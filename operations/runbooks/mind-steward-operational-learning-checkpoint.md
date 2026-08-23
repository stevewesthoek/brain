# Mind Steward Operational Learning Checkpoint

MRU0-P3.24 captures what the real review loop has shown without turning observations into automatic learning or proposals.

## Use

Load the existing P3.21 daily loop, P3.22 calibration, P3.23 readiness, P3.19 workflow, and P3.18 briefing artifacts, then call `buildOperationalLearningCheckpoint` from `tools/scripts/mind-steward-operational-learning-checkpoint.mjs`. Write local output with `writeOperationalLearningCheckpoint` to:

- `runtime/local/mind-steward/learning/latest.json`
- `runtime/local/mind-steward/learning/latest.md`

If artifacts are absent, the checkpoint reports no observed usage; it does not create synthetic activity.

## Learning cycle

Run the daily loop during normal work, record human review decisions through P3.19, run calibration after real sessions, and use readiness to identify operational blockers. After at least two weeks or ten completed review sessions, review the checkpoint with the operator and decide whether any improvement candidate deserves a separately authorized proposal.

Candidates are classified as immediate fixes, future capabilities, or experimental ideas. They remain report-only. Mind review may be required where a candidate affects context, meaning, or priorities.

## Boundary

The checkpoint does not optimize, propose, promote, schedule, mutate Mind or Brain, call providers, or create a new authority or analytics store.
