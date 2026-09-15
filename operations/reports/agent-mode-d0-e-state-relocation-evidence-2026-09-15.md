# Agent Mode D0-E StateStore Relocation Evidence — 2026-09-15

## Outcome

D0-E is **COMPLETE**. D0 remains **IN PROGRESS**. Starting HEAD was
`43abbd64 feat(agent-mode): add portable local service packaging`; D0-A/B/C/D
remain landed, with D0-D's recorded full Core result of 2,596/2,596.

## Contract and authority

The implementation adds `brain-state-snapshot-v1`, `brain-state-import-v1`, and
`brain-control-plane-relocation-v1`. Export is a bounded logical record
snapshot, not a SQLite/WAL/SHM copy. Snapshot identity, family hashes, and the
aggregate hash are deterministic; timestamps are metadata and do not define
identity. The adapter reads the current StateStore schema version (`10`) from
`store_meta`, requires the current supported version, and rejects unknown or
newer versions. Records are bounded to 64 families, 10,000 records, 1 MiB per
record, and 32 MiB total.

Durable families are exported through the SQLite adapter for agents, tasks,
runs, attempts, events, effects, dispatch/outbox, leases/fences, budgets,
capabilities, reviews, workcells, scheduler, attention/notifications,
organization/K5, Jarvis, receipts, and store metadata. These are logical
records; SQLite row/page/WAL details are not part of the public contract.
Current persisted records contain no credential or secret-value columns. Host-
local PIDs, runtime identity, leases/fences, dispatch, and uncertain effects
are preserved as evidence and require normal recovery/reconciliation before
activation; imported PIDs are never signalled and fences are never reset.

## Export/import and relocation safety

Final export requires an existing closed source opened read-only through
`openExisting()`; it performs `PRAGMA quick_check` and zero writes. Import
accepts only a fresh target, creates the current StateStore schema, imports in
foreign-key dependency order in one transaction, runs `foreign_key_check`, and
removes a failed new target. IDs, event ordering, exact-once material, reviews,
attention, scheduler state, Jarvis state, and K5 state are preserved. Import
does not execute schedules, effects, runtimes, services, providers, TTS/STT, or
network transfers. Snapshot files are explicit local artifacts with mode 0600.

The administrative CLI is explicit: `brain-agent state export --store ...
--output ...`, `state verify --snapshot ...`, and `state import --snapshot ...
--target-store ... --expect-snapshot ...`. There is no browser export/import,
remote copy, service activation, live migration, merge, or split-brain mode.
The relocation plan reports `ready-for-activation` only after snapshot,
target-config, secret-provisioning, and host-local reconciliation gates pass;
activation itself remains out of scope.

## Evidence and validation

The fixture exported from a WAL-configured StateStore, verified, imported to a
fresh target, and reconstructed through normal public StateStore retrieval.
Tampering, family/hash changes, unsupported metadata, and populated targets
fail closed. Repeated logical export is deterministic; source state is not
mutated. The D0-E focused set passed **25/25** (D0-A 9, D0-B 6, D0-C 5,
D0-D 3, D0-E 2). Brain Core typecheck/build passed. The full Brain Core suite
passed **2,596/2,596**. `git diff --check` passed. No live Office database was
read or copied; network, AWS, Bedrock, Codex, Tailscale, SSH, launchctl,
systemctl, service registration/activation, provider/model, AgentRuntime,
Harness, BrainNode, Workcell, TTS, and STT effects were **0**.

## D0 matrix and next task

Portable config, bootstrap planning, runtime packaging, local install/service
packaging, and logical StateStore transfer are complete/foundation-complete.
BrainNode packaging, VPS/Tailscale deployment, future StateStore backends,
AgentCore adapters, plugin SDK, live cutover, and H0 are deferred or not
started. D0 exit classification is **B**: the relocation contract is proven,
but one isolated local relocation/cutover activation and recovery drill
remains. Exact next task: **D0-F — Control-Plane Relocation Cutover and
Recovery Drill**. This must use fixture/isolated installs and must not touch the
live Office control plane.
