# Mind Steward

Mind Steward is a retained Brain-owned package for local, deterministic Mind maintenance analysis and presentation. Its default boundary is dry-run/report-only. It remains separate from Brain Core and uses the canonical Brain-owned path registry for active path and policy resolution.

The package and repository configuration do not, by themselves, prove deployment, active scheduling, or continuous operation.

## Responsibilities

Current package responsibilities include:

- classifying captures when an operator invokes the classifier;
- producing deterministic dry-run contract and maintenance plans;
- generating Markdown and JSON reports;
- creating and presenting review previews;
- evaluating wiki health;
- generating maintenance-preview queues;
- exposing local CLI presentation surfaces.

Mind Steward does not autonomously move files, rewrite Mind content, update Kanban or task authority, or select durable destinations. Classifier apply mode remains disabled pending approval integration. Any durable change requires a separate exact approved execution path and its existing validation and rollback boundaries.

## Canonical path resolution

Active path policy is resolved centrally through:

- `operations/specs/infinite-brain-path-registry.json`
- `tools/mind-canonical-path-registry.mjs`
- `projects/mind-steward/src/path-registry.ts`

The active capture destinations used by Mind Steward are registry-derived:

- intake: `inbox/new/`
- failure queue: `inbox/failed/`

The package also resolves other canonical paths, including the approved agent-context target, through registry path IDs rather than duplicating path policy in package code.

Legacy paths such as `capture/inbox/`, `capture/failed/`, `router/`, and `mind/router/` are not current active defaults. Registry-listed compatibility or historical paths may be read only within their explicit scoped policies; they are not durable-write destinations. `wiki/log.md` remains a registry-classified compatibility read/proposal ledger and produces no-op review items only.

## Execution and safety boundary

- Dry-run/report-only behavior is the default.
- Reports and previews are non-authoritative until reviewed.
- Local model selection occurs only when the classifier is explicitly invoked by a caller.
- Repository files and package code do not establish that a scheduler or workflow is actively deployed.
- Retention does not authorize nightly execution, scheduling, watchers, production writes, or continuous automation.
- Durable changes require a separate approved apply path; authority must not be inferred from a preview or report.
- The package must not infer authority to edit Mind, `kanban.md`, `tasks.md`, raw source content, or runtime configuration.
- Path and write policy are owned centrally by Brain contracts and are not duplicated inside Mind Steward.

## Package boundary

Mind Steward remains separate from Brain Core. It has no package import dependency on Brain Core. The packages share canonical path and policy resolution through the Brain-owned registry, while retaining distinct responsibilities:

- Mind Steward: local classifier, dry-run reports, preview presentation, wiki health, maintenance-preview queues, and CLI presentation.
- Brain Core: API and adapter surfaces, proposal and approval adapters, scheduler views, and contained write boundaries.

Future migration or retirement requires separate Brain-owned evidence and approval. This README does not authorize either outcome.

## Validation

Package scripts are defined in `package.json`:

```bash
npm --prefix projects/mind-steward run typecheck
npm --prefix projects/mind-steward run test
npm --prefix projects/mind-steward run ci
```

Canonical registry validation:

```bash
node tools/mind-canonical-path-registry.mjs validate
```

## Evidence

- `operations/reports/b1-5-mind-steward-package-boundary-2026-07-14.md`
- `operations/reports/bs0-8-mind-steward-path-registry-migration-2026-07-14.md`
- `operations/reports/bs0-9-brain-core-path-consumer-migration-2026-07-14.md`
- `operations/specs/infinite-brain-path-registry.json`
- `tools/mind-canonical-path-registry.mjs`
- `projects/mind-steward/src/path-registry.ts`
- `operations/runbooks/infinite-brain-roadmap-status.md`
