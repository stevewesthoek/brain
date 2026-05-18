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

## Current limitation

Brain Console now has a typed parity response contract, but the request reader and visible dashboard card/tab have not yet been inserted into `projects/brain-console-obsidian/src/view.ts` in this slice. The next implementation slice should add a compact ProBot parity card in the Brain Console Overview or System/Recovery area using the existing request helper pattern, then expand missing ProBot parity surfaces one by one.

## Next safe tasks

1. Add visible Brain Console ProBot parity card using `readBrainCoreProBotDashboardParity()`.
2. Add read-only ProBot workflow queue summary if safe source data exists.
3. Add read-only Video Orchestrator account health parity without tokens/OAuth/secrets.
4. Add read-only system update availability summary without execution controls.
5. Keep ProBot as legacy/thin client until every keep/redesign tab has Brain Console parity and explicit decommission approval exists.
