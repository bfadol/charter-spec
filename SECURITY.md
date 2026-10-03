# Security

## Reporting a vulnerability

Report it privately through GitHub's private vulnerability reporting for this
repository: the "Report a vulnerability" button under the Security tab. Do not
open a public issue.

Include what is affected (a file, a schema rule, a script, the site), how to
reproduce it, and what an attacker could do with it.

## What is in scope

This repository: the charter schema and validator, the config schemas, the
scripts that check the site's Status claims and build the site, and the site
itself.

The Charter platform, which generates and checks applications against this
contract, is a separate, private codebase and is not in scope here.

## Supported versions

Before v1.0, only the latest release tag is supported. A fix lands in a new
release, not in an older one.
