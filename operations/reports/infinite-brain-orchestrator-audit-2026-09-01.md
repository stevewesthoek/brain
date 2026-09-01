# Infinite Brain Orchestration Architecture Audit

**Date:** 2026-09-01
**Audit source:** `origin/main` at `46bec0626b3d61c35f5f7da3b1a538c17978a4e2`
**Audit branch:** `codex/infinite-brain-orchestrator-audit-2026-09-01`
**Scope:** read-only architecture, orchestration, skill/profile, runtime-contract, and documentation audit
**Source worktree:** `/Users/Office/Repos/stevewesthoek/brain-orchestrator-audit-2026-09-01`

## Executive finding

Brain has a strong foundation: explicit Brain/Mind authority boundaries, a compact default profile, mature domain workflows, safety policies, a tested read-only Context Broker, bounded context packs, and a provider-neutral universal-entry contract. The missing layer is orchestration convergence. Natural-language routing is still principally markdown guidance plus profile selection; the accepted Broker and universal-entry surfaces are not activated as a common client runtime; capabilities have several overlapping registries; and task state, evidence, routing, risk, and quality gates are not carried in one shared packet.

The result is a system that can be excellent when the correct orchestrator is already in the active surface or is manually discovered, but inconsistent at the black-box boundary. `/code`, `/research`, `/memory`, `/review`, `/qa`, `/handoff`, and `/careful` are active; `/design`, `/web`, and `/video` are documented master orchestrators but dormant in the default profile. The profile system intentionally keeps context small, but the current repository does not yet provide a machine-enforced way to select the smallest correct dormant capability from arbitrary natural language.

## Final verdict

Strong foundation but v2 required

## Audit method and boundaries

The audit used exact current source from the clean `origin/main` worktree after `git fetch origin`. It used entrypoint documents, skill/profile indexes, source `SKILL.md` files, runbooks, runtime contracts, Brain Core adapters, focused validators, and focused tests. Generated projections and placeholder UI registries were treated as navigation evidence only. The audit did not use the dirty starting checkout as source authority, did not read secrets, and did not activate a profile or sync consumer links.

The pasted brief requested five deliverables and an architecture-only pass. Therefore this report distinguishes:

- **Current:** directly evidenced in `origin/main` or in a read-only validation result.
- **Documented intent:** described by a policy/runbook but not necessarily runtime-enforced.
- **Proposed:** a v2 design recommendation; not an existing capability.

## Inventory snapshot

| Surface | Current evidence | Count / status |
|---|---|---:|
| Source skill files | `ai/skills/custom/**/SKILL.md` plus `ai/skills/vendors/**/SKILL.md` | 137 total: 95 custom, 42 vendor |
| Top-level skill families | `ai/skills/custom/*`, `ai/skills/vendors/*` | 62 directories: 53 custom, 9 vendor |
| Default active entries | `docs/skills/profiles/default.txt`, `ai/skills/active/` | 7 |
| Profile files | `docs/skills/profiles/*.txt` | 8 |
| Legacy recovery profile | `docs/skills/profiles/full-current.txt` | 120 entries; duplicate `brain-nightly-scheduler-new-job` |
| Gstack vendor skill files | `ai/skills/vendors/gstack/**/SKILL.md` | 28 |
| Broad orchestration-language hits | `SKILL.md` files containing orchestration/workflow language | 86; this is a discovery count, not a claim that all are top-level orchestrators |
| Broker operations | `broker-contracts-v1.schema.json` and `context-broker.mjs` | 9, read-only |
| Context Broker schema definitions | `broker-contracts-v1.schema.json` | 15 |
| Context-learning fixture profiles | `validate:context-learning-broker` output | 2 |
| Brain Core static orchestrator registry | `projects/brain-core/src/adapters/orchestrators.ts` | 11 placeholder entries; not a source-of-truth skill router |
| Agent capability manifest | `projects/brain-core/src/adapters/agent-capabilities.ts` plus CLI/AI-surface manifests | Exists; useful seed, not yet the universal route catalog |

