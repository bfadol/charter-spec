#!/usr/bin/env node
/**
 * The site's deploy gate. Runs in this repository's Pages workflow and blocks
 * the deploy unless the site's Status claims are backed.
 *
 * Most Status claims are evidenced by artifacts in the platform's codebase,
 * which this repository cannot see. So the gate has two halves:
 *
 *   1. LOCAL. Everything that can be verified from this tree is verified
 *      here: the page and the map agree one-to-one per column, and every
 *      path-evidenced claim whose evidence lives in this repository has all
 *      of its evidence present. A claim is local when at least one of its
 *      evidence paths exists here; then every one of them must.
 *
 *   2. ATTESTED. The platform runs the full check against its own tree and
 *      commits the result here as website/status-attestation.json. The gate
 *      requires that record to exist, to be under 7 days old, to cover exactly
 *      the claims in the current map, and to show every one of them passing.
 *
 * Evidence commands in the map are never executed here: they are written for
 * the platform's tree, and their results arrive through the attestation.
 *
 * Run from the repo root: node scripts/verify-site-status.mjs
 * Exits 1 naming every problem.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { pageClaims } from "./check-status-claims.mjs";

const HTML_PATH = "website/index.html";
const MAP_PATH = "website/status-map.json";
const ATTESTATION_PATH = "website/status-attestation.json";

export const MAX_ATTESTATION_AGE_DAYS = 7;
/** Tolerated clock skew for a timestamp that reads as slightly in the future. */
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Page and map must list the same claims, one-to-one per column. */
export function pageMapProblems(page, map, mapPath = MAP_PATH) {
  const problems = [];
  for (const status of ["shipped", "in-progress"]) {
    const mapped = map.claims.filter((c) => c.status === status);
    for (const entry of mapped) {
      const hits = page[status].filter((li) => li.includes(entry.claim));
      if (hits.length === 0) {
        problems.push(`mapped ${status} claim "${entry.claim}" is not on the page's ${status} list`);
      } else if (hits.length > 1) {
        problems.push(`mapped ${status} claim "${entry.claim}" matches ${hits.length} page items: ambiguous`);
      }
    }
    for (const li of page[status]) {
      if (!mapped.some((entry) => li.includes(entry.claim))) {
        problems.push(`page ${status} claim "${li.slice(0, 70)}…" has no mapping entry in ${mapPath}`);
      }
    }
    if (mapped.length !== page[status].length) {
      problems.push(`${status}: page lists ${page[status].length} claim(s), mapping has ${mapped.length}: one-to-one required`);
    }
  }
  return problems;
}

/**
 * Verify the claims whose evidence lives in this repository. Returns the
 * claims verified here and any problems; every other claim is left to the
 * attestation.
 */
export function localClaimResults(map, cwd = process.cwd()) {
  const verified = [];
  const problems = [];
  for (const entry of map.claims) {
    const paths = entry.verify?.paths;
    if (!paths || entry.status !== "shipped") continue;
    const missing = paths.filter((p) => !existsSync(resolve(cwd, p)));
    if (missing.length === paths.length) continue; // evidence lives in the platform
    verified.push(entry.claim);
    if (missing.length > 0) {
      problems.push(`shipped claim "${entry.claim}" is evidenced in this repository but is missing: ${missing.join(", ")}`);
    }
  }
  return { verified, problems };
}

