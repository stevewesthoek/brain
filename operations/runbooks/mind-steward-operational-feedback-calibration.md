# Mind Steward Operational Feedback and Calibration

MRU0-P3.22 is a report-only calibration layer over the P3.17–P3.21 artifacts. It measures observed workflow signals and records possible improvement areas without deciding what should change.

## Activation

Build or load the current P3.18 briefing, P3.19 workflow, and P3.21 daily-loop artifact, then call `buildOperationalFeedbackCalibration` from `tools/scripts/mind-steward-operational-feedback-calibration.mjs`. Write local inspection output with `writeOperationalFeedbackCalibration` under:

- `runtime/local/mind-steward/calibration/latest.json`
- `runtime/local/mind-steward/calibration/latest.md`

No synthetic usage data is created when source artifacts are absent. No scheduler is enabled.

## Signals

The report exposes reviewed/accepted/rejected/deferred items, repeated review history, stale sources, missing context, missing provenance, duplicate source hashes, and explicit ingestion failure evidence. Rejection is reported as a possible quality signal, not proof of a false positive.

Each finding includes evidence, affected capability, confidence, uncertainty, and a possible improvement area. Findings are observations for human calibration only; they are not proposals, decisions, promotions, or changes.

## Human loop

Review the report alongside the daily loop. Compare signals across real review sessions, inspect the cited evidence, and separately authorize any documentation, workflow, or implementation change. Mind and Brain canonical sources are never modified by this layer.
