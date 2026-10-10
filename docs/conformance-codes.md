# Conformance codes

The Charter platform reports named codes when it checks an app's conformance (`charter check`) and when it generates one (`charter new`). This file lists them: 37 codes.

**Names may change before v1.0.** No stability is promised for any code name in this file. Do not build on a name without pinning the charter-spec version you read it in.

## Reading the tables

**Kind**

* failure: the gate line fails, or the run stops.
* warning: reported by name; never a failure.
* named pass: a pass that is reported by name so that it is not mistaken for a full pass.

**Carried in**

* `code` field: the code is a value in a `code` field of the structured output. Machine-readable today.
* text only: the code appears only at the start of a message. It is not in a `code` field. Reading it by machine means matching message text.

18 codes are carried in a `code` field. 15 are text only. The 4 owner codes are in between: see their note.

## Conformance codes reported by `charter check`

Grouped by the line of the `charter` gate that reports them.

### schema: accountable owner

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `OWNER_REGISTRY_MISSING` | failure | text only in the check report | The owner registry was not found. Without it no owner can be resolved. |
| `OWNER_REGISTRY_INVALID` | failure | text only in the check report | The owner registry cannot be parsed or fails its own schema. |
| `OWNER_PLACEHOLDER` | failure | text only in the check report | The charter names the template placeholder as its owner and the app is not a listed template. |
| `OWNER_UNREGISTERED` | failure | text only in the check report | The charter's `accountability.owner` is not a registered organizational unit. |

Note: these four are a `code` value on the validation error that the check receives. The check report joins validation errors into the message of the schema line, so in the report they are text only.

### review-by

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `REVIEW_BY_EXPIRED` | failure | `code` field | `accountability.reviewBy` is before today. |

### capability-conformance

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `CAPABILITY_UNDECLARED_WIRED` | failure | `code` field | The code wires a shared capability that the charter does not declare. |
| `CAPABILITY_DECLARED_UNWIRED` | failure | `code` field | The charter declares a shared capability and no wiring for it was detected. |
| `CAPABILITY_CONFIG_CONTRADICTION` | warning | `code` field | A config value resolved from the code contradicts the declared config. Both values are shown. |
| `CAPABILITY_CONFIG_UNRESOLVED` | warning | `code` field | Config that static analysis cannot resolve to a value. |

### integrations

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `INTEGRATION_UNDECLARED_HOST` | failure | `code` field | An outbound host was detected that no declared integration covers. |
| `INTEGRATION_DECLARED_UNWIRED` | warning | `code` field | A declared integration has no statically detectable wiring. |
| `INTEGRATION_DYNAMIC_TARGET` | warning | `code` field | An outbound call site whose target cannot be reduced to a host. The call site is listed. |

### translation origin: identity pin

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `IDENTITY_PIN_MALFORMED` | failure | text only | The identity pin in the linked run report is not an object or lacks its base fields. |
| `IDENTITY_PIN_UNATTRIBUTED` | failure | text only | The identity pin does not record how it was declared, by whom, or the declaration itself. Also stops a generation run that would write such a pin. |
| `IDENTITY_PIN_DECLARATION_UNRESOLVABLE` | failure | text only | The pin points at a recorded question that does not exist or does not match. |
| `IDENTITY_PIN_PRIOR_SHAPE` | named pass | text only | The pin is in a report dated before attribution was required. The absent fields are reported, not defaulted. |

### lineage

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `LINEAGE_REFERENCE_UNRESOLVABLE` | failure | `code` field | A run report on the regeneration chain is missing, unreadable, or not pointed to. |
| `LINEAGE_IDENTITY_MISMATCH` | failure | `code` field | A run report on the chain is for a different promoted spec, or carries no spec identity. |
| `LINEAGE_GENERATION_NOT_INCREASING` | failure | `code` field | Generation numbers along the chain do not strictly increase, or the charter and its run report disagree. |

