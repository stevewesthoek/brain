# Mind Maintenance Pilot Operator Runbook

The Mind maintenance pilot is an explicit, report-only workflow. It reads exactly five approved Mind files, produces two report files, and verifies that protected source files were not changed.

## Preconditions

- Run from a checked-out Brain repository with `projects/brain-core` dependencies installed.
- Point `--mind-root` at a Git working tree containing the approved five-file pilot dataset.
- Review the Mind working tree before starting. Pre-existing changes are preserved and are not attributed to the pilot.
- Do not run the pilot through a scheduler. Each run requires an explicit `--enable-report-only` flag.

## Validate the implementation

From `projects/brain-core`:

```bash
npm run test:mind-maintenance-pilot-all
```

The aggregate acceptance gate builds Brain Core once and runs the complete maintenance pilot suite, including the compiled CLI end-to-end fixture.

## Run one explicit pilot

From `projects/brain-core`:

```bash
npm run build
node dist/bin/mind-maintenance-pilot.js run \
  --enable-report-only \
  --mind-root /absolute/path/to/mind
```

Optional reproducibility fields:

```bash
node dist/bin/mind-maintenance-pilot.js run \
  --enable-report-only \
  --mind-root /absolute/path/to/mind \
  --source-commit <mind-commit> \
  --generated-at 2026-06-14T12:00:00Z \
  --generated-by manual-operator
```

Without `--source-commit`, the CLI resolves the current Mind `HEAD`. Without `--generated-at`, it uses the current timestamp.

## Expected outputs

Only these files may be introduced or replaced:

```text
system/reports/maintenance-latest.json
system/reports/maintenance-latest.md
```

A successful CLI response is JSON on stdout with:

- `ok: true`
- `status: completed`
- `mode: report-only`
- `filesConsidered: 5`
- `sourceFilesChanged: 0`
- the report ID, source commit, finding count, detector error count, and output paths

Review the Markdown report first. The JSON file is the canonical structured representation.

## Safety checks

The pilot is disabled unless `--enable-report-only` is supplied. It snapshots and verifies:

- the five approved pilot source files
- `kanban.md`
- newly introduced Git changes during the run

The only allowed newly introduced paths are the two report outputs. A protected source mutation or unexpected path returns `status: integrity-failed` and a non-zero exit code.

The pilot does not authorize content edits. Accepting a finding means the concern is valid; it does not permit Brain to modify Mind.

## Exit codes

```text
0  Successful report-only run, or help output
1  Runtime, detector, Git, write, or integrity failure
2  Invalid or unsafe invocation
```

## Failure handling

For exit code `2`, fix the command and retry. Confirm that `run`, `--enable-report-only`, and `--mind-root` are present.

For exit code `1`, inspect the structured JSON error. Do not treat generated reports as valid after an integrity failure.

If only the two report outputs were created and the run must be discarded, remove those exact files manually after reviewing Git status. Never reset or clean unrelated Mind changes.

## Post-run review

1. Confirm the CLI returned `ok: true`.
2. Confirm `sourceFilesChanged` is `0`.
3. Review `system/reports/maintenance-latest.md`.
4. Compare findings with the exact evidence paths and locations.
5. Accept, dismiss, or leave findings open through a separate human review process.
6. Prepare any content change as a separate exact-path proposal with explicit approval.




## Persisted finding decisions

The report-only pilot may read one optional decision file from the Mind repository:

```text
system/reports/maintenance-decisions.json
```

The file is validated before report generation and is never modified by a report run. A missing file is treated as an empty decision document. Invalid JSON or an invalid decision document stops the run with `decision-load-failed` before either latest report is written.

Each stored decision is matched to a detected finding by `deduplicationKey`:

- `accepted` keeps the finding visible and attaches the review record.
- `dismissed` suppresses recurrence through `suppressionUntil`, inclusively.
- An expired dismissal reopens as a visible finding.
- A resolved condition that recurs reopens rather than inheriting the previous resolution.
- Decisions with no matching finding remain stored and are reported as unmatched statistics.

Decision writes are a separate explicit operation. Report generation remains read-only with respect to the decision file and all Mind source content.

## CLI decision statistics

A successful `mind-maintenance-pilot run` result includes:

```json
{
  "decisionStatistics": {
    "loaded": 0,
    "matched": 0,
    "unmatched": 0,
    "accepted": 0,
    "suppressed": 0
  }
}
```

The fields mean:

- `loaded`: decisions present in the validated decision document.
- `matched`: loaded decisions whose deduplication key matched a finding in this run.
- `unmatched`: loaded decisions with no matching finding in this run.
- `accepted`: visible report findings carrying an accepted decision.
- `suppressed`: findings moved to `suppressedFindings` by an active dismissal.

These statistics describe decision application only. They do not authorize source edits or imply that unmatched decisions should be removed automatically.
