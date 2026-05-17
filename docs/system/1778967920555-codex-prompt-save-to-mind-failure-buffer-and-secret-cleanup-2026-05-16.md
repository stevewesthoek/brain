# Codex Prompt — Save-to-Mind Failure Buffer and Workflow Secret Cleanup

## Repo / source

Work from the `brain` repo, with verification against the connected `mind` repo only where needed.

## Goal

Implement and verify the next Save-to-Mind hardening slice after successful live `capture/inbox/` deployment:

1. Remove the literal Gemini API key from the repo workflow JSON and live n8n workflow configuration without exposing the key.
2. Add/verify recoverable failure-buffer behavior so failed captures can land in:

```text
mind/capture/failed/
```

3. Keep successful captures landing in:

```text
mind/capture/inbox/
```

4. Keep the public webhook path stable:

```text
/webhook/mind-inbox
```

## Current verified state

The previous live deployment slice reported and local files now reflect:

- Live n8n deployment performed via n8n Public API wrapper on workflow `FwP5INe9qoo1OwGC`.
- Production `/webhook/mind-inbox` test succeeded.
- Test capture landed at:

```text
mind/capture/inbox/2026-05-16-mind-os-live-deployment-verification.md
```

- No new test capture landed in legacy `mind/01-inbox/`.
- Failure-buffer behavior was not verified and remains pending.

## Critical security issue

The repo workflow JSON currently contains a literal Gemini API key embedded in the Gemini request URL.

Do not print it, copy it, or include it in any commit message, log, issue, or documentation.

Clean it up by replacing the live and repo workflow configuration with a safe secret reference, such as an n8n credential or environment variable, depending on the existing production pattern.

Preferred target pattern:

```text
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{ $env.GEMINI_API_KEY }}
```

or an n8n-managed credential if the workflow supports that more safely.

Do not assume the exact env var name. Inspect runbooks/tooling safely and use the existing production convention if available.

## Safety rules

- Do not expose, print, copy, or commit live secret values.
- Do not inspect `.env`, `.env.*`, private keys, credential stores, token files, browser session stores, or secret folders unless an existing safe deploy tool abstracts them without showing values.
- Do not move, archive, delete, or rewrite legacy Mind folders.
- Do not change the public webhook path.
- Do not break the already verified success path to `capture/inbox/`.
- Do not stage all files.
- Do not commit or push unless explicitly asked by the user.
- Keep changes narrow and reversible.

## Files to read first

```text
brain/docs/system/mind-os-migration-handoff-2026-05-16.md
brain/operations/runbooks/n8n-mind-inbox.md
brain/operations/automations/n8n/workflows/mind-inbox-fixed.json
mind/MIND-OS-HANDOFF-2026-05-16.md
mind/capture/inbox/2026-05-16-mind-os-live-deployment-verification.md
mind/capture/failed/README.md
```

Also search for any existing failure-buffer design docs. A historical design may exist in Claude file history, but prefer current repo runbooks and workflow JSON as source of truth.

## Task 1 — Sanitize the repo workflow JSON

Update:

```text
brain/operations/automations/n8n/workflows/mind-inbox-fixed.json
```

Requirements:

- Remove the literal Gemini API key from the JSON.
- Replace it with a safe runtime reference or n8n credential usage.
- Preserve the Gemini model endpoint.
- Preserve `capture/inbox/` as the success write path.
- Preserve `/mind-inbox` as the webhook path.
- Preserve `$env.GITHUB_MIND_PAT` or existing safe GitHub auth pattern.
- Validate JSON after editing.

Do not paste the original secret into any command, patch, docs, or output.

## Task 2 — Deploy sanitized live workflow config

Use safe existing tooling only:

- existing repo-local n8n API wrapper if available, or
- n8n CLI if installed/configured safely, or
- documented n8n workflow import/update process.

When deploying, do not print environment variables, credential values, or secret-bearing workflow exports.

After deployment, verify the workflow remains active.

