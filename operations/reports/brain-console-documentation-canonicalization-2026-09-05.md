# Brain Console Documentation Canonicalization

Date: 2026-09-05
Repository: `stevewesthoek/brain`
Baseline: `origin/main` at `161f3d29a6b8f6b195533c5edcbe1c67ab74cb76`

## Current authority map

- Implementation entry point: `projects/brain-console/README.md`
- Product: `operations/specs/brain-console-product-spec.md`
- Architecture: `docs/system/brain-console-architecture.md`
- Operations: `operations/runbooks/brain-console-operations.md`
- Roadmap/status: `docs/system/brain-console-roadmap.md`
- Obsidian integration: `operations/specs/brain-console-obsidian-plugin.md`

The current product is **Brain Console**. Brain Console 2.0 is retained only
as the completed release/history designation.

## Normalization

- Moved `operations/runbooks/brain-console-2-operations.md` to
  `operations/runbooks/brain-console-operations.md`.
- Moved `operations/specs/brain-console-2-product-spec.md` to
  `operations/specs/brain-console-product-spec.md`.
- Moved `operations/reports/brain-console-2-modernization-roadmap.md` to
  `docs/system/brain-console-roadmap.md`.
- Consolidated current README content into maintainer entry points that link to
  the authorities instead of duplicating operational instructions.
- Retained 16 dated Brain Console 2.0 reports as historical evidence.
- No `projects/brain-console-2` implementation exists.

Active references to the old canonical runbook, product-spec, and roadmap paths:
**0**. Historical closeout reports retain their original path references as
immutable evidence.

## Verification

- Implementation changes: **NO**.
- Runtime changes: **NO**.
- Brain Console-scoped `git diff --check`: **PASS**.
- Canonical authority paths exist and active stale-path search is clean.
- Live smoke: Core `4877` HTTP 200, Console `4881` HTTP 200, Brain Console.app present.
- Shared dirty checkout remained untouched.
