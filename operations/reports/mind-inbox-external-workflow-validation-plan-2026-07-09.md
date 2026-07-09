# Mind Inbox External Workflow Validation Plan — 2026-07-09

**Task:** Task O — Batch 8D external Brain workflow validation planning  
**Status:** validation plan only; no routing switched, no content moved  
**Starting Brain commit:** `ba1ddff3 docs: refine Mind compatibility audit`  
**Branch:** `main`

## Brain repo dirty status

Pre-existing dirty paths (all unrelated to Mind inbox routing):

```text
 M .graphifyignore
 M operations/infrastructure/local-apps.json
 M operations/infrastructure/local-apps.md
 M operations/system-configs/claude/.last-cleanup
 M operations/system-configs/claude/.last-update-result.json
 D operations/system-configs/claude/plans/ (12 deleted plan files)
 M operations/system-configs/codex/ (various config, app binaries, SQLite, lock files, plugins)
 M tools/firecrawl/logs/firecrawl.log
?? operations/system-configs/codex/ (app-server, attachments, browser, config.json, process_manager)
```

These are system-generated / infrastructure paths. None were touched or staged.

## Search methodology

All file types searched across the entire `brain` repo:

```text
.ts, .js, .mjs, .json, .yml, .yaml, .sh, .md, .toml
```

Searched terms:

```text
capture/inbox, capture/failed, capture/daily
inbox/new, inbox/failed, inbox/raw, inbox/processed
Save-to-Mind, Save to Mind, save.to.mind
webhook/mind-inbox, mind-inbox
MIND_ROOT, INBOX_DIR, captureInbox, inboxNew
n8n, workflow, GitHub, scheduler, classification
local_only, OpenAI-compatible, failed capture, capture processing
```

Searched locations:

```text
projects/brain-core/           — main TS implementation
projects/mind-steward/         — Mind Steward CLI and dry-run reporters
projects/runtime/              — runtime/writer audit logs (generated, not code)
operations/automations/n8n/    — n8n workflow JSON
operations/scripts/            — operational scripts
tools/scripts/                 — shell scripts (mind-compile-loop, dry-run reports)
tools/                         — other tooling
```

## Evidence summary

### 1. TypeScript implementation — strong dual-path support

**`projects/brain-core/src/mind-paths.ts`** — canonical path constant definitions:

| Constant | Path | Era |
|----------|------|-----|
| `MIND_TARGET_PATHS.inboxNew` | `inbox/new` | target |
| `MIND_TARGET_PATHS.inboxFailed` | `inbox/failed` | target |
| `MIND_TARGET_PATHS.inboxRaw` | `inbox/raw` | target |
| `MIND_TARGET_PATHS.inboxProcessed` | `inbox/processed` | target |
| `MIND_LEGACY_PATHS.captureInbox` | `capture/inbox` | legacy-fallback |
| `MIND_LEGACY_PATHS.captureFailed` | `capture/failed` | legacy-fallback |

Compatibility groups defined:
- `MIND_INBOX_NEW_CANDIDATES`: `[inbox/new (target), capture/inbox (legacy-fallback)]`
- `MIND_FAILED_INBOX_CANDIDATES`: `[inbox/failed (target), capture/failed (legacy-fallback)]`

**`projects/brain-core/src/adapters/mind-steward-inbox-queue.ts`** — inbox reader:
- Resolves inbox path via `MIND_INBOX_NEW_CANDIDATES`: tries `inbox/new/` first, falls back to `capture/inbox/`
- Uses configurable mind root: `process.env.BRAIN_CORE_MIND_STEWARD_MIND_ROOT` or default `../mind`

**`projects/brain-core/src/adapters/execution-plans.ts`** — read/preview allowed paths:
- `inbox/new/` — allowed
- `capture/inbox/` — allowed
- `inbox/failed/` — allowed
- `capture/failed/` — allowed

Tests exist for reading from `inbox/new/` and `capture/inbox/`.

### 2. Shell scripts — hardcoded legacy paths (MUST CHANGE)

**`tools/scripts/mind-steward-inbox-dry-run-report.sh`** (line 37):
```bash
INBOX_DIR="$MIND_ROOT/capture/inbox"
```
- Reads capture files from `capture/inbox/`
- Never tries `inbox/new/`
- Reports the path in JSON and Markdown output
- Action: must be updated to try `inbox/new/` first with legacy fallback

