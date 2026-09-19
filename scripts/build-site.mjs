#!/usr/bin/env node
/**
 * Build the site for GitHub Pages: website/ is hand-authored static content,
 * so the build is an assembly step. It copies website/ to _site/, adds
 * .nojekyll (serve the files as they are), and drops the CNAME file while it
 * still holds the placeholder, so a placeholder domain is never published.
 *
 * Run from the repo root: node scripts/build-site.mjs
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SRC = "website";
const OUT = "_site";
export const CNAME_PLACEHOLDER = "your-domain.example";

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true });
writeFileSync(join(OUT, ".nojekyll"), "");

const cname = join(OUT, "CNAME");
if (existsSync(cname)) {
  const domain = readFileSync(cname, "utf-8").trim();
  if (domain === "" || domain === CNAME_PLACEHOLDER) {
    rmSync(cname);
    console.log(`  CNAME still holds the placeholder: left out of the build`);
  } else {
    console.log(`  CNAME: ${domain}`);
  }
}

if (!existsSync(join(OUT, "index.html"))) {
  console.error(`✗ ${OUT}/index.html is missing: nothing to publish`);
  process.exit(1);
}
console.log(`✓ site built to ${OUT}/: ${readdirSync(OUT).sort().join(", ")}`);
