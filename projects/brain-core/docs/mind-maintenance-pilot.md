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




## Record a finding decision

Decision recording is an explicit write to:

```text
system/reports/maintenance-decisions.json
```

Build first, then run one of the following commands from `projects/brain-core`.

### Accept a finding

Accepted findings remain visible in later reports and require a next action.

```bash
npm run build
node dist/bin/mind-maintenance-pilot.js record-decision \
  --mind-root /absolute/path/to/mind \
  --finding-id finding-stale-page-router-00-current-context-001 \
  --deduplication-key stale-page:router/00-current-context.md:review_after \
  --source-report mind-maintenance-20260614T103145Z \
  --source-commit c60f7f8 \
  --reviewer "Steve Westhoek" \
  --reviewed-at 2026-06-14T11:04:45.000Z \
  --decision accepted \
  --reason "The review date elapsed and the page requires review." \
  --next-action "Review the page and refresh only outdated sections."
```

### Dismiss and temporarily suppress a finding

Dismissed findings may include a suppression date. Suppression is inclusive through that date; recurrence reopens afterward.

```bash
node dist/bin/mind-maintenance-pilot.js record-decision \
  --mind-root /absolute/path/to/mind \
  --finding-id finding-source-gap-strategy-001 \
  --deduplication-key source-gap:wiki/organisations/prochat/brand/prochat-os-strategy.md:market-position \
  --source-report mind-maintenance-20260614T103145Z \
  --source-commit c60f7f8 \
  --reviewer "Steve Westhoek" \
  --reviewed-at 2026-06-14T11:10:00.000Z \
  --decision dismissed \
  --reason "This statement is an intentional strategic position, not an external factual claim." \
  --suppression-until 2026-07-14
```

### Resolve a finding

Resolved findings require a durable reference to the approved action or review that completed the work. A later recurrence opens as a new visible finding.

```bash
node dist/bin/mind-maintenance-pilot.js record-decision \
  --mind-root /absolute/path/to/mind \
  --finding-id finding-stale-page-router-00-current-context-001 \
  --deduplication-key stale-page:router/00-current-context.md:review_after \
  --source-report mind-maintenance-20260614T103145Z \
  --source-commit c60f7f8 \
  --reviewer "Steve Westhoek" \
  --reviewed-at 2026-06-14T11:15:00.000Z \
  --decision resolved \
  --reason "The page was reviewed and its freshness metadata was updated." \
  --resolution-ref mind:b77f203
```

Recording a decision creates or replaces the entry with the same `deduplicationKey`. The command rejects older review timestamps, conflicting finding IDs, invalid decision-specific options, and invalid existing decision files. Review Git status and commit the decision file separately after each approved write.




## Recover from decision-file failures

### `decision-load-failed`

This status means the pilot could not parse or validate `system/reports/maintenance-decisions.json`. The run stops before writing either latest report.

Operator steps:

1. Stop and do not retry the report run unchanged.
2. Inspect `system/reports/maintenance-decisions.json` for malformed JSON, schema violations, duplicate finding IDs, duplicate deduplication keys, invalid timestamps, or decision-specific field errors.
3. Compare the file with the last reviewed Git version before making any correction.
4. Repair the decision file explicitly, or remove it only when the intended state is an empty decision document and that removal is approved.
5. Review `git diff -- system/reports/maintenance-decisions.json`.
6. Rerun the report-only command.
7. Treat the rerun as valid only when it returns `ok: true`.

Do not copy or reconstruct decisions from generated reports without reviewing the original decision history.

### Decision-file `integrity-failed`

This status means `system/reports/maintenance-decisions.json` changed between the runner's before-and-after integrity snapshots. The generated reports must not be trusted, even when their files were written successfully.

Operator steps:

1. Stop and discard the generated `maintenance-latest.json` and `maintenance-latest.md` outputs from that run after confirming they are the only outputs being removed.
2. Inspect `git status` and `git diff -- system/reports/maintenance-decisions.json` to identify the unexpected creation, deletion, or content mutation.
3. Determine which process or operator changed the decision file during the report run.
4. Restore or approve the intended decision-file state through a separate explicit decision operation.
5. Confirm no unrelated Mind changes are reverted or cleaned.
6. Rerun the report-only command from a stable working tree.
7. Accept the reports only when the rerun returns `ok: true`, `sourceFilesChanged: 0`, and no integrity failures.

