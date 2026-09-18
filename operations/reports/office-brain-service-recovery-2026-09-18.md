# Office Brain service recovery — 2026-09-18

## Status

**BLOCKED_SERVICE_RECOVERY.** The supported RC.6 Brain release and canonical
StateStore are intact, but the host runtime dependency required by the
supported launchd descriptors is unavailable. The production services were
not started because substituting an NVM binary or changing the descriptors
would exceed this bounded recovery authorization.

This is a separate recovery record. No Genieo inspection, disk cleanup,
release deployment, StateStore write, provider call, or Git push was performed.

## Repository and support reconciliation

- Starting repository HEAD: `bc290673 ops(brain): reclaim safe host disk space`.
- The supported production record remains
  `operations/release/agent-mode-production-support-v1.json`.
- Supported release: `1.0.0-rc.6`, status `PRODUCTION_ACTIVE`.
- Package ID:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Release ID:
  `brain-agent-release:sha256:b5813f2c215f6db3fafc0685691cee43ba699f2d699bb748b1b4633804c03242`.
- Source revision: `284d162926a8ee8ce80421a726a06c3a22abbd65`.
- Runtime root:
  `/Users/Office/Library/Application Support/Brain/agent-mode-rc6`.
- Rollback status remains `ROLLBACK_SUPPORTED`; the retained pre-activation
  backup remains present and was not used.

The existing worktree changes were preserved and are not part of this
recovery record.

## Initial host state

At the recovery preflight:

- Core process: absent; `127.0.0.1:4877` unavailable.
- Console process: absent; `127.0.0.1:4881` unavailable.
- `com.office.brain-core`: absent from the user launchd domain.
- `com.office.brain-console`: absent from the user launchd domain.
- Ports 4877 and 4881: unoccupied.
- StateStore: present and readable.
- Disk: `926 GiB` total, `839 GiB` used, `33 GiB` free, `97%` used at the
  final read-only check.
- Host boot evidence: current boot began `2026-09-10 21:23`; no reboot occurred
  during this recovery attempt.
- No launchd disabled-state entry was reported for either Brain label.

The final semantic Store counts remained zero for agents, tasks, runs, attempts,
leases, effects, receipts, organization plans, organization final results, and
scheduler schedules.

## Launchd descriptors

The supported production descriptors are the existing files under the
normalized install root:

```text
/Users/Office/Library/Application Support/Brain/agent-mode/services/com.brain.core.plist
/Users/Office/Library/Application Support/Brain/agent-mode/services/com.brain.console.plist
```

Their embedded labels are `com.office.brain-core` and
`com.office.brain-console`. Both descriptors point to the immutable RC.6
release package, the canonical Store/configuration paths, and the supported
ports. Their hashes at inspection were:

```text
76b9c1f9290584dcf682fd0daa647ae7f7d79a118055e95dc799c6ce84c62d31  com.brain.core.plist
bd35ff2fd57476dfe5f1ad79ffe20405f398fb9bda48a4d7baef444082b88727  com.brain.console.plist
```

No descriptor was edited. The RC.6 install-package descriptors under
`agent-mode-rc6/services/` use non-production `com.brain.*` labels and
`RunAtLoad=false`; they were not bootstrapped as a second service path.

## Root-cause classification

Confirmed classifications:

- `LAUNCHD_SERVICE_UNLOADED`: both supported `com.office.*` services are
  absent from the user launchd domain.
- `DEPENDENCY_FAILURE`: the supported descriptor executable
  `/opt/homebrew/bin/node` is a broken symlink to
  `/opt/homebrew/Cellar/node/25.9.0_1/bin/node`, and that target file is
  absent.
- `MISSING_RUNTIME_FILE`: the missing file is the host Node executable, not an
  RC.6 Brain entrypoint.

Not supported by the bounded evidence:

- `HOST_REBOOT_OR_LOGIN_TRANSITION`: host boot predates the outage window and
  no reboot occurred during this recovery.
- `PROCESS_CRASH`, `STARTUP_FAILURE`, `PORT_CONFLICT`,
  `STATESTORE_OPEN_FAILURE`, `DISK_SPACE_FAILURE`, and `PERMISSION_FAILURE`:
  no direct evidence found.
- `BROKEN_SERVICE_DESCRIPTOR`: descriptor syntax, labels, ports, and RC.6
  paths are internally consistent.

The exact reason the jobs became unloaded is not recoverable from the bounded
launchd state and the retained logs. The missing Node dependency is the
actionable recovery blocker.

## Recent logs and artifact verification

The latest retained Core/Console stdout logs ended with successful listening
and Next.js readiness messages at approximately `08:27–08:28` on September
18. Their stderr logs were empty. There was no retained bounded log evidence
of an exception, database failure, port conflict, or disk-full shutdown.

RC.6 verification passed from retained metadata:

- `install.json` matches the supported package ID, source revision, release
  root, and production components.
- release manifest matches version `1.0.0-rc.6`, package ID, source revision,
  release ID, and StateStore schema `10`.
- retained verification receipt reports both package and release verification
  as true.
- RC.6 Core and Console entrypoints exist under the immutable release root.
- the supported Node range is `>=22.5.0`; available NVM versions include
  `v22.16.0`, `v24.12.0`, and `v24.16.0`, but none is the recorded production
  executable path and none was substituted.

## StateStore safety check

Canonical Store:

`/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`

Read-only checks passed:

- application `store_meta.schema_version`: `10`;
- SQLite integrity check: `ok`;
- foreign-key check: clean;
- WAL: present, zero bytes;
- SHM: present, owner-only permissions;
- Store permissions: owner-only (`0600`).

No migration, checkpoint, vacuum, export, restore, or write occurred.

## Recovery actions and production effects

No launchd bootstrap, kickstart, stop, restart, or descriptor repair was
attempted because the required `/opt/homebrew/bin/node` executable failed the
pre-start dependency gate.

Production effect ledger:

| Effect | Count |
| --- | ---: |
| Core starts/stops | 0 |
| Console starts/stops | 0 |
| Descriptor edits | 0 |
| StateStore writes/restores | 0 |
| Release deployment or RC.7 cut | 0 |
| Provider/model/AWS/network/SSH/Tailscale effects | 0 |
| BrainNode/Workcell effects | 0 |
| Genieo or disk-cleanup operations | 0 |
| Git push | 0 |

## Recovery decision

Recovery status: **BLOCKED**.

The next exact task is a separately authorized host-dependency repair to
restore a supported Node executable at `/opt/homebrew/bin/node` (Node `>=22.5.0`),
followed by a fresh RC.6 artifact/Store/port preflight and the existing
launchd-only Core-first recovery sequence. Do not use an NVM path as an
undocumented production substitute, do not bootstrap the `com.brain.*` package
descriptors as a second service path, and do not start the Genieo goal until
Core and Console pass the recovery health and stability gates.
