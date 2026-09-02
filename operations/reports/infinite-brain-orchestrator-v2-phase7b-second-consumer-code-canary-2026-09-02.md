# Infinite Brain Orchestrator v2 Phase 7B — Second-Consumer Code Canary

**Date:** 2026-09-02  
**Decision:** `CANARY_ACCEPTED`  
**Scope:** Claude Code consumer × Code domain only  
**Universal Contract:** `1.0.0`  
**Adapter:** `adapter.claude-code.v1` (`claude-code-adapter@1.0.0`)

## 1. Baseline and source

- Verified `origin/main` before work: `6aacb3ab73bb8124f26c84968d9c5ffd05a183bd`.
- Clean canary source revision: `87809d17df3affc9e3b245e45a706564795f0674`.
- Implementation commits: `afa27ea2` (adapter/controller/runner), `517c254b` (canonical composition alignment), and `87809d17` (atomicity/dormant evidence).
- Canonical documentation commit: `82a42cb1`.
- Integrated implementation/documentation parent on `main`: `7c00a68f`.
- The original dirty checkout was not used or modified; all implementation work was isolated in the Phase 7B worktree.

The clean runner required zero dirty items and recorded Claude Code `2.1.251 (Claude Code)`. The selected projection files were present: `operations/system-configs/claude/CLAUDE.md`, `settings.json`, hooks, and skills.

## 2. Selected consumer

The selected first non-Codex consumer is **Claude Code**, exactly as recommended by Phase 7A. It was selected because the Phase 7A report named it explicitly, the local runtime is available, and its filesystem, Git, shell, testing, interactive qualification, receipt, and continuity capabilities are equivalent for a bounded Code canary.

The canary does not make Claude Code the default. Browser, MCP, web, and visual capabilities remain host-dependent alternatives and are recorded as such. This evidence path intentionally performs no provider call and grants no execution authority.

## 3. Current broad-conformance drift classification

The broad conformance recheck was run independently and its findings were not suppressed:

| Exact finding | Classification | Phase 7B effect |
|---|---|---|
| `mcp:workbench: revision-mismatch (HEAD=4e6e8502bc778f7e301ea0aaa4fb1e7198e12c21 admitted=bbbbadb2997140bd0f818a3ba00f36f2d8f80198)` | Workbench artifact/source/provenance drift | Nonblocking for Claude Code + Code targeted gates |
| `mcp:workbench/packages/mcp/runtime-provenance.json: artifact-digest-mismatch` | Workbench artifact drift | Nonblocking |
| `mcp:workbench/packages/shared/src/workbench-command-contract.ts: artifact-digest-mismatch` | Workbench artifact drift | Nonblocking |
| `mcp:workbench/docs/openapi.chatgpt.json: artifact-digest-mismatch` | Workbench artifact drift | Nonblocking |
| `mcp:workbench/apps/web/src/app/api/actions/run-command/route.ts: artifact-digest-mismatch` | Workbench artifact drift | Nonblocking |
| `mcp:workbench/packages/cli/src/agent/n8n-workflow-migration-command-adapter.ts: artifact-digest-mismatch` | Workbench artifact drift | Nonblocking |
| `mcp:workbench/packages/cli/src/agent/config.ts: artifact-digest-mismatch` | Workbench artifact drift | Nonblocking |
| `mcp:workbench: runtime-provenance-source-revision-not-admitted` | Workbench provenance/index drift | Nonblocking |
| `mcp:workbench/package.json: provenance-digest-mismatch` | Workbench provenance drift | Nonblocking |
| `node tools/validate-infinite-brain-scheduler-inventory.mjs` unavailable | Scheduler historical/current-state validation drift | Nonblocking; command remains visible |
| `node tools/validate-typed-scheduler-jobs.mjs` unavailable | Scheduler historical/current-state validation drift | Nonblocking; command remains visible |
| `node tools/validate-mcp-provider-admissions.mjs --provider-root workbench=/Users/Office/Repos/prochattools/saas/workbench-private` unavailable | Workbench/provider-admission validation drift | Nonblocking; no provider path was exercised |
| `network_access=false` | Conformance environment boundary | Expected for this isolated evidence run |
| `personal_mind_content_read=false` | Conformance environment boundary | Expected; no Mind content was needed |

These findings do not invalidate the targeted canary: clean Universal Contract/projection checks, capability handshake, Brain Code route, task/evidence packets, graph, gates, continuity, privacy, fallback, and rollback all passed.

