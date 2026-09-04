# Brain Console 2.0 — persisted Context Pack and Evidence Packet wiring

Date: 2026-09-04
Repository: `/Users/Office/Repos/stevewesthoek/brain`
Baseline origin/main: `687ea0024fdbd622f9761b93d506a98e80815dde`
Source/deployment revision during this report: `d665bcf345c34ef4357a751f4699703c9afe14c8`

## Outcome

The additive task-reference contract is wired end to end:

```text
agent ledger/task snapshot
  → Brain Core agent-task-graph projection
  → Brain Core agent-task-state continuity projection
  → typed Console schemas and normalizers
  → Task detail bounded reference cards and stable query links
```

Task projections now carry optional `contextPackRefs` and `evidencePacketRefs`. Each descriptor retains the packet ID, revision, type, source, freshness, status, authority, locator, and timestamps, with evidence IDs/relation or selected-item count where available. Packet bodies are not embedded or preloaded.

Legacy task snapshots without either field remain valid. Malformed reference entries are dropped by the bounded normalizer rather than displayed as authoritative data. Missing and unavailable states are explicit (`NOT_PERSISTED`, `UNAVAILABLE`, `MISSING`, or `STALE`).

## Acceptance evidence

### Task projection

- PASS — Core types, snapshot adapter, and derived task-state adapter carry both optional ref sets.
- PASS — Core normalization accepts the repository’s current Context Pack aliases (`packId`, `sourceRevision`, `sourcePath`) and Evidence Packet aliases (`evidencePacketId`, `authorityOwner`, `edgeType`) without changing canonical output fields.
- PASS — Console uses typed Zod schemas with additive `.passthrough()` compatibility.
- PASS — fixture coverage includes Context-only, Evidence-only, both, legacy, stale, and missing states.
- PASS — live task graph/current state served through Core contain no persisted packet refs today; the Console shows zero attached refs and explicit `NOT_PERSISTED` detail. No live reference was fabricated to make acceptance appear complete.

### Brain Console detail

- PASS — task detail renders compact Context Pack and Evidence Packet ref cards.
- PASS — selecting a card uses stable `/brain/tasks/{taskId}?context={packetId}` or `?evidence={packetId}` state.
- PASS — selected detail is bounded metadata only; full packet bodies, provider payloads, secrets, and transcripts remain unloaded.
- PASS — graph nodes show only refs actually attached to that task and link to the same stable detail state; no inferred nodes or edges are added.
- PASS — the Evidence gate links directly to an attached Evidence Packet ref when one exists and remains `NOT_PERSISTED` when none exists.
- PASS — continuity steps carry the same ref sets and expose task-detail links, preserving refs across the resume projection.

### Runtime and browser verification

- PASS — `/runtime/identity`: `identityState=matching`, source and deployment both `d665bcf345c34ef4357a751f4699703c9afe14c8`.
- PASS — deployment mode `production`; runtime `running`; launch mechanism `launchagent`.
- PASS — `GET /brain`, `/brain/active-work`, `/brain/tasks-evidence`, `/brain/quality-safety`, `/brain/continuity`, `/brain/capability-routing`, and `/brain/tasks/0C-C?...` returned HTTP 200.
- PASS — 1141×797 Brain Overview: document scroll delta 0px; raw task disclosure closed; dead-link count 0; current task data rendered.
- PASS — warm browser navigations after deployment: 830–953ms in four measured runs.
- PASS — deterministic browser fixture interception rendered both reference cards, selected Context detail, both stable deep links, no packet-body preload, and HTTP 200 task detail.

## Validation

- PASS — Brain Core full suite: 1,966 tests passed.
- PASS — Brain Core typecheck and production build.
- PASS — Brain Console typecheck and production build.
- PASS — Brain Console contract suites: 10 tests passed.
- PASS — source diff check (`git diff --check`).
- PASS — shared checkout `/Users/Office/Repos/stevewesthoek/brain` remained untouched; implementation ran in isolated worktree `/Users/Office/Repos/stevewesthoek/brain-console-2-persisted-context-evidence`.

## Files changed

- `projects/brain-core/src/types/agent-task-references.ts`
- `projects/brain-core/src/adapters/agent-task-references.ts`
- `projects/brain-core/src/types/api.ts`
- `projects/brain-core/src/adapters/agent-ledger.ts`
- `projects/brain-core/src/adapters/agent-task-state.ts`
- `projects/brain-core/src/tests/agent-task-references.test.ts`
- `projects/brain-console/lib/braincore-schemas.ts`
- `projects/brain-console/lib/fixtures/brain-workspace-task-references.json`
- `projects/brain-console/components/brain-workspace.tsx`
- `projects/brain-console/app/brain/tasks/[taskId]/page.tsx`
- `projects/brain-console/app/globals.css`
- `projects/brain-console/lib/brain-workspace-contract.test.mjs`

No LaunchAgent, scheduler, provider/model-routing, Infinite Brain shell, or Computer/Operations surface was changed.
