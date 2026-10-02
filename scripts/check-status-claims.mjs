#!/usr/bin/env node
/**
 * Status anti-drift check: the website's Status section must not claim
 * anything the repo cannot back, and must not understate what has shipped.
 *
 * The page (website/index.html) stays hand-authored; website/status-map.json
 * polices it. For every mapping entry:
 *   - shipped:     every listed path exists / the command exits zero
 *   - in-progress: verified as NOT shipped — every listed path is absent /
 *                  the command exits non-zero
 * And the mapping must match the page one-to-one per column: a claim on the
 * page with no mapping entry (or vice versa) is drift.
 *
 * Every entry names the repository its evidence lives in: "repo": "spec"
 * (this repository: the contract and the site), "repo": "platform" (the
 * platform's codebase) or "repo": "record" (the maintainers' engineering
 * record: findings and pilot records). Evidence paths and commands are
 * relative to that repository's root. A claim whose evidence spans
 * repositories adds further parts under "also", each naming its own repo;
 * every part must hold. The page and the map are the spec's, so they are
 * read from the spec root. Run where every tree is reachable, from the
 * platform root, naming where the others live:
 *   node <spec>/scripts/check-status-claims.mjs --spec-root <spec> --record-root <record>
 * Without --spec-root the spec root is the working directory. A record part
 * with no --record-root, or with a root that does not exist, FAILS: evidence
 * that cannot be reached is never skipped and absence is never assumed.
 * Exits 1 naming every diverged claim.
 */
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HTML_PATH = "website/index.html";
const MAP_PATH = "website/status-map.json";

/** The repositories a claim's evidence can live in. */
export const REPOS = ["spec", "platform", "record"];

/** REPOS as prose for error messages: "spec", "platform" or "record". */
export const REPO_NAMES = `${REPOS.slice(0, -1).map((r) => `"${r}"`).join(", ")} or "${REPOS.at(-1)}"`;

/**
 * An entry's evidence parts: the entry's own repo + verify first, then any
 * "also" parts. Each part is { repo, paths?, command? }.
 */
export function entryParts(entry) {
  const also = entry.also === undefined ? [] : entry.also;
  if (!Array.isArray(also)) return null;
  return [{ repo: entry.repo, ...(entry.verify ?? {}) }, ...also];
}

const stripTags = (s) => s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

