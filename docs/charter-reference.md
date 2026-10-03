# Charter field reference

What each field of `charter.yaml` means. The schema is the authority:
`packages/platform/src/lifecycle/validator.ts` and the files it imports
(`capability-config.ts`, `integration-config.ts`, and the three config schemas
under `cache/`, `feature-flags/` and `data/`). Where this file and the schema
differ, the schema is right and this file is wrong.

Written against charter-spec v0.3.0. Terms are defined in
[glossary.md](glossary.md); the codes named here are listed in
[conformance-codes.md](conformance-codes.md).

## How the schema treats fields

* The top-level object is not strict. A field the schema does not define is
  dropped during validation, not rejected: a misspelled or invented top-level
  field passes `charter validate` silently.
* The `capabilities` block, each capability's config, and each `integrations`
  entry are strict: an unknown field there is an error.
* The schema reads no files and reaches no network. Checks that need either
  (a registered owner, a review date in the past, a run report that resolves)
  belong to the platform's `charter check`.

## Who supplies a field

| Source | Fields |
|---|---|
| A person's answer (principle 6) | `dataPattern.ownership`, `dataPattern.residency`, `dataPattern.classification`, `accountability`, `integrations` |
| The author of the spec | `name`, `owner`, `domainBoundary`, `dependencies`, the rest of `dataPattern`, `capabilities` |
| The harness, at generation | `provenance` |

On the supported path these are concluded with a person during translation;
the harness stamps `accountability` and `integrations` from the recorded
answers. The schema checks the shape of these fields, not where they came
from, and neither do the platform's gates yet.

## Top-level fields

| Field | Required | Value |
|---|---|---|
| `name` | yes | Non-empty string. The app's name. |
| `owner` | yes | Non-empty string. The authoring team. Distinct from `accountability.owner`. |
| `accountability` | yes | See below. |
| `domainBoundary` | yes | Non-empty string. The business domain the app serves. |
| `runtimePattern` | yes | `api`, `worker` or `both`. |
| `dependencies` | yes | A list, possibly empty. See below. |
| `dataPattern` | yes | See below. |
| `lifecycle` | yes | `active`, `review` or `archived`. |
| `aiGenerated` | no | Boolean. Anything that is not a boolean, or a missing value, is read as `false`; it is never an error. |
| `aiTools` | no | List of strings. Defaults to an empty list. |
| `capabilities` | no | See below. |
| `integrations` | no | See below. |
| `provenance` | no | See below. Absent on a hand-written app. |

## accountability

Who answers for the running app.

| Field | Required | Value |
|---|---|---|
| `owner` | yes | Non-empty string. A named organizational unit. `charter check` resolves it against the platform's owner registry: an unregistered unit fails (`OWNER_UNREGISTERED`), and so does the template placeholder outside a template (`OWNER_PLACEHOLDER`). |
| `reviewBy` | yes | ISO date, `YYYY-MM-DD`. The date by which the charter is re-reviewed. A date before today fails `charter check` (`REVIEW_BY_EXPIRED`). The schema checks only the shape. |

## dependencies

Each entry:

| Field | Required | Value |
|---|---|---|
| `name` | yes | Non-empty string. |
| `type` | yes | Non-empty string. Free text. |
| `critical` | yes | Boolean. |

External systems the app calls are declared in `integrations`, which is what
`charter check` verifies against the code.

## dataPattern

| Field | Required | Value |
|---|---|---|
| `storage` | yes | One of `azure-sql`, `cosmos`, `blob`, `postgres`, `none`. |
| `ownership` | yes | `own` or `consume`. `consume` is the default posture. |
| `classification` | yes | `public`, `internal`, `restricted` or `confidential`. |
| `retention` | yes | `90d`, `1y` or `permanent`. |
| `auditRequired` | yes | Boolean. |
| `systemOfRecord` | when `ownership` is `own` | Non-empty string: what the app is the system of record for. |
| `residency` | when `ownership` is `own` | Non-empty string: where the owned data lives. |

`storage` is described as the contract defines it today. Three of its five
values name one provider's services, alongside `postgres` and `none`. This
file records the values; it does not recommend them.