The 137 source files are intentionally not all active. The profile architecture says dormant source skills remain available and the default should stay near seven entries. That is a sound context-cost decision, but it creates a requirement for reliable discovery and activation that is not yet implemented in the runtime.

## Current active and dormant routing surface

### Default active profile

`docs/skills/profiles/default.txt` contains exactly:

```text
code
research
memory
review
qa
handoff
careful
```

`switch-skill-profile.mjs default --dry-run --verbose` resolves all seven and reports a matching seven-entry target. The profile comments explicitly move heavy orchestrators such as design and video, and tool skills such as Firecrawl, into domain profiles. This keeps the ordinary context surface small.

### Domain profiles

| Profile | Entries | Read-only dry-run result |
|---|---:|---|
| default | 7 | PASS; all resolve |
| design | 14 | PASS; includes design, web-design, design review/polish, graphify, media acquisition |
| research | 14 | FAIL; unresolved `gemini` |
| video | 17 | FAIL; unresolved `n8n` |
| deploy | 22 | FAIL; unresolved `hetzner`, `aws`, `azure`, `supabase` |
| productivity | 5 | PASS; all resolve |
| power | 18 | FAIL; unresolved `n8n` |
| full-current | 120 | FAIL; duplicate `brain-nightly-scheduler-new-job` |

This is a material operational gap: the profile design is the intended context-budget mechanism, but three commonly relevant profiles do not pass their own resolution contract. The failure is visible and fail-fast, which is safer than silent omission, but it makes “natural-language routing to dormant skills” unreliable.

### Consumer/export state

Source `origin/main` contains these projections:

- Claude, Gemini, and Cursor point at `ai/skills/active`.
- The Codex projection has a managed `skills` directory rather than the same root-link shape.
- Antigravity points at `/Users/Office/.gemini/config/skills`, not `ai/skills/active`.
- Kiro’s expected projection is absent in the clean worktree.

`sync-ai-skills.mjs --check` therefore fails on the clean source: Antigravity has the wrong target, and all seven Kiro reachability checks fail. This was checked read-only. The live machine state is not equivalent to source `origin/main`: local Claude, Codex user skills, and Gemini expose eight entries through the dirty checkout, and the Codex root also contains `hatch-pet`. Those are observations of machine-local state, not changes made by this audit.

### Branch/source drift

The starting checkout contains uncommitted capability-discovery changes not present in `origin/main`, including `tools/discover-capabilities.mjs` and an active capability-discovery skill. The clean audit source has `ai/policy/capability-discovery.md` but not that runtime discovery script or skill. This is important evidence of a source/consumer drift risk: a newer local configuration can make the system appear more automatically discoverable than the fetched source actually is.

## Orchestrator taxonomy

The audit treats “orchestrator” as a role, not merely a filename. The following groups cover the real user-facing and composition surfaces found in source:

| Role | Members / source | Current interpretation |
|---|---|---|
| Active master entrypoints | `code`, `research`, `memory` | Natural-language-facing active workflows |
| Active quality/safety/continuity gates | `review`, `qa`, `careful`, `handoff` | Strong operational workflows, but not all are thin gates |
| Dormant domain masters | `design`, `web`, `video` | Mature domain routers that require profile or direct-source selection |
| Structural/context coordinators | `graphify`, `orchestrate` | Mapping and multi-agent coordination; not universal user routing |
| Broad composite workflow | `forge` | Raw SaaS idea-to-production launch workflow; too broad/high-risk for universal default routing |
| Domain composite | `viral-flow`, `stb-pipeline` | Video/content and Says the Bible pipeline-specific orchestration |
| Specialist domain router | `bible-research`, `scripture-sources` | Research/Bible methods and source acquisition; should remain composable specialists |
| Supporting quality/planning workflow family | gstack `autoplan`, `plan-*`, `investigate`, `ship`, `qa-only`, `land-and-deploy`, design review tools | Useful bounded modules; should not become additional top-level user choices |
| Runtime contract surfaces | `universal-brain-entry`, `universal-entry-consumer`, Context Broker | Read-only, tested, provider-neutral navigation and context contracts; not activated client orchestration |

