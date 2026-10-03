# Changelog

Releases of charter-spec, newest first. Each is a git tag. Dates are the date
of the release commit. Names and codes may change before v1.0.

## v0.4.1, 2026-10-03

* `SECURITY.md` is now in the package. The status claim "The open contract published" cites it as evidence, and the platform checks that evidence against the package it pins; without the file the claim failed there.

## v0.4.0, 2026-10-03

* Site rewritten around the thesis: how an app is made, in place of the thesis's second paragraph; what a charter declares, with an example for an invented app valid against v0.3.0; the two governance tiers; the eight capabilities; deployment at its grade; the open contract with links to every published document.
* Status map: twenty claims become five shipped claims and one next. Each entry's `why` is its unproven remainder only; the next claim's evidence is a proxy, recorded as weak. Pilot detail, dates, coverage figures and the external pilot leave the page. This is a status map change; it lands with the platform pin bump that attests it.
* The site's status test now requires at least two claims verified in this repository, down from three.

## v0.3.0, 2026-10-03

* `docs/charter-reference.md`: the charter field by field, written against the schema, which remains the authority.
* `SECURITY.md`: how to report a vulnerability, through GitHub private vulnerability reporting.
* `CHANGELOG.md`: this file, with the earlier releases filled in from their tags.
* Schema source: a comment on the `capabilities` field said declared-versus-wired conformance was out of scope; it now says `charter check` checks it. No change to the schema itself.
* Site: "certification" replaced by conformance wording; claim descriptions narrowed where the evidence reaches less far than the wording did (provenance capture, the first pilot, accountability, classification, secret rotation); the providers line leads with OIDC and OpenTelemetry and names only the providers run so far; the pipeline section no longer says an app without provenance fails conformance; footer links to the principles, claim strength and glossary. No claim title or status changed, so the status map is unchanged.

## v0.2.0, 2026-10-03

* `docs/principles.md`: the six principles and three standing disciplines, published here as canonical text.
* `docs/claim-strength.md`, `docs/conformance-codes.md`, `docs/glossary.md`.
* `package.json` `files` includes `docs`, so the documents reach consumers of the git dependency.

## v0.1.1, 2026-10-02

* Status claims can name the record repository as the place their evidence lives.
* Site domain and the contract's description updated.

## v0.1.0, 2026-09-19

* The charter contract: the schema, the validator and their tests.
* The public site and the check that maps each Status claim to its evidence, with every claim naming the repository its evidence lives in.
* The Pages deployment, gated on that check and on a fresh, passing platform attestation.
* Packaging: builds to `dist` with an exports map, so the contract installs as a dependency.
