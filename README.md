# charter-spec

The charter contract.

A **charter** (`charter.yaml`) is a machine-validated declaration an
application carries: what it is, who answers for it, what it depends on, what
data it touches and at what sensitivity, which external systems it reaches,
and how it was generated. This repository holds the contract itself and the
public site that describes it:

- the **schema** that defines a valid charter,
- the **validator** that checks a declaration at authoring time,
- the **validator's tests**, which pin the contract's behaviour,
- the **site** and the **status check** that keeps the site's claims honest.

## The platform is separate

The Charter platform, which generates applications that carry a charter and
gates them against this contract, is a separate, private codebase. It is not
in this repository and is not needed to read, validate, or test a charter.
The platform depends on this repository for the schema; nothing here depends
on the platform.

The file layout under `packages/platform/src/` mirrors the platform's own
layout on purpose, so that the contract files are the same files in both
places rather than a translated copy.

## Layout

```
packages/platform/src/
  lifecycle/validator.ts            The schema and validateAppMetadata()
  lifecycle/capability-config.ts    Registry of declarable shared-capability config
  lifecycle/integration-config.ts   Declared external systems
  lifecycle/types.ts                Types for the declaration
  cache/config-schema.ts            Pinned config schema: cache
  feature-flags/config-schema.ts    Pinned config schema: feature flags
  data/config-schema.ts             Pinned config schema: data access
  **/*.test.ts                      The tests that pin all of the above
scripts/check-status-claims.mjs     The site's status check
website/                            The site, and the map of each status claim to its evidence
```

## Validate a charter

The validator takes an already-parsed object; any YAML parser will do for
getting from `charter.yaml` to that object.

```ts
import { validateAppMetadata } from "./packages/platform/src/lifecycle/validator.js";

// `charter` is the parsed content of a charter.yaml
const result = validateAppMetadata(charter);
if (!result.valid) {
  for (const e of result.errors) console.error(`${e.field}: ${e.message}`);
}
```

The validator collects every error before returning rather than stopping at
the first. It never reads files and never reaches the network: checks that
need either (does a referenced run report exist, is a review date current)
belong to the platform's gates, not to the schema.

## Run the tests

Requires Node.js 22.5 or later and pnpm 10 or later.

```bash
pnpm install
pnpm test
pnpm typecheck
```

## Use it as a dependency

`pnpm build` compiles the contract to `dist/`; installing this repository as a
git dependency builds it the same way. Modules are addressed by their path
under `packages/platform/src/`, without the extension:

```ts
import { validateAppMetadata } from "charter-spec/lifecycle/validator";
import { cacheConfigSchema } from "charter-spec/cache/config-schema";
```

## The site's status claims

`website/index.html` is hand-authored. Every claim in its Status section maps,
in `website/status-map.json`, to evidence that can be checked mechanically: a
claim under Shipped must have its evidence present, and a claim under In
progress must have its evidence absent. Every entry names the repository its
evidence lives in: `spec` (here) or `platform`. Spec claims are verified
against this tree before every deploy. Platform claims are verified by the
platform against its own tree, and the result arrives here as
`website/status-attestation.json`; the deploy is blocked unless that record is
under 7 days old, covers exactly the current map, and shows every claim
passing.

## License

Apache-2.0. See [LICENSE](LICENSE).
