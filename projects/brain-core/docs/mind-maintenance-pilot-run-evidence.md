# Mind Maintenance Pilot — Controlled Run Evidence

Use this document for one explicit run against the real Mind repository. The goal is to prove the report-only pilot works safely on real content before any recurring use.

## Run identity

- Operator:
- Date/time:
- Brain commit:
- Mind root:
- Mind `HEAD` before run:
- CLI command used:
- Generated report ID:

## Pre-run checks

Record the existing Mind working-tree state before running the pilot.

```bash
git -C /absolute/path/to/mind status --short
```

- Existing changed paths:
- Existing untracked paths:
- Confirmed that no pre-existing change will be reset or cleaned: yes / no
- Confirmed that the five pilot files exist: yes / no
- Confirmed that `kanban.md` exists or is intentionally absent: yes / no

## Command

From `projects/brain-core`:

```bash
npm run build
node dist/bin/mind-maintenance-pilot.js run \
  --enable-report-only \
  --mind-root /absolute/path/to/mind \
  --generated-by controlled-real-mind-pilot
```

Optional reproducibility overrides:

```bash
  --source-commit <mind-head-before-run> \
  --generated-at <iso-timestamp>
```

## CLI result

Paste the complete JSON response.

```json
{}
```

Expected safety fields:

- `ok: true`
- `status: completed`
- `mode: report-only`
- `filesConsidered: 5`
- `sourceFilesChanged: 0`
- `integrity.ok: true`

## Post-run working-tree check

```bash
git -C /absolute/path/to/mind status --short
```

Expected newly introduced paths:

```text
?? system/reports/maintenance-latest.json
?? system/reports/maintenance-latest.md
```

If either report already existed, it may appear as modified rather than untracked.

- Newly changed paths:
- Protected source files changed: yes / no
- Unexpected paths introduced: yes / no
- Integrity verification passed: yes / no

Stop immediately if a protected source or unexpected path changed. Do not accept the generated reports as valid until the cause is understood.

## Report parity check

Compare:

```text
system/reports/maintenance-latest.json
system/reports/maintenance-latest.md
```

Verify:

- Same report ID: yes / no
- Same source commit: yes / no
- Same generated timestamp: yes / no
- Same total finding count: yes / no
- Same detector error count: yes / no
- Markdown contains every JSON finding ID: yes / no
- Markdown contains every failed detector: yes / no

## Finding review

For each finding, record:

| Finding ID | Type | Path | Accurate? | Useful? | Decision | Notes |
|---|---|---|---|---|---|---|
|  |  |  | yes / no | yes / no | open / accept / dismiss |  |

### False positives

- Finding ID:
- Why it is a false positive:
- Detector adjustment proposed:
- Should unchanged recurrence be suppressed: yes / no

### Missed findings

- Path and location:
- Expected finding type:
- Why the detector likely missed it:
- Proposed bounded improvement:

### Detector errors

- Detector:
- Path:
- Error type:
- Retryable:
- Impact on report trust:

## Pilot outcome

Choose one:

- [ ] Safe and useful for repeated manual runs
- [ ] Safe, but detector tuning is required
- [ ] Unsafe or unreliable; do not repeat

Summary:

- Findings total:
- Findings judged accurate:
- Findings judged useful:
- False positives:
- Missed findings:
- Detector errors:
- Unexpected writes:

## Follow-up decision

Select the next bounded action:

- [ ] No implementation change; repeat the manual pilot later
- [ ] Tune one existing detector
- [ ] Add finding review persistence
- [ ] Add report history and run comparison
- [ ] Add a read-only Brain Console report surface
- [ ] Investigate an integrity or write-safety failure

Do not enable scheduling or autonomous Mind content changes from this review.
