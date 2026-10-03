# Claim strength

Every claim made about Charter, or about an app that carries a charter, is stated with the strength of the evidence behind it. This file defines the three grades, and how a dispute and the unproven remainder are stated alongside a claim. It is the canonical home for these definitions. The discipline that requires them is the claim-strength register in [principles.md](principles.md).

## The five parts of a stated claim

A claim on the record has up to five parts:

1. what is **demonstrated**,
2. what is **proven to boundary**,
3. what is **asserted**,
4. what is **disputed**, if anything,
5. the **unproven remainder**.

The first three are grades. A claim, or each part of a compound claim, carries exactly one grade. The last two are not grades. They are statements made next to the grade so that a reader sees what the evidence does not settle.

## The three grades

### Demonstrated

The thing claimed was observed happening, on the real subject of the claim, and a record of the observation exists that a reader can check.

* Evidence: a run record, command output, a captured artifact, or a file read at a named commit.
* The grade covers what was observed and nothing wider. A property demonstrated on one path is not demonstrated on another path that was not run.
* Example: "The lineage chain of this app verifies to generation 1" is demonstrated when the check was run on that app and its output is on the record.

### Proven to boundary

The evidence carries the claim up to a named point and stops there. The point is the boundary. It is stated with the claim.

* Evidence: the same kinds as for demonstrated, up to the boundary; or a trace by reading that establishes the claim within stated limits.
* The boundary is named in plain words: where the evidence stops and why.
* Nothing beyond the boundary is claimed. What lies beyond it is part of the unproven remainder.
* Example: "The adapter reaches the external system and is refused at authentication" is proven to the authentication boundary. No authenticated exchange is claimed.

### Asserted

The claim is stated without evidence of either kind above on the record.

* An asserted claim may be true. The grade says only that the record does not yet show it.
* A claim taken from an earlier source and not checked again is asserted, and says so.
* Example: "No other workflow publishes the site" is asserted when it rests on a rule and no check enforces it.

## Stating a dispute

A dispute is recorded next to the claim it concerns. It is not a grade and it does not replace one.

* The statement says who disputes what, in that party's own words where they are available.
* The claim keeps the grade its evidence supports. A dispute does not lower a grade, and a grade does not close a dispute.
* A disputed account is not removed or smoothed over. Both accounts stay on the record.
* If the dispute is ruled on, the disposition is added with its date. The original statements stay.
* When nothing is disputed, the statement is "none". It is not left out.

## Stating the unproven remainder

The unproven remainder is the part of a claim that the evidence does not reach. It is stated in words, next to the claim.

* It says what was not checked, what was not run, and what lies beyond a boundary.
* It is stated even when it seems obvious. A claim with no stated remainder reads as complete, so "nothing remains unproven" is a statement that needs its own evidence.
* Example: "Demonstrated for completed and failed runs. Not demonstrated for an interrupted run: none was interrupted."

## Rules of use

* Durable text never states a claim above its recorded grade.
* A compound claim is split, and each part carries its own grade. One grade is never stretched over parts with different evidence.
* A grade changes only when the evidence changes. The change is recorded with its date. The earlier statement is not rewritten: corrections are made in the record, not over it.
* A grade belongs to a subject at a point in time. If the subject is replaced, the grade does not carry over. Evidence gathered on an earlier build of an app is not evidence about a later one.
* A check that was announced reports its result, including when it finds nothing.

## Where the grades appear in public material

The Status section of the public site lists claims as shipped or in progress. Shipped means the claim's evidence is checked by machine before each deploy; the README of this repository describes that check. The map behind the Status section does not carry grades. Where the page's wording uses a grade term, it is used in the sense defined here.
