# Plan: /autoresearch Skill + Strategy

## Context

Karpathy's autoresearch demonstrates a general optimization pattern:
1. Define bounded scope (one file to modify)
2. Define a measurable metric (lower/higher is better)
3. Run autonomous experiment loop: modify → measure → keep/discard → repeat
4. Wake up to results

The user recognized this pattern applies universally to any bounded, measurable optimization target — skills, apps, UI, workflows, marketing, finances. This plan installs the autoresearch methodology as a first-class skill in the brain repo with full documentation of how to apply it across domains.

**Note:** Karpathy's repo requires an H100 GPU + Python ML stack — we do NOT install that binary. Instead, we adapt the methodology (the loop pattern + program.md concept) for Claude Code, generalizing it to all optimization targets.

---

## Files to Create / Modify

### New files
1. `brain/ai/skills/custom/autoresearch/SKILL.md` — the skill Claude loads
2. `brain/operations/runbooks/autoresearch-strategy.md` — full strategy document
3. `brain/ai/skills/active/autoresearch` → symlink to `../custom/autoresearch`

### Modified files
4. `operations/system-configs/claude/CLAUDE.md` — add `/autoresearch` to available skills list
5. `operations/decision-log.md` — log the strategic decision

---

## Step 1: SKILL.md

**Path:** `brain/ai/skills/custom/autoresearch/SKILL.md`

**Trigger description:** Use when the user wants to optimize, improve, or research improvements to any bounded system — skills, apps, UI, workflows, n8n automations, marketing copy, or business metrics. Also trigger proactively when the user says "make this better", "optimize this", "can this be improved", or "run experiments on this".

**Body structure:**
- Philosophy: the autoresearch loop (scope + metric + loop)
- How to invoke: what to ask the user, how to define a program.md equivalent
- Domain catalog with per-domain template (scope, metric, loop, time budget)
  - Skills/prompts
  - App performance
  - UI/UX
  - n8n workflows
  - Marketing & copy
  - Business metrics & finances
- How to present results and apply them
- Decision: keep (commit) or discard (git reset)

---

## Step 2: Strategy Runbook

**Path:** `brain/operations/runbooks/autoresearch-strategy.md`

**Purpose:** Human-readable strategic document explaining the optimization philosophy across all domains. This is the "why" and the catalog. It covers:
- The principle: everything measurable is improvable
- The three elements needed: scope, metric, time budget
- Full domain catalog with worked examples
- Integration with the brain model-routing system (Haiku runs experiments, Gemini Flash preprocesses results, Codex reviews final diff)
- How to set up a new optimization target from scratch (program.md template per domain)

---

## Step 3: Symlink

```bash
ln -s ../custom/autoresearch /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/autoresearch
```

---

## Step 4: CLAUDE.md update

Add `/autoresearch` to the available skills list in `operations/system-configs/claude/CLAUDE.md`.

---

## Step 5: Decision log entry

Append to `operations/decision-log.md`:
- Strategic decision: adopt autoresearch as general optimization methodology
- Date: 2026-04-10
- Domains covered
- Pointer to runbook

---

## Step 6: Commit & push

Single commit with message:
```
feat: add /autoresearch skill — autonomous optimization loop for any bounded system
```

---

## Verification

- `ls brain/ai/skills/active/autoresearch` — symlink resolves
- `cat brain/ai/skills/active/autoresearch/SKILL.md` — skill loads
- Skill appears in available skills in next Claude Code session
- Runbook accessible at `brain/operations/runbooks/autoresearch-strategy.md`
