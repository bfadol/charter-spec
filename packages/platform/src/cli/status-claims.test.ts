import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkStatusClaims } from "../../../../scripts/check-status-claims.mjs";

/**
 * The website anti-drift check (scripts/check-status-claims.mjs), pinned:
 * shipped = every mapped artifact exists; in-progress = verified as NOT
 * shipped, so an artifact that exists turns the claim red (the 2026-09-12
 * stale-line finding: a pending part that was never mapped passed green).
 */

function fixture(opts: { shipped: Array<[string, string]>; progress: Array<[string, string]>; map: unknown }) {
  const dir = mkdtempSync(join(tmpdir(), "status-claims-"));
  const li = ([title, sub]: [string, string]) => `<li><div>${title}<span>${sub}</span></div></li>`;
  const html = `<html><body><section id="status"><div class="wrap">
<div class="status-col shipped"><h4>Shipped</h4><ul>${opts.shipped.map(li).join("\n")}</ul></div>
<div class="status-col progress"><h4>In progress</h4><ul>${opts.progress.map(li).join("\n")}</ul></div>
</div></section></body></html>`;
  writeFileSync(join(dir, "index.html"), html);
  writeFileSync(join(dir, "status-map.json"), JSON.stringify(opts.map));
  return dir;
}

describe("status anti-drift check", () => {
  it("NEGATIVE: an in-progress claim whose mapped artifact exists turns the check red", () => {
    const dir = fixture({
      shipped: [],
      progress: [["Live operation", "not yet demonstrated"]],
      map: { claims: [{ claim: "Live operation", status: "in-progress", repo: "platform", verify: { paths: ["evidence/live"] } }] },
    });
    mkdirSync(join(dir, "evidence", "live"), { recursive: true }); // the pending part has shipped
    const { failures } = checkStatusClaims({ htmlPath: "index.html", mapPath: "status-map.json", cwd: dir });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/in-progress claim "Live operation" diverged: artifact\(s\) already exist: evidence\/live/);
  });

  it("NEGATIVE: an in-progress claim whose verify command succeeds turns the check red", () => {
    const dir = fixture({
      shipped: [],
      progress: [["Live operation", "not yet demonstrated"]],
      map: { claims: [{ claim: "Live operation", status: "in-progress", repo: "platform", verify: { command: "true" } }] },
    });
    const { failures } = checkStatusClaims({ htmlPath: "index.html", mapPath: "status-map.json", cwd: dir });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/command unexpectedly succeeds/);
  });

  it("NEGATIVE: a shipped claim with a missing artifact turns the check red", () => {
    const dir = fixture({
      shipped: [["Regeneration lineage", "demonstrated"]],
      progress: [],
      map: { claims: [{ claim: "Regeneration lineage", status: "shipped", repo: "platform", verify: { paths: ["evidence/regen.md"] } }] },
    });
    const { failures } = checkStatusClaims({ htmlPath: "index.html", mapPath: "status-map.json", cwd: dir });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/shipped claim "Regeneration lineage" diverged: missing artifact\(s\): evidence\/regen.md/);
  });

  it("NEGATIVE: a page claim with no mapping entry cannot ship", () => {
    const dir = fixture({
      shipped: [["Mapped", "ok"], ["Unmapped", "no entry"]],
      progress: [],
      map: { claims: [{ claim: "Mapped", status: "shipped", repo: "platform", verify: { command: "true" } }] },
    });
    const { failures } = checkStatusClaims({ htmlPath: "index.html", mapPath: "status-map.json", cwd: dir });
    expect(failures.some((f) => /has no mapping entry/.test(f))).toBe(true);
    expect(failures.some((f) => /one-to-one required/.test(f))).toBe(true);
  });

  it("NEGATIVE: a mapping entry that does not name its repo fails by name", () => {
    const dir = fixture({
      shipped: [["Unplaced", "evidence exists, repo unnamed"]],
      progress: [],
      map: { claims: [{ claim: "Unplaced", status: "shipped", verify: { command: "true" } }] },
    });
    const { failures } = checkStatusClaims({ htmlPath: "index.html", mapPath: "status-map.json", cwd: dir });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/shipped claim "Unplaced" diverged: mapping entry must name its repo \("spec" or "platform"\), got undefined/);
  });

  it("spec claims resolve against the spec root and platform claims against the working tree", () => {
    // The page and the map are the spec's: they are read from the spec root.
    const spec = fixture({
      shipped: [["Schema", "in the spec"], ["Pipeline", "in the platform"]],
      progress: [],
      map: {
        claims: [
          { claim: "Schema", status: "shipped", repo: "spec", verify: { paths: ["contract/schema.ts"] } },
          { claim: "Pipeline", status: "shipped", repo: "platform", verify: { command: "test -f cli/pipeline.ts" } },
        ],
      },
    });
    const platform = mkdtempSync(join(tmpdir(), "status-claims-platform-"));
    mkdirSync(join(spec, "contract"));
    writeFileSync(join(spec, "contract", "schema.ts"), "export {};");
    mkdirSync(join(platform, "cli"));
    writeFileSync(join(platform, "cli", "pipeline.ts"), "export {};");
    const opts = { htmlPath: "index.html", mapPath: "status-map.json" };
    expect(checkStatusClaims({ ...opts, cwd: platform, specRoot: spec }).failures).toEqual([]);

    // NEGATIVE: run from the spec tree alone, the platform claim's evidence is not there.
    const specOnly = checkStatusClaims({ ...opts, cwd: spec, specRoot: spec });
    expect(specOnly.failures).toEqual([expect.stringMatching(/shipped claim "Pipeline" diverged: command failed/)]);
  });

  it("the shipped and in-progress verdicts pass when the tree matches the map", () => {
    const dir = fixture({
      shipped: [["Regeneration lineage", "demonstrated"]],
      progress: [["Live operation", "not yet demonstrated"]],
      map: {
        claims: [
          { claim: "Regeneration lineage", status: "shipped", repo: "platform", verify: { paths: ["evidence/regen.md"] } },
          { claim: "Live operation", status: "in-progress", repo: "platform", verify: { paths: ["evidence/live"] } },
        ],
      },
    });
    mkdirSync(join(dir, "evidence"));
    writeFileSync(join(dir, "evidence", "regen.md"), "record");
    const { failures, lines } = checkStatusClaims({ htmlPath: "index.html", mapPath: "status-map.json", cwd: dir });
    expect(failures).toEqual([]);
    expect(lines).toEqual(["  ✓ shipped     Regeneration lineage", "  ✓ in-progress Live operation"]);
  });
});