The Brain Core `/orchestrators` adapter is not used as authoritative evidence of actual skill behavior. It returns eleven placeholder summaries, including “Brain Core,” “Brain Console,” and “Mind Steward,” with placeholder sources/statuses. This is a UI/API registry, not the current universal route graph.

## Score rubric

Scores are 1–10 and measure the current source surface, not the quality of the author’s intent:

- **Thinness:** 10 means a small adapter that delegates; 1 means a large body combining routing, domain knowledge, execution, and reporting.
- **Routing:** clarity and reachability of intent-to-workflow selection.
- **Qualification:** ability to infer safe defaults and ask only material questions.
- **Autonomy:** safe progress within scope without unnecessary user interruption; not authority to perform risky actions.
- **Composition:** ability to chain specialists, tools, and gates without duplicating their bodies.
- **Context discipline:** bounded, progressive, relevant context behavior.
- **Decomposition:** explicit task breakdown and parallel/serial decisions.
- **State:** structured state/artifact continuity beyond prose.
- **Gates:** explicit validation, approval, and stop conditions.
- **Domain quality:** quality of domain-specific judgment and output contract.
- **Failure behavior:** visible, bounded, fail-closed behavior.
- **Continuity:** handoff, resume, and cross-surface state quality.

## Orchestrator scorecard

| Orchestrator | Thin | Route | Qual. | Auto. | Compose | Context | Decomp. | State | Gates | Domain | Failure | Continuity | Mean |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `code` | 4 | 8 | 7 | 7 | 8 | 6 | 8 | 5 | 7 | 9 | 6 | 7 | 6.8 |
| `research` | 5 | 8 | 8 | 7 | 8 | 8 | 7 | 5 | 7 | 9 | 7 | 5 | 7.0 |
| `memory` | 6 | 8 | 8 | 6 | 6 | 6 | 5 | 8 | 5 | 9 | 6 | 6 | 6.6 |
| `review` | 2 | 7 | 5 | 7 | 7 | 7 | 8 | 7 | 9 | 9 | 7 | 7 | 6.8 |
| `qa` | 2 | 8 | 4 | 8 | 8 | 6 | 8 | 8 | 9 | 9 | 8 | 6 | 7.0 |
| `handoff` | 6 | 7 | 8 | 5 | 5 | 9 | 6 | 9 | 8 | 8 | 8 | 10 | 7.4 |
| `careful` | 9 | 6 | 8 | 8 | 3 | 7 | 3 | 4 | 9 | 8 | 9 | 3 | 6.4 |
| `design` | 4 | 8 | 3 | 4 | 9 | 7 | 9 | 8 | 9 | 10 | 7 | 7 | 7.1 |
| `web` | 4 | 9 | 3 | 7 | 9 | 7 | 8 | 6 | 8 | 9 | 8 | 5 | 6.9 |
| `video` | 2 | 9 | 8 | 7 | 10 | 7 | 10 | 9 | 9 | 10 | 8 | 7 | 7.8 |
| `graphify` | 4 | 8 | 8 | 6 | 7 | 8 | 9 | 8 | 6 | 9 | 7 | 6 | 7.2 |
| `orchestrate` | 8 | 6 | 6 | 8 | 9 | 5 | 9 | 5 | 4 | 6 | 5 | 4 | 6.3 |
| `forge` | 2 | 5 | 5 | 6 | 10 | 3 | 8 | 7 | 3 | 6 | 3 | 4 | 5.2 |
| `viral-flow` | 3 | 8 | 7 | 6 | 9 | 6 | 8 | 7 | 6 | 8 | 6 | 5 | 6.6 |
| `bible-research` | 5 | 8 | 7 | 6 | 8 | 8 | 8 | 6 | 7 | 10 | 9 | 6 | 7.3 |
| `scripture-sources` | 6 | 8 | 7 | 5 | 6 | 8 | 7 | 5 | 7 | 9 | 8 | 5 | 6.8 |
| `stb-pipeline` | 3 | 7 | 6 | 4 | 8 | 6 | 9 | 9 | 9 | 9 | 8 | 6 | 6.9 |

