# Video Orchestrator Phase 3B - Posting Adapter Interface + Registry

## Purpose

Phase 3B formalizes the posting adapter contract and routing layer without enabling real platform publishing. The only executable adapter remains manual upload export.

## Adapter Interface

- `validateConfig()`
- `validateCredentials()`
- `preflight()`
- `execute()`
- `pollStatus()`

Each adapter returns a structured result with status, mode, platform, package target, warnings, and optional metadata.

## Adapter Modes

- `manual`
- `api`
- `n8n`
- `browser_assisted`
- `disabled`

## Registry Behavior

- `manual` routes to the existing local export implementation
- `api`, `n8n`, and `browser_assisted` are dry-run/blocked stubs
- `disabled` returns blocked/skipped results
- unknown modes fall back to manual only when the target permits manual fallback

## Result Model

- `succeeded`
- `skipped`
- `blocked`
- `failed`
- `dry_run`

## Safety Rules

- No network posting
- No OAuth
- No credentials or token access
- No browser automation
- No n8n execution
- Manual fallback remains the only executable adapter

## What This Prepares For

Phase 3C+ can add a real platform adapter behind the same interface once credentials, approval, and platform-specific behavior are intentionally introduced.
