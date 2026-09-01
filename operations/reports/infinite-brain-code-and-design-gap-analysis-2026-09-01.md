# Infinite Brain Code and Design Orchestration Gap Analysis

**Date:** 2026-09-01
**Baseline:** `origin/main` `46bec0626b3d61c35f5f7da3b1a538c17978a4e2`
**Scope:** `code`, `design`, `web`, `review`, `qa`, `careful`, structural navigation, context cost, composition, and cross-domain build flows
**Status:** Audit and proposed remediation only; no active skill, client, tool, or routing behavior changed

## Executive conclusion

Brain has credible code and design orchestration, but the two domains currently live at different activation and interaction levels. `code` is default active and provides the strongest general coding route: understand, improve, fix, review, build, document, ship, and template. `design` is a mature dormant domain master with strong visual rules, scenario classification, persistent artifacts, design review, motion review, and visual QA. `web` is a useful dormant master for research, browser interaction, automation, and scale scraping. `review` and `qa` provide serious quality gates, while `careful` provides deterministic command protection.

The main gap is not specialist quality. It is the missing thin adapter and shared packet layer. The current system has no machine-enforced universal route that can select code/design/web, decide when to add review/QA/careful, carry one risk/confirmation state, and return one evidence/continuity envelope. Design and web also impose mandatory intake questions before routing, which is safe but inconsistent with the desired minimum-question UX. Code’s routing is clearer, but its general build path does not make QA selection automatic and its 580-line body carries both orchestration and significant specialist workflow detail.

## Current inventory

| Surface | Source | Status | Strength |
|---|---|---|---|
| Code | `ai/skills/custom/code/SKILL.md` | Default active; 580 lines | Best general coding router and map/plan/review discipline |
| Design | `ai/skills/custom/design/SKILL.md` | Dormant design profile; 516 lines | Strongest visual/domain quality and artifact model |
| Web | `ai/skills/custom/web/SKILL.md` | Dormant; 497 lines | Clear research/interactive/script/scale split and external-state boundaries |
| Review | `ai/skills/vendors/gstack/review/SKILL.md` | Default active; 1,044 lines | Strong pre-landing/adversarial/fix-first evidence gate |
| QA | `ai/skills/vendors/gstack/qa/SKILL.md` | Default active; 1,055 lines | Strong browser/test/fix/regression loop with before/after evidence |
| Careful | `ai/skills/vendors/gstack/careful/SKILL.md` | Default active; 59 lines | Small deterministic shell safety guard |
| Graphify | `ai/skills/vendors/safishamsi/graphify/SKILL.md` | Dormant | Structural/semantic navigation; non-authoritative |
| Agent capability manifest | `projects/brain-core/src/adapters/agent-capabilities.ts` | Repository adapter | Existing safety class, approval, preferred task type, verification seed |
| Brain Core registry | `projects/brain-core/src/adapters/orchestrators.ts` | Placeholder API registry | UI summaries only; not actual route authority |

The default profile intentionally contains `code`, `review`, `qa`, and `careful`, but not `design` or `web`. The design profile resolves successfully in dry-run; the current source research/video/deploy/power profiles have resolution failures, which increases the risk that a user request is routed to a dormant source without a reliable profile activation path.

## Strengths by domain

### Code

The code orchestrator’s eight workflows and standing laws are a sound base:

- map before touching code;
- plan multi-file work;
- reuse existing patterns;
- investigate root cause before fixing;
- review before shipping;
- use Codex for high-risk/adversarial second opinion under policy;
- use GrepLoop only for concrete, local, testable findings;
- hand off when scope/context exceeds the current runtime.

The code policy also has explicit runtime roles and a decomposition threshold. The source is clear that users do not need to name subskills. This should become descriptor data and a thin adapter, not be discarded.

### Design

The design orchestrator preserves the qualities a generic router cannot supply:

- new project versus reference mimic versus existing upgrade;
- SaaS/landing/funnel/website classification;
- research, design-system, implementation spec, polish, motion, and visual review sequence;
- PRODUCT.md, DESIGN.md, and brand-spec artifacts;
- user triage at points where subjective visual judgment is required.

The domain pipeline is intentionally opinionated. V2 should keep that opinionated core while making its intake and gates selectable by a higher-level router.

### Web and structural navigation

The web orchestrator correctly separates pure content acquisition, stateful browser interaction, reusable Playwright automation, and scale scraping. Graphify provides map/query/path/explain/update modes and bounded output. Current Brain policy makes Codebase Memory MCP the preferred structural navigator when fresh and keeps exact source authoritative; this prevents Graphify from becoming a hidden second source of truth.

### Review, QA, and careful

The review and QA sources already contain the ingredients of high-quality gates: evidence, severity, baseline, tests/screenshots/console, bounded fix loops, reports, and stop conditions. `careful` complements them with deterministic shell pattern protection. The issue is packaging: review and QA are large execution workflows, not small gate descriptors, and their setup/telemetry/clean-tree prompts can interrupt a task before the universal layer has classified what is needed.

