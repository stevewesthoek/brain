# Infinite Brain Orchestrator v2 Phase 7A — Codex Code Default Promotion and Stability

**Date:** 2026-09-02  
**Activation timestamp:** `2026-09-02T00:00:01.000Z`  
**Activation source revision:** `2fec45d753b857827648b083dd87a25c3585fdb7` (pre-change `origin/main`: `16dcba61c9b2995a52c0b869147bb431459d50e0`)  
**Consumer/domain:** Codex / Code only  
**Universal Consumer Contract:** `1.0.0`  
**Adapter revision:** `codex-canary-contract@1.0.0`  
**Activation mechanism:** `codex-code-default` state machine plus default Codex entry selector  
**Prior path:** `codex-current-entry`  
**Production execution:** not enabled; `productionActive: false`

## 1. Decision

Accepted transition: `CANARY_ACCEPTED → CODE_V2_DEFAULT_FOR_CODEX`.
The default selector uses the Brain-owned universal pipeline and chooses v2 only
for a current, safe, valid Code result. It falls back to the prior Codex path
for disabled/rolled-back state, high or critical risk, other domains,
stale/conflicted state, controlled failures, projection drift, or any
safety/validation regression.

## 2. Authority and policy review

Brain remains semantic authority for descriptor-first routing, qualification,
capability selection, atomic context, task/evidence packets, composition,
Review/QA and safety gates, continuity, receipts, and fallback. The Codex
adapter contains no Codex-specific route, model, provider, qualification,
specialist, context-budget, or gate policy. No Brain/Mind authority boundary
changed.

## 3. Exact scope

Codex + Code only; other consumers activated `0`; other domains activated `0`;
active-skill expansion `0`; client configuration changes `0`; Kiro live
projection changes `0`; providers called `0`; repository/Mind/production writes
from the evidence path `0`. Other consumers remain reference-only and no other
domain canary was activated.

## 4. Pre-promotion validation

Clean-revision preflight passed Phase 3, 4, 5, and 6A validators; the umbrella
validator; Universal Consumer Contract; context-learning contracts and Broker;
capability manifest/state/inventory; contract layers and registry; Universal
Entry, Broker, continuity, projection, catalog/router/graph/packet, Codex
pilot, and canary test suites; Phase 6B canary; Phase 6C extended runner; and
the cross-repo Brain/Mind contract.

The broad `infinite-brain:conformance` command still reports the previously
documented unrelated Workbench artifact/provenance drift and unavailable
scheduler/provider validator commands. Targeted universal consumer and
cross-repo conformance pass; Phase 7A introduces none of that drift.

## 5. State, timestamp, revision, and rollback record

The activation record names the source revision, contract version, adapter
revision, timestamp, mechanism, and prior path above. The live rollback drill
transitioned to `ROLLED_BACK`, selected `codex-current-entry`, invoked no v2
path, required no manual configuration surgery, and restored the default only
after a passing preflight. Deterministic drill time: `0` seconds; target: 60.

## 6. Serial burn-in

Ten serial black-box Code requests passed through the actual default selector:
simple bug, known file, unknown area, small feature, multi-file feature,
refactor, frontend Code, backend/API, test failure, and security-sensitive
Code. Result: **10/10 Code v2 selections; zero unsafe activity**.

## 7. Default-path cohort

The 132-case Phase 6C corpus ran serially through the promoted default entry,
not the canary-only route: **132 total, 92 v2 selections, 40 legacy fallbacks**.
Routing safety was 100%; 9 high-risk cases were present and all 9 safely
refused; 10 controlled failures all safely fell back; stale/conflict cases
treated as current: `0`.

## 8. Isolated Code tasks and repair

Twenty existing Phase 6C disposable fixtures plus five Phase 7A fixtures ran in
temporary roots. Result: **25/25 final tests, Review, and QA passes**. One
bounded repair cycle was exercised and succeeded. Temporary roots were removed;
production and Mind writes were zero.

## 9. Qualification behavior

