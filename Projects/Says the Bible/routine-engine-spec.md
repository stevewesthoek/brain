📄 ROUTINE ENGINE SPEC

Version: v0.1
Date: 2026-02-27
Purpose: Turn taxonomy into nightly flows → foundation for SaaS routines
Confidence: High (0.9)

⸻

Core Idea

A routine is not:

“Play random audio.”

A routine is:

State → need → next audio.

Think like a thermostat, not Spotify.

⸻

The Bedtime State Machine

Four primary states.

START
TRANSITION
FALL_ASLEEP
NIGHT_WAKE

That’s enough for v1.

Canonical alignment:
If any upstream taxonomy still uses `WIND_DOWN`, treat it as `TRANSITION`.

Each audio already has a taxonomy field:
routine_position

So routing is matching state → content.

⸻

Deterministic v1 Engine

No personalization yet.

Rules:

START
→ pick STORY or JOURNEY
→ energy: SOFT or STORY_DRIVEN

TRANSITION
→ pick TRUST / COMFORT
→ energy drops

FALL_ASLEEP
→ VERY_SOFT only
→ loopable preferred

NIGHT_WAKE
→ SAFETY / CALM
→ very short or loop

That is already a real product.

⸻

Example Routine (Genesis Night)

State START
→ Creation

State TRANSITION
→ Joseph

State FALL_ASLEEP
→ Psalms Rest loop

If child wakes → Shepherd

No UI complexity required.
Just rule-based selection.

⸻

Routing Inputs (Context)

Even before accounts you can infer:

Time of playback
Previous audio
Story vs ambient preference
Manual user selection
Device type (phone = night wake likely)

Later add:

Child profile
Mood selection
Sleep difficulty
History

Routing engine is just a function.

⸻

Routing Function Shape (Conceptual)

Input:

state
recent_history
taxonomy filters

Output:

next_audio_slug

Simple.

No ML required.

⸻

Core Routing Rules

Avoid repetition

Do not repeat last 2 audios.

Gradual energy drop

Never jump from STORY_DRIVEN → VERY_SOFT instantly unless explicit.

Emotional continuity

RESCUE → TRUST → CALM is valid
WONDER → CALM is valid
TRIAL → VERY_SOFT directly is not

Loop eligibility

Only FALL_ASLEEP content loops.

These rules create perceived intelligence.

⸻

Night Wake Engine (Important)

This is SaaS gold.

Night wake routing:

Short
Safe
Low narrative
Immediate calm

Candidates:

Psalms
Shepherd
Ambient scripture loops

This becomes a separate feature later:
automatic night support.

Huge retention driver.

⸻

User Control Layer

Minimal v1 controls:

Start routine button
Play next softer
Night wake quick button

Do not overbuild.

Routing should feel invisible.

⸻

Future Adaptive Layer

When accounts + history exist:

Track:

Completion
Skip timing
Time asleep proxy
Wake frequency

Routing can adapt:

Child falls asleep faster after Psalms → prioritize
Skips stories → reduce narrative
Frequent wake → add safety audio earlier

That is real SaaS behavior.

⸻

Content Requirements to Enable Engine

Each audio must have:

routine_position
energy
emotional_tag
loopable boolean
duration category

Without this, routing breaks.

Taxonomy is prerequisite.

⸻

UX Pattern

Routine screen is not library.

It is:

“Tonight we begin here.”

Single primary CTA.

Engine runs underneath.

This reduces choice fatigue → higher retention.

⸻

Monetization Layer Connection

Ownership phase:
Manual routines.

Routine features phase:
Saved routines.

SaaS phase:
Adaptive routines.

Same engine, deeper inputs.

No rewrite.

⸻

Technical Skeleton (Future)

Tables you will eventually need:

RoutineSession
RoutineStep
PlaybackEvent
SleepEstimate (soft metric)

Not now.
But design choices should allow it.

You already did that with taxonomy.

⸻

Failure Mode To Avoid

Do not let routing become a playlist builder.

That kills perceived intelligence.

Routing must feel intentional even if simple.

Rules > randomness.