## Gap matrix

| Area | Current state | Gap | Priority |
|---|---|---|---|
| Universal intent route | Code is default; design/web are prose/profile routes | No shared machine route for code/design/web or mixed build requests | P0 |
| Thinness | Code/design/web are 497–580 lines; review/QA are 1,044–1,055 | Adapter, domain method, and execution/gate logic are mixed | P1 |
| Design activation | Design profile resolves in dry-run but is dormant | Natural-language request does not automatically activate selected design context | P0 |
| Web activation | Web source and routing docs exist but not default/research profile | Research/web/browser intent can miss the web master | P0 |
| Qualification | Design and web require a Step 0 bundled question and wait | Safe defaults and repository evidence are not used before questioning | P0 |
| Code qualification | Code classifies without mandatory intake | Scope/target/output can remain ambiguous for vague costly requests | P1 |
| QA selection | QA is active and broad; can set up/fix/commit | No universal threshold decides report-only, smoke, standard, or exhaustive | P1 |
| Review mode | Review can fix-first and persist state | Advisory versus mutating review mode is not one route-level field | P1 |
| Risk | Policies and careful hook exist | Risk/confirmation not carried from route to every child node | P0 |
| Context cost | Default profile is intentionally seven; Broker is bounded | Full skill bodies, profiles, and dormant sources lack unified cost metadata | P0 |
| Composition | Code/design/video/web each compose locally | Mixed code + design + QA + deploy lacks one graph/packet/gate order | P0 |
| State | Design artifacts, QA/review reports, Git, handoff are separate | No common task/evidence envelope | P0 |
| Quality evidence | Domain-specific gates are strong | Gate selection and evidence fields are not standardized | P1 |
| Continuity | Handoff/CLR contracts exist | Code/design tasks do not automatically bind route/artifact/evidence pointers | P1 |
| Route observability | Brain Core has capability summaries and placeholder registries | No route receipt, candidate/rejection data, or gate outcome metrics | P1 |
| Source/export health | `sync-ai-skills --check` fails on Antigravity/Kiro in clean source | Consumer reachability is not a precondition of route activation | P1 |

## Black-box cases

| Prompt | Desired route | Current behavior implied by source | Assessment |
|---|---|---|---|
| “Fix this failing test.” | `code` FIX → investigate → patch → test | Code can classify and proceed using repository evidence; review/QA may be selected by scope | Good base; no shared route receipt |
| “Build a dashboard.” | `code` + `design` when UI work is material | Code is active; design is dormant and its workflow mandates intake before routing | Partial; activation gap |
| “Make the landing page feel premium.” | `design` upgrade/new → design review → visual QA | Design asks a bundled Step 0 question and waits | Fails minimum-question autonomy |
| “Copy the look of this site into our app.” | `design` mimic + `web`/research reference acquisition + code | Design has mimic classification; web/reference path is dormant and not universally selected | Partial; composition gap |
| “Review my changes.” | `review` report-only or fix-first based on authorization | Review performs diff-aware review and may auto-fix AUTO-FIX findings | Good quality; mode must be explicit in packet |
| “Test this site and fix anything broken.” | `qa` + web/browser; fix-enabled only within scope | QA may require clean tree, browser setup, test bootstrap, screenshots, fixes, commits | Safe but potentially over-broad without threshold/mode |
| “Improve the UI and make it responsive.” | `design` → `web-design` → code → QA | Local design workflow can compose; no universal cross-domain graph | Major v2 gap |
| “Ship the feature.” | code → review → QA as applicable → ship/deploy gate | Code policy routes review/ship; QA is not universally automatic; deploy is another profile | Gate threshold gap |
| “Delete the old deployment and replace it.” | careful + deploy capability + explicit confirmation/rollback | Global guardrails and careful hook guard dangerous commands; route itself has no common risk packet | Major risk-routing gap |
| “Continue the dashboard work.” | handoff/continuity → verify revision → selected design/code context | Handoff contract is strong, but no automatic route/artifact binding | Continuity integration gap |

## Qualification UX finding

The desired behavior is “infer safe defaults and ask one material question at most.” Current behavior is mixed:

- Code, research, memory, video, and graphify generally classify from the prompt and available evidence.
- Design mandates one intake question containing what is being built, starting point, vibe, and primary goal, then explicitly waits.
- Web mandates a bundled intake question covering action, auth, recurring behavior, and URLs, then waits.
- Review and QA ask legitimate operational/setup questions, but those prompts are embedded in large execution workflows.
- Handoff correctly requires confirmation before future mutation/resume, which is a safety gate rather than a generic intake question.