The cohort contained 12 expected material questions and observed all 12. It
produced zero unnecessary questions: **0.00%**, below the maximum 5%. Missed
material ambiguity: **0**. Architecture, testing framework, provider/model
profile, and internal-choice questions: `0`.

## 10. Review and QA selection

Review was selected for **80/80** applicable default-path Code cases (100%). QA
was selected for **61/61** applicable cases (100%). Analysis/plan-only and
high-risk/qualification boundaries were excluded from mutation-quality claims;
safety and confirmation behavior remained fail-closed.

## 11. High-risk behavior

Nine high/critical cases were recognized and safely refused to the legacy
boundary. Unsafe execution-ready results: **0**. Deployment, credentials,
production, destructive, public-content, financial, and migration-like actions
were not executed.

## 12. Stale/conflict and continuity behavior

Five stale/conflicted continuation cases were included. All selected legacy
fallback; stale state was never treated as current. Automatic resume/takeover
was false and reconciliation remained explicit.

## 13. Controlled fallback behavior

Broker-unavailable, descriptor-stale, invalid-graph, unavailable-capability,
and related injected-failure cases all produced explicit legacy fallback
receipts. Silent fallback count was `0`; no fallback weakened safety.

## 14. Dormant skills

Dormant specialist descriptors remained discoverable and were inspected only
after semantic selection. Ambient activation: **0**. Full bodies read before
selection: **0**. No active profile or global skill surface expanded.

## 15. Atomic context

Default-path bounds were: bootstrap maximum `409` tokens; context pack maximum
`41` tokens; full repository bootstrap `false`; full conversation bootstrap
`false`; secrets loaded `false`; transcript replay `false`.

## 16. Receipts and privacy

Receipts recorded Brain revision, Universal Contract version, adapter revision,
consumer/domain/default state, request hash, route/owner/risk, qualification,
selected capabilities, context/Task Packet/graph references, gates, continuity,
fallback, metrics, outcome, and safety. Raw prompts, transcripts, secrets, and
client configuration were not stored.

## 17. Model-swap invariance

The same Code request under two model labels preserved route family, owner,
risk, gate selection, and no-execution safety: **5/5 invariants passed**.

## 18. Cross-consumer non-regression

Universal consumer conformance passed with zero client-name-only route
differences, unchanged Brain ownership, explicit capability negotiation, and
zero activation for non-Codex consumers. The targeted cross-repo contract
passed. The broad drift noted in Section 4 remains isolated to existing
Workbench artifact/provenance and unavailable-validator inventory.

## 19. Legacy path comparison

Thirty-plus prior-path comparisons remain available from Phase 6C, and the
Phase 7A cohort retained the same prior path as comparison boundary. The prior
path remained available; default v2 added no writes or provider calls. No
user-facing quality delta is claimed from synthetic fixtures.

## 20. Safety and execution boundary

The default promotion changes selection state only. `productionActive` remains
false. Providers, writes, Mind writes, profile activations, automatic resume,
client configuration changes, and execution attempts were all zero in the
default evidence path. Isolated task writes were confined to disposable roots.

## 21. Canonical implementation and rollback

Implementation: `tools/context-learning/codex-code-default.mjs`  
Runner: `tools/context-learning/run-phase7a-codex-code-default.mjs`  
Contract/schema: `operations/specs/infinite-brain-codex-code-default.v1.json` and adjacent `.schema.json`  
Focused tests: `tools/context-learning/codex-code-default.test.mjs`  
Canonical v2 spec: `operations/specs/infinite-brain-orchestrator-v2.md`

Rollback is deterministic: disable the default state, select
`codex-current-entry`, verify v2 is not invoked, and require fresh preflight
before restoration.

## 22. Acceptance

Infinite Brain Orchestrator v2 Phase 7A is accepted: Code requests in Codex now
use the universal Brain-owned v2 orchestration contract by default, with
descriptor-first capability discovery, atomic context, automatic proportional
Review/QA, safety gating, retained legacy fallback, validated rollback, and no
semantic fork from other LLM/IDE consumers.

NEXT DOMAIN CANARY: Research
FIRST NON-CODEX CONSUMER CANARY: Claude Code

Neither recommended canary is activated by this phase.
