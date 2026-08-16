# CLR4 Cross-Host Runtime and Packaging Foundation — 2026-08-16

## Status

**Accepted 2026-08-16 as a repository implementation.** CLR0-CLR4 are complete. CLR5-CLR8 are not authorized. No deployment profile, transport, cache, package mutation, provider registration, or client installation is activated by this acceptance.

## Goal

Establish a source-, host-, UI-, OS-, and vendor-neutral deployment/runtime foundation for the Context & Learning Runtime without activating new providers, conversation ingestion, learning promotion, or live client installation.

CLR4 must make the same core contracts usable for:

```text
personal-local
personal-dual-host
business-single-tenant
managed-single-tenant
```

Steve's current Brain/Mind + Office/MacBook installation is one reference profile only.

## Required outcomes

1. versioned deployment/provider profile schema;
2. context/capability provider configuration independent of repository names and paths;
3. reference Steve profile expressed only through installation configuration;
4. at least one non-Brain/Mind alternate provider fixture;
5. secure transport abstraction that hides Thunderbolt/Tailscale/IP/SSH details from CLR core;
6. bounded last-known-good context cache with exact age/source revision;
7. deterministic fail-closed policy for operations requiring current human authority or current Decision Core state;
8. deterministic read-only `doctor`/`status` behavior;
9. explicit install/update/export/backup/rollback contracts with dry-run/receipt boundaries before mutation is ever allowed;
10. default-safe export/backup that excludes secrets, raw private evidence, derived indexes, and caches unless explicitly requested by a future authorized operation;
11. no Obsidian/macOS/model/vendor dependency in public core contracts.

## HEAD reconciliation

CLR4 originally started from `9b1ce088` but packet preflight detected an unexpected concurrent repository advance to `e434efe67771e19d864ef5253d874ee40a2f6133` (`feat: complete Phase 3C4 read-only hygiene audit and final-sync design`). Exact repository inspection shows that commit belongs to the separately excluded `operations/migrations/dokploy-azure-to-lightsail/` program: its Phase 3C4 audit/design, post-cutover hygiene roadmap, and migration manifest. The migration directory is now committed and no longer appears as untracked dirt. No CLR specification, Context Broker, Decision Core, Obsidian cockpit, Workbench, or Video Orchestrator surface was found in that concurrent change.

**Reconciliation decision:** safe to continue CLR4 from the migration-updated branch without reset/revert/merge/cherry-pick. A second concurrent advance occurred during finalization to `3a20893d` (`docs(migration): record AWS cutover rehearsal`). Exact repository search ties that change to the Dokploy Azure→Lightsail Phase 3D rehearsal report/preflight work under `operations/migrations/dokploy-azure-to-lightsail/`; no CLR working path was displaced, and final `git status` continued to show the CLR4 set independently from unrelated local Claude settings. The migration program remains outside CLR4 scope and will not be modified or committed as CLR work.

## Existing reference contracts to reuse

- CLR authority/freshness schemas from CLR1;
- Context Broker/provider contracts from CLR2;
- one Decision Core from CLR3;
- existing Brain workstation connectivity contract for Steve's adapter:
  - logical `office` authority transport;
  - direct Thunderbolt route preferred;
  - Tailscale route fallback;
  - current route/IP/SSH alias details remain deployment configuration, never CLR core constants.

## Implementation plan

### CLR4.1 — Deployment/provider schema

Create a versioned schema for:

- deployment profile kind;
- installation/tenant identity;
- host roles;
- context and capability provider bindings;
- broker endpoint and transport adapter references;
- last-known-good cache policy;
- privacy/provider policy;
- UI/consumer adapter enablement;
- package lifecycle contracts.

### CLR4.2 — Portable fixtures

Provide:

- `personal-local` generic fixture;
- Steve `personal-dual-host` reference fixture;
- alternate non-Brain/Mind `business-single-tenant` fixture;
- generic `managed-single-tenant` fixture.

Only the Steve reference fixture may mention Brain/Mind or the Office transport names. Public schema defaults and runtime code must not.

### CLR4.3 — Cross-host runtime policy

Implement dependency-free deterministic helpers for:

