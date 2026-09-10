# Agent Mode N0.1 Remote Node Evidence — 2026-09-09

## Status

N0.1 is complete for its bounded scope. N0 remains in progress; N0.2 is the
exact next task. This report records the new N0.1 work and does not rewrite
historical K0, K2.1, or K2.2 evidence.

No model call was made.

## Scope and design

N0.1 adds a thin `NodeTransport` seam around the existing `BrainNode` command /
receipt contract:

- `LocalNodeTransport` delegates to the existing local perimeter.
- `SshNodeTransport` uses OpenSSH first, with `shell:false`, strict host-key
  behavior, bounded output, one JSON line on stdin, and one JSON envelope out.
- Tailscale remains the existing network overlay; it is not a competing
  transport identity. No public listener or daemon was added.
- The remote runner is short-lived. It creates temporary node-local in-memory
  state to apply the same perimeter and never copies or shares the Office
  SQLite database.
- HMAC-SHA256 node-local provenance is required in addition to SSH host
  authentication. The node-local secret is mode 0600 and is not in Git or the
  Office StateStore.
- Negotiation requires `brain-node-v1`, runner version, expected node/resource,
  fresh available health, platform metadata, and exactly `repo.read`.
- Receipt validation preserves operation/attempt/capability/scope lineage,
  fencing and integrity hashes. Stderr cannot turn a command into success.
  Disconnects are nonterminal; reconnect is a fresh handshake without replay.

## Canonical identities

The implementation and live proof reuse the infrastructure catalog identities:

```text
resourceRef: host:macbook
nodeId:      node-instance:host:macbook
transport:   ssh:macbook
SSH alias:   macbook
```

No `brain-node-office`, `brain-node-macbook`, or worker-specific competing
identity was introduced. The live proof derives the known resource set from
`operations/infrastructure/catalog/assets.v1.json`.

## Read-only preflight

The bounded preflight verified:

- catalog resources `host:office` and `host:macbook` are active;
- the existing `macbook` SSH alias resolves with the existing user and key;
- explicit `StrictHostKeyChecking=yes`, `UpdateHostKeys=no`, and
  `BatchMode=yes` authenticated successfully;
- the remote platform is Darwin arm64;
- the remote PATH did not include Node, while node-local/system Node locations
  were available; the wrapper resolves those locations without shell/SSH
  configuration changes;
- no existing `~/.local/brain/node` config, runner, database, or fixture was
  overwritten during bootstrap.

No SSH configuration, SSH key, or Tailscale state was changed.

## Live proof

One harmless fixture read was executed through the real SSH transport after
the final build. The controller used a temporary Office StateStore, and the
receipt was recorded and reopened from that store.

```json
{
  "status": "PASS",
  "nodeResourceRef": "host:macbook",
  "nodeId": "node-instance:host:macbook",
  "protocolVersion": "brain-node-v1",
  "runnerVersion": "brain-node-runner-n0.1",
  "transport": "ssh:macbook",
  "capability": "repo.read",
  "operationId": "operation:n0-1-live-read",
  "attemptId": "attempt:n0-1-live-read",
  "receiptStatus": "succeeded",
  "resultHash": "48e30340bef4f5da653ab9981dca8ec8a9ec091c774a3b64b1991a4649e10981",
  "latencyMs": 698,
  "officeStateStoreReconciled": true,
  "reconnectCleanup": "short-lived-runner-exited"
}
```

The marker content was `N0_1_REMOTE_READ_PASS` with a trailing newline. No
model or public endpoint was involved.

## Files changed for N0.1

- `projects/brain-core/src/agent-mode/brain-node.ts`
- `projects/brain-core/src/agent-mode/node-enrollment.ts`
- `projects/brain-core/src/agent-mode/node-transport.ts`
- `projects/brain-core/src/agent-mode/brain-node-runner.ts`
- `projects/brain-core/src/tests/agent-mode-node-transport.test.ts`
- `tools/scripts/brain-node-runner-wrapper.sh`
- `tools/scripts/agent-mode-n0-1-live-proof.ts`
- `operations/fixtures/agent-mode-n0-1-macbook-node.json`
- `operations/fixtures/agent-mode-n0-1-marker.txt`
- `operations/runbooks/agent-mode-node-transport.md`
- `operations/specs/agent-mode-runtime-roadmap.md`
- `docs/product/agent-mode-progress.md`

Pre-existing K0–K2 changes in the dirty worktree were preserved.

## Validation

- focused Agent Mode / Brain Core suite: **96 passed, 0 failed**;
- `npm run typecheck --silent`: **pass**;
- `npm run build --silent`: **pass**;
- wrapper `bash -n`: **pass**;
- `git diff --check`: **pass**;
- live SSH preflight: **pass**;
- live bounded MacBook `repo.read` and Office receipt reconciliation:
  **pass**.

The tests cover local/SSH parity, fixed argv and stdin injection resistance,
wrong host and node, protocol/capability mismatch, stale health, HMAC failure,
malformed receipts, timeout/disconnect, duplicate/stale/conflicting receipt
semantics, and canonical enrollment.

## Persistent MacBook changes and rollback

The minimum node-local bootstrap remains under:

```text
~/.local/brain/node/
```

It contains the short-lived runner wrapper/modules, mode-0600 node config,
mode-0600 node-local authentication secret, and the harmless read fixture;
the root and fixture directory are mode 0700. No `.db` or `.sqlite` file is
present in that scope.

To roll back N0.1 after confirming no later node work depends on it, remove
only that exact node-local directory. This does not remove SSH keys, alter SSH
configuration, change Tailscale, or affect Office StateStore data. The secret
was rotated once for the final proof and was never printed.

## Remaining N0 gaps

N0.2 remains: broader remote-node lifecycle/reconnect and multi-node proof using
the same protocol. N0.1 intentionally does not provide write capabilities,
shell execution, automatic retries, VPS transport, a public API, a daemon, K3
coding autonomy, or model routing. There are no current blockers to N0.2.
