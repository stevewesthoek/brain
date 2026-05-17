# ProBot Brain Core Thin Client Commands

## Purpose

Document the desired read-only ProBot aliases over Brain Core without forcing a risky refactor into the tangled command handlers yet.

## Desired aliases

- `brain`
- `brain status`
- `brain reports`
- `brain sessions`
- `brain approvals`

## Brain Core endpoints

- `GET /status`
- `GET /capabilities`
- `GET /runtime/reports`
- `GET /sessions`
- `GET /scheduler/jobs`
- `GET /approvals`

## Safety rules

- GET only.
- No POST endpoints.
- No approval execution.
- No dashboard changes.
- Fail soft when Brain Core is offline.
- Keep legacy commands working.

## Why the code edit was skipped

The current ProBot command layer is split between Slack and Telegram handlers plus shared helper services. There is no low-risk centralized insertion point for alias routing without opening a wider command refactor.

## Exact code locations to refactor later

- `projects/probot/src/bot/commands.ts`
- `projects/probot/src/bot/slack.ts`
- `projects/probot/src/bot/telegram.ts`

## Expected behavior

- `brain` should show a compact Brain Core summary.
- `brain status` should show only status.
- `brain reports` should show runtime report summaries.
- `brain sessions` should show session counts or summaries.
- `brain approvals` should show approval counts.

All responses should remain read-only and should not invoke approval POST routes.