V2 should make “question required” a descriptor/route decision with a reason and missing fields. It should allow a design or web adapter to proceed when the target, current project, and safe defaults are discoverable. It should retain a mandatory confirmation gate for actions that truly cross an authorization boundary.

## Proposed code/design route contract

```yaml
request:
  goal: "build a polished dashboard"
  target: "current repository"
  artifact: "web UI"
  output: "implemented feature"
  risk: "repo_write"
route:
  primary: skill.design
  children: [skill.web-design, skill.code]
  gates: [design-artifact, visual-review, code-review, qa]
  question:
    required: false
    reason: "repository and existing UI provide safe defaults"
context:
  scopes: [current_ui, project_design_system, relevant_brain_policy]
  maxTokens: 4000
state:
  model: task_packet
  artifacts: [PRODUCT.md, DESIGN.md, changed_files]
  continuity: pointer_only
permissions:
  confirmationClass: policy
  externalState: false
```

This is a proposed v2 packet example. The existing design workflow remains responsible for what “polished” means, and the existing code/QA/review workflows remain responsible for implementation and validation details.

## Remediation plan

### P0 — Shadow route and descriptor metadata

1. Create descriptors for code, design, web, review, QA, careful, Graph/CBM navigation, and their required specialists.
2. Add intent/exclude, input/output, context-cost, risk, confirmation, quality-gate, failure, state, and continuity metadata.
3. Build shadow-only routing for code/design/web and mixed prompts.
4. Record why a route was selected, which alternatives were rejected, what question was avoided/asked, and which gates are predicted.
5. Reuse existing `agent-capabilities.ts` fields rather than creating a competing manifest.

### P1 — Thin adapters around existing engines

1. Separate route selection from full `code`, `design`, and `web` bodies at the contract boundary.
2. Add explicit modes: `report_only`, `plan_only`, `fix_enabled`, `build_enabled`, `external_action_blocked`.
3. Make design/web intake conditional on material ambiguity rather than always mandatory.
4. Let the code adapter select QA/review by changed surface and risk, preserving a user-requested override.
5. Keep Graphify/CBM as navigation providers; exact source remains authority.

### P1 — Shared packet and gates

1. Carry one task packet through design → code → review → QA.
2. Carry one evidence packet containing artifacts, source refs, test/review/visual evidence, exclusions, and next action.
3. Carry one risk/confirmation state into deploy/external gates.
4. Bind `.ai/current.md`, Git revisions, design artifacts, QA reports, and review evidence through references, not copied content.

### P2 — Activation and cleanup

1. Run the black-box corpus in shadow mode.
2. Repair/reconcile profile and consumer projection drift in separate authorized changes.
3. Conform one client at a time to the universal entry/Broker contract.
4. Measure route accuracy and gate coverage before changing default activation.
5. Only after evidence, reduce duplicated routing prose and split large engines where behavior parity is testable.

## Code/design success measures

- ≥95% correct primary route for code/design/web fixtures.
- ≤10% unnecessary question rate where scope and safe defaults are discoverable.
- 100% of mixed build routes expose a deterministic gate order.
- 100% of repo-write routes expose scope and validation requirements.
- 100% of external/destructive/deploy routes require the correct confirmation class.
- 100% of design outputs identify design artifacts and visual-review status when applicable.
- 100% of code shipping routes have review evidence; applicable UI changes have QA/visual evidence.
- Descriptor and selected-instruction budgets remain within phase limits.
- No shadow route changes profile/client state or invokes external providers.
- Continuation candidates bind repository/worktree/branch/Brain revision and fail closed on conflict/staleness.

## Evidence links

- [Code orchestrator](../../ai/skills/custom/code/SKILL.md)
- [Design orchestrator](../../ai/skills/custom/design/SKILL.md)
- [Web orchestrator](../../ai/skills/custom/web/SKILL.md)
- [Review gate](../../ai/skills/vendors/gstack/review/SKILL.md)
- [QA workflow](../../ai/skills/vendors/gstack/qa/SKILL.md)
- [Careful guard](../../ai/skills/vendors/gstack/careful/SKILL.md)
- [Graphify](../../ai/skills/vendors/safishamsi/graphify/SKILL.md)
- [Code orchestration policy](../../ai/policy/code-orchestration.md)
- [Unified routing policy](../../ai/policy/routing.md)
- [Context loading order](../../ai/policy/context-loading-order.md)
- [Skill loading architecture](../../docs/skills/skill-loading-architecture.md)
- [Default profile](../../docs/skills/profiles/default.txt)
- [Design profile](../../docs/skills/profiles/design.txt)
- [Context Broker contracts](../specs/context-learning/broker-contracts-v1.schema.json)
- [Universal entry consumption](../specs/context-learning/universal-entry-consumption-policy.md)
- [Session continuity](../specs/context-learning/session-continuity-policy.md)
- [Orchestrator v2 specification](../specs/infinite-brain-orchestrator-v2.md)