- transport route selection from configured candidates;
- last-known-good cache age/state evaluation;
- current-authority requirement evaluation;
- visible offline/stale fallback decisions;
- provider/profile health doctor output;
- package lifecycle plan validation.

No real network connection or file mutation is part of CLR4 runtime helpers.

### CLR4.4 — Packaging/lifecycle contracts

Define deterministic plan/receipt shapes for:

```text
install
update
export
backup
rollback
```

CLR4 validates plans and safe defaults only. It does not perform package installation, updates, backup writes, restore writes, or rollback mutations.

### CLR4.5 — Validation and closeout

Required validation:

- JSON syntax/schema fixtures;
- four deployment profile fixtures;
- alternate-provider portability test;
- no Steve/Office/MacBook/Brain/Mind constants in generic runtime/schema;
- transport fallback tests;
- cache fresh/stale/expired tests with exact age;
- fail-closed current-authority/Decision Core tests;
- doctor/status deterministic tests;
- package plan safe-default tests;
- safe export/backup exclusion tests;
- secret-material scan;
- `git diff --check`.

## Explicit exclusions

Do not modify or absorb:

- `operations/system-configs/claude/settings.json`;
- `operations/migrations/**`;
- Mind repository state;
- Workbench-private;
- `feature/video-orchestrator`;
- live provider/MCP registrations;
- live SSH/Codex/macOS configuration;
- CLR3 Obsidian plugin installation into Mind;
- conversation ingestion;
- learning promotion;
- CLR5+ work;
- Git push.

## Risk controls

- **Hardcoded Steve topology:** rejected by portability validation.
- **Stale authority treated as current:** runtime policy fails closed for current-authority or current-decision operations.
- **Cache becoming canonical:** cache contracts mark last-known-good state derived/rebuildable and age-bounded.
- **Unsafe backup/export:** default plan excludes secrets/raw private evidence and non-essential derived state.
- **Update lock-in:** every public profile/lifecycle contract is versioned and rollback metadata is required before a future mutating update.
- **Provider lock-in:** provider binding uses logical IDs/types and adapter references rather than repository-specific code.

## Acceptance boundary

CLR4 acceptance means the repository contracts and deterministic policy/runtime helpers are validated. It does **not** mean any profile is installed, any transport is activated, any cache is populated, or any package lifecycle mutation has run.

## Final validation evidence

### Deployment/profile contracts

```text
npm run validate:context-learning-deployment
```

Result:

```text
context-learning-deployment-valid
profiles=4
kinds=4
lifecycleOps=5
```

The four validated profile kinds are:

```text
personal-local
personal-dual-host
business-single-tenant
managed-single-tenant
```

The Steve Brain/Mind + Office/MacBook topology exists only in `steve-personal-dual-host-reference`. The alternate `atlas-business-single-tenant` fixture passes the same runtime/validator path without Steve, Office, MacBook, Brain, Mind, or Obsidian coupling.

### Runtime behavior

```text
npm run test:context-learning-deployment
```

Result: **PASS — 9/9**.

Coverage proves:

1. configured transport priority and visible fallback;
2. exact last-known-good cache age plus fresh/stale/expired states;
3. fail-closed current human authority;
4. fail-closed current Decision Core state;
5. bounded supplemental last-known-good reads where policy allows them;
6. deterministic read-only doctor output;
7. safe dry-run lifecycle plans with rollback/receipt metadata;
8. unsafe lifecycle/export plans rejected;
9. alternate-provider portability;
10. deterministic lifecycle receipts with `writesPerformed: false`.

### Lifecycle contracts

`operations/specs/context-learning/lifecycle-contract-v1.schema.json` validates both dry-run plans and receipts for all five operations:

```text
install
update
export
backup
rollback
```

Export/backup plans must exclude secrets, raw private evidence, derived indexes, caches, and runtime sessions. All CLR4 plans are `dryRun: true`, `mutationAuthorized: false`, rollback-aware, and receipt-required.

### JSON validation

Passed for:

- root `package.json`;
- deployment profile schema;
- lifecycle plan/receipt schema;
- four-profile fixture bundle.

### Live-versus-repository truth

Verified repository implementation: **yes**.

Activated transport/provider/cache/package mutation: **no**.

Live Obsidian installation: **no**.

Conversation ingestion / learning promotion: **no**.

CLR5 authorization: **no**.
