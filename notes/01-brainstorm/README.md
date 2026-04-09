# 01 — Brainstorm (Elaboration)

## Purpose
High-signal captures that entered the funnel. Here they get **elaborated, contextualized, and clarified** before deciding if they're worth a strategy.

**Key insight:** This layer is where you explore "Is this real? What's the full picture?"

## How it works

```
high-value/ captures auto-arrive
       ↓
[You optionally elaborate]
       ↓
[Mark status: reviewed]
       ↓
    ├─→ GOOD: Move to 02-strategy/
    └─→ NOT NOW: Archive or delete
```

## What lives here

- **Early-stage concepts** with potential but incomplete
- **Raw insight** that needs more thinking
- **Ideas that need context** before committing
- **Competitive intel** or market observations (pre-decision)

## Typical workflow

1. **New brainstorm lands** (auto-routed from high-value inbox)
2. **You read it** — "Hmm, interesting. But what does this really mean for us?"
3. **You add context** (edit the note):
   - Add "Why this matters" section
   - Link to related notes
   - Note assumptions or questions
4. **You set status: reviewed**
5. **Automation decides:**
   - If it looks solid → proposes move to strategy
   - If it needs more data → stays here
   - If you mark it "not-now" → archives

## Status flow

- `new` → You received it, haven't looked yet
- `reviewing` → You're thinking about it
- `reviewed` → Decided what to do
- `ready-for-strategy` → Move this to 02-strategy/
- `hold` → Interesting, but wait for context
- `archived` → Passed on this one

## Frontmatter

```yaml
---
type: brainstorm
source: inbox|manual
status: new|reviewing|reviewed|ready-for-strategy|hold|archived
confidence: 0.0–1.0
signal_quality: 0.0–1.0
para_hint: project|area|resource
elaborated_at: YYYY-MM-DD
tags: [list]
---
```

## What you do here

- Read captures
- Think about implications
- Add context/links
- Mark status
- **Let automation handle the rest**

## What NOT to do

- Don't commit to building (that's strategy's job)
- Don't create tasks yet (that's tasks' job)
- Don't overthink — if you're unsure, mark `hold` and move on

---

## References

- **Previous layer:** [[00-inbox|00-Inbox]]
- **Next layer:** [[02-strategy|02-Strategy]]
- **Dashboard:** [[home|Command Center]]