### Evidence by orchestrator

**`code` — strong routing and composition, not thin.** `ai/skills/custom/code/SKILL.md` defines eight workflows, map/plan/execute/review loops, dormant subskill routing, scope rules, and escalation. It is the best current general coding router. It is 580 lines, carries substantial workflow knowledge, does not expose a shared descriptor/state packet, and does not make QA automatic for every feature. Its documented “review before shipping” behavior is stronger than its general build-to-test behavior.

**`research` — strong method, incomplete runtime reachability.** `ai/skills/custom/research/SKILL.md` provides evidence levels, source-first laws, workflow types, domain routing, and research-repo output guidance. It routes Bible work to `bible-research` and web work to `web`, but those are dormant and the research profile currently fails on `gemini`. It recommends source ledgers and citations without producing a universal evidence packet or runtime route receipt.

**`memory` — clear intent taxonomy and structured stores.** `ai/skills/custom/memory/SKILL.md` separates recall, capture, facts, review, and maintenance, and the runbook documents `mem-search`, `mem-write`, and `mem-facts`. It has better state than most orchestrators, but its hot memory store, Mind authority, Brain operational learning, session state, and review/promote lifecycle are not represented by one common task packet. The current CLR direction correctly says `~/.brain/memory` should become derived hot recall rather than independent human truth.

**`review` — high-quality gate with too much execution inside it.** The gstack review source performs pre-landing review, completeness analysis, fix-first edits, user questions for ASK items, scaled adversarial review, and result persistence. It is valuable, but at 1,044 lines it is not a thin gate. Its preamble may write telemetry/state before review, and its fix-first behavior makes it a mutating workflow rather than a pure advisory gate.

**`qa` — high-quality, side-effectful QA workflow.** The gstack QA source covers browser testing, setup, screenshots, console checks, test bootstrap, tiering, fix loops, regression tests, commits, and reports. It requires a clean tree and may ask to install or bootstrap missing test infrastructure. That is appropriate for explicit QA/fix work, but not for unconditional routing of every small change. A future thin QA adapter should choose a tier and invoke this workflow only when the changed surface and risk justify it.

**`handoff` — strongest continuity convention.** The handoff source has compact state fields, `.ai/current.md`, optional milestone archives, decision-log references, exact next action, validation evidence, and confirmation before mutation on resume. Its gap is not the handoff format; it is that the format is not the common state/evidence packet for every orchestrator.

**`careful` — excellent deterministic command guard, narrow scope.** The 59-line source delegates shell protection to a PreToolUse hook and covers recursive deletion, database destructive commands, force-push, reset/restore, Kubernetes deletion, and Docker cleanup. It cannot by itself classify all production, credential, financial, external-state, or migration risk; those remain policy/configuration responsibilities. It also has no task-state or continuity role.

**`design` — exceptional domain quality, poor black-box qualification.** `ai/skills/custom/design/SKILL.md` has strong design laws, scenario classification, subskill composition, durable PRODUCT/DESIGN artifacts, planning gates, visual QA, and user triage. Its Step 0 requires one intake question and explicitly waits before routing, even when the target, existing project, or safe defaults could be discovered. It is 516 lines and dormant from default.

**`web` — good risk/repeatability decomposition, dormant and question-heavy.** The web source distinguishes research, interactive browser work, reusable Playwright automation, and scale scraping, with useful auth/anti-bot/checkpoint boundaries. Its Step 0 also mandates one bundled intake question. It is not in the default or research profile source, despite `/research` and routing docs pointing to it.

