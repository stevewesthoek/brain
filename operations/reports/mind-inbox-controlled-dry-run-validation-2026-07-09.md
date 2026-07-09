# Mind Inbox Controlled Dry-Run Validation — 2026-07-09

**Task:** Task O — Batch 8F controlled dry-run validation  
**Status:** validation complete; no routing switched, no content moved  
**Starting Brain commit:** `443c498a docs: support configurable Mind inbox paths`

## Brain dirty status preservation

All pre-existing dirty/generated/system-config paths were preserved untouched:
- `.graphifyignore`, `operations/infrastructure/local-apps.*`
- `operations/system-configs/claude/**`, `operations/system-configs/codex/**`
- `tools/firecrawl/logs/firecrawl.log`

## Mind read-only status

Mind repo was NOT modified. Read-only confirmation:
- Mind latest commit: `c1b5f4a docs: record external Brain workflow validation plan`
- Mind dirty status unchanged: `wiki/log.md`, `Untitled.canvas`, `wiki/organisations/prochat/pitch-decks/`
- `.obsidian/app.json` unchanged
- No capture files moved

## Methodology

Temporary fake Mind roots created under `/tmp/brain-mind-inbox-validation.*` with controlled directory structures. Scripts were pointed at these fake roots via env variables. No real Mind repo files were touched.

### Repair made: `resolve_inbox_dir()` return code

During Scenario C testing, `set -euo pipefail` caused the script to exit before writing any report when `resolve_inbox_dir` returned non-zero. The `return 1` on the fallback path was changed to `return 0`. The guard `[[ ! -d "$INBOX_DIR" ]]` already handles the case where neither path exists.

### Improvement made: `inboxSource` field

The static `inboxResolvedFrom` field was replaced with a dynamic `inboxSource` field that reports one of:
- `target` — `inbox/new` was selected
- `legacy-fallback` — `capture/inbox` was selected as fallback
- `unavailable` — neither path exists

A separate `resolve_inbox_source()` function was added (avoiding subshell scoping issues) and the JSON/Markdown outputs now reference this variable.

## Validation results

### `mind-steward-inbox-dry-run-report.sh`

| Scenario | Structure | Exit | inboxPath | inboxSource | fileCount |
|----------|-----------|------|-----------|-------------|-----------|
| A — target exists | `inbox/new/` (2 files) + `capture/inbox/` (2 files) | 0 | ends with `/inbox/new` | `target` | 2 |
| B — fallback only | `capture/inbox/` (2 files), no `inbox/new/` | 0 | ends with `/capture/inbox` | `legacy-fallback` | 2 |
| C — neither exists | empty root | 1 | fallback path (does not exist) | `unavailable` | 0 |

All three scenarios produce valid JSON and Markdown reports. No real Mind files changed.

### `mind-compile-loop.sh`

| Scenario | Structure | Exit | Proposal source | Proposed dest | Real Mind modified? |
|----------|-----------|------|----------------|---------------|---------------------|
| D — target exists | `inbox/new/` with resource capture | 0 | `inbox/target-resource.md` | `resources/research/...` | No (fake root only) |
| E — fallback only | `capture/inbox/` with resource capture | 0 | `inbox/legacy-resource.md` | `resources/research/...` | No (fake root only) |
| F — neither exists | empty root, only `wiki/log.md` | 0 | no proposals appended | n/a | No (fake root only) |

Script remains suggest-only in all cases. No file moves, renames, deletes, or modifications to capture files occurred.

### n8n static validation

| Check | Result |
|-------|--------|
| Workflow ID `FwP5INe9qoo1OwGC` | ✅ |
| Workflow name `Mind Inbox — Capture & Classify with Signal Scoring` | ✅ |
| Active state `true` | ✅ |
| Webhook path `/mind-inbox` | ✅ |
| Contains `MIND_INBOX_PATH` | ✅ |
| Contains `MIND_FAILED_PATH` | ✅ |
| Default `capture/inbox` preserved | ✅ |
| Default `capture/failed` preserved | ✅ |
| Unset env → `capture/inbox/<date>-<slug>.md` | ✅ |
| Target env → `inbox/new/<date>-<slug>.md` | ✅ |
| Leading/trailing slashes sanitized | ✅ |
| Empty env falls back to legacy default | ✅ |
| Filename `${date}-${slug}.md` unchanged | ✅ |
| Success/failure routing semantics unchanged | ✅ |

No workflow was triggered. No network calls were made.

## Files changed in this batch

- `tools/scripts/mind-steward-inbox-dry-run-report.sh` — repaired `return 1` to `return 0`, added `resolve_inbox_source()` function, replaced static `inboxResolvedFrom` with dynamic `inboxSource` field
- `tools/scripts/mind-compile-loop.sh` — repaired `return 1` to `return 0` (same `set -e` guard fix)
- `operations/reports/mind-inbox-controlled-dry-run-validation-2026-07-09.md` — this report
- `operations/reports/mind-inbox-external-workflow-validation-plan-2026-07-09.md` — Batch 8F note added

## Recommendation for Batch 8G

Batch 8F passes all validations. The next step is a controlled n8n write test requiring explicit credentials and approval:

1. Set `MIND_INBOX_PATH=inbox/new` and `MIND_FAILED_PATH=inbox/failed` in n8n env
2. Send one test capture via webhook to verify it lands in `inbox/new/`
3. Send one forced-failure test to verify it lands in `inbox/failed/`
4. Verify shell scripts resolve `inbox/new/` correctly when captures exist there
5. Do not switch Mind `.obsidian/app.json` or move existing captures until write test passes

## Boundaries preserved

- No real Mind repo files were modified
- No `.obsidian/app.json` was changed
- No n8n workflow was triggered
- No network calls were made
- No capture content was moved
- No Save-to-Mind routing was switched
- Only intended Brain files were staged
