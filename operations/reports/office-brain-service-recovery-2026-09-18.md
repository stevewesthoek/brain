# Office Brain service recovery — 2026-09-18

## Status

**PASS.** The supported RC.6 Brain release and canonical StateStore were
verified, the missing host Node dependency was repaired through Homebrew, the
existing production descriptors were corrected to the documented RC.6 root,
and both services were restored through user launchd.

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
  initial read-only check; final capacity was `926 GiB` total, `835 GiB` used,
  `35 GiB` free, `96%` used.
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
`com.office.brain-console`. Initially both descriptors pointed to the
rollback-baseline package despite the RC.6 support record. The pre-repair
hashes were:

```text
76b9c1f9290584dcf682fd0daa647ae7f7d79a118055e95dc799c6ce84c62d31  com.brain.core.plist
bd35ff2fd57476dfe5f1ad79ffe20405f398fb9bda48a4d7baef444082b88727  com.brain.console.plist
```

The exact repair changed only the production service descriptors under
`agent-mode/services/`: package executable/working-directory paths and source
revision were changed to RC.6, while the canonical config, secret reference,
and StateStore paths were preserved. The post-repair hashes are:

```text
46d664bd679c4a0dd2dddc091f7f568c6b4c13283756913e8836e54f7568cf91  com.brain.core.plist
e3c5854ff7cd06cc7b3b926424262781185918a85140ec8f723ca09017ab7fc6  com.brain.console.plist
```

The RC.6 install-package descriptors under `agent-mode-rc6/services/` use
non-production `com.brain.*` labels and `RunAtLoad=false`; they were not
bootstrapped as a second service path.

## Root-cause classification

Confirmed classifications:

- `LAUNCHD_SERVICE_UNLOADED`: both supported `com.office.*` services are
  absent from the user launchd domain.
- `DEPENDENCY_FAILURE`: the supported descriptor executable
  `/opt/homebrew/bin/node` is a broken symlink to
  `/opt/homebrew/Cellar/node/25.9.0_1/bin/node`, and that target file is
  absent at preflight. Homebrew repair restored Node `v26.8.2` at the
  supported path.
- `MISSING_RUNTIME_FILE`: the missing file is the host Node executable, not an
  RC.6 Brain entrypoint.
- `BROKEN_SERVICE_DESCRIPTOR`: both production descriptors pointed at the
  rollback-baseline package instead of RC.6. This was repaired using the
  immutable RC.6 identity from the support record and activation evidence.

Not supported by the bounded evidence:

- `HOST_REBOOT_OR_LOGIN_TRANSITION`: host boot predates the outage window and
  no reboot occurred during this recovery.
- `PROCESS_CRASH`, `STARTUP_FAILURE`, `PORT_CONFLICT`,
  `STATESTORE_OPEN_FAILURE`, `DISK_SPACE_FAILURE`, and `PERMISSION_FAILURE`:
  no direct evidence found.
The exact reason the jobs became unloaded is not recoverable from the bounded
launchd state. The actionable causes were the missing Node executable and the
descriptor drift.

## Recent logs and artifact verification

The pre-recovery stdout logs ended with successful listening and Next.js
readiness messages at approximately `08:27–08:28` on September 18. The first
RC.6 descriptor attempt after Node repair failed because it referenced the
absent RC.6 `config/secrets.env`; the canonical secret reference was restored
from the production activation contract. After that repair, Core and Console
started cleanly and no new fatal stderr event appeared during the 10-minute
observation window.

RC.6 verification passed from retained metadata:

- `install.json` matches the supported package ID, source revision, release
  root, and production components.
- release manifest matches version `1.0.0-rc.6`, package ID, source revision,
  release ID, and StateStore schema `10`.
- retained verification receipt reports both package and release verification
  as true.
- RC.6 Core and Console entrypoints exist under the immutable release root.
- the supported Node range is `>=22.5.0`; Homebrew now provides `v26.8.2` at
  the recorded production executable path `/opt/homebrew/bin/node`.

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

The bounded recovery actions were:

1. Reinstalled the existing Homebrew `node` formula from a bottle with
   Homebrew cleanup and dependent checks disabled; no Brain release or Store
   files were touched.
2. Detected and immediately booted out one launchd start of the stale
   rollback-baseline descriptor.
3. Repaired the two exact production descriptors to the RC.6 package and
   canonical config/Store paths, validated both plists, and bootstrapped Core.
4. Held Core for more than 60 seconds with stable PID and all Core routes at
   200, then bootstrapped Console.
5. Observed both services for 20 samples over approximately 10 minutes.

Production effect ledger:

| Effect | Count |
| --- | ---: |
| Core launchd bootstrap submissions / explicit bootouts | 3 / 2 |
| Console launchd bootstrap submissions / explicit bootouts | 1 / 0 |
| Descriptor edits | 2 exact production plists |
| Homebrew Node repair | 1 formula reinstall |
| StateStore writes/restores | 0 |
| Release deployment or RC.7 cut | 0 |
| Brain/provider/model/AWS/SSH/Tailscale effects | 0 |
| BrainNode/Workcell effects | 0 |
| Genieo or disk-cleanup operations | 0 |
| Git push | 0 |

Homebrew downloaded and verified the Node bottle and required formula
dependencies as part of the explicitly bounded host dependency repair. No
Brain API, provider, model, AWS, SSH, or Tailscale network call was made.

## Recovery decision

Recovery status: **PASS**.

Final recovery state:

- Core: launchd-owned PID `72595`, RC.6 working directory, last exit never
  exited.
- Console: launchd-owned PID `75201`, RC.6 working directory, last exit never
  exited.
- Core `/status`, `/agent-mode/observer`, `/agent-mode/console`, and
  `/scheduler/status`: HTTP 200.
- Console `/agents` and legacy Core `/agent-console`: HTTP 200.
- StateStore schema `10`, integrity `ok`, foreign-key check clean.
- Semantic counts remained zero for agents, tasks, runs, attempts, leases,
  effects, receipts, organization plans, final results, and schedules.
- No provider/model/AWS/network/SSH/Tailscale/BrainNode/Workcell effect was
  caused by recovery.

The Genieo/security-cleanup goal is now **UNBLOCKED**, but it was not resumed
automatically. The exact next task is to begin that separate goal's fresh Phase
0 health snapshot, then perform only its bounded Genieo verification and safe
cleanup steps.
