# ProBot to Brain Console dashboard parity handoff

Date: 2026-05-18

## Goal

Move ProBot dashboard value into the Obsidian Brain Console so ProBot can become a legacy/thin client and Brain Console becomes the primary human cockpit.

## Scope approved in this pass

- Dashboard parity and migration visibility.
- Brain Core read-only APIs for parity status.
- Brain Console type contract for parity data; visible card wiring remains the next slice.
- No controlled-execution runtime work.
- No ProBot decommission.
- No secret, OAuth, Stripe, or financial data exposure.
- No direct shell execution or mutation controls from Brain Console.

## ProBot dashboard tabs inventoried

- Overview.
- Local Apps.
- Production Pipeline.
- Video Orchestrator Studio.
- Viral Flow.
- Stripe.
- Session History.
- System Updates.

## First implementation slice

Implemented a read-only Brain Core parity inventory endpoint:

- `GET /probot/dashboard-parity`

Implemented files:

- `projects/brain-core/src/adapters/probot-dashboard-parity.ts`
- `projects/brain-core/src/types/api.ts`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/tests/live-status-endpoints.test.ts`
- `projects/brain-console-obsidian/src/client.ts` (type contract only)

The endpoint reports each ProBot dashboard tab, its Brain Console target section, migration decision, status, priority, related Brain Core endpoints, and safety status.

## Safety status

- Read-only only.
- No POST route added.
- No secrets exposed.
- No financial data exposed.
- Stripe is explicitly marked legacy/admin-only and not visible in Brain Console.
- No mutation controls enabled.
- No direct shell execution enabled.
- No file writes.
- No Mind writes.

## Validation

- Brain Core CI: passed, 322 tests passing.
- Brain Console typecheck: passed.

## Second implementation slice

Implemented visible Brain Console ProBot parity card:

- Added `readBrainCoreProBotDashboardParity()` reader in `projects/brain-console-obsidian/src/view.ts`.
- Added `renderProBotDashboardParityCard()` to display parity status in the Overview tab.
- Card displays: total tabs (8), visible count, working count, partial count, legacy-only count, blocker count.
- Card lists all ProBot tabs with their Brain Console target section, migration status (available/partial/legacy-only), and implementation decision (keep/redesign/admin-only).
- Card shows per-tab: status, decision, visibility in Brain Console, whether working.
- Safety label: "Read-only · No secrets · No mutation controls · No direct shell execution"

Implemented files:

- `projects/brain-console-obsidian/src/view.ts` (visible card + reader)
- `docs/system/probot-to-brain-console-dashboard-parity-handoff.md` (this file)

## Validation

- Brain Core CI: 322 tests passing.
- Brain Console typecheck: passed.
- Brain Console build: passed, main.js bundled (792.4kb).

## Safety status

All safety boundaries maintained:
- Read-only only (no POST routes).
- No secrets, OAuth tokens, or credentials exposed.
- No Stripe financial data exposed.
- No mutation controls.
- No shell execution.
- No file writes.
- No Mind writes.
- No platform API writes.
- No STB mutation.
- No Video execution.
- No ProBot decommission.

## Next safe tasks

1. Add read-only ProBot workflow queue summary if safe source data exists (low-risk).
2. Add read-only Video Orchestrator account health parity without tokens/OAuth/secrets.
3. Add read-only system update availability summary without execution controls.
4. Add read-only Stripe account parity (metadata only, no API keys or financial data).
5. Keep ProBot as legacy/thin client until every keep/redesign tab has Brain Console parity and explicit decommission approval exists.