A report-only run never authorizes decision-file writes. Decision changes belong to the explicit `record-decision` workflow and should be reviewed and committed separately.




## Validate and summarize decisions read-only

Use `validate-decisions` to validate the canonical decision document and inspect aggregate counts without running detectors, reading Git status, writing reports, or modifying the decision file.

```bash
npm run build
node dist/bin/mind-maintenance-pilot.js validate-decisions \
  --mind-root /absolute/path/to/mind
```

The command accepts only `--mind-root`. A missing decision file is treated as an empty valid document. A valid result is emitted as JSON on stdout:

```json
{
  "ok": true,
  "status": "decision-summary",
  "mode": "read-only",
  "decisionPath": "/absolute/path/to/mind/system/reports/maintenance-decisions.json",
  "schemaVersion": "1.0",
  "sourceRepo": "mind",
  "updatedAt": "2026-06-15T09:00:00.000Z",
  "decisionCount": 3,
  "counts": {
    "accepted": 1,
    "dismissed": 1,
    "resolved": 1
  }
}
```

Field meanings:

- `decisionPath`: canonical decision-file path resolved under the supplied Mind root.
- `schemaVersion`: validated decision-document schema version.
- `sourceRepo`: expected repository identity, always `mind` for this workflow.
- `updatedAt`: document update timestamp, or the validation timestamp for a missing file treated as empty.
- `decisionCount`: total validated decisions.
- `counts`: totals grouped by accepted, dismissed, and resolved state.

Invalid JSON or schema violations return exit code `1` with `status: decision-summary-failed` on stderr. Repair or remove the invalid decision file before retrying. This command is diagnostic only and never records, replaces, or deletes decisions.




### List decisions unmatched by the latest report

Add `--list-unmatched` to compare validated persisted decisions with the validated latest maintenance report:

```bash
node dist/bin/mind-maintenance-pilot.js validate-decisions \
  --mind-root /absolute/path/to/mind \
  --list-unmatched
```

The command remains strictly read-only. It does not run detectors, resolve Git state, inspect the working tree, write reports, record decisions, or modify either input file.

Matching semantics:

1. Load and validate `system/reports/maintenance-decisions.json`.
2. Load and validate `system/reports/maintenance-latest.json`.
3. Collect every `deduplicationKey` from both `findings` and `suppressedFindings` in the latest report.
4. Return each persisted decision whose `deduplicationKey` is absent from that combined set.
5. Preserve the persisted decision order in `unmatchedDecisions`.

A decision matched by either a visible finding or a suppressed finding is not listed as unmatched. Matching is based only on the stable `deduplicationKey`; finding IDs, report IDs, review timestamps, and decision state do not change the match result.

With `--list-unmatched`, successful JSON adds these fields:

- `latestReportPath`: canonical path to `system/reports/maintenance-latest.json` under the supplied Mind root.
- `latestReportId`: validated `reportId` from the latest report.
- `unmatchedDecisionCount`: compact total of persisted decisions not represented by visible or suppressed findings in that report.
- `unmatchedDecisions`: complete persisted decision records not represented by visible or suppressed findings in that report.

An empty `unmatchedDecisions` array means every persisted decision is represented in the latest report context. It does not mean every decision is still operationally relevant or requires no review.

If the latest report is missing, malformed, or fails schema validation, the command exits with code `1`, writes `status: decision-summary-failed` to stderr, and performs no writes. Inspect or regenerate `system/reports/maintenance-latest.json`, confirm the report is valid and stable, then rerun the command. Do not edit the latest report merely to force a decision match; regenerate it through the report-only workflow when appropriate.

For both decision-file and latest-report failures, compare the affected file with its reviewed Git version before repair. Accept the result only after a successful read-only rerun, and verify both input files remain unchanged.