## Task 3 — Re-test success path after sanitization

Run a harmless production webhook test with a new title, for example:

```text
Title: Mind OS sanitized workflow verification
Body: Safe test capture created to verify Save-to-Mind still writes to capture/inbox after moving Gemini authentication out of the workflow JSON.
Tags: mind-os, security-test
```

Verify:

- Webhook returns success.
- New capture lands in `mind/capture/inbox/`.
- New capture does not land in `mind/01-inbox/`.
- New capture contains no secrets.

## Task 4 — Design and implement failure-buffer behavior

Goal behavior:

- If Gemini classification fails, times out, returns invalid JSON, or returns a low-confidence unrecoverable processing error, preserve the raw capture in:

```text
mind/capture/failed/
```

- The failed note should include safe metadata:

```yaml
type: failed-capture
source: chatgpt|shortcut|unknown
status: needs-retry
created: ISO timestamp
failure_stage: gemini-classify|parse|github-write|unknown
error_summary: short redacted summary
```

- The body should include the raw user-provided capture content, as long as it is the capture payload and not a secret/log dump.
- The webhook should return a clear recoverable status, such as:

```json
{"status":"failed-buffered","result":"saved_to_capture_failed"}
```

Do not intentionally break production with dangerous malformed payloads. Prefer controlled test inputs and n8n node-level failure simulation if supported safely.

## Task 5 — Test failure buffer safely

Only test failure behavior in a way that does not expose secrets or destabilize the workflow.

Acceptable test approaches:

- Use a safe temporary workflow copy/staging workflow if available.
- Use a controlled payload that triggers a known validation/fallback path without breaking production.
- Use n8n execution/test tooling that can simulate Gemini failure without changing live credentials.

Verify:

- A failed/recoverable capture lands in `mind/capture/failed/`.
- The note contains safe raw content and redacted error metadata.
- The successful capture path still works after failure-buffer changes.
- No captures are lost.

If failure-buffer testing cannot be done safely, document exactly why and stop before risky deployment.

## Task 6 — Update docs and handoffs after real verification

Update only after verified:

```text
brain/docs/system/mind-os-migration-handoff-2026-05-16.md
brain/operations/runbooks/n8n-mind-inbox.md
mind/MIND-OS-HANDOFF-2026-05-16.md
mind/HOME.md
mind/README.md
```

Include:

- Sanitized workflow verification date.
- Failure-buffer deployment date if deployed.
- Success test capture path.
- Failure test capture path if verified.
- Clear statement that literal Gemini API key was removed from repo workflow JSON and live workflow config without exposing the value.
- Any remaining limitations.

## Validation checklist

Run and record results:

```bash
git status --short
python3 -m json.tool operations/automations/n8n/workflows/mind-inbox-fixed.json >/dev/null
rg "generativelanguage.googleapis.com|GEMINI|capture/inbox|capture/failed|01-inbox|mind-inbox" operations/automations/n8n/workflows/mind-inbox-fixed.json operations/runbooks/n8n-mind-inbox.md docs/system/mind-os-migration-handoff-2026-05-16.md
```

Do not run commands that print secret values.

If available, run a targeted secret scan on the workflow JSON and changed docs. If the scan misses the known Gemini key pattern, still manually confirm there is no literal `key=` value containing an API key in the workflow JSON.

Also verify in `mind`:

```bash
git status --short
find capture/inbox -maxdepth 1 -type f -name "*.md" -print
find capture/failed -maxdepth 1 -type f -name "*.md" -print
```

## Expected final report

Report:

1. Whether the literal Gemini key was removed from repo workflow JSON.
2. Whether the live n8n workflow was sanitized.
3. Whether success path still works after sanitization.
4. Whether failure-buffer behavior was deployed.
5. Whether failure-buffer behavior was tested.
6. Exact safe test capture paths.
7. Files changed.
8. Validations passed.
9. Blockers or deferred work.
10. Do not say committed or pushed unless explicitly done after user approval.
