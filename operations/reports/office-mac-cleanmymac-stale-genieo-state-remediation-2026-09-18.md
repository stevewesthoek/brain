# Office Mac CleanMyMac/Moonlock Stale Genieo State Remediation

Completed: 2026-09-18 15:47 +01:00
Starting HEAD: `101cb079 ops(brain): verify hardened production installation`

## Outcome

The current Brain installation remained healthy throughout this verification.
The historical CleanMyMac item `Genieo (InstallMac) →
com.office.brain-console.plist` is classified as a
`STALE_MALWARE_HISTORY_RECORD`, not a live current-file detection. A supported
Protection refresh and fresh Moonlock scan now show **No threats found** and the
Genieo card is absent.

No Brain plist was removed or recreated, Brain was not stopped or restarted,
and no broad security exclusion or whitelist was created.

## Brain health before remediation

- Core PID `72595`, launchd-owned and healthy.
- Console PID `75201`, launchd-owned and healthy.
- Health routes returned HTTP 200: `/status`, `/agent-mode/observer`,
  `/agent-mode/console`, `/scheduler/status`, and Console `/agents`.
- RC.6 package:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Node `/opt/homebrew/bin/node`, version `v26.8.2`, resolved to
  `/opt/homebrew/Cellar/node/26.8.2/bin/node`.
- StateStore schema `10`, SQLite integrity `ok`, foreign-key check clean.

## Descriptor verification

Current supported descriptors were present and unchanged:

- `/Users/Office/Library/Application Support/Brain/agent-mode/services/com.brain.core.plist`
- `/Users/Office/Library/Application Support/Brain/agent-mode/services/com.brain.console.plist`

The loaded labels are `com.office.brain-core` and
`com.office.brain-console`. The read-only service doctor passed for both
descriptors, Node identity, RC.6 release identity, canonical StateStore,
launchd ownership, lifecycle policy, and one-process cardinality per service.

Historical paths remained absent:

- `/Users/Office/Library/LaunchAgents/com.office.brain-core.plist`: **absent**.
- `/Users/Office/Library/LaunchAgents/com.office.brain-console.plist`: **absent**.

## CleanMyMac/Moonlock state investigation

The initial Protection UI was inspected without selecting Remove. At the start
of this goal it already showed `Protection — No threats found`, with a clean
malware result tile and no Genieo card. The historical Genieo item had
previously appeared in the Protection → Malware Removal result list, which is a
historical review surface rather than a current filesystem path.

Bounded relevant support-state inspection found:

- `~/Library/Application Support/CleanMyMac_5_Setapp/PantherDBInfo.json`:
  Moonlock database metadata only (version `5.5.89` and update timestamps).
- `~/Library/Application Support/CleanMyMac_5_Setapp_HealthMonitor/application.info`:
  update/unused application metadata; no Genieo path or threat record.
- CleanMyMac and HealthMonitor preference files: no Genieo, rule UUID, old
  Brain path, or malware-result key.
- Relevant CleanMyMac/Moonlock logs: no current matching Genieo, rule UUID,
  old Node path, or old plist path.
- Current helper processes were observed: CleanMyMac, Menu, HealthMonitor,
  FinderSync extension, and the privileged CleanMyMac agent. No helper was
  restarted.

The absent historical paths and lack of a current detection object rule out
`LIVE_DETECTION_CURRENT_FILE`. The result was a stale Malware Removal history
record/UI model, classified as:

`STALE_MALWARE_HISTORY_RECORD`

## Supported refresh actions

Only supported, non-destructive Protection actions were used:

1. Reopened and inspected the Protection page.
2. Returned to the supported Protection scan start page without removing any
   item; a proposed “Start Over” reset was cancelled, so no scan-history reset
   was performed.
3. Invoked CleanMyMac’s `Action → Scan` command.

No manual database edit, arbitrary cache deletion, broad history reset, Smart
Care run, cleanup, maintenance action, removal, or whitelist was performed.

## Fresh scan and final UI

The post-refresh fresh Moonlock scan completed with:

- result: **No threats found**;
- files scanned: approximately `1.1M`;
- Genieo detected: **no**;
- exact current flagged path: none.

The final Protection UI showed `Your Mac Is Safe` and
`A malware scan did not find any threats or vulnerabilities.` The Genieo card
was absent afterward. A MacPaw support packet is not required because the stale
card cleared and the fresh scan is clean.

## Brain health after remediation

The post-scan service doctor returned `PASS`. Core remained PID `72595`,
Console remained PID `75201`, all supported health routes returned HTTP 200,
RC.6 identity was unchanged, and the StateStore remained schema 10 with clean
integrity and foreign-key checks.

Expected Brain mutations: `0`.
Expected Brain restarts: `0`.

## Production mutation ledger

- Brain descriptor removal/recreation: `0`.
- Brain stop/start/restart: `0`.
- StateStore writes: `0`.
- Runtime/release/rollback changes: `0`.
- Model/provider/AWS/network/SSH/Tailscale operations: `0`.
- BrainNode/Workcell operations: `0`.
- Security exclusions or global whitelists: `0`.
- Files removed: `0`.

## Exact next action

No automatic action remains. Continue ordinary read-only Brain service-doctor
monitoring. If Moonlock later reports a new path, stop and review the exact
path, timestamp, signature, and metadata; do not recreate historical plists or
remove legitimate Brain descriptors.
