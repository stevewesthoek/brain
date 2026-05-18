# ProBot to Brain Console Dashboard Parity Handoff

## Goal

Make every ProBot dashboard tab visible, available, and tracked inside the Obsidian Brain Console so the old ProBot dashboard can become legacy-only.

## Current migration slice

Implemented a read-only Brain Core parity inventory endpoint and a Brain Console overview card:

- `GET /probot/dashboard-parity`
- Brain Console card: `ProBot → Brain Console Parity`

The endpoint maps each legacy ProBot dashboard tab to its Brain Console destination, migration decision, status, supporting Brain Core endpoints, remaining gaps, and safety flags. The Brain Console card renders the total/visible/working/partial/legacy-only counts and one row per legacy ProBot tab.

## Legacy ProBot tabs tracked

- Overview → Brain Console `overview` — available
- Local Apps → Brain Console `apps` — available
- Production Pipeline → Brain Console `pipelines` — partial/redesigned
- Video Orchestrator Studio → Brain Console `pipelines` — partial/redesigned
- Viral Flow → Brain Console `posts` — partial/redesigned
- Stripe → intentionally legacy-only / not migrated
- Session History → Brain Console overview/activity — available
- System Updates → Brain Console recovery/maintenance — planned/read-only first

## Safety boundary

- No ProBot mutation controls were migrated.
- No direct shell execution was added.
- No credential, OAuth, Stripe, or secret data is exposed.
- No file writes, Mind writes, publishing, STB mutation, or controlled-execution runtime work was added.
- Future lifecycle controls must remain approval-request-only before any execution path exists.

## Validation

- `npm run --prefix projects/brain-core ci` — passed, 322 tests.
- `npm run --prefix projects/brain-console-obsidian typecheck` — passed.
- `npm run --prefix projects/brain-console-obsidian build` — passed.
- `npm run --prefix projects/brain-console-obsidian package` — passed.

## Next active task

Wire the parity response into a visible Brain Console card or tab, then fill the partial surfaces in this order:

1. Video Orchestrator account-health parity without credentials.
2. ProBot production workflow queue read-only summary if safe data exists.
3. Viral Flow live/account summary without secrets.
4. System update read-only availability summary.
5. Dedicated Session History parity view.

## Git hygiene

Do not stage unrelated `operations/system-configs/**` churn or `tsx-502/`.