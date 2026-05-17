# Model Router

The model router is the AI steward for the `mind` vault and related Brain Core workflows.

## Status

Initial scaffold only. No live scheduler job or destructive migration logic is implemented yet.

## Responsibilities

- Read the `mind/router/` contract.
- Classify captures from `mind/capture/inbox/`.
- Route useful work into `mind/live/`.
- Compile durable knowledge into `mind/wiki/`.
- Preserve raw evidence in `mind/sources/`.
- Report failed or unsafe captures through `mind/capture/failed/`.
- Run dry checks before any migration or archive operation.

## Non-responsibilities

- Do not store secrets.
- Do not execute arbitrary shell commands from Obsidian notes.
- Do not move/delete legacy numbered folders until validation and explicit archive phase.
- Do not become a dashboard; Obsidian and Brain Core own the operating surfaces.

## Initial jobs

- `mind-compile-loop`
- `mind-memory-loop`
- `mind-hygiene-loop`
- `mind-drift-error-loop`

## Current dry-run capability

The first implemented helper is a read-only contract checker for `mind-drift-error-loop`.

It accepts a snapshot of known `mind` paths and reports:

- missing required Mind OS folders and root files
- missing `router/` contract files
- missing `live/` cockpit files
- missing capture/wiki/source/archive index files
- legacy numbered folders that remain present and read-only
- whether Save-to-Mind is still unverified for `capture/inbox/`
- whether live n8n deployment has been verified
- whether the failure buffer is unconfigured, folder-only, test-verified, or real-error-verified
- whether the archive phase remains blocked by incomplete failure-buffer verification

This is intentionally not a filesystem walker yet. The caller must provide observed path status from a trusted adapter, Brain Core, scheduler job, or BuildFlow validation step.

## Safety posture

The first implementation is read-only/dry-run. Writes should be explicit, small, logged, and reversible. Legacy numbered folders must not be moved, archived, deleted, or rewritten until validation and explicit archive approval.