**`video` — richest pipeline composition, too thick for a universal entry.** The 1,188-line source has strong checkpointing, asset manifests, source preservation, TTS/render/post separation, platform policy checks, and explicit adapter boundaries. It is the strongest example of project/domain state, but its size and many platform concerns make it a domain engine behind a thin adapter, not a top-level universal router.

**`graphify` — good structural/semantic mapping workflow, not canonical authority.** It provides map/query/path/explain/update modes and bounded outputs. Brain’s current policy correctly treats Codebase Memory MCP as the preferred structural navigator when fresh, with exact source as authority, and Graphify as optional bounded semantic projection. Graphify should remain a provider behind the universal catalog rather than become the universal router.

**`orchestrate` — useful internal parallel coordinator.** It handles independent subtask decomposition, worker limits, monitoring, merge, and cost reporting in a small 65-line source. It lacks a universal task packet, strong failure/rollback semantics, and continuity binding. It should be an internal composition capability, not the user-facing `/orchestrate` answer to all intents.

**`forge` — broad launch workflow with unacceptable default blast radius.** It chains research, product, design, billing, cloud, and deployment concerns from a raw idea. That composition is useful as an explicitly authorized project workflow, but its context cost, side-effect range, qualification, and failure boundaries are not appropriate for default universal routing.

**`viral-flow` — coherent video strategy sub-orchestrator.** It has discover/angle/hook/script/analyze/post/account/series workflows and belongs behind `video`. It does not define generic risk, context, evidence, or continuity contracts.

**`bible-research` — high domain quality, proposed specialist status.** The source has unusually strong method safeguards: context, text-to-doctrine-to-application separation, translation comparison, original-language caution, tradition representation, uncertainty, and no fabricated citations. The runbook is marked “Proposed specialist skill package.” It lacks universal capability descriptors, a standard evidence packet, and a runtime activation path.

**`scripture-sources` — useful source-acquisition specialist.** It separates lookup, translation comparison, original-language checks, and support maps, and preserves provenance. It should remain subordinate to research/Bible routing. Its API/source availability and output persistence are not standardized with the generic research evidence model.

**`stb-pipeline` — strong project pipeline with explicit blocked boundaries.** Says the Bible pipeline has episode/SSML/YouTube scheduling state and controlled execution gates, but current scheduling/execution is blocked or policy-gated. It is project-specific and should not be treated as general Bible research or general video publishing.

## Architecture audit by requirement

| Requirement | Current state | Assessment |
|---|---|---|
| Thin orchestrators | Rich workflows exist, but code/design/web/video/review/QA combine adapter, method, and execution details | Partial; split adapters from domain engines |
| Natural-language routing | Policies and master skills describe routing; dormant skills are discoverable through indexes/profiles | Partial; no universal runtime router or route receipt |
| Qualification UX | Most routes classify silently; design/web mandate a bundled question; QA/review have environment/setup questions | Inconsistent; needs one policy and one question budget |
| Autonomy | Local reads/analysis and focused edits are encouraged; global policies set safe stops | Good policy, uneven enforcement across skills |
| Composition | Domain orchestrators compose specialists well; `orchestrate` can parallelize | Strong locally, weak cross-domain standard |
| Context discipline | Default profile is seven; Context Broker has bounded/cited packs; large skills remain active when selected | Strong foundation, missing automatic progressive selection |
| Decomposition | Code, video, web, and orchestrate define breakdowns; research is workflow-based | Good in domain islands |
| Shared state | Handoff, video, QA, review, and CLR have separate state/artifacts | No universal task/evidence packet |
| Quality gates | Review, QA, design review, Bible method, careful, and universal-entry gates exist | Strong gates, but invocation thresholds vary |
| Domain quality | Code/research/design/video/Bible quality is high and explicit | Strong; do not flatten into generic prompts |
| Failure behavior | CLR/entry/broker fail closed; profiles fail-fast; domain workflows vary | Strong contracts, uneven orchestration integration |
| Continuity | Handoff and CLR continuity contracts are strong and tested | Not automatically bound to every route |
| Runtime activation | CLR0–CLR4 and universal entry are accepted as repository implementations; client activation is explicitly unclaimed | Major gap between contract and consumer runtime |
| Capability catalog | Broker and agent manifests carry useful descriptor fields | Multiple catalogs; no one source-agnostic route catalog wired to clients |