### chartered

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `CHARTERED_NO_PROVENANCE` | failure | `code` field | The charter carries no provenance block. The app is not chartered. |
| `CHARTERED_RETRO_NOT_ON_LIST` | failure | `code` field | The charter declares `retroCertified: true` and its name is not on the closed pre-harness list, or its directory name differs from its name. The app is not chartered. |
| `CHARTERED_RUN_REPORT_UNRESOLVABLE` | failure | `code` field | `provenance.runReport` is absent, does not exist, is not a readable JSON object, or records another app. The app is not chartered. |
| `STAMPED_APP_NOT_CHARTERED` | failure | `code` field | After stamping, `charter new` or `charter stamp --retro` found the app not chartered on the expected grounds; the run fails. |

Note: `STAMPED_APP_NOT_CHARTERED` is reported by `charter new` and `charter stamp --retro`, not by `charter check`. It is listed here with the chartered status codes it follows from.

## Generation codes: `charter new`

### Recorded human answers

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `ACCOUNTABILITY_ORIGIN_UNRESOLVABLE` | failure | text only | The linked translation run report does not exist or is not readable. |
| `ACCOUNTABILITY_ORIGIN_INCOMPLETE` | failure | text only | The linked report carries no complete accountability record. Nothing is defaulted. |
| `INTEGRATIONS_ORIGIN_UNRESOLVABLE` | failure | text only | The linked translation run report does not exist or is not readable. |
| `INTEGRATIONS_ORIGIN_INCOMPLETE` | failure | text only | The linked report carries no concluded integrations record, or one that fails the schema. |

### Regeneration

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `REGENERATES_TARGET_MISSING` | failure | text only | The run declares that it regenerates an app that does not exist. |
| `REGENERATES_MISMATCH` | failure | text only | The run declares that it regenerates one app and the spec names another. |
| `IDENTITY_PIN_UNPINNABLE` | failure | text only | The predecessor's runtime pattern does not map to a spec template, so its identity cannot be pinned. |
| `LINEAGE_PREDECESSOR_UNREADABLE` | failure | text only | The predecessor's charter is missing, unparseable, or lacks the provenance a regeneration needs. |
| `LINEAGE_PREDECESSOR_RUN_REPORT_UNRESOLVABLE` | failure | text only | The predecessor's provenance points at no run report, or at one that is missing or unreadable. |
| `LINEAGE_PREDECESSOR_REPLACED` | warning | text only | The predecessor is about to be deleted for regeneration. The message gives the command that restores it. |
| `IDENTITY_PIN_OVERRIDDEN` | warning | text only | The model proposed a name or template that contradicts the pin. The pin holds and the proposal is kept in the run report. |
| `GOVERNANCE_RELAXATION_PROPOSED` | warning | `code` field | The proposal relaxes a governance field against the predecessor. Shown to the respondent before they answer. |

### Blocks the harness stamps

| Code | Kind | Carried in | Meaning |
|---|---|---|---|
| `LINEAGE_ENGINE_WRITTEN` | warning | `code` field | The engine wrote a lineage block. It is kept in the run report and removed from the charter; the harness stamps the recorded lineage. |
| `INTEGRATIONS_ENGINE_WRITTEN` | warning | `code` field | The engine wrote an integrations block. It is kept in the run report and replaced by the block a person concluded. |

## Failures that carry no code

These fail without a named code: a charter that is invalid against the schema, a declared capability config that is invalid against its pinned schema, a translation origin that does not resolve, and the `tests`, `coverage` and `audit` gates.

## What this list rests on

The list was taken from the platform's command-line sources by reading every emitting site. It is complete for codes written in upper case with underscores; a code of another shape would not have been found. The "Carried in" column was established by reading the emitting code and its direct callers. The structured output was not captured and compared. The rows added in v0.4.3 were taken from the text of the platform change that adds them, before the code that emits them was written; they were not read from emitting code. For the three `CHARTERED_` codes and `STAMPED_APP_NOT_CHARTERED`, the "Carried in" value was set when this release was drafted, not taken from a change text. Terms used here are defined in [glossary.md](glossary.md), and the grades in [claim-strength.md](claim-strength.md).
