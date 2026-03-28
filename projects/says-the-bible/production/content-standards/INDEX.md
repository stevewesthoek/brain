# Bedtime Scripture System — Canonical Index

Version: v1.4
Status: Active Production Standard
Last Updated: 2026-03-02

This directory defines the authoritative structure for all bedtime audio scripts.

If a script conflicts with this documentation, this documentation wins.

Generated outputs in `generated-ssml/` are intentionally kept in Git for sync, review, reuse, and library continuity.

---

# 1. Core Structure (MANDATORY)

File:
script-template.md

Defines:

• Minute-by-minute architecture (0–30)
• Narrative cutoff at 20:00
• Integration block rules
• Sleep loop wave system
• Reflection ratio guidelines (~75–80% narrative / ~20–25% reflection)
• No new content after minute 20

Every script must conform to this structure.

---

# 2. Script Generator System (MANDATORY WORKFLOW)

File:
script-generator-checklist.md

Defines:

• Step-by-step story extraction process
• Reflection mapping rules
• Identity statement extraction
• Structural planning workflow
• Pause coding enforcement
• Quality control verification

This document is the production workflow.

The template defines WHAT.
The generator defines HOW.

No episode is written without following this checklist.

---

# 3. Pause & Timing System (MANDATORY)

File:
pause-system.md

Defines:

• P0–P5 pause taxonomy
• Minute-by-minute pause distribution
• Wave timing escalation (25–30 min)
• Reflection loop timing
• Silence progression model

This ensures neurological consistency across episodes.

---

# 4. SSML Implementation Rules (MANDATORY)

File:
ssml-cheatsheet.md

Defines:

• Exact <break> mappings
• Default safe pause durations
• How to encode silence progression

No custom ad-hoc pauses unless explicitly tested.

---

# 5. Code-Level Constants (MANDATORY)

File:
pause-library.ts

This file is the single source of truth for pause durations.

Do not hardcode <break> values directly in scripts.
Import from pause-library instead.

---

# 6. Scientific Rationale (REFERENCE)

File:
honesty-note.md

Explains:

• Sleep onset latency window
• Predictive coding theory
• Default Mode Network transition
• Parasympathetic regulation
• Why repetition reduces cortical activation

This file protects against pseudo-science creep.

It explains *why* the structure exists.

---

# 7. Script Authoring Rules

When writing new episodes:

1. Follow script-template-v1.4 exactly.
2. Use script-generator-checklist-v1.4 to construct it.
3. Stop introducing new narrative at 20:00.
4. Increase reflection density after 20:00.
5. Use identical sleep loop structure in final 5 minutes.
6. Maintain predictable phrase rhythm.
7. Never introduce emotional spikes after minute 15.

---

# 8. What Is NOT Allowed

• Surprise plot twists after minute 15
• New characters after minute 20
• Dramatic vocal shifts in final 10 minutes
• Removing the repetition waves
• Replacing safety language with abstract theology
• Writing without using the generator checklist

---

# 9. Future Versioning

If structure changes:

• Create script-template-v1.5.md
• Update pause-system-v1.5.md
• Update script-generator-checklist-v1.5.md
• Update this INDEX.md version
• Never silently mutate v1.4

---

# Final Principle

This is not just storytelling.
This is neurological deceleration design.

Narrative → Meaning → Identity → Rhythm → Silence

Consistency builds safety.
Safety builds sleep.
Sleep builds trust.
Trust builds brand.