**`tools/scripts/mind-compile-loop.sh`** (line 26):
```bash
INBOX_DIR="${MIND_DIR}/capture/inbox"
```
- Reads capture files from `capture/inbox/`
- Proposes moves referencing `capture/inbox/` as source
- Action: must be updated to try `inbox/new/` first with legacy fallback

### 3. n8n workflow — hardcoded legacy write path (MUST CHANGE)

**`operations/automations/n8n/workflows/mind-inbox-fixed.json`**:
- Code node (line ~71): `const file = \`capture/inbox/${date}-${slug}.md\``
- Code node (line ~500): `const file = \`${isFailed ? 'capture/failed' : 'capture/inbox'}/${date}-${slug}.md\``
- Uses `$env.GEMINI_API_KEY`, `$env.GITHUB_MIND_PAT` for credentials
- **Does NOT use any configurable path variable** — the path prefix is hardcoded in JavaScript
- Writes to GitHub API: `https://api.github.com/repos/stevewesthoek/mind/contents/...`
- Action: must be updated to accept a configurable path prefix (env var or n8n variable)

### 4. Mind Steward CLI — configurable path

**`projects/mind-steward/src/cli/dry-run-report.ts`** and **`classify-captures.ts`**:
- Accept `--mind-root` argument or `MIND_STEWARD_MIND_ROOT` env var
- Default fallback: `../../mind` relative to cli path
- **Does NOT hardcode `capture/inbox`** — uses paths from the report/classification input
- Action: no change required; already configurable

## Current path support matrix

| Component | capture/inbox | inbox/new | capture/failed | inbox/failed | Configurable? |
|-----------|---------------|-----------|----------------|---------------|---------------|
| `mind-paths.ts` constants | legacy-fallback | target ✅ | legacy-fallback | target ✅ | Via env `MIND_STEWARD_MIND_ROOT` |
| `mind-steward-inbox-queue.ts` | ✅ fallback | ✅ primary | — | — | Via env `BRAIN_CORE_MIND_STEWARD_MIND_ROOT` |
| `execution-plans.ts` | ✅ allowed | ✅ allowed | ✅ allowed | ✅ allowed | No (static list) |
| `mind-steward-inbox-dry-run-report.sh` | ✅ hardcoded | ❌ not tried | — | — | Partially via `MIND_STEWARD_MIND_ROOT` |
| `mind-compile-loop.sh` | ✅ hardcoded | ❌ not tried | — | — | Partially via `MIND_DIR` |
| `mind-inbox-fixed.json` (n8n) | ✅ writes here | ❌ not supported | ✅ writes here | ❌ not supported | ❌ path is hardcoded in JS |
| Mind Steward CLI | ✅ reads | ✅ reads | ✅ reads | ✅ reads | Via `--mind-root` or env var |
| Mind tests | ✅ tested | ✅ tested | ✅ tested | ✅ tested | Via fixture setup |

## What must change before a controlled switch

### Required changes in Brain repo

1. **Update `tools/scripts/mind-steward-inbox-dry-run-report.sh`**:
   - Replace hardcoded `INBOX_DIR="$MIND_ROOT/capture/inbox"` with priority resolution:
     - Try `$MIND_ROOT/inbox/new` first
     - Fall back to `$MIND_ROOT/capture/inbox`
   - Update JSON and Markdown reports to reflect which path was used.

2. **Update `tools/scripts/mind-compile-loop.sh`**:
   - Replace hardcoded `INBOX_DIR="${MIND_DIR}/capture/inbox"` with priority resolution:
     - Try `$MIND_DIR/inbox/new` first
     - Fall back to `$MIND_DIR/capture/inbox`
   - Update proposed-move source paths to reflect actual source directory.

3. **Update `operations/automations/n8n/workflows/mind-inbox-fixed.json`**:
   - Replace hardcoded `capture/inbox/` and `capture/failed/` with env-var-driven path prefix, e.g.:
     ```javascript
     const inboxPrefix = $env.MIND_INBOX_PATH || 'capture/inbox';
     const failedPrefix = $env.MIND_FAILED_PATH || 'capture/failed';
     const file = `${isFailed ? failedPrefix : inboxPrefix}/${date}-${slug}.md`;
     ```
   - After switch, set `MIND_INBOX_PATH=inbox/new` and `MIND_FAILED_PATH=inbox/failed` in n8n env.

