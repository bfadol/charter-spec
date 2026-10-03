# Charter principles

This file is the canonical text of the Charter principles and standing disciplines. Principles are cited by number and charter-spec version. Disciplines are cited by name and charter-spec version. A change to any of them is a governance decision: it lands here, in its own commit, and is recorded as a ruling, listed by its ID under Amendments.

## Architecture principles
1. Apps are non-invasive to existing systems in both tiers; ownership, not write access, is the governed variable. Consume is the default and is not read-only.
2. Apps conform to the platform scaffold and inherit shared capabilities rather than reimplementing them; the charter declares that inheritance completely, and conformance is verified in both directions.
3. The platform governs generation, not just runtime; provenance is the birth certificate and its absence is a pipeline failure. Human answers are recorded once under the respondent contract and inherited by reference, never re-inferred.
4. Observability and identity are built in via open standards (OpenTelemetry, OIDC); providers are configuration.
5. Infrastructure is portable and declarative: Kubernetes with OpenTofu, kubeconfig only, sovereign cloud, on-prem, and air-gapped included. A dependency of the conformance path on public infrastructure is a defect to be removed, and is disclosed until it is.
6. Decisions are made by humans and recorded by machine: ownership, residency, classification, accountability, and tier are answered, not inferred, with respondent identity and channel on the record.

## Standing disciplines
- **Claim-strength register.** Claims are graded by evidence strength: demonstrated, proven to boundary, asserted, with any dispute and the unproven remainder stated alongside. Corrections are made in the record, not over it. The grades are defined in [claim-strength.md](claim-strength.md).
- **Decision tripwire.** Any modification to a gate, check, or proxy definition, or to what generation is told, stops and surfaces for review before landing.
- **Evidence preservation.** Deleted or amended artifacts are recovered byte-verified and frozen into the record before a finding closes. Captured run artifacts are immutable history; corrections live in current declarations, never in edits to recorded runs.

## Amendments

- 2026-10-02. R-0006. Decision tripwire widened to cover what generation is told (prompt context, rules, the generation skill).
- 2026-10-02. R-0010. Published in this repository. Principle 2: "now" removed. Principle 5: last sentence replaced. Claim-strength register: "proven to boundary" spelled without hyphens, dispute and unproven remainder added, the sentence about an earlier brief removed, the link to the definitions added. Decision tripwire: second sentence removed.

## Origin

First published in this repository at v0.2.0. The earlier history of the text is in the maintainers' engineering record. Rulings are cited here by ID; the decision log is kept with the platform.