## Context-model audit across Claude, Codex, and Gemini

The canonical loading order is guardrails → routing/runtime role → task orchestration → capability discovery → handoff/briefs → deterministic gates → active profile → dormant registries/profiles → exact task evidence. This is the right least-context principle. Claude is the primary long-context orchestrator; Codex is the focused reviewer/executor; Gemini is the large-context preprocessor. The configs consistently describe Brain/Mind separation and profile/index use.

The gap is implementation, not policy:

- No universal runtime loader consumes the order and emits a route/context receipt.
- Active skill metadata is a collection of full `SKILL.md` bodies, not compact descriptors with cost/risk/inputs/outputs.
- The Context Broker can list/inspect capabilities progressively, but no client activation is claimed.
- Domain profiles are not all resolvable.
- Existing model/agent capability manifests already contain safety class, approval requirements, preferred task types, and verification commands, but they are separate from the skill/profile index and not the universal route graph.
- The source/consumer projections are not fully synchronized.

## Black-box qualification and vague-prompt tests

These are static black-box tests of the documented behavior on a clean source. They intentionally do not invoke production clients or change profiles. “Observed result” means what the current docs/source require a compliant agent to do.

| Prompt | Intended route | Current observed behavior | Result |
|---|---|---|---|
| “Fix this bug.” | `code` → FIX/investigate | Classify and inspect the repository; no mandatory intake question. Scope may remain underspecified for a costly fix. | Partial |
| “Make this landing page better.” | `design` → upgrade/new classification | Mandatory Step 0 bundled intake question; routing waits for answer. | Fails minimum-question autonomy |
| “Research this.” | `research` | One clarification is allowed if question/evidence/output are materially ambiguous; otherwise classify. | Partial; no universal output default |
| “What does Romans 8:28 mean?” | `research` → `bible-research` | Bible method route is documented; specialist may ask tradition/audience only when material. | Good documented route; dormant runtime |
| “Remember that I prefer concise reports.” | `memory` capture | Intent taxonomy identifies capture; write/fact operation follows memory policy. | Good, but authority/promote boundary is not one shared packet |
| “Review my changes.” | `review` | Diff-aware review, severity/evidence, possible fix-first edits; no general intake if repository state is sufficient. | Good gate, side effects need explicit mode |
| “Test this site.” | `qa` or `web` | QA can require clean tree, browser/runtime setup, and possibly bootstrap questions; web also has mandatory intake. | Safe but interruption-heavy |
| “Continue where we left off.” | `handoff` / continuity consumer | Read candidate state, verify repo/worktree/revision/freshness/conflict; fail closed or require confirmation. | Strong contract; no automatic client activation |
| “Delete the old deployment and replace it.” | `careful` + deploy workflow | Global policy requires confirmation; careful hook guards command patterns but does not itself reason about full deployment blast radius. | Needs universal risk packet |
| “Build a polished dashboard and deploy it.” | `design` + `code` + review/QA + deploy gate | Multiple domain routes are documented, but no universal composition graph or one risk/approval packet decides the sequence. | Major v2 gap |

### Qualification conclusion

The current system has a good instinct—do not interrogate users about skill names—but no shared question budget. Design and web explicitly violate the desired default of “infer safe defaults, ask only what changes the result” by requiring a question before routing. QA and review have legitimate environmental gates, but their setup prompts are mixed with domain execution. Handoff correctly requires confirmation before mutation, but this rule is not carried as a universal task packet.

## Quality, risk, and failure audit

The strongest current safety pattern is layered:

1. Brain/Mind authority boundaries and guardrails define what is canonical and what requires confirmation.
2. `careful` deterministically blocks dangerous shell patterns.
3. Review and QA provide high-quality evidence gates.
4. Context Broker and universal entry expose freshness, conflicts, boundedness, and zero authority escalation.
5. Video and project pipelines add checkpointed state and disabled/policy-gated execution.