### No changes required in these Brain components

- `mind-paths.ts` — already has full dual-path constants and compatibility groups.
- `mind-steward-inbox-queue.ts` — already tries `inbox/new/` first.
- `execution-plans.ts` — already allows both paths.
- Mind Steward CLI (`projects/mind-steward/`) — already configurable via `--mind-root` or env var.
- `mind-structure-validator.ts` and tests — already support both paths.

## External tests required but NOT run in this batch

These require network/credentials and were not executed:

1. **n8n controlled test write to `inbox/new/`**:
   - Requires active n8n instance with `GITHUB_MIND_PAT` and `GEMINI_API_KEY` configured.
   - Should write one test capture to `inbox/new/` after path prefix is configurable.

2. **n8n controlled test failed-capture to `inbox/failed/`**:
   - Same n8n/env requirements.
   - Uses `forceFailure=true` or intentionally malformed input.
   - Should write to `inbox/failed/` after path prefix update.

3. **Mind Steward dry-run against `inbox/new/`**:
   - Requires a test capture to exist in `inbox/new/`.
   - Run `bash tools/scripts/mind-steward-inbox-dry-run-report.sh` after path resolution is updated.

4. **Brain Core test suite**:
   - Read-only unit tests exist and could be run without network.
   - Command: `cd projects/brain-core && npm run test` (requires build step).
   - Only run if you have a safe environment (no captures created, no network called).

## Required switch order

This is the exact sequence required for a safe controlled switch:

**Step 1 — Update shell scripts for dual-path support**
Update `mind-steward-inbox-dry-run-report.sh` and `mind-compile-loop.sh` to try `inbox/new/` first with `capture/inbox/` fallback.

**Step 2 — Make n8n path configurable**
Update `mind-inbox-fixed.json` to use `$env.MIND_INBOX_PATH` and `$env.MIND_FAILED_PATH` with legacy defaults.

**Step 3 — Controlled test: read `inbox/new/` from shell scripts**
Place a dry-run test capture in `inbox/new/`, run dry-report scripts, confirm they find it.

**Step 4 — Controlled test: write to `inbox/new/` from n8n**
Set `MIND_INBOX_PATH=inbox/new` in n8n env. Send one test capture. Verify it lands in `inbox/new/`.

**Step 5 — Controlled test: write to `inbox/failed/` from n8n**
Set `MIND_FAILED_PATH=inbox/failed`. Force a failure. Verify it lands in `inbox/failed/`.

**Step 6 — After tests pass: update Mind `.obsidian/app.json`**
Change `newFileFolderPath` from `capture/inbox` to `inbox/new`.
Review stale `attachmentFolderPath` from `sources/files` to `resources/files`.

**Step 7 — After Obsidian update: update Mind agent context**
Update `AGENTS.md`, `00-current-context.md`, `00-memory-map.md`, and `folder-contract.md` to mark legacy-to-target switch as active.

**Step 8 — Move existing `capture/inbox/` content to `inbox/new/`**
Git mv the files, preserving history.

**Step 9 — Move existing `capture/failed/` content to `inbox/failed/`**
Git mv the files, preserving history.

**Step 10 — Decide `capture/daily/` separately**
Options: `inbox/processed/daily/`, `history/capture-daily/`, or other human-approved target.

## Recommendation

**Proceed with Batch 8E — Brain shell script and n8n path update.**

This batch should:
1. Update `tools/scripts/mind-steward-inbox-dry-run-report.sh` to try `inbox/new/` first.
2. Update `tools/scripts/mind-compile-loop.sh` to try `inbox/new/` first.
3. Update `operations/automations/n8n/workflows/mind-inbox-fixed.json` to use env-var-driven path prefixes.
4. Validate the shell script changes with a read-only test.
5. Do NOT trigger the n8n workflow yet (requires network/credentials for controlled test).

After Batch 8E, proceed with Batch 8F — controlled n8n write test, which DOES require:
- Active n8n instance
- `GITHUB_MIND_PAT` and `GEMINI_API_KEY` env vars
- Permission to write one test capture to `inbox/new/`
- Permission to write one test failed-capture to `inbox/failed/`

