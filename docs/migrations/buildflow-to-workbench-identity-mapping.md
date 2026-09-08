# BuildFlow → Workbench Identity Mapping

## Decision

BuildFlow is the historical/internal product name.
Workbench is the current user-facing product identity.

## Preserve

Technical identifiers remain unchanged for compatibility. This includes
environment variables, repository paths, app and service IDs, command names,
credential paths, domains, Docker image and volume names, migration manifests,
historical reports, generated artifacts, and test fixture namespaces.

## Rename scope

Only active human-facing terminology may change. Product labels, inventory
names, descriptions, and human-readable log prefixes may use Workbench.

## Non-goals

This is not:

- a repository migration
- a credential migration
- an infrastructure migration
- a domain migration
- an API migration

