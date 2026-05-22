# Brain Agentic OS — Roadmap

**Date:** 2026-05-22
**Owner:** Steve Westhoek
**Status:** Active
**Strategy:** `docs/system/brain-agentic-os-strategy.md`

---

## Vision

Brain evolves from a skill/config layer into a complete agentic operating system — where lower-tier models execute tasks autonomously using verification loops, persistent context, and structured implementation plans.

---

## Phases

| Phase | Goal | Timeline | Status |
|-------|------|----------|--------|
| **Phase 1** | GrepLoop — autonomous verification loops | 2026-05-22 → 2026-05-24 | **complete** |
| **Phase 2** | opensrc — dependency source access | 2026-05-24 → 2026-05-25 | **complete** |
| **Phase 3** | Persistent codebase graph | 2026-05-25 → 2026-05-27 | **complete** |
| **Phase 4** | code-structure — refactoring intelligence | 2026-05-27 → 2026-05-28 | **complete** |
| **Phase 5** | SvelteKit default decision + boilerplate | 2026-05-28 → 2026-06-01 | **complete** |
| **Phase 6** | Agent Ledger & Auditability — append-only audit trail | 2026-05-29 → 2026-06-07 | **complete** |
| **Phase 7** | Multi-Agent Orchestration — parallel work coordination | 2026-06-08 → 2026-06-20 | **complete** |

---

## Phase 1: GrepLoop — Autonomous Verification Loops

**Goal:** Build a `/greploop` skill that iterates review → fix → re-review until clean or max iterations reached.

**Value:** Closes the gap between "review found issues" and "issues fixed." Currently manual. After this phase, autonomous.

**Exit criteria:**
- `/greploop` skill file exists at `ai/skills/custom/greploop/SKILL.md`
- Skill is symlinked to `active/`
- Skill synced to all AI consumers
- The skill defines: trigger phrases, max iterations (3), stop conditions, escalation rules
- Integration with existing `/review` and `/code fix` workflows documented

---

## Phase 2: opensrc — Dependency Source Access

**Goal:** Install opensrc globally and create a Brain skill that lets AI agents read actual dependency source code.

**Value:** Agents can debug library internals, understand edge cases, and learn patterns from well-known implementations without manual repo cloning.

**Exit criteria:**
- `opensrc` installed globally via npm
- Skill file at `ai/skills/custom/opensrc/SKILL.md` with trigger phrases
- Symlinked to `active/`
- Synced to all AI consumers
- Verified: `opensrc path zod` returns a valid path

---

## Phase 3: Persistent Codebase Graph

**Goal:** Cache graphify output per-repo and reload at session start. Incrementally update on git diff.

**Value:** Agents start sessions with structural understanding. No cold-start penalty. Enables smarter refactoring decisions.

**Exit criteria:**
- Convention defined: `.brain/graph.json` in each instrumented repo
- `/graphify` skill updated with persistence instructions
- Cache reload logic documented
- Incremental update pattern documented (regenerate on significant git diff)

---

## Phase 4: code-structure — Refactoring Intelligence

**Goal:** Add the service-layer extraction skill as a sub-strategy for `/code improve` workflows.

**Value:** Prevents both spaghetti (no extraction) and astronaut architecture (premature extraction). Activates only when cross-flow duplication is detected.

**Exit criteria:**
- Skill installed at `ai/skills/vendors/shimeles/code-structure/SKILL.md`
- Symlinked to `active/`
- `/code` orchestrator SKILL.md updated with integration instructions
- Activation condition documented: "2+ callers with duplicated operational logic"

---

## Phase 5: SvelteKit Default for New Projects

**Goal:** Establish SvelteKit as the default frontend for new web projects. Document the decision. Create a boilerplate.

**Value:** AI agents produce more correct, more concise code. 30-40% less code per component. No hooks footguns. Single-file encapsulation.

**Exit criteria:**
- Decision recorded in `operations/decision-log.md`
- SvelteKit boilerplate repo created or template documented
- `/code build` workflow updated to default to SvelteKit for new web projects
- Existing Next.js projects explicitly excluded from migration

---

## Phase 6: Agent Ledger & Auditability

**Goal:** Build an append-only event ledger that logs all agent decisions, tool calls, state mutations, and approvals.

**Value:** Enables forensic debugging ("why did agent choose X?"), compliance reporting, cost tracking, and reproducible investigation of failures.

**Exit criteria:**
- Ledger writer at `projects/brain-core/src/adapters/agent-ledger-writer.ts` with validation
- Ledger reader with query interface at `projects/brain-core/src/adapters/agent-ledger-reader.ts`
- CLI tools: `ledger-query`, `ledger-replay`, `ledger-report` all symlinked to `~/.local/bin/`
- Ledger schema documented in `operations/standards/agent-ledger-standard.md`
- Forensic debugging runbook at `operations/runbooks/ledger-forensic-debugging.md`
- Brain Console ledger view widget displaying real-time event stream
- Cost transparency widget showing live cost tracking

---

## Phase 7: Multi-Agent Orchestration

**Goal:** Enable parallel execution of independent subtasks across multiple agents with work queue, load balancing, and result merging.

**Value:** 60-70% cost reduction for parallelizable work (e.g., code review 3 modules in parallel vs serial). Foundation for scaling to many concurrent agents.

**Exit criteria:**
- Work queue manager at `projects/brain-core/src/adapters/work-queue-manager.ts`
- Task distributor with load balancing at `projects/brain-core/src/adapters/task-distributor.ts`
- Subagent executor at `projects/brain-core/src/adapters/subagent-executor.ts`
- Agent pool manager at `projects/brain-core/src/adapters/agent-pool.ts`
- Result merger with conflict resolution at `projects/brain-core/src/adapters/result-merger.ts`
- Transaction manager with checkpoint/rollback at `projects/brain-core/src/adapters/transaction-manager.ts`
- `/orchestrate` skill at `ai/skills/custom/orchestrate/SKILL.md` symlinked to `active/`
- CLI tool: `orchestrate` command-line orchestrator
- Orchestration debugging runbook at `operations/runbooks/multi-agent-orchestration-debugging.md`
- Orchestration standard at `operations/standards/multi-agent-orchestration-standard.md`
- Ledger integration: `parallel_work_*` events tracked

---

## Non-Goals (Evaluated and Rejected)

| Technology | Reason for rejection |
|------------|---------------------|
| **Greptile** | High overlap with existing /review + /codex + /graphify. $30+/month for features we already have. GrepLoop pattern is the only value-add → we build it ourselves (Phase 1). |
| **Daytona** | Overkill for solo developer. Bash hooks + OrbStack containers sufficient for local isolation. Revisit when running multi-agent parallel workloads at scale. |
| **Convex** | Supabase (self-hosted, full SQL) is well-established. Convex's document model is a downgrade for complex data. Consider only for a greenfield real-time prototype. |
| **Building own runtime loop** | Claude Code/Codex/Gemini improve their loops weekly. Brain should configure, not replace. |

---

## Dependencies

- Phase 1 has no dependencies. Can start immediately.
- Phase 2 depends only on npm access. Can start immediately.
- Phase 3 depends on graphify being functional. Already is.
- Phase 4 depends on Phase 3 (graph needed to detect duplication).
- Phase 5 has no technical dependencies. Decision only.
