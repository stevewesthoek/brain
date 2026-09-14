# Agent Mode U0-E Resource Visibility Evidence — 2026-09-14

## Status and scope

Starting HEAD for this bounded slice was `ae715035` (`feat(agent-mode): harden
console control audit`). K0–K5 and U0-A through U0-D were already complete;
U0 remained in progress. No newer U0-E implementation was present. The three
protected unrelated worktree paths were preserved and were not staged.

U0-E closes the durable read-model visibility gap only. It does not add live
model calls, provider probes, inventory scans, mutations, new authorization,
new StateStore tables, Workcell execution, BrainNode operations, or a second
runtime/result ledger.

## Canonical projection

The existing Brain-owned `agent-mode-console-v1` projection at
`GET /agent-mode/console` now includes three additional bounded collections:

- `rootGoals`: durable root policy/deadline/budget facts with Jarvis/supervisor
  and organization ownership where known;
- `workcells`: safe repository reference, branch/base, owner, lifecycle, latest
  lease, validation, diff, review, commit, and merge metadata;
- `executionResources`: distinct attempt/dispatch execution facts.

Existing `runtimes`, `modelResources`, and `nodeResources` remain separate.
Node resources use only the observer's durable `infrastructure.host-health`
source. There are no provider, host, SSH, Tailscale, runtime, AWS, or model
probes. Codex quota and richer node/worktree inventory remain explicitly
unavailable/not yet surfaced because no canonical durable Brain source is
available to this slice. Jarvis intake and notifications are likewise not
invented.

Every new collection is capped at 100 records. Ordering is active before
terminal, newest updated first, then stable identity. Root and Workcell detail
uses the existing `agent-mode-console-detail-v1` route and adds closed `root`
and `workcell` kinds. Detail remains metadata-only: no absolute paths, writer
lease fences, raw diffs, prompts, hidden reasoning, provider payloads, or
credentials.

### Field inventory

The U0-E gap audit classified the requested visibility fields as follows:

| Class | Fields and disposition |
| --- | --- |
| A — already surfaced | Agent/Task/Run/Attempt lifecycle, durable runtime/model/provider route facts, budgets, schedules, approvals, evidence metadata, failures, and control-audit metadata from the existing projection. |
| B — surfaced by U0-E | Root goal and Jarvis ownership, root policy/deadline/budget facts, Workcell repository/branch/base metadata, lease/validation/diff summary, review/commit/merge status, durable node health, and per-attempt execution resources. |
| C — no canonical durable source | Live Codex quota, live provider/host availability, richer inventory telemetry, notifications, and Jarvis intake/escalation state where Brain has no authoritative persisted projection. |
| D — intentionally deferred or excluded | Provider probes, inventory scans, raw diffs/files, absolute worktree paths, lease fences, mutation controls, and any new runtime or resource ledger. |

Class C fields are reported as unavailable/not yet surfaced rather than
synthesized. Class D fields are not admitted to the projection contract.

## Console surface

Brain Console `/agents` continues to use only `brainCoreRequest()`, TanStack
Query, and strict Zod validation. It now has read-only Roots, Workcells, and
Resources views alongside Overview, Agents, Organizations, Tasks, and
Failures. Existing guarded controls remain unchanged and no new action button
was added. Loading, unavailable, stale, and empty states remain explicit.

The browser does not read SQLite or filesystem state, persist authority in
local storage, or call providers. A refresh or independent second client
reconstructs the same domain state from Brain Core; `generatedAt` is request
metadata only.

## Validation evidence

Focused Core validation: **50/50 passed** across observer, projection/detail,
K5-A/K5-B/K5-C, controls, restart, and concurrency tests. The updated Core
projection/detail tests explicitly cover Root Goal/Jarvis ownership, Workcell
lease/validation/diff metadata, resource separation, redaction, and new detail
kinds. Console schema validation: **7/7 passed**, including empty projection,
strict malformed responses, uncertainty, K5 final-result metadata, Root Goal,
Workcell, and execution-resource parsing.

Build/type validation:

- Brain Core `npm run typecheck`: passed;
- Brain Core `npm run build`: passed;
- Brain Console `npm run typecheck`: passed;
- Brain Console `npm run build`: passed;
- `git diff --check`: passed.

The full Brain Core suite was attempted. It reached the long-running legacy
orchestration tests but exceeded the bounded command window before emitting a
final aggregate summary. No failure appeared in captured output; the full
suite is therefore not claimed as completed. The focused Agent Mode/K4 suite
remained green. The local browser inspection used a separate development
surface and verified the `/agents` route, navigation, eight tabs, explicit
unavailable/loading behavior, and the existing compact layout. The shared
default Brain Core port was an older service without this branch's route, so a
live populated projection was not claimed from that process.

## Security and authority audit

The new code only maps existing observer records. It does not insert Agent,
Task, Run, Attempt, Workcell, budget, scheduler, or approval state; it does
not call AgentRuntime, Harness, ModelGateway, AWS, BrainNode, Workcells, or
network services. No Console database or inventory ledger was added. Runtime,
model, node, and execution-resource identities are typed separately. Safe
repository references are retained while absolute repository/worktree paths
and lease fences are omitted. Unknown durable state is represented as null,
unknown, or unavailable rather than probed or synthesized.

## U0 decision

U0-E is **COMPLETE** for the bounded durable resource-visibility gate. U0
remains **IN PROGRESS**. The authoritative next bounded slice is **U0-F —
Durable Escalations, Unread Notifications, and Remaining Resource/Quota
Visibility Gaps**, subject to the next roadmap review. U0-F was not started.
