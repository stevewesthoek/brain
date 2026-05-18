# Post Orchestrator Preview Mode Runbook

## Purpose

Post Orchestrator preview mode is the read-only Brain Core and Brain Console surface for post flows, fixtures, review queues, schedule previews, analytics fixtures, safety policy, and migration planning.

It is intentionally preview-only. It does not publish, schedule, export files, copy to clipboard, or decommission anything.

## Current status

- P1-P15 preview arc is complete.
- Publishing is disabled.
- Scheduling is disabled.
- Platform writes are disabled.
- Decommission is not started.

## How to view in Obsidian

1. Start Brain Core.
2. Open Brain Console in Obsidian.
3. Open the Posts/Post Orchestrator section.
4. Review the grouped preview cards and blocker summaries.

## What each group means

- Status: compact overview of counts, blockers, and the next safe step.
- Flow Preview: platform flows, event fixtures, dry-run plans, and draft examples.
- Review / Schedule: review queue, schedule preview, and manual export preview.
- Safety / Policy: readiness, platform policy, operator guidance, and acceptance checks.
- Migration / Checkpoint: migration parity, decommission readiness, and roadmap checkpoint.

## What is safe

- Read-only endpoints.
- Dry-run previews.
- Review approval requests.
- Schedule review approval requests.
- Manual export preview only.

## What is not enabled

- Publishing.
- Scheduling.
- Platform API writes.
- Browser automation.
- External analytics reads.
- Decommissioning.

## Operator checklist

1. Review the overview card.
2. Review the blocked items in readiness and policy cards.
3. Inspect platform policies.
4. Inspect migration parity.
5. Review the roadmap checkpoint.
6. Decide whether to approve a future design phase.

## Next phase decision

- Visual polish and navigation cleanup, or
- explicit user-approved real scheduling/publishing design later.

No secrets.
No live tokens.
No write actions.
