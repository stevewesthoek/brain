📄 ROUTINE TEMPLATES SYSTEM

Version: v0.2
Date: 2026-03-01
Purpose: Convert library assets into ready-to-run bedtime routines with minimal user decisions.

Canonical references: `operations-spec.md`, `routine-engine-spec.md`

⸻

## 0) Core Principle

Templates are pre-built bedtime flows.

- Bundles organize content.
- Templates organize behavior.

User question answered:

`What do we play tonight?`

⸻

## 1) Canonical Template State Model

Use the same 4 states as the routine engine:

- START
- TRANSITION
- FALL_ASLEEP
- NIGHT_WAKE (optional quick rescue step)

No alternate state vocabulary in UI or data models.

⸻

## 2) Foundational Templates (Initial 3)

| Template | START | TRANSITION | FALL_ASLEEP | NIGHT_WAKE |
|---|---|---|---|---|
| Gentle Start | GENESIS -> CREATION | GENESIS -> JOSEPH | PSALMS -> REST | PSALMS -> SHEPHERD |
| Safety Nights | GENESIS -> NOAH | PSALMS -> SHEPHERD | PSALMS -> PROTECTION LOOP | PSALMS -> SHEPHERD SHORT |
| Quick Calm | PSALMS -> REST | PSALMS -> PROTECTION | AMBIENT LOOP | PSALMS -> REST SHORT |

Constraint:

- Maximum 5 active templates before `live_skus >= 40`.

⸻

## 3) Template UX Rules

- Primary CTA: `Start this routine`.
- Optional secondary CTA: `Play next softer`.
- Do not expose “build your own playlist” before Routine Tools phase.

Choice reduction is the value proposition.

⸻

## 4) Inclusion Rules

A template is valid only if:

- It includes at least 3 states.
- It has a clear emotional purpose.
- It ends with FALL_ASLEEP content.
- It has a NIGHT_WAKE fallback or explicitly inherits global NIGHT_WAKE default.

⸻

## 5) Evolution Path

- Phase 1: Static templates (manually curated, rules-based)
- Phase 2: Saved templates (user-level persistence)
- Phase 3: Adaptive templates (behavior-informed ordering)

Same concept, deeper personalization over time.

