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
 * Run from the repo root: node scripts/check-status-claims.mjs
 * Exits 1 naming every diverged claim.
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const HTML_PATH = "website/index.html";
const MAP_PATH = "website/status-map.json";

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
 * One entry's verdict. shipped: every path exists / the command exits zero.
 * in-progress: verified as NOT shipped — every path is absent / the command
 * exits non-zero; an artifact that exists turns the claim red.
 */
export function verdict(entry, cwd = process.cwd()) {
  const { verify, status } = entry;
  const exists = (p) => existsSync(resolve(cwd, p));
  if (verify.paths) {
    const present = verify.paths.filter(exists);
    if (status === "shipped") {
      const missing = verify.paths.filter((p) => !exists(p));
      return missing.length === 0
        ? { ok: true }
        : { ok: false, detail: `missing artifact(s): ${missing.join(", ")}` };
    }
    // in-progress: every artifact must be absent
    return present.length === 0
      ? { ok: true }
      : { ok: false, detail: `artifact(s) already exist: ${present.join(", ")} — the claim may belong under Shipped` };
  }
  if (verify.command) {
    let exitZero = true;
    try {
      execSync(verify.command, { stdio: "pipe", cwd });
    } catch {
      exitZero = false;
    }
    if (status === "shipped") {
      return exitZero ? { ok: true } : { ok: false, detail: `command failed: ${verify.command}` };
    }
    return exitZero
      ? { ok: false, detail: `command unexpectedly succeeds: ${verify.command} — the claim may belong under Shipped` }
      : { ok: true };
  }
  return { ok: false, detail: "mapping entry has neither paths nor command" };
}

/**
 * Run the whole check. Returns every diverged claim (empty = green) and the
 * per-entry lines the CLI prints. Pure with respect to process state so it
 * can be tested against fixture pages and maps.
 */
export function checkStatusClaims({ htmlPath = HTML_PATH, mapPath = MAP_PATH, cwd = process.cwd() } = {}) {
  const html = readFileSync(resolve(cwd, htmlPath), "utf-8");
  const map = JSON.parse(readFileSync(resolve(cwd, mapPath), "utf-8"));
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
    const v = verdict(entry, cwd);
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

// CLI entry — unchanged behaviour: prints every entry, exits 1 naming every diverged claim.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const { failures, lines, total } = checkStatusClaims();
  for (const l of lines) console.log(l);
  if (failures.length > 0) {
    console.error(`\n✗ Status section has diverged from the repo (${failures.length} problem(s)):`);
    for (const f of failures) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`\n✓ all ${total} Status claims verified against repo artifacts.`);
}
