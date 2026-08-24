# MRU0-P3.44 Conversation Intelligence Operator Friction Report

**Date:** 2026-08-24

## Friction observed in normal-work evaluation

1. **Manual candidate preparation limits evaluation realism.** The operator must already recognize and structure an important session item, so extraction quality cannot be measured end-to-end.
2. **Context is often insufficient.** Two items required partial-quality ratings because session references preserve identity but not the surrounding reasoning.
3. **Stale items require explicit judgment.** Staleness was useful for archive/defer decisions but adds a review step when the candidate is otherwise valuable.
4. **Duplicate guidance creates noise.** The validation-gate lesson was correctly bounded but unnecessary for this queue, producing the only distracting rating.
5. **Envelope-level review can hide candidate-level differences.** A future artifact with multiple candidates may need separate operator ratings, but splitting review authority is not justified by this window.
6. **No independent recall baseline exists.** False negatives and missed important items cannot be measured without a separately curated session reference set.

## Safety observations

No hidden scanning, transcript database, provider call, automatic ingestion, canonical write, or automatic promotion occurred. The safety boundary itself caused some friction by requiring explicit candidate preparation, but that is an intentional tradeoff rather than an implementation defect.

