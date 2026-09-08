# Agent Mode K0.3 Evidence — 2026-09-08

## Result

**K0.3 fixture gate: PASS.** K0 overall remains in progress. This slice is
local-only, non-listening, fixture-backed, and does not use live models, AWS,
remote transport, or billable resources.

## Implemented boundary

- `projects/brain-core/src/agent-mode/brain-node.ts` defines the versioned
  `brain-node-v1` descriptor, command envelope, and `BrainNodeReceipt`.
- The descriptor carries a stable node identity, infrastructure resource
  reference, platform metadata, health, advertised capability, and local
  resource/worktree bindings. No Office-specific absolute path, username, or
  host assumption is in the domain code.
- Authentication is injected through a deterministic fixture-only provenance
  seam. The node is a local adapter and opens no listener.
- The only executable capability is `repo.read`, with a configured maximum
  byte bound. The implementation has no write, shell, child-process, scheduler,
  network, or remote-transport path.
- Resource IDs resolve only through node-local bindings. The node canonicalizes
  the configured root and target, uses component-aware realpath containment,
  and rejects unknown resources, worktree mismatches, traversal, absolute
  paths, lexical escapes, symlink escapes, missing targets, and non-files.
- Before any capability read, the node independently verifies protocol,
  provenance, node identity, health, advertised/granted capability, task/run/
  attempt relationship, scope hash, grant, policy, deadline, cancellation,
  lease identity/fence/current lease, and K0.2 outbox dispatchability.
- Successful and bounded-failure executions return versioned receipts with
  operation/attempt/capability/scope/fence/status, result/evidence references,
  timestamps, effect hash, and error/reconciliation fields. Accepted receipts
  replay as duplicates without a second file read. K0.2 durably records the
  receipt and advances the outbox state.
- Cancellation is an execution denial and leaves the attempt in `requested`;
  it does not claim arbitrary process termination.

## Adversarial fixture coverage

`projects/brain-core/src/tests/brain-node.test.ts` proves:

- happy-path read, durable K0.2 reconciliation, duplicate replay, and bounded
  output failure;
- identical behavior on synthetic macOS-shaped and Linux-shaped installations;
- malformed/unsupported protocol, invalid provenance, wrong node, undeclared
  capability, ungranted capability, and non-dispatchable outbox denial;
- unknown resource, worktree mismatch, scope mismatch, grant mismatch, and
  policy mismatch denial;
- traversal and absolute-path injection denial;
- direct and nested symlink escape denial after canonical realpath resolution;
- expired deadline, stale lease/fence, cancellation, and conflicting duplicate
  command denial before the capability read.

All fixture roots are temporary synthetic directories. The read function is
injected and counted; denied cases perform zero capability reads.

## Validation

- K0.3 BrainNode tests: **10 passed**.
- Focused Agent Mode/Core regression set, including K0.3: **52 passed**.
- A0.2 restricted Harness profile regression: **4 passed**.
- Brain Core TypeScript check: **passed**.
- `git diff --check` and targeted whitespace scan: **clean**.

## Remaining K0

K0 still needs mocked `AgentRuntime` integration plus Brain Core read-only
observer routes and the Console observer projection. Live execution, Bedrock,
Jarvis autonomy, remote nodes, writes, shell, schedulers, and K1/K2 work remain
outside K0.3.

## Exact next goal

K0.4: implement the mocked AgentRuntime integration and read-only Brain Core
observer routes/Console projection over the durable StateStore and local
BrainNode receipt boundary.

## Blockers

None for K0.3. Live-provider and external-state gates remain intentionally
closed by roadmap policy.
