# Brain AI System Future Roadmap — Optional Enhancements

**Purpose:** Capture optional future AI-system improvements that may strengthen Brain without adding prompt bloat, runtime lock-in, or unnecessary infrastructure.

**Status:** Optional roadmap. Do not implement these items automatically. Each item must go through `ai/policy/brain-module-onboarding.md` before implementation.

---

## Selection Rule

Only implement an item here when it gives substantial benefit.

Do not implement an item merely because it is interesting, popular, or used elsewhere. The default is to keep Brain lean.

Before implementation, confirm:

```text
1. What user pain does this solve?
2. Is the benefit substantial enough to justify more system surface?
3. Can it be implemented in a Brain-native, AI-agnostic way?
4. Can it stay modular and optional?
5. Can deterministic behavior live in hooks, scripts, or validation instead of prompts?
6. Which registry, runbook, policy, or profile will make it discoverable?
```

---

## Optional Candidate 1 — Ideal State Briefs for Larger Workstreams

**Idea:** Add a lightweight template for defining the desired end state before starting complex work.

**Potential owner:** `operations/runbooks/ideal-state-brief-template.md`

**What it would include:**

- goal;
- non-goals;
- constraints;
- success criteria;
- expected changed areas;
- validation plan;
- risks;
- rollback path;
- handoff/resume notes.

**Benefit:** Helps larger tasks stay coherent without loading excessive context or inventing process in the moment.

**Why it may be worth doing:** Brain already has strong policies and handoff briefs. An ideal-state brief would add a clear “what done looks like” artifact for bigger projects, reducing drift and rework.

**Why to defer:** Small tasks do not need another template. Use only when a project is broad enough that unclear success criteria would cause waste.

**Activation level:** Runbook-only; not a default active skill.

**Implementation trigger:** Use when multiple files, policies, runbooks, or runtimes will change in one workstream.

---

## Optional Candidate 2 — Containment Zones Policy

**Idea:** Define explicit boundaries between source, generated output, runtime state, secrets, personal knowledge, and shared AI infrastructure.

**Potential owner:** `ai/policy/containment-zones.md` or `operations/runbooks/containment-zones.md`

**Possible zones:**

| Zone | Examples | Rule |
|---|---|---|
| Source | code, policies, skills, runbooks | versioned intentionally |
| Generated | graphs, build info, scan output | ignored or committed only through explicit lane |
| Runtime | model tracking, cleanup markers, local state | normally not committed |
| Secrets | auth, keys, tokens, credentials | never committed |
| Brain infrastructure | AI configs, tools, hooks, policies | updated through module onboarding |
| Mind knowledge | personal strategy, research, memory | stored in `mind`, not `brain` |

**Benefit:** Makes boundaries explicit and reduces accidental leakage, bad commits, and cross-repo confusion.

**Why it may be worth doing:** Brain already has sensitive-edit guards, generated-file staging guards, and brain-vs-mind routing. A containment policy would unify those rules into one map.

**Why to defer:** Existing guards already cover the highest-risk cases. Add this only if boundary confusion continues or generated/runtime files keep appearing in review.

**Activation level:** Policy/runbook; possible later hook expansions only if deterministic.

**Implementation trigger:** Use if multiple repo zones need consistent treatment across Brain, Mind, Graphify, generated outputs, or runtime configs.

---

## Optional Candidate 3 — Graphify-Only Generated Output Commit Lane

**Idea:** If Graphify output becomes stable and useful in git history, add a narrow auto-commit lane for Graphify-owned output paths only.

**Potential owner:** `operations/runbooks/graphify-generated-output-commit-lane.md` plus a small script only after output paths are audited.

**Allowed behavior:**

- run only after a successful Graphify job;
- inspect only approved Graphify output paths;
- reject if unrelated files changed;
- reject if source/config/runtime files are included;
- stage explicit paths only;
- commit with a fixed generated-output message;
- no push by default.

**Benefit:** Preserves useful repo graph snapshots without allowing broad automatic commits.

**Why it may be worth doing:** Historical graph diffs could help AI agents and humans understand repo evolution.

**Why to defer:** If graph output is noisy, huge, cache-like, or not frequently reviewed, it adds churn without value.

**Activation level:** Automation, opt-in per repo, never global autogit.

**Implementation trigger:** Use only after confirming Graphify outputs are deterministic, small enough, isolated, and reviewable.

---

## Optional Candidate 4 — Readiness Criteria Template

**Idea:** Add a compact checklist for determining when a change is ready to ship or hand off.

**Potential owner:** `operations/runbooks/readiness-criteria-template.md`

**What it would include:**

- changed files;
- intended behavior;
- validation evidence;
- review evidence;
- known risks;
- excluded dirty files;
- rollback or follow-up;
- commit/push status.

**Benefit:** Makes “done” explicit for larger changes and avoids accidental shipping with unclear validation.

**Why it may be worth doing:** Brain already uses review-before-ship and compact handoff briefs. A readiness template would standardize final evidence for complex changes.

**Why to defer:** For small docs-only changes, the existing final-response contract is enough.

**Activation level:** Runbook/template; optionally referenced by `/review` or `/handoff` later.

**Implementation trigger:** Use when a change spans several modules or requires another AI/human to continue confidently.

---

## Optional Candidate 5 — Module Health Audit

**Idea:** Add a periodic or manual audit that checks whether modules remain discoverable, indexed, documented, and aligned with active profiles.

**Potential owner:** `operations/runbooks/module-health-audit.md`

**Possible checks:**

- policies referenced by `operations/AI-CONFIG-INDEX.md`;
- runbooks listed in `operations/runbooks/README.md` when recommended;
- skills listed in `docs/skills/skill-index.md`;
- profiles include only intended skills;
- active skill surface matches `docs/skills/profiles/default.txt`;
- hooks have source files and documented behavior;
- generated/runtime files are not accidentally promoted.

**Benefit:** Prevents long-term documentation and registry drift.

**Why it may be worth doing:** Brain is becoming modular. Modular systems need occasional integrity checks so expansion does not fragment.

**Why to defer:** Manual focused checks are enough until module count or drift risk grows.

**Activation level:** Runbook first; script/hook only for deterministic checks later.

**Implementation trigger:** Use before/after large AI-system refactors or quarterly maintenance.

---

## Non-Goals

Do not use this roadmap to justify:

- new always-on prompts;
- large skill activation by default;
- global automatic commits;
- runtime-specific lock-in;
- hidden background daemons without clear ownership;
- dashboards or services without substantial workflow value;
- duplicate registries;
- generated output churn in source control.

---

## Roadmap Governance

Every item remains optional until explicitly selected.

When selected, use the standard module onboarding output contract:

```text
Module type:
Owner surface:
Activation level:
Registries updated:
Runtime scope:
Validation:
Decision log needed: yes/no
```
