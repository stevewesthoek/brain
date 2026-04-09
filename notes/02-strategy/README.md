# 02 — Strategy (Decision & Context)

## Purpose
**Committed decisions with full strategic context.** Here you define **why, what, constraints, and success criteria** before breaking into projects.

**Key insight:** Strategy answers "Should we do this?" Projects answer "How do we do this?"

## How it works

```
brainstorm ready-for-strategy
       ↓
[You write strategy document]
       ↓
[Define: why, constraints, success]
       ↓
[Mark status: committed OR on-hold]
       ↓
    ├─→ committed: Promotion to 03-projects/
    └─→ on-hold: Wait for more context
```

## What lives here

- **Strategic decisions** (e.g., "Adopt usage-based pricing for SaaS")
- **Market analysis** before a major pivot
- **Constraint mapping** (time, budget, people, tech debt)
- **Competitive intelligence** with decision implication
- **Opportunity assessments** (cost/benefit, timing)

## Typical workflow

1. **Strategy document template auto-generates** (from brainstorm)
2. **You fill in sections:**
   - **Context:** Why this matters now
   - **Problem:** What are we solving?
   - **Constraints:** Time, money, people, dependencies
   - **Options:** What are the alternatives?
   - **Recommendation:** What should we do? Why?
   - **Success criteria:** How do we know it worked?
   - **Risks:** What could go wrong?
3. **You mark status: committed** (or on-hold)
4. **If committed:** Automation suggests creating project(s)

## Status flow

- `draft` → Writing, not final
- `ready-for-review` → Someone should read this
- `reviewed` → You've approved it
- `committed` → Decision made, move forward
- `on-hold` → Decision made, but waiting for external condition
- `archived` → No longer relevant

## Frontmatter

```yaml
---
type: strategy
para_type: project|area|resource
status: draft|ready-for-review|reviewed|committed|on-hold|archived
priority: 1|2|3|4|5
area: (which business/life area?)
committed_at: YYYY-MM-DD
related_projects: [links]
tags: [list]
---
```

## Strategic document structure

```markdown
# [Strategy Title]

## Context
Why this matters. What changed? What's the opportunity?

## Problem Statement
What are we solving? Who's affected?

## Constraints
- Time: (launch date? long-term horizon?)
- Budget: (cost cap? ROI target?)
- People: (who's involved?)
- Tech: (dependencies, tech debt considerations)
- External: (market, partners, compliance)

## Options Considered
1. Option A: ... (pros/cons)
2. Option B: ... (pros/cons)
3. We chose: Option X because...

## Recommendation
Clear statement of what we're doing.

## Success Criteria
- Quantitative: (metrics, targets)
- Qualitative: (feel, feedback)
- Timeline: (by when do we judge success?)

## Risks & Mitigations
- Risk: ... → Mitigation: ...
- Risk: ... → Mitigation: ...

## Next Steps
What happens after this is committed?
```

## What you do here

- **Write** clear strategic thinking (1-3 hours per strategy)
- **Link** related strategies or project dependencies
- **Mark status** when you've decided
- **Let automation** suggest next projects

## What NOT to do

- Don't get stuck here. 80/20 is enough.
- Don't overthink options if one is obvious.
- Don't write tactics (that's projects/phases).

---

## References

- **Previous layer:** [[01-brainstorm|01-Brainstorm]]
- **Next layer:** [[03-projects|03-Projects]]
- **Dashboard:** [[home|Command Center]]
