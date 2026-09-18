# Office Brain Post-Hardening Installation and Moonlock Verification

Verification completed: 2026-09-18 15:26 +01:00
Starting HEAD: `91e8c0da ops(brain): harden production service resilience`

## Status

The current RC.6 installation is healthy and matches the hardened service
contract. A fresh CleanMyMac/Moonlock Protection scan completed with **No
threats found** after scanning approximately 1.1M files.

No Brain file was removed, no security exclusion was created, no current
descriptor was changed, and no production service was restarted.

## Production health

- Core: running, PID `72595`, launchd-owned.
- Console: running, PID `75201`, launchd-owned.
- Health routes all returned HTTP 200: `/status`,
  `/agent-mode/observer`, `/agent-mode/console`, `/scheduler/status`, and
  Console `/agents`.
- RC.6 package identity:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Source revision: `284d162926a8ee8ce80421a726a06c3a22abbd65`.
- Immutable release root:
  `/Users/Office/Library/Application Support/Brain/agent-mode-rc6/releases/brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.

## Current launchd installation

Loaded production labels are:

- `com.office.brain-core`
- `com.office.brain-console`

The loaded jobs reference these managed descriptors:

- `/Users/Office/Library/Application Support/Brain/agent-mode/services/com.brain.core.plist`
- `/Users/Office/Library/Application Support/Brain/agent-mode/services/com.brain.console.plist`

Both descriptors use the current Node executable, immutable RC.6 working
directory, canonical StateStore/config bindings, `RunAtLoad=true`, and
`KeepAlive=true`. The service doctor validated descriptor semantics, not just
filenames, and found no rollback, checkout, temporary-root, or RC.5 pointer.

Historical descriptor absence is expected and passed:

- `OLD_CORE_DESCRIPTOR_ABSENT = PASS`:
  `/Users/Office/Library/LaunchAgents/com.office.brain-core.plist` is absent.
- `OLD_CONSOLE_DESCRIPTOR_ABSENT = PASS`:
  `/Users/Office/Library/LaunchAgents/com.office.brain-console.plist` is absent.

These files were not recreated.

## Node and installation inventory

- Node path: `/opt/homebrew/bin/node`.
- Resolved path: `/opt/homebrew/Cellar/node/26.8.2/bin/node`.
- Version: `v26.8.2`.
- Resolved binary SHA-256:
  `902b6a6984d5d825829ea9064ab73b734548df37bc0683990dca31c8dc2a9253`.
- RC.6 manifest and `core/package.json` are present; the package declares
  Node `>=22.5.0` and package identity matches production.
- Canonical StateStore exists at
  `/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`.
- StateStore schema: `10`.
- SQLite integrity: `ok`.
- Foreign-key check: clean.
- Rollback baseline is retained but not active:
  `brain-runtime-package:sha256:bb9461f8f0b49e19edf9b9c59e634fde114d2ca9289d059fa16c3a9b24d17cba`.
- Production backup is present at
  `/Users/Office/Library/Application Support/Brain/agent-mode/backups/rc6-production-activation-20260918-072024`.
- Current support record is
  `operations/release/agent-mode-production-support-v1.json`.

## Service doctor

The read-only `brain-agent service doctor` passed with schema
`brain-service-resilience-v1`:

- current Core descriptor: `PASS`;
- current Console descriptor: `PASS`;
- Node dependency and version: `PASS`;
- RC.6 package/source identity: `PASS`;
- canonical StateStore: `PASS`;
- launchd ownership: `PASS` for both services;
- process cardinality: one Core and one Console;
- rollback-baseline drift: not present.

## Fresh Moonlock scan

The scan was initiated through CleanMyMac Protection → Action → Scan. Only the
malware/security scan was run. Smart Care, cleanup, maintenance, removal, and
configuration changes were not invoked.

Result: **No threats found**. Moonlock reported that the malware scan found no
threats or vulnerabilities after approximately 1.1M files were scanned.

Before the fresh scan, CleanMyMac displayed the historical Genieo record with
the item name `com.office.brain-console.plist`. The corresponding historical
path `/Users/Office/Library/LaunchAgents/com.office.brain-console.plist` is
absent, while the supported managed descriptor is present at the
`Application Support/Brain/agent-mode/services/com.brain.console.plist` path
and passes the service doctor. This is classified as:

`STALE_MOONLOCK_UI_RECORD` / historical false-positive rule match.

Genieo still reported after the fresh scan: **no**. No exact current threat
path was reported. No ignore, dismiss, or clear-history action was performed;
no file was removed.

If the historical item remains visible in a future UI refresh, use only
CleanMyMac's exact-item history/dismiss action after review. Do not recreate the
old plist and do not whitelist the Brain directory, Homebrew, launchd, or all
Node binaries.

## Post-scan health and disk

After the scan, Core remained PID `72595` and Console remained PID `75201`.
All supported routes again returned HTTP 200, and the service doctor again
returned `PASS`. RC.6 identity was unchanged.

Disk status at verification: approximately `81G` available, `20%` used.
No cleanup or storage maintenance was performed.

## Security conclusion and next action

There is no current Brain installation defect and no current Genieo finding.
The remaining concern is only the possibility of stale Moonlock UI history
being displayed again. If a future scan reports a new path, stop and review the
exact path, timestamp, signature, and metadata before taking any action.

Exact next action: none automatically. Continue ordinary read-only service
doctor monitoring; handle any future new security path as a separately reviewed
security finding.
