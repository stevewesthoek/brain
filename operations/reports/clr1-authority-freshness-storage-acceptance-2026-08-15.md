# CLR1 Authority, Freshness, Storage, and Schema Acceptance — 2026-08-15

## Decision

CLR1 is accepted as a **foundation-only** implementation. It defines and validates contracts for authority, freshness, storage, logical learning transactions, context packs, and report-only shared-memory inventory. It does not activate conversation ingestion, learning promotion, schedulers, new providers, broad Mind writes, or any runtime service.

CLR2-CLR8 remain unstarted and require separate owner authorization.

## Implemented contracts

- `operations/specs/context-learning/contracts-v1.schema.json`
  - knowledge atom;
  - relation;
  - evidence event;
  - decision item;
  - logical learning transaction;
  - context pack;
  - retention storage class/profile;
  - authority registry.
- `operations/specs/context-learning/authority-registry.v1.json`
  - Mind canonical human meaning;
  - Brain canonical machine capability/operational learning;
  - conversation/runtime material as evidence;
  - indexes/hot memory/graphs as derived;
  - context/bootstrap/handoff state as ephemeral.
- `operations/specs/context-learning/retention-profile.personal-local.v1.json`
  - every non-canonical storage class is bounded by source policy, lifecycle, size/item cap, TTL/LRU, or rebuild semantics;
  - canonical Mind/Brain content and compact decision/transaction receipts remain durable according to their own authority/history policies.
- `tools/context-learning/context-learning-core.mjs`
  - deterministic authority validation;
  - deterministic freshness/supersession evaluation;
  - bounded-retention invariants;
  - local JSON Schema subset validation used by CLR1 without network/runtime package installation.
- `tools/context-learning/inventory-shared-memory.mjs`
  - aggregate-only `REPORT_ONLY` inventory of `~/.brain/memory`;
  - before/after source fingerprint;
  - no writes, moves, deletes, filenames, memory text, fact values, or raw transcript content in output.

## Validation evidence

### JSON syntax

`validate_json_files` passed for:

- `contracts-v1.schema.json`;
- `authority-registry.v1.json`;
- `retention-profile.personal-local.v1.json`.

### Contract validation

```text
npm run validate:context-learning-contracts
```

Result:

```text
context-learning-contracts-valid
  definitions=8
  authorityKinds=32
  storageClasses=12
```

### Focused behavior tests

```text
npm run test:context-learning
```

Result: `6/6 PASS`.

The tests cover:

- schema definition/fixture validation;
- authority registry consistency;
- rejection of wrong Mind/Brain ownership;
- `fresh`, `review_due`, `stale`, `superseded`, `contradicted`, and `unknown` freshness states;
- rejection of unbounded non-canonical storage;
- deterministic aggregate-only shared-memory inventory with zero source mutation.

## Live shared-memory inventory

The report-only inventory was executed twice against the real `~/.brain/memory` store.

Both runs returned the same inventory digest:

```text
a65e17614876b932672e7bfdb7b41b7d12f7bde94f70b1fa2cb6d3a33e6ee261
```

Both runs also returned the same before/after source fingerprint:

```text
0599913638c63eab228dd4191411fd73d6d8855cbddead96a7638fc103c7663a
```

Observed aggregate only:

```text
mode: REPORT_ONLY
writesAttempted: 0
rawContentIncluded: false
filenamesIncluded: false
mutated: false
fileCount: 9
totalBytes: 17,492
facts: 12 active, 0 inactive, 0 invalid
classification:
  mind-candidate: 6 files / 15,304 bytes
  derived-hot-recall: 1 file / 218 bytes
  unresolved-historical-evidence: 2 files / 1,970 bytes
```

No entry was moved, deleted, rewritten, promoted, or copied into Git. The classification is migration-planning evidence only; it does not make the six candidate files canonical Mind truth.

## Portal and optional-provider clarification captured during CLR1

The architecture review also reconciled several existing components without activating them:

- **Obsidian** remains Steve's one primary human cockpit under the existing Brain decision log.
- **Brain Core** is the headless local API/control/safety boundary, not a separate human UI.
- The standalone `projects/brain-console` web app on port `4881` is not required for CLR and must not receive Decision Center-only work before CLR3 portal consolidation.
- **Codebase Memory MCP** remains an optional Brain-only structural-navigation accelerator when fresh; exact current source remains authority.
- **Graphify** remains an optional non-authoritative semantic/relationship/visual projection; it is not CLR's canonical graph store or required dependency.
- **Workbench** remains an optional guarded local repository/action bridge and future CLR consumer. Its current admitted MCP does not passively export ChatGPT history. Conversation evidence may enter CLR only through a future supported export/event/capture surface under CLR5.

These clarifications change no runtime state.

## Explicit non-actions

CLR1 did **not**:

- ingest any conversation;
- call a model for learning extraction;
- create a new scheduler/background loop;
- write to Mind;
- promote any shared-memory entry;
- modify or delete `~/.brain/memory`;
- enable CBM/Graphify/Workbench globally;
- start/fix/decommission the port-4881 web app;
- alter Brain Core runtime/service state;
- touch `feature/video-orchestrator`;
- reopen or rewrite completed P1-P8 history.

## Next gate

CLR1 acceptance authorizes nothing beyond itself. The next possible phase is CLR2 — Universal Context Broker and live alignment — only after a separate explicit owner authorization.