The missing cross-layer behavior is a universal risk classification before selecting a route. A request can cross from read-only research to external acquisition, from design to repository writes, or from code to deployment without a shared machine-readable declaration of side effects, confirmation class, evidence required, and rollback. The v2 contract must make this metadata part of routing, while retaining domain-specific judgment inside each specialist.

## Maturity assessment

| Dimension | Current | Target | Gap | Priority |
|---|---|---|---|---|
| Authority and safety policy | 4/5 | 5/5 | Minor conformance/consumer drift | P1 |
| Context Broker/contracts | 4/5 | 5/5 | Accepted read-only implementation, not active consumer | P1 |
| Profile/context budgeting | 3/5 | 5/5 | Good default profile; unresolved profiles and no automatic selection | P0 |
| Capability metadata | 3/5 | 5/5 | Several partial catalogs; missing unified descriptor dimensions | P0 |
| Intent routing | 2/5 | 5/5 | Markdown routing, no shared route receipt/graph | P0 |
| Domain orchestration | 4/5 | 5/5 | Strong islands; duplicated adapter/quality/state concerns | P1 |
| Qualification UX | 2/5 | 5/5 | Design/web mandatory intake; QA/review setup prompts inconsistent | P0 |
| Quality gates | 4/5 | 5/5 | Strong but large/mutating and threshold selection is local | P1 |
| Shared task/evidence state | 2/5 | 5/5 | Handoff/video/QA/review/CLR artifacts are separate | P0 |
| Cross-engine consumer activation | 1/5 | 5/5 | Client activation explicitly unclaimed | P1, gated |
| Observability and metrics | 3/5 | 5/5 | Many local reports; no universal route/gate outcome metrics | P2 |

**Overall maturity:** 3/5 — strong foundation, fragmented orchestration layer.
**Target:** 5/5 — descriptor-first universal routing with thin adapters, domain-specialist composition, bounded context/evidence packets, risk-aware gates, and measured client conformance.

## Recommended target model (10 bullets)

1. One provider-neutral Universal Brain Entry Point for every supported consumer.
2. One compact capability descriptor catalog for orchestrators, specialists, gates, tools, runbooks, CLIs, MCP capabilities, and validators.
3. One thin intent router that classifies goal, domain, artifact, risk, context need, and output without loading full skills.
4. Three layers: universal entry/safety; thin domain orchestrator adapters; specialist/tool/gate engines.
5. One question policy: ask at most one bundled question only when missing information materially changes the safe route or output.
6. One composition graph: route → bounded context → selected orchestrator → specialists/tools → quality/risk gates → evidence/result.
7. One task packet and one evidence packet, using existing Context Pack and continuity contracts rather than copying canonical truth.
8. Explicit context phases and budgets: bootstrap, descriptors, selected instructions, evidence, result, handoff.
9. Risk metadata and confirmation classes selected before any external, credential, financial, destructive, database, deployment, or public-content action.
10. Shadow-mode conformance and route/gate metrics before any client activation or default behavior change.

## First implementation phase

The first implementation phase should be a **read-only descriptor catalog plus shadow router**. It should:

- extend the existing agent capability manifest and Broker capability descriptor rather than create a competing registry;
- inventory every audited orchestrator/specialist/gate with source path, role, intent, inputs, outputs, context cost, risk class, confirmation class, quality gates, failure behavior, and continuity support;
- resolve profile/source paths and report stale/missing projections;
- accept vague prompts and emit only a route explanation, selected descriptor IDs, required context scopes, one-question decision, and predicted gates;
- produce no profile activation, client configuration change, provider call, file write, or execution;
- validate against a fixed black-box prompt corpus for code, design, research, Bible, memory, review, QA, handoff, and careful.

This phase closes the most important evidence gap while preserving all production behavior.

## Quick wins

