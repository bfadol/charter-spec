# Glossary

One line per term. Where a term has a canonical home, the line points to it and does not restate it. The schema is `packages/platform/src/lifecycle/validator.ts` in this repository.

## The charter

* **Charter.** The declaration an app carries in `charter.yaml`: what it is, who answers for it, what data it touches, which systems it reaches, and how it was generated. Defined by the schema. Field by field: [charter-reference.md](charter-reference.md).
* **Chartered.** Said of an app whose charter is valid, whose provenance was stamped by the generation harness or is a retro-certification on the closed pre-harness list, and which passes charter check.
* **Schema.** The definition of a valid charter. See the README.
* **Validator.** The function that checks a parsed charter against the schema. It reads no files and reaches no network.
* **Ownership.** Whether the app owns data (`own`) or consumes it from systems that do (`consume`). See principle 1.
* **Residency.** Where owned data lives. Required when ownership is `own`.
* **Classification.** The sensitivity of the data: `public`, `internal`, `restricted` or `confidential`.
* **Review tier.** `standard` or `heightened`. Derived from ownership and classification by the schema, never set by hand.
* **Heightened.** The review tier of an app that owns data or whose classification is `restricted` or `confidential`.
* **Accountability.** The charter block naming the organizational unit that answers for the app and the date its declaration is next reviewed.
* **Owner.** The organizational unit named in `accountability.owner`. It must be registered.
* **Review-by.** The date in `accountability.reviewBy`. A date in the past fails charter check.
* **Capability.** A shared platform service an app inherits and does not reimplement. See principle 2.
* **Declared and wired.** A capability is declared when the charter lists it and wired when the code uses it. Conformance requires each to imply the other.
* **Integration.** An external system the app reaches, declared in the charter's `integrations` block. See `packages/platform/src/lifecycle/integration-config.ts`.

## Generation

* **Spec.** The written requirement an app is generated from.
* **Translation.** The stage that turns a requirement into a spec, with a person answering the questions that are theirs to answer.
* **Respondent.** The person who answers during translation. Their identity and channel are recorded. See principle 6.
* **Channel.** How the respondent's answers arrived: at a terminal, or piped.
* **Generation harness.** The platform's pipeline that generates an app from a spec, gates each stage, and stamps provenance.
* **Engine.** The model-driven tool the harness runs to write code.
* **Provenance.** The charter block the harness stamps to record how the app was generated. See principle 3.
* **Run report.** The record of one generation run. Provenance points to it.
* **Generation.** The count of times an app has been generated. The first is generation 1.
* **Regeneration.** Generating an existing app again from its spec, producing the next generation.
* **Predecessor.** The generation that a regeneration replaces.
* **Lineage.** The chain from an app's current generation back to generation 1, recorded in provenance and verified by charter check.
* **Identity pin.** The declaration, made by a person, that a run regenerates a named app. It fixes the app's name and template.
* **Pre-harness.** Said of an app written before the generation harness existed.
* **Retro-certified.** The established term for a pre-harness app whose conformance was checked after it was written, graded as such. The list of these apps is closed.

## Charter check

* **Charter check.** The platform command that checks an app's conformance: `charter check`.
* **Gate.** A named stage of charter check that passes or fails: `charter`, `tests`, `coverage`, `audit`.
* **Check.** One line of a gate: a single thing verified.
* **Proxy.** A check that stands in for a property it cannot observe directly. A proxy is named as one.
* **Conformance.** Agreement between what a charter declares and what the app does, as far as charter check can verify it.
* **Conformance code.** A named failure, warning or pass reported by the platform. See [conformance-codes.md](conformance-codes.md).
* **Vacuous pass.** A pass reported by name because there was nothing to evaluate.

## Claims and the record

* **Claim strength.** The grade of the evidence behind a claim. See [claim-strength.md](claim-strength.md).
* **Status claim.** A line in the Status section of the public site. Each maps to evidence that is checked by machine. See the README.
* **Attestation.** The platform's record that the Status claims whose evidence lives outside this repository were checked and passed.
* **Principle.** One of the numbered statements in [principles.md](principles.md).
* **Standing discipline.** One of the named working rules in [principles.md](principles.md).
* **Decision tripwire.** A standing discipline. See [principles.md](principles.md).
* **Ruling.** A recorded decision about what the product is or what a valid charter is, cited by its ID.
* **Finding.** A recorded gap between what is claimed and what the evidence shows, kept after it is fixed.
