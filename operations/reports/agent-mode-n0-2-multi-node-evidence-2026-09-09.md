# Agent Mode N0.2 Multi-Node Evidence — 2026-09-09

## Decision

**N0 COMPLETE.** N0.1 and N0.2 exit gates passed for the approved bounded
scope. The exact next roadmap task is **K3 — safe coding autonomy**. K3 was
not started. No model call was made.

This report records N0.2 and does not rewrite historical N0.1 evidence.

## Time-dependent regression

`LocalNodeTransport` now accepts an injectable clock and production defaults to
the real clock. The existing K2.1 fixture operation preparation also uses its
injected `now` value, so historical fixture deadlines are deterministic without
disabling deadline validation or extending deadlines. The previously failing
local/SSH parity test passes.

## Generic enrollment and portability

`SshNodeEnrollment` now uses opaque `string` identities for `resourceRef`,
`nodeId`, `transportRef`, `hostAlias`, and `authRef`. The controller validates
the configured resource against a trusted resource set; the runner trusts only
its node-local enrollment/config and incoming commands cannot redefine that
identity. `SshNodeTransport` requires explicit enrollment and has no MacBook
default or MacBook factory.

Two test-owned enrollments prove unchanged code paths for synthetic Darwin and
Linux nodes:

```text
host:laptop-example / ssh:laptop-example / Darwin arm64
host:server-example / ssh:server-example / Linux x64
```

The generic Agent Mode node/transport source contains no `host:office`,
`host:macbook`, `office`, `macbook`, private IP, or personal absolute path.
Remaining personal references are limited to installation-specific N0.1/N0.2
fixtures, the explicitly named live-proof scripts, historical reports/runbook
deployment instructions, and unrelated existing repository tests. They are
configuration/evidence, not generic runtime branches.

HMAC command provenance remains required. Enrollment carries only the opaque
`authRef`; the secret stays node-local outside Git, task state, model context,
and the Office StateStore. Future rotation is documented as provision-new,
handshake-verify, controller-reference-switch, then retire-old-secret.

## Reconnect and duplicate-delivery semantics

Delivery uses the existing K0 recovery vocabulary:

| Boundary | Result |
|---|---|
| before send / process cannot start | `not_sent`; operation remains dispatchable/retryable by policy |
| after send with no valid receipt | `sent_receipt_unknown`; Office marks effect observed without receipt and requires reconciliation |
| valid receipt | `receipt_known`; controller validates lineage, fence, scope, protocol and hashes |
| valid remote rejection | rejected receipt, not transport failure |
| malformed receipt | invalid receipt; never accepted |
| handshake unavailable/stale | transport unavailable; fresh negotiation required |

SSH disconnect after command delivery is never recorded as an ordinary failed
effect and is never blindly replayed. Reconnect is a fresh handshake.

Because each runner is short-lived, N0.2 adds a private atomic node-local
deduplication file. It stores only schema version, operation ID, immutable
command hash, receipt, and created/expiry timestamps. It is bounded to 512
records with 24-hour retention (maximum seven-day configuration), uses a lock,
temporary file and atomic rename, and fails closed on corruption. Identical
operation content across separate runner processes returns the prior semantic
result as a duplicate; conflicting content returns `operation_conflict`.
Office remains the sole authoritative Brain StateStore; no ledger, prompt,
credential, or SQLite replication is present.

## Office/MacBook live parity

The same logical bounded `repo.read` was run through Office local transport and
MacBook SSH transport against equivalent harmless node-local fixtures. Both
returned `N0_2_MULTI_NODE_PASS`, had distinct correct node/transport identities,
and both receipts were reconciled through the Office StateStore.

```json
{
  "status": "PASS",
  "semanticResult": "N0_2_MULTI_NODE_PASS",
  "latencyMs": 508,
  "office": {
    "nodeId": "node-instance:host:office",
    "transport": "local",
    "operationId": "operation:n0-2-office-read:1788962398674",
    "attemptId": "attempt:n0-2-office-read:1788962398674",
    "receiptStatus": "succeeded"
  },
  "macbook": {
    "nodeId": "node-instance:host:macbook",
    "transport": "ssh:macbook",
    "operationId": "operation:n0-2-macbook-read:1788962398674",
    "attemptId": "attempt:n0-2-macbook-read:1788962398674",
    "receiptStatus": "succeeded"
  },
  "identicalSemanticResult": true,
  "officeStateStoreReconciled": true
}
```

No destructive network test, SSH topology change, Tailscale change, model
call, public listener, daemon, or deployment outside the bounded node-local
scope was used.

## Persistent MacBook state

The N0.2 node-local scope is `~/.local/brain/node/`:

- wrapper and compiled runner modules;
- mode-0600 `node.json` and HMAC `auth.secret`;
- mode-0700 `fixtures/n0-2/` containing the mode-0600 marker;
- mode-0600 `dedup.json`, approximately 2004 bytes in the final inspection;
- no `.db` or `.sqlite` file.

Rollback is to remove only `~/.local/brain/node/dedup.json` when no pending
reconciliation depends on it, or the complete exact `~/.local/brain/node/`
scope for full N0 rollback. Neither procedure touches SSH keys/configuration,
Tailscale, Office StateStore, FluidVoice, MLX Whisper, local model installs,
or global shell configuration. The node secret was rotated for the final proof
without printing or retaining its value locally.

## Files changed for N0.2

- `projects/brain-core/src/agent-mode/brain-node.ts`
- `projects/brain-core/src/agent-mode/live-agent-mode-slice.ts`
- `projects/brain-core/src/agent-mode/node-enrollment.ts`
- `projects/brain-core/src/agent-mode/node-transport.ts`
- `projects/brain-core/src/agent-mode/node-deduplication-store.ts`
- `projects/brain-core/src/agent-mode/brain-node-runner.ts`
- `projects/brain-core/src/tests/agent-mode-node-transport.test.ts`
- `tools/scripts/brain-node-runner-wrapper.sh`
- `tools/scripts/agent-mode-n0-1-live-proof.ts`
- `tools/scripts/agent-mode-n0-2-live-parity.ts`
- `operations/fixtures/agent-mode-n0-1-macbook-node.json`
- `operations/fixtures/agent-mode-n0-2-macbook-node.json`
- `operations/fixtures/agent-mode-n0-2-marker.txt`
- `operations/runbooks/agent-mode-node-transport.md`
- `operations/specs/agent-mode-runtime-roadmap.md`
- `docs/product/agent-mode-progress.md`

Pre-existing unrelated dirty work was preserved. No commit or push was made.

## Validation

- focused Agent Mode/Brain Core suite: **102 passed, 0 failed**;
- previously failing local/SSH parity test: **pass**;
- generic enrollment and synthetic Darwin/Linux tests: **pass**;
- separate short-lived runner-process duplicate/conflict test: **pass**;
- delivery/loss/reconnect fixtures: **pass**;
- node-local dedup corruption fail-closed test: **pass**;
- `npm run typecheck --silent`: **pass**;
- `npm run build --silent`: **pass**;
- wrapper `bash -n`: **pass**;
- JSON fixture validation: **pass**;
- `git diff --check`: **pass**;
- live Office/MacBook parity and Office receipt reconciliation: **pass**.