### The review tier

Not a field. The schema derives it: `heightened` when `ownership` is `own` or
`classification` is `restricted` or `confidential`, otherwise `standard`.
Classification only ever raises the tier. A `provenance.reviewTier` lower than
the derived tier is a schema error; a higher one is allowed.

## capabilities

The shared platform capabilities the app inherits, and the config of those
that take one. Optional; when present, strict.

| Key | Value |
|---|---|
| `cache` | `backend` (`redis`, `memory` or `none`; required), `keyPrefix` (non-empty string), `defaultTtlSeconds` (integer, 0 or more; 0 means no expiry). |
| `feature-flags` | `flags`: a map from flag name to a definition: `enabled` (boolean, required), `enabledForRoles` and `enabledForTenants` (non-empty lists of non-empty strings), `rolloutPercentage` (0 to 100), `variants` (map from name to a weight of 0 or more; the weights must sum to more than 0). |
| `data-access` | `backend` (`memory` or `postgres`; required), `tables` (at least one SQL identifier, unique), `idempotency.table` (SQL identifier) when the app uses an idempotency store. |
| `identity`, `config`, `observability`, `resilience`, `lifecycle` | `{}`. Presence only: the entry declares that the app inherits the capability. Any field is an error. |

Connection URLs and connection strings are not declarable; they come from the
environment at run time. Whether every declared capability is wired, and
every wired one declared, is checked by `charter check`, not by the schema.

## integrations

The external systems the app reaches, outside the platform. Optional; when
present, a non-empty list with unique names. Each entry is strict:

| Field | Required | Value |
|---|---|---|
| `name` | yes | Non-empty string. Matches the code's downstream label. |
| `hosts` | one of `hosts`, `hostsFrom` | Unique bare lowercase hostnames: no scheme, port or path. |
| `hostsFrom` | one of `hosts`, `hostsFrom` | An environment variable name that supplies the host at deploy time. |
| `credentials` | yes | A list, possibly empty, of credential reference names: lowercase slugs, never values. |
| `cadence` | yes | `on-demand` or `scheduled`. |
| `schedule` | when `cadence` is `scheduled`; rejected otherwise | A bare five-field cron expression. |
| `note` | no | Non-empty free text. |
| `mode` | yes | `live` (the real system) or `stubbed` (a stand-in). |

Shared platform capabilities are never integrations. `charter check` fails an
outbound host the code reaches that no entry declares.

## provenance

The birth certificate. Written by the harness, never by hand. Strict when
present.

| Field | Required | Value |
|---|---|---|
| `harnessVersion` | yes | Non-empty string. |
| `engine` | yes | Non-empty string. |
| `model` | yes | Non-empty string. |
| `specHash` | yes | `sha256:` and 64 lowercase hex characters, or `none` on retro-certified provenance only. |
| `generatedAt` | yes | ISO date-time. On retro-certified provenance, the time of retro-certification. |
| `reviewTier` | yes | `standard` or `heightened`; never lower than the derived tier. |
| `validation` | yes | `configValid`, `testsPassed`, `securityScanPassed` (booleans) and `coveragePercent` (0 to 100): the gate results at stamping. |
| `lineage` | yes | See below. |
| `runReport` | yes, except on retro-certified provenance | Repository path of the run report. |
| `translationRunReport` | no | Repository path of the translation run report the spec came from. `charter check` requires it to resolve. |
| `retroCertified` | no | `true` only. Marks provenance issued after the fact for an app on the closed pre-harness list. |

The schema accepts a `retroCertified` block on its face: it does not know the
list, and `charter check` does not yet compare the two.

### lineage

| Field | Required | Value |
|---|---|---|
| `generation` | yes | Integer, 1 or more. |
| `predecessor` | from generation 2; absent on generation 1 | `generation` (integer, below this block's), `runReport` (non-empty), `specHash` (as above), `generatedAt` (ISO date-time). |
| `reason` | from generation 2; absent on generation 1 | Non-empty string: the regeneration reason, verbatim from a person's answer. |

`charter check` walks the chain: each reference resolves, every run report is
for the same spec, and generations strictly increase.
