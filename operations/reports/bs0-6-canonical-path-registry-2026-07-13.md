# BS0.6 — Canonical path registry

**Execution date:** 2026-07-14  
**Status:** complete  
**Verdict:** PASS — a versioned executable registry now separates canonical paths, compatibility/historical paths, generated output, future targets, and external integration names without changing a consumer.

## Registry and implementation

- **Registry:** `operations/specs/infinite-brain-path-registry.json`
- **Version:** `1.0.0`
- **Entries:** 36
- **Read-only helper:** `tools/mind-canonical-path-registry.mjs`
- **Focused tests:** `tools/mind-canonical-path-registry.test.mjs`
- **Consumption note:** `operations/specs/infinite-brain-path-registry.md`

The existing contract registry was updated with the `canonical-path-registry`
entry and with executable-schema/validator mappings for the Mind folder
contract. No current Brain Core or Mind Steward consumer was migrated.

## Classifications

- Canonical active paths: `inbox/new/`, `inbox/failed/`, `inbox/raw/`,
  `inbox/processed/`, the reviewed domain roots, `system/agent-context/`, and
  `kanban.md` as current task authority.
- Future-only paths: `tasks.md`, `tasks/`, and planned
  `system/generated/graph/`.
- Forbidden active defaults: `capture/inbox/`, `capture/failed/`, `live/`,
  `sources/`, `router/`, `archive/`, numbered roots, ordinary `wiki/`,
  `wiki/log.md`, legacy task summaries, generated-output variants, and n8n
  environment-override names.
- Scoped compatibility authorities: ProChat brand, playbook, and YouTube
  subtrees plus the personal-identity subtree. These do not promote the
  general `wiki/` root to canonical authority.
- Graphify outputs are classified separately as operational generated,
  compatibility generated, or planned generated output, and are always
  non-authoritative.

## Deletion and unresolved decisions

Every compatibility/historical entry names cross-repository conformance and
explicit approval prerequisites; simple path absence can never authorize
deletion. B1.0a live routing/failure verification remains a prerequisite for
capture-path cleanup.

The missing `wiki/organisations/prochat/brand/prochat-os-strategy.md` is
explicitly registered as unresolved. Its existing Mind source is preserved;
no replacement path or product authority was invented.

## Files changed

- `operations/specs/infinite-brain-path-registry.json` (new)
- `operations/specs/infinite-brain-path-registry.md` (new)
- `tools/mind-canonical-path-registry.mjs` (new)
- `tools/mind-canonical-path-registry.test.mjs` (new)
- `operations/specs/infinite-brain-contract-registry.json`
- `operations/specs/infinite-brain-runtime-implementation-plan.md`
- this report

## Validation

```text
node --test tools/mind-canonical-path-registry.test.mjs
# 3 pass

node tools/mind-canonical-path-registry.mjs validate
# registry=pass; registry_version=1.0.0; paths=36
# network_access=false; mind_content_read=false

node tools/mind-canonical-path-registry.mjs classify wiki/unscoped-note.md
# compatibility-directory; path_id=wiki-root

node tools/mind-canonical-path-registry.mjs deletion-prerequisites capture/inbox
# includes cross-repository-conformance and B1.0a live-routing verification

node tools/validate-infinite-brain-contract-registry.mjs
# registry=pass; contracts=21

JSON parse and git diff --check
# pass
```

Focused negative tests reject duplicate patterns, non-canonical active
defaults, missing normative sources, and a candidate external integration that
claims verified routing.

## Safety and continuation decision

Mind remained read-only. No runtime consumer, workflow, scheduler, deployment,
environment value, credential, network action, folder, or compatibility path
changed. The Brain worktree began with 142 dirty entries and the Mind worktree
with 38; unrelated work was preserved.

BS0.6 has no Critical/High path-policy ambiguity in executable enforcement.
**BS0.7 may begin.**