- Add a machine-readable descriptor view beside the existing human skill index; keep full skill bodies dormant.
- Add profile resolution and projection checks to deterministic CI/manual gates; do not silently repair links in this audit.
- Mark `orchestrators-reference.md` as historical or reconcile its “five orchestrators” claim with the seven-entry default source.
- Add one shared qualification policy and explicitly exempt design/web from mandatory intake when safe defaults are discoverable.
- Add route/evidence/gate fixture tests before activating any client consumer.
- Reuse the existing Context Pack, Broker, universal-entry, agent-capability, and continuity schemas as source material.

## NO-CHANGE confirmation

| Protected surface | Changed? |
|---|---|
| Production orchestrator behavior | NO |
| Active skill symlinks/profile activation | NO |
| Tool/provider configuration | NO |
| Claude/Codex/Gemini consumer configuration | NO |
| Routing behavior | NO |
| Database, scheduler, deployment, or external state | NO |
| Secrets or credential material | NO |
| Skill deletion or source skill mutation | NO |

## Validation evidence

Read-only checks from the clean audit worktree:

- `npm run validate:context-learning-contracts` — PASS; 8 definitions and 32 authority kinds validated.
- `npm run validate:context-learning-broker` — PASS; 15 definitions, 9 operations, 2 profiles validated.
- `npm run test:context-learning` — PASS; 6 tests.
- `npm run test:context-broker` — PASS; 11 tests.
- Universal-entry/conformance/activation tests — PASS; 12 tests.
- Continuity/Codex pilot tests — PASS; 10 tests.
- `switch-skill-profile.mjs default --dry-run --verbose` — PASS; 7/7 resolve.
- Domain profile dry-runs — design/productivity PASS; research/video/deploy/power/full-current fail visibly for the inventory reasons above.
- `sync-ai-skills.mjs --check` — FAIL on source projection drift: Antigravity target mismatch and seven Kiro reachability failures. No sync apply was run.
- Audit worktree started clean at the recorded source SHA and remained limited to the five requested deliverables until final commit.

## Primary evidence map

- [Context loading order](../../ai/policy/context-loading-order.md)
- [Unified routing policy](../../ai/policy/routing.md)
- [Code orchestration policy](../../ai/policy/code-orchestration.md)
- [Skill loading architecture](../../docs/skills/skill-loading-architecture.md)
- [Skill index](../../docs/skills/skill-index.md)
- [Default profile](../../docs/skills/profiles/default.txt)
- [Context-learning architecture](../specs/infinite-brain-context-learning-runtime-architecture.md)
- [Context-learning roadmap](../specs/infinite-brain-context-learning-runtime-roadmap.md)
- [Broker contracts](../specs/context-learning/broker-contracts-v1.schema.json)
- [Context pack schema](../specs/context-pack.schema.json)
- [Universal entry consumption policy](../specs/context-learning/universal-entry-consumption-policy.md)
- [Session continuity policy](../specs/context-learning/session-continuity-policy.md)
- [Orchestrators reference](../runbooks/orchestrators-reference.md)
- [Research orchestrator](../runbooks/research-orchestrator.md)
- [Bible research runbook](../runbooks/bible-research.md)
- [Code orchestrator source](../../ai/skills/custom/code/SKILL.md)
- [Research orchestrator source](../../ai/skills/custom/research/SKILL.md)
- [Design orchestrator source](../../ai/skills/custom/design/SKILL.md)
- [Web orchestrator source](../../ai/skills/custom/web/SKILL.md)
- [Video orchestrator source](../../ai/skills/custom/video/SKILL.md)
- [Handoff source](../../ai/skills/custom/handoff/handoff/SKILL.md)
- [Careful source](../../ai/skills/vendors/gstack/careful/SKILL.md)
- [Review source](../../ai/skills/vendors/gstack/review/SKILL.md)
- [QA source](../../ai/skills/vendors/gstack/qa/SKILL.md)

Orchestrator v2 architecture audit is complete; no production orchestration behavior was changed.