## 4. Adapter thinness audit

Claude Code adds only `tools/context-learning/claude-code-consumer-adapter.mjs`. Its responsibilities are limited to native message/workspace/session translation, environment capability reporting, adapter/session metadata, universal-result rendering, and continuation exposure. The generic canary boundary supplies state selection, prior-path fallback, and receipts.

The adapter contains no Code route selection, qualification algorithm, specialist selection, context budget, packet decomposition, graph composition, gate policy, model/provider policy, safety downgrade, transcript state, or automatic resume. The universal pipeline now consumes the canonical `composeShadowRequest` result used by the Codex default, preventing consumer-specific semantic drift.

## 5. Capability comparison

| Capability | Codex | Claude Code | Classification |
|---|---|---|---|
| filesystem | observed | observed | SAME |
| git | observed | observed | SAME |
| shell | observed | observed | SAME |
| structured output | observed | observed | SAME |
| continuation | observed | observed | SAME |
| interactive qualification | observed | observed | SAME |
| MCP | observed | host-dependent | ALTERNATIVE |
| browser | observed | host-dependent | ALTERNATIVE |
| web | observed | host-dependent | ALTERNATIVE |
| visual | host-dependent | host-dependent | SAME |

The canonical Brain capabilities (`brain.contract.v1`, `brain.route`, `brain.packet`, `brain.context`, `brain.receipt`, and `brain.continuity`) negotiated `SUPPORTED`. No required capability was silently omitted; semantic Code capability differences required: `0`.

## 6. Canary activation

The selected activation was exactly `claude-code × code`, with mode `CANARY` and the transition:

```text
CONFORMANT → CANARY_ACTIVE
```

Preconditions passed: clean source, Claude Code runtime/projection reachability, Universal Contract validation, capability handshake, Code capability owned by `skill.code`, Context Broker/continuity path, redacted receipts, prior-path availability, model/provider independence, and safety parity. `productionActive=false`, `defaultActive=false`, and activation was not broadened to another domain or consumer.

## 7. Serial Code burn-in

The serial burn-in was **10/10**. It covered known-file bug, unknown-area bug, small feature, multi-file feature, frontend, backend/API, test repair, refactor, performance, and security prompts. Every burn-in case selected the Brain-owned Code v2 path, with no provider calls, writes, execution, or automatic resume.

## 8. Selected-consumer Code cohort

The actual Claude Code consumer-boundary cohort contained **100 serial cases** (threshold ≥75): vague/exact requests, bugs, features, frontend, backend/API, configuration, performance, security, testing, refactoring, continuation, stale context, high-risk operations, dormant specialists, and out-of-domain requests. It selected v2 for `80` cases and the explicit legacy path for `20`; every case produced a valid v2 or legacy outcome, with no silent fallback or safety bypass.

## 9. Fifty-prompt parity against Codex v2 default

The identical Code parity set contained **50 prompts** (threshold ≥50):

- semantic parity: `50/50`, **100%** (threshold ≥99%);
- owner/route parity: `100%`;
- specialist parity: `100%`;
- qualification parity: `100%`;
- risk and confirmation parity: `100%`;
- selected capability/role parity: `100%`;
- mandatory quality-gate parity: `100%`;
- safety-gate parity: `100%`;
- context-scope parity: `100%`;
- continuity and execution-readiness parity: `100%`;
- consumer-only semantic differences: `0`.

## 10. Isolated coding tasks

The selected consumer completed **15/15** disposable isolated coding fixtures (threshold ≥15). Each fixture covered implementation, tests, Review, QA, Evidence Packet, and completion evidence. Final passes: `15`; Evidence Packets: `15`; critical defects: `0`; production writes: `0`; Mind writes: `0`; repair cycles: `0`.

## 11. Output quality

All isolated fixtures passed implementation, test, Review, QA, and Evidence Packet checks. Code cases retained the required Review and QA gates. No quality gate was weakened, skipped, or made consumer-specific. The result remained a bounded BrainResult with task, graph, evidence, gate, receipt, and continuation references.

## 12. Qualification parity

All **12/12** ambiguous-product qualification fixtures matched the Codex default: `100%` parity, `0` unnecessary questions, and `0` missed material ambiguities. There were `0` questions asking the user to choose a skill, architecture, model/provider, or profile.

## 13. Dormant skill parity

