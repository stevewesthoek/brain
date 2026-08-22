# BuildFlow → Workbench Brain Reconciliation Report

**Date:** 2026-08-23
**Repository:** `brain`
**Status:** Done — bounded documentation synchronization complete; commit remains pending owner review.

## Decision

Workbench is the current product identity. BuildFlow remains the historical and
internal compatibility identity. This reconciliation changes human-facing
current terminology only; it is not a technical migration.

## Files changed by this pass

- `docs/migrations/buildflow-to-workbench-brain-sync.md` — identity policy and preserved-identifier record.
- `docs/migrations/buildflow-to-workbench-brain-reconciliation-report.md` — this report.
- `docs/migrations/buildflow-to-workbench-next-decisions.md` — synchronized the prior audit’s status for the labels changed by this pass.
- `operations/accounts/credentials-index.md` — current section and service labels changed to Workbench; credential names, paths, domains, and setup commands preserved.
- `operations/architecture/prochat-infrastructure-architecture.md` — current application/project/schema labels changed to Workbench; image references, volume names, IDs, and historical ADR text preserved.

The following active inventory labels were already synchronized before this pass
and were not rewritten: `operations/infrastructure/infra.md`,
`operations/infrastructure/local-apps.json`, and
`operations/infrastructure/local-apps.md`. Their BuildFlow technical paths,
commands, and environment references remain unchanged.

## Files intentionally untouched

The following classes of material were intentionally preserved:

- `docs/projects/buildflow/**` dated reports and project records.
- `operations/migrations/**` migration manifests, readiness reports, and evidence.
- `operations/decision-log.md` and other historical decision records.
- BuildFlow standards and runbooks whose normative status or ownership requires a separate decision.
- Runtime scripts, manifests, package metadata, code, tests, generated artifacts, and video-job metadata.
- Existing unrelated user changes, including Azure/Buildflow migration material and Firecrawl logs.
- The isolated `feature/video-orchestrator` worktree and branch.

## Remaining BuildFlow references

The repository-wide audit found remaining references in the following categories.

### Technical compatibility identifiers — preserve

- `BUILDFLOW_ACTION_TOKEN` and other environment/credential identifiers.
- `buildflow` repository, filesystem, configuration, and data paths such as `~/.config/buildflow`, `~/.buildflow`, and `/var/lib/buildflow`.
- `buildflow.prochat.tools` and related technical domains.
- BuildFlow app/service IDs, deployment identifiers, command names such as `buildflow-orchestrator.sh`, and provider identifiers.
- Docker image, container, and volume names such as `ghcr.io/stevewesthoek/buildflow` and `buildflow-data`.
- `.buildflow` and `.buildflow-test-*` fixture/runtime namespaces.
- Script tokens, log labels, trust paths, migration manifests, and other machine-facing identifiers.

These references are compatibility surfaces. Renaming them would be an
infrastructure or runtime migration and is outside this decision.

### Historical records — preserve unchanged

- Dated BuildFlow project reports and archived documentation under `docs/projects/buildflow/`.
- Azure/Dokploy migration reports, manifests, and cutover evidence under `operations/migrations/` and related report directories.
- Historical architecture ADRs, including the BuildFlow digest-pinning decision.
- Generated video-orchestrator metadata and historical logs that record the identity used at generation time.

These references preserve historical accuracy and provenance.

### Ambiguous references — future decision required

- BuildFlow standards and runbooks that may still be normative rather than archival.
- Credentials-index technical headings or source-of-truth language beyond the bounded human-facing labels synchronized here.
- Provider inventory, domain, deployment, and migration-policy references where the current operational owner is not explicit.

These should be reviewed in a separate policy/ownership decision before any
further rename. No change is authorized by this report.

## Validation

- `git diff --check` — PASS.
- `node tools/validate-brain-document-consistency.mjs` — PASS (`docs=pass`, `files=10`, `result=pass`).

No broad test suite was run. No infrastructure, credential, runtime, or
automation execution path was changed.

## Future migration candidates

Any future change to domains, paths, environment variables, commands, app IDs,
container/image/volume names, or deployment identifiers requires a separately
authorized technical migration with its own compatibility and rollback plan.