/** Extract the Status section's claims per column from the hand-authored page. */
export function pageClaims(html, htmlPath = HTML_PATH) {
  const section = /<section id="status">([\s\S]*?)<\/section>/.exec(html)?.[1];
  if (!section) throw new Error(`${htmlPath}: no <section id="status"> found`);
  const columns = { shipped: [], "in-progress": [] };
  const chunks = section.split(/class="status-col /).slice(1);
  for (const chunk of chunks) {
    const key = chunk.startsWith("shipped") ? "shipped" : chunk.startsWith("progress") ? "in-progress" : null;
    if (!key) continue;
    for (const [, li] of chunk.matchAll(/<li>([\s\S]*?)<\/li>/g)) {
      columns[key].push(stripTags(li));
    }
  }
  return columns;
}

/**
 * One evidence part's verdict against one repository root. shipped: every
 * path exists / the command exits zero. in-progress: verified as NOT
 * shipped — every path is absent / the command exits non-zero; an artifact
 * that exists turns the claim red.
 */
export function partVerdict(part, status, root) {
  const exists = (p) => existsSync(resolve(root, p));
  if (part.paths) {
    const present = part.paths.filter(exists);
    if (status === "shipped") {
      const missing = part.paths.filter((p) => !exists(p));
      return missing.length === 0
        ? { ok: true }
        : { ok: false, detail: `missing artifact(s): ${missing.join(", ")}` };
    }
    // in-progress: every artifact must be absent
    return present.length === 0
      ? { ok: true }
      : { ok: false, detail: `artifact(s) already exist: ${present.join(", ")} — the claim may belong under Shipped` };
  }
  if (part.command) {
    let exitZero = true;
    try {
      execSync(part.command, { stdio: "pipe", cwd: root });
    } catch {
      exitZero = false;
    }
    if (status === "shipped") {
      return exitZero ? { ok: true } : { ok: false, detail: `command failed: ${part.command}` };
    }
    return exitZero
      ? { ok: false, detail: `command unexpectedly succeeds: ${part.command} — the claim may belong under Shipped` }
      : { ok: true };
  }
  return { ok: false, detail: "mapping entry has neither paths nor command" };
}

/**
 * One entry's verdict: every evidence part must hold, each against the root
 * of the repository it names. A part whose repository root was not given, or
 * does not exist, fails by name: a missing tree would otherwise make every
 * in-progress (absence) claim pass without having looked.
 */
export function verdict(entry, cwd = process.cwd(), specRoot = cwd, recordRoot = undefined) {
  const parts = entryParts(entry);
  if (parts === null) return { ok: false, detail: `"also" must be a list of evidence parts` };
  const roots = { spec: specRoot, platform: cwd, record: recordRoot };
  const details = [];
  for (const part of parts) {
    if (part === null || typeof part !== "object" || !REPOS.includes(part.repo)) {
      details.push(`mapping entry must name its repo (${REPO_NAMES}), got ${JSON.stringify(part?.repo)}`);
      continue;
    }
    const given = roots[part.repo];
    if (given === undefined) {
      details.push(`evidence lives in the ${part.repo} repository and no ${part.repo} root was given (--${part.repo}-root <dir>): not verified, never skipped`);
      continue;
    }
    const root = resolve(given);
    if (!existsSync(root)) {
      details.push(`the ${part.repo} root does not exist: ${root}`);
      continue;
    }
    const v = partVerdict(part, entry.status, root);
    if (!v.ok) details.push(parts.length > 1 ? `[${part.repo}] ${v.detail}` : v.detail);
  }
  return details.length === 0 ? { ok: true } : { ok: false, detail: details.join("; ") };
}

/**
 * Run the whole check. Returns every diverged claim (empty = green) and the
 * per-entry lines the CLI prints. Pure with respect to process state so it
 * can be tested against fixture pages and maps.
 */
export function checkStatusClaims({
  htmlPath = HTML_PATH,
  mapPath = MAP_PATH,
  cwd = process.cwd(),
  specRoot = cwd,
  recordRoot = undefined,
} = {}) {
  // The page and the map are the spec's own files.
  const html = readFileSync(resolve(specRoot, htmlPath), "utf-8");
  const map = JSON.parse(readFileSync(resolve(specRoot, mapPath), "utf-8"));
  const page = pageClaims(html, htmlPath);
  const failures = [];
  const lines = [];

  // 1. Bidirectional completeness: mapping ↔ page, per column.
  for (const status of ["shipped", "in-progress"]) {
    const mapped = map.claims.filter((c) => c.status === status);
    for (const entry of mapped) {
      const hits = page[status].filter((li) => li.includes(entry.claim));
      if (hits.length === 0) {
        failures.push(
          `mapped ${status} claim "${entry.claim}" is not on the page's ${status} list — page and mapping have diverged`,
        );
      } else if (hits.length > 1) {
        failures.push(`mapped ${status} claim "${entry.claim}" matches ${hits.length} page items — ambiguous`);
      }
    }
    for (const li of page[status]) {
      if (!mapped.some((entry) => li.includes(entry.claim))) {
        failures.push(
          `page ${status} claim "${li.slice(0, 70)}…" has no mapping entry in ${mapPath} — unverifiable claims cannot ship`,
        );
      }
    }
    if (mapped.length !== page[status].length) {
      failures.push(
        `${status}: page lists ${page[status].length} claim(s), mapping has ${mapped.length} — one-to-one required`,
      );
    }
  }

  // 2. Artifact verification per entry.
  for (const entry of map.claims) {
    const v = verdict(entry, cwd, specRoot, recordRoot);
    const label = `${entry.status.padEnd(11)} ${entry.claim}`;
    if (v.ok) {
      lines.push(`  ✓ ${label}`);
    } else {
      lines.push(`  ✗ ${label}`);
      failures.push(`${entry.status} claim "${entry.claim}" diverged: ${v.detail}`);
    }
  }
  return { failures, lines, total: map.claims.length };
}

// CLI entry: prints every entry, exits 1 naming every diverged claim.
// realpath: a package manager may install this file behind a symlink, and a
// symlinked argv[1] would never equal import.meta.url: the CLI would exit 0
// having checked nothing.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(resolve(process.argv[1]))).href) {
  const flag = (name) => {
    const i = process.argv.indexOf(name);
    if (i === -1) return undefined;
    if (!process.argv[i + 1]) {
      console.error("usage: check-status-claims.mjs [--spec-root <dir>] [--record-root <dir>]");
      process.exit(2);
    }
    return process.argv[i + 1];
  };
  const specRoot = flag("--spec-root");
  const recordRoot = flag("--record-root");
  const { failures, lines, total } = checkStatusClaims({ specRoot, recordRoot });
  for (const l of lines) console.log(l);
  if (failures.length > 0) {
    console.error(`\n✗ Status section has diverged from the repo (${failures.length} problem(s)):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ all ${total} Status claims verified against repo artifacts.`);
}
