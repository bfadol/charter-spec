import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { verifySiteStatus } from "../../../../scripts/verify-site-status.mjs";

/**
 * The site's deploy gate (scripts/verify-site-status.mjs), pinned: claims
 * evidenced in this repository are verified here; everything else must arrive
 * through a platform attestation that exists, is under 7 days old, covers
 * exactly the current map, and shows every claim passing.
 */
const NOW = new Date("2026-09-19T12:00:00Z");
const COMMIT = "b".repeat(40);
const MAP = {
  claims: [
    { claim: "Schema", status: "shipped", verify: { paths: ["spec/schema.ts", "spec/registry.ts"] } },
    { claim: "Pipeline", status: "shipped", verify: { command: "exit 1" } },
    { claim: "Live operation", status: "in-progress", verify: { paths: ["platform/live"] } },
  ],
};
const passing = (generatedAt: string, claims: Array<{ claim: string; status: string }> = MAP.claims) => ({
  schema: 1,
  platformCommit: COMMIT,
  generatedAt,
  allPassed: true,
  total: claims.length,
  claims: claims.map((c) => ({ claim: c.claim, status: c.status, pass: true })),
  pageMapFailures: [],
});

function fixture(opts: { attestation?: unknown; specFiles?: string[]; shipped?: string[] }) {
  const dir = mkdtempSync(join(tmpdir(), "site-status-"));
  const li = (title: string) => `<li><div>${title}<span>detail</span></div></li>`;
  const html = `<html><body><section id="status"><div class="wrap">
<div class="status-col shipped"><h4>Shipped</h4><ul>${(opts.shipped ?? ["Schema", "Pipeline"]).map(li).join("\n")}</ul></div>
<div class="status-col progress"><h4>In progress</h4><ul>${li("Live operation")}</ul></div>
</div></section></body></html>`;
  mkdirSync(join(dir, "website"));
  mkdirSync(join(dir, "spec"));
  writeFileSync(join(dir, "website", "index.html"), html);
  writeFileSync(join(dir, "website", "status-map.json"), JSON.stringify(MAP));
  for (const f of opts.specFiles ?? ["spec/schema.ts", "spec/registry.ts"]) writeFileSync(join(dir, f), "export {};");
  if (opts.attestation !== undefined) {
    writeFileSync(join(dir, "website", "status-attestation.json"), JSON.stringify(opts.attestation));
  }
  return dir;
}

describe("site deploy gate", () => {
  it("passes on local evidence plus a fresh, complete, all-passing attestation, without running map commands", () => {
    const dir = fixture({ attestation: passing("2026-09-18T12:00:00Z") });
    const { problems, verifiedLocally } = verifySiteStatus({ cwd: dir, now: NOW });
    // "Pipeline" maps to a command that exits 1: a pass here proves it was never executed.
    expect(problems).toEqual([]);
    expect(verifiedLocally).toEqual(["Schema"]);
  });

  it("NEGATIVE: no attestation blocks the deploy", () => {
    const { problems } = verifySiteStatus({ cwd: fixture({}), now: NOW });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/status-attestation\.json does not exist/);
  });

  it("NEGATIVE: an attestation exactly 7 days old is stale; one second younger is fresh", () => {
    const stale = verifySiteStatus({ cwd: fixture({ attestation: passing("2026-09-12T12:00:00Z") }), now: NOW });
    expect(stale.problems).toHaveLength(1);
    expect(stale.problems[0]).toMatch(/7\.0 days old .* must be under 7 days/);
    const fresh = verifySiteStatus({ cwd: fixture({ attestation: passing("2026-09-12T12:00:01Z") }), now: NOW });
    expect(fresh.problems).toEqual([]);
  });

  it("NEGATIVE: a future-dated or non-UTC timestamp blocks the deploy", () => {
    const future = verifySiteStatus({ cwd: fixture({ attestation: passing("2026-09-20T12:00:00Z") }), now: NOW });
    expect(future.problems[0]).toMatch(/dated in the future/);
    const local = verifySiteStatus({ cwd: fixture({ attestation: passing("2026-09-19T12:00:00+03:00") }), now: NOW });
    expect(local.problems[0]).toMatch(/not a UTC ISO time/);
  });

  it("NEGATIVE: one attested failure blocks the deploy and names the claim", () => {
    const a = passing("2026-09-19T11:00:00Z");
    a.claims[1] = { ...a.claims[1], pass: false, detail: "command failed: exit 1" } as (typeof a.claims)[number];
    a.allPassed = false;
    const { problems } = verifySiteStatus({ cwd: fixture({ attestation: a }), now: NOW });
    expect(problems.some((p) => /claim "Pipeline" is attested as failing: command failed: exit 1/.test(p))).toBe(true);
  });

  it("NEGATIVE: an attestation claiming allPassed over a failing claim is not believed", () => {
    const a = passing("2026-09-19T11:00:00Z");
    a.claims[1] = { ...a.claims[1], pass: false };
    const { problems } = verifySiteStatus({ cwd: fixture({ attestation: a }), now: NOW });
    expect(problems.some((p) => /"Pipeline" is attested as failing/.test(p))).toBe(true);
  });

  it("NEGATIVE: an attestation for a different map blocks the deploy, in both directions", () => {
    const missing = passing("2026-09-19T11:00:00Z", MAP.claims.slice(0, 2));
    expect(verifySiteStatus({ cwd: fixture({ attestation: missing }), now: NOW }).problems).toEqual([
      expect.stringMatching(/"Live operation" is in the map but not in the attestation/),
    ]);
    const extra = passing("2026-09-19T11:00:00Z", [...MAP.claims, { claim: "Retired", status: "shipped" }]);
    expect(verifySiteStatus({ cwd: fixture({ attestation: extra }), now: NOW }).problems).toEqual([
      expect.stringMatching(/attested shipped claim "Retired" is not in the map/),
    ]);
  });

  it("NEGATIVE: local evidence partly missing blocks the deploy even under a passing attestation", () => {
    const dir = fixture({ attestation: passing("2026-09-19T11:00:00Z"), specFiles: ["spec/schema.ts"] });
    const { problems } = verifySiteStatus({ cwd: dir, now: NOW });
    expect(problems).toEqual([expect.stringMatching(/"Schema" is evidenced in this repository but is missing: spec\/registry\.ts/)]);
  });

  it("NEGATIVE: a page claim with no mapping entry blocks the deploy", () => {
    const dir = fixture({ attestation: passing("2026-09-19T11:00:00Z"), shipped: ["Schema", "Pipeline", "Unmapped"] });
    const { problems } = verifySiteStatus({ cwd: dir, now: NOW });
    expect(problems.some((p) => /has no mapping entry/.test(p))).toBe(true);
    expect(problems.some((p) => /one-to-one required/.test(p))).toBe(true);
  });
});