## Batch 8E — Shell script and n8n path update (2026-07-09)

**Completed:** Batch 8E updated three Brain-side files to support target inbox paths while preserving legacy defaults.

### Changes made

**1. `tools/scripts/mind-steward-inbox-dry-run-report.sh`**
- Before: `INBOX_DIR="$MIND_ROOT/capture/inbox"` — hardcoded legacy path
- After: `INBOX_DIR="$(resolve_inbox_dir "$MIND_ROOT")"` — prioritises `inbox/new`, falls back to `capture/inbox`
- Reports which path was selected (JSON `inboxResolvedFrom` field, Markdown `Inbox resolution` line)
- If neither path exists, fails with clear message indicating both were tried

**2. `tools/scripts/mind-compile-loop.sh`**
- Before: `INBOX_DIR="${MIND_DIR}/capture/inbox"` — hardcoded legacy path
- After: `INBOX_DIR="$(resolve_inbox_dir "$MIND_DIR")"` — prioritises `inbox/new`, falls back to `capture/inbox`
- Proposal source path changed from `` `capture/inbox/${filename}` `` to `` `inbox/${filename}` ``
- Proposal destination for resource/reference type changed from `sources/research/${slug}.md` to `resources/research/${slug}.md` (reflecting Mind Batch 7 resources migration)

**3. `operations/automations/n8n/workflows/mind-inbox-fixed.json`**
- Before: `const file = \`${isFailed ? 'capture/failed' : 'capture/inbox'}/${date}-${slug}.md\`` — hardcoded paths
- After: env-var-driven path prefixes with legacy defaults:
  ```javascript
  const inboxPrefix = ($env.MIND_INBOX_PATH || 'capture/inbox').replace(/^\/+|\/+$/g, '') || 'capture/inbox';
  const failedPrefix = ($env.MIND_FAILED_PATH || 'capture/failed').replace(/^\/+|\/+$/g, '') || 'capture/failed';
  const file = `${isFailed ? failedPrefix : inboxPrefix}/${date}-${slug}.md`;
  ```
- Legacy defaults unchanged: `capture/inbox` and `capture/failed`
- Sanitises leading/trailing slashes; rejects empty paths by falling back to legacy default
- GitHub API URL, auth logic, webhook path, workflow id/name/active state unchanged

### Validation performed
- `bash -n` syntax check passed for both shell scripts
- JSON parse check passed for n8n workflow
- n8n code contains `MIND_INBOX_PATH`, `MIND_FAILED_PATH`, and legacy defaults `capture/inbox`, `capture/failed`
- Webhook path `/mind-inbox` preserved
- Workflow `id`, `name`, `active` state unchanged
- No workflow was triggered
- No network commands were run
- No Mind repo files were changed

### Remaining external test requirements
- Controlled write test to `inbox/new/` via n8n (requires credentials)
- Controlled write test to `inbox/failed/` via n8n (requires credentials)
- These are deferred to Batch 8F

## Batch 8F — Controlled dry-run validation (2026-07-09)

**Completed:** Batch 8F validated all updated scripts with fake Mind roots and n8n static simulation. See `operations/reports/mind-inbox-controlled-dry-run-validation-2026-07-09.md`.

Key outcomes:
- All three shell scenarios pass (target exists, fallback only, neither exists).
- All three compile-loop scenarios pass (same three cases).
- n8n static simulation passes for all four env patterns (unset, target, slashes, empty).
- Small bug fixed: `resolve_inbox_dir` `return 1` caused `set -e` early exit; changed to `return 0`.
- Improvement: added dynamic `inboxSource` field (`target`/`legacy-fallback`/`unavailable`) replacing static description.
- No network calls, no n8n trigger, no Mind repo modification.

## Boundaries preserved in this validation

- No implementation code was changed in the Brain repo.
- No workflow JSON was edited.
- No env/secrets files were touched.
- No n8n workflow was triggered.
- No network commands were run.
- No Mind capture content was moved.
- No Mind repo `.obsidian/app.json` was changed.
- No Mind Save-to-Mind routing was switched.
- Only this validation plan was created.