/** The attestation must be fresh, complete for the current map, and all-passing. */
export function attestationProblems(attestation, map, now = new Date()) {
  const problems = [];
  if (attestation === null || typeof attestation !== "object") return ["attestation is not a JSON object"];
  if (attestation.schema !== 1) problems.push(`unsupported attestation schema: ${JSON.stringify(attestation.schema)}`);
  if (!/^[0-9a-f]{40}$/.test(attestation.platformCommit ?? "")) {
    problems.push("attestation carries no full platform commit hash");
  }

  const at = Date.parse(attestation.generatedAt);
  if (typeof attestation.generatedAt !== "string" || !attestation.generatedAt.endsWith("Z") || Number.isNaN(at)) {
    problems.push(`attestation timestamp is not a UTC ISO time: ${JSON.stringify(attestation.generatedAt)}`);
  } else {
    const age = now.getTime() - at;
    if (age >= MAX_ATTESTATION_AGE_DAYS * DAY_MS) {
      problems.push(
        `attestation is ${(age / DAY_MS).toFixed(1)} days old (generated ${attestation.generatedAt}); it must be under ${MAX_ATTESTATION_AGE_DAYS} days`,
      );
    } else if (age < -MAX_FUTURE_SKEW_MS) {
      problems.push(`attestation is dated in the future: ${attestation.generatedAt}`);
    }
  }

  const attested = Array.isArray(attestation.claims) ? attestation.claims : [];
  if (!Array.isArray(attestation.claims)) problems.push("attestation lists no claims");
  for (const entry of map.claims) {
    const hits = attested.filter((c) => c.claim === entry.claim && c.status === entry.status);
    if (hits.length === 0) {
      problems.push(`${entry.status} claim "${entry.claim}" is in the map but not in the attestation: the platform has not attested the current map`);
    } else if (hits.some((c) => c.pass !== true)) {
      const detail = hits.find((c) => c.pass !== true)?.detail;
      problems.push(`${entry.status} claim "${entry.claim}" is attested as failing${detail ? `: ${detail}` : ""}`);
    }
  }
  for (const c of attested) {
    if (!map.claims.some((entry) => entry.claim === c.claim && entry.status === c.status)) {
      problems.push(`attested ${c.status} claim "${c.claim}" is not in the map: the attestation is for a different map`);
    }
  }
  if (Array.isArray(attestation.pageMapFailures) && attestation.pageMapFailures.length > 0) {
    problems.push(`attestation records page/map drift: ${attestation.pageMapFailures.join("; ")}`);
  }
  if (attestation.allPassed !== true) problems.push("attestation does not record allPassed: true");
  return problems;
}

/** Run the whole gate. Returns every problem (empty = deploy may proceed). */
export function verifySiteStatus({
  htmlPath = HTML_PATH,
  mapPath = MAP_PATH,
  attestationPath = ATTESTATION_PATH,
  cwd = process.cwd(),
  now = new Date(),
} = {}) {
  const map = JSON.parse(readFileSync(resolve(cwd, mapPath), "utf-8"));
  const page = pageClaims(readFileSync(resolve(cwd, htmlPath), "utf-8"), htmlPath);
  const local = localClaimResults(map, cwd);
  const problems = [...pageMapProblems(page, map, mapPath), ...local.problems];

  let attestation = null;
  const file = resolve(cwd, attestationPath);
  if (!existsSync(file)) {
    problems.push(`${attestationPath} does not exist: the platform has not attested the Status claims`);
  } else {
    try {
      attestation = JSON.parse(readFileSync(file, "utf-8"));
      problems.push(...attestationProblems(attestation, map, now));
    } catch (err) {
      problems.push(`${attestationPath} is not valid JSON: ${err.message}`);
    }
  }
  return { problems, verifiedLocally: local.verified, total: map.claims.length, attestation };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { problems, verifiedLocally, total, attestation } = verifySiteStatus();
  console.log(`  local:    page and map compared; ${verifiedLocally.length} claim(s) evidenced in this repository:`);
  for (const claim of verifiedLocally) console.log(`              ${claim}`);
  if (attestation?.platformCommit) {
    console.log(`  attested: ${total} claim(s) by platform ${String(attestation.platformCommit).slice(0, 12)} at ${attestation.generatedAt}`);
  }
  if (problems.length > 0) {
    console.error(`\n✗ Site status is not backed; the deploy is blocked (${problems.length} problem(s)):`);
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
  console.log(`\n✓ all ${total} Status claims backed: local evidence present, attestation fresh and passing.`);
}