Three dormant-specialist fixtures were descriptor-visible and selected the same relevant capability intersection in both consumers. Ambient full-body reads: `0`; global activation: `false`; unrelated dormant activation: `0`. Selection remained lazy and Brain-owned.

## 14. Atomic context

Atomic context checks passed in both consumers:

- ambient all-skills load: `false`;
- unrelated full-skill reads: `0`;
- dormant full-body reads during descriptor listing: `0`;
- full repository loaded: `false`;
- full conversation loaded: `false`;
- secrets loaded: `false`;
- maximum bootstrap target: `800` tokens;
- maximum descriptor forecast: `10,603` tokens;
- maximum selected instruction forecast: `25,774` tokens;
- maximum simultaneous active context: `1,050` tokens.

## 15. Safety parity

Safety parity was **100%**. Deploy, delete production data, rotate credentials, and modify billing cases retained the same high/critical risk and confirmation boundary as Codex. All four selected the legacy safety boundary; execution-ready results: `0`; provider calls: `0`; writes: `0`; external mutations: `0`; Mind writes: `0`; production side effects: `0`. No credentials, financial action, destructive action, deployment, or public-content action executed.

## 16. Continuity and handoff

Both directions passed through the same continuity contract:

- Codex → Claude Code: `READY_READ_ONLY`;
- Claude Code → Codex: `READY_READ_ONLY`;
- stale source: `BLOCKED` with `source_revision_stale`;
- conflicting source: `BLOCKED` with `source_session_conflict`;
- transcript replay: `false`;
- automatic resume/takeover: `false`.

Handoff packets retained repository/worktree/branch/revision identity, objective, completed and pending work, decisions, changed files, validation evidence, freshness, conflicts, and explicit continuation point. No transcript was treated as canonical state.

## 17. Failure and fallback

Adapter failure, tool unavailable, Context Broker unavailable, selected skill unavailable, invalid graph, and continuity conflict were all exercised. Every failure produced explicit legacy fallback or a universal blocked result, preserved the prior path `claude-code-current-entry`, and kept provider calls, writes, execution, and automatic resume at zero. Silent fallback count: `0`; safety bypasses: `0`.

## 18. Live rollback drill

Rollback passed while the canary was active:

```text
CANARY_ACTIVE → ROLLED_BACK → legacy prior path
                 ↓ validation
              CONFORMANT → CANARY_ACTIVE
```

The rollback probe selected legacy, invoked no v2 path, replayed no task/evidence packet, and required no manual configuration surgery. Re-enable succeeded only after validation. Elapsed rollback evidence: `0` seconds in the deterministic fixture; packet inertness: `true`.

## 19. Universal Contract regression

The existing Universal Contract test suite passed `11/11`, including 228-scenario consumer conformance, every reference adapter, capability negotiation, model/provider swap invariance, stale continuation, no-transcript replay, consumer-independence validation, semantic projection, and dormant specialist behavior. The new Claude Code canary test suite passed `5/5`. Cross-session continuity tests passed `3/3`.

No active-skill projection, Claude settings, Codex default, other client, other domain, provider admission, scheduler, Workbench, or Mind state was mutated by the canary.

## 20. Final canary state

- final state: **`CANARY_ACCEPTED`**;
- consumer: `claude-code`;
- domain: `code`;
- mode: `CANARY`;
- default active: `false`;
- production active: `false`;
- Codex Code default: preserved;
- other consumers activated: `0`;
- other domains activated: `0`.

## 21. Recommendation

The next domain canary is **Research**, exactly as recommended by the Phase 7A closeout. It requires separate authorization and its own domain-specific evidence; it is not activated by Phase 7B.

## 22. Rollout matrix

| Domain × consumer | Codex | Claude Code | Cursor | Kiro | Antigravity | Gemini | Workbench |
|---|---|---|---|---|---|---|---|
| Code | DEFAULT_ACTIVE | CANARY_ACCEPTED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Research | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Design | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Web | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Memory | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |
| Review/QA/Handoff/Careful/Video | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED | NOT_PERFORMED |

Infinite Brain Orchestrator v2 Phase 7B is accepted: the same Brain-owned Code
orchestration contract now runs successfully through a second real consumer
without semantic duplication, while preserving descriptor-first discovery,
atomic context, quality/safety gates, continuity, fallback, rollback, and
consumer isolation.

NEXT DOMAIN CANARY: Research
