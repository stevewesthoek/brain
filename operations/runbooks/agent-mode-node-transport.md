# Agent Mode NodeTransport Runbook

## Boundary

`BrainNode` is the portable, authenticated command/receipt contract. `NodeTransport`
only delivers that contract and validates the remote envelope. The current
transports are `local` and `ssh:macbook`; Tailscale is the existing network
overlay, not a transport identity, and no public listener or daemon is used.

Office remains the controller and sole durable authority. A remote runner uses
a short-lived, node-local in-memory StateStore to enforce the same perimeter;
it never receives or copies the Office SQLite database.

## Canonical enrollment

The infrastructure catalog is authoritative for `host:office` and
`host:macbook`. N0.1 uses the canonical identities:

```text
resource: host:macbook
node:     node-instance:host:macbook
SSH:      ssh:macbook / macbook
```

The remote runner is always invoked as
`~/.local/brain/node/brain-node-runner` with either `--handshake` or `--execute`.
The SSH process uses `BatchMode=yes`, strict host-key checking, disabled host
key updates, a five-second connection timeout, `shell:false`, one JSON line in,
and one JSON envelope out. Command data is sent on stdin; it is never interpolated
into an SSH command string.

## Authentication and negotiation

SSH host authentication is necessary but not sufficient. The node also holds
the mode-0600 node-local secret at `~/.local/brain/node/auth.secret`. The
controller signs command provenance with HMAC-SHA256, and the node verifies it.
The secret is not stored in Git or in the Office database.

Handshake admission requires protocol `brain-node-v1`, the expected canonical
node/resource identity, a runner version, available health evidence within the
freshness window, and exactly the `repo.read` capability with a safe byte limit.
Receipts must preserve operation/attempt/capability/scope lineage, fence and
integrity hashes. Stderr is diagnostic only and can never make a command
successful. Disconnects remain nonterminal and are not replayed automatically;
reconnect starts with a fresh handshake. Duplicate/conflict decisions remain
StateStore responsibilities.

## N0.1 preflight and proof

The bounded preflight confirmed that the catalog identities resolve, the
existing `macbook` SSH alias is usable with strict host-key behavior, and an
authenticated command reaches Darwin arm64. The remote PATH did not include
Node, so the wrapper resolves only node-local/system Node locations without
changing shell or SSH configuration.

The minimum bootstrap is confined to `~/.local/brain/node/`: wrapper, runner
modules, mode-0600 config/secret/fixture files, and a mode-0700 fixture
directory. No SSH keys, Tailscale settings, global launchers, models, or
database files were changed.

The live proof performed one bounded `repo.read` of the harmless marker fixture
and reconciled the receipt into a temporary Office StateStore:

```text
status: PASS
operation: operation:n0-1-live-read
attempt:  attempt:n0-1-live-read
receipt:  succeeded
latency:  868 ms
```

No model call was made.

## N0.2 reconnect and deduplication

The generic implementation has no personal-host branch. Installation-specific
identities remain only in the N0.1/N0.2 fixture files and explicitly named live
proof scripts. Auth references remain opaque; a future rotation can provision
a new node-local secret, verify a fresh handshake, switch the controller's
credential reference, and retire the old secret without placing secret bytes
in Git, task state, or the Office database.

Remote delivery states reuse the K0 vocabulary: before-send failure leaves the
operation dispatchable; after-send receipt loss marks the effect observed
without receipt and requires reconciliation; valid receipts are recorded by
Office; remote rejection is a received rejected receipt; malformed receipts
are invalid and never accepted. Reconnect performs a fresh handshake and does
not replay automatically.

The node-local dedup file is `~/.local/brain/node/dedup.json`, mode 0600,
bounded to 512 records / 24-hour retention (maximum configured retention is
seven days), and currently approximately 2004 bytes. It stores only schema
version, operation ID, immutable command hash, receipt, and timestamps. Writes
use a restrictive directory, lock, temporary file, and atomic rename. Invalid
JSON or invalid entries fail closed. Remove this exact file, after confirming
no pending reconciliation depends on it, to reset node-local dedup evidence;
remove the complete node scope only for full N0 rollback.

## Office/MacBook parity

`tools/scripts/agent-mode-n0-2-live-parity.ts` runs the same logical bounded
read through `LocalNodeTransport` and an explicitly configured
`SshNodeTransport`. The live proof returned `N0_2_MULTI_NODE_PASS`, reconciled
both receipts in Office, and preserved distinct node and transport identities.
No model call is involved.

## N0 rollback

N0 node-local state can be removed as one exact scope after confirming no later
node work depends on it:

```text
~/.local/brain/node/
```

This removes the N0.1/N0.2 runner/config/secret/dedup/fixture scope. It does not
touch `~/.ssh`, Tailscale, the infrastructure catalog, or Office StateStore.

## Not included

N0.1 does not add write capabilities, shell execution, a public API, a daemon,
automatic retries, VPS transport, K3 coding autonomy, or model routing.
