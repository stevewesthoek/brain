# Office Mac Moonlock Genieo Detection Forensics — 2026-09-18

## Status

**Resolved as a stale Moonlock detection record / false-positive rule match.**

The exact objects named by CleanMyMac/Moonlock were identified in its own
support logs. All three logged paths are absent now. They correspond to an old
Homebrew Node path and old Brain launch-agent descriptor paths, not to a
currently present Genieo component. No object was removed by this
investigation.

## Starting state

- Repository HEAD: `a0403a5c ops(mac): reconcile APFS disk accounting`
- Existing protected worktree changes were preserved and not staged:
  - `operations/accounts/credentials-index.md`
  - `tools/firecrawl/logs/firecrawl.log`
  - `operations/specs/mindcontrol-product-roadmap.md`
  - `operations/specs/nevermind-release-pipeline-roadmap.md`
- No general disk cleanup, model deletion, APFS snapshot deletion, Trash
  emptying, Brain restart, or production service mutation was performed.

## Brain health before and after

The read-only health gate passed before the forensic search and again after it:

- Brain Core: launchd-owned PID `72595`, RC.6 runtime root
- Brain Console: launchd-owned PID `75201`
- `/status`: HTTP 200
- `/agent-mode/observer`: HTTP 200
- `/agent-mode/console`: HTTP 200
- `/scheduler/status`: HTTP 200
- Console `/agents`: HTTP 200
- RC.6 identity unchanged
- StateStore `store_meta.schema_version`: `10`
- SQLite integrity: `ok`
- Foreign-key check: clean
- Rollback baseline: present
- Production activation backup: present

## Moonlock detection source

The bounded source was:

`~/Library/Group Containers/S8EX82NJP6.com.macpaw.CleanMyMac-setapp/Library/Logs/CleanMyMac_5_Setapp_HealthMonitor/com.macpaw.CleanMyMac-setapp.HealthMonitor 2026-08-29--12-17-43-109.log`

The related CleanMyMac operation log was:

`~/Library/Group Containers/S8EX82NJP6.com.macpaw.CleanMyMac-setapp/Library/Logs/CleanMyMac_5_Setapp/com.macpaw.CleanMyMac-setapp 2026-08-29--12-15-01-281.log`

Moonlock reported:

- threat signature: `Genieo (InstallMac)`
- threat type: `adware`
- rule/detection UUID: `E6622CC2-669E-4FD7-BB45-90BF3C383A7A`
- detection times observed: `2026-09-18 08:25:51.909` and
  `2026-09-18 10:21:47.166`
- CleanMyMac review flow began at `2026-09-18 09:22:39.040`
- a removal operation was logged from `10:21:47.047` through `10:21:49.049`

The log contains a transient `All malwares detected by scan: []` record at
`10:21:47.169`, but later log entries reconstruct the same stale detection
model. This is not treated as an independent clean-scan guarantee.

## Exact detection targets

| Logged path | Logged object | Logged size | Current state | Classification |
| --- | --- | ---: | --- | --- |
| `/opt/homebrew/Cellar/node/25.9.0_1/bin/node` | `node` regular file | 3198 bytes in Moonlock model | absent | `STALE_MOONLOCK_RECORD` |
| `/Users/Office/Library/LaunchAgents/com.office.brain-core.plist` | Brain Core launch agent | 3198 bytes in Moonlock model | absent | `STALE_MOONLOCK_RECORD` |
| `/Users/Office/Library/LaunchAgents/com.office.brain-console.plist` | Brain Console launch agent | 3448 bytes in Moonlock model | absent | `STALE_MOONLOCK_RECORD` |

The log uses `/Users/~/Library/...` for the two user paths; the effective
account is `Office`.

The current legitimate equivalents are different:

- `/opt/homebrew/bin/node` points to `/opt/homebrew/Cellar/node/26.8.2/bin/node`
- Brain launchd descriptors are:
  - `~/Library/Application Support/Brain/agent-mode/services/com.brain.core.plist`
  - `~/Library/Application Support/Brain/agent-mode/services/com.brain.console.plist`

The current descriptors launch the immutable RC.6 release and remain active.
They are managed runtime inputs, not malware targets, and were not changed.

## Target metadata and origin

The historical target paths are absent, so current size, hash, xattrs, code
signature, open-file state, and quarantine metadata cannot be collected from
those paths. No absent target was executed.

The current Node symlink and Brain service descriptors were inspected only to
establish the replacement relationship. They are active, signed/managed
runtime inputs for Brain and were retained.

Origin assessment:

- The detection record is consistent with a historical Brain/Homebrew layout
  being classified by a generic adware rule.
- The old Node formula path is no longer installed.
- The old Brain launch-agent paths are no longer the active service paths.
- No Genieo installer, DMG, archive, package receipt, quarantine object, or
  installer invocation was found in the bounded evidence.
- Timestamp overlap does not prove causation.

Origin confidence: **LIKELY** for the stale record being tied to the old
Brain/Homebrew layout; **UNKNOWN** for the original reason the Moonlock rule
matched those objects.

Brain/Codex origin assessment: **NO_EVIDENCE_OF_BRAIN_CODEX_ORIGIN** as a
Genieo/adware origin. The flagged paths were Brain/runtime artifacts, but that
does not establish that Brain or Codex downloaded or installed Genieo.

## Active persistence recheck

Focused checks for the exact signature and paths found:

- no `genieo` or `installmac` process;
- no `genieo` or `installmac` launchd job;
- only the legitimate current `com.office.brain-core` and
  `com.office.brain-console` jobs are active;
- no current old-path launch agent files;
- no managed-device or MDM enrollment;
- no relevant browser extension or policy match in the bounded check;
- no enabled HTTP, HTTPS, SOCKS, or PAC proxy setting in the bounded check.

Active Genieo persistence: **no**.  
Browser/profile persistence: **no evidence found**.  
Credential interception, keychain access, or privileged Genieo persistence:
**no evidence found**.

Credential-risk classification: **LOW**.

## Removal decision

Removal performed: **no**.

The exact records classify as `STALE_MOONLOCK_RECORD`, which is not among the
authorized Genieo-object removal classes. Removing the current Brain service
descriptors or Node runtime would be unsafe and would violate the production
health boundary. No CleanMyMac removal action was initiated by this goal.

The CleanMyMac log records its own removal operation, but the current terminal
state cannot prove whether that operation deleted or moved the old paths. The
user Trash is privacy-protected and was not inspected or emptied.

Post-removal Moonlock result: **not applicable to this investigation**. The
internal log contains a transient empty result, but no independent UI rescan
was performed after a removal by this goal.

## Remaining security uncertainty

The remaining uncertainty is limited to why the Moonlock rule UUID labeled the
historical Node and Brain launch-agent objects as `Genieo (InstallMac)` and
whether CleanMyMac's earlier logged removal operation moved them to Trash.
There is no current target path or active persistence to remove.

If the owner wants the vendor-level explanation, the exact next action is to
open CleanMyMac Protection → Malware → Review, expand `Genieo (InstallMac)`,
and capture the current component/path detail without pressing Remove. Do not
run Smart Care or broad cleanup.

## Recommended next action

No further security mutation is recommended in this goal. Preserve the current
healthy RC.6 Brain deployment. If Moonlock reports a new detection, capture
the expanded path and timestamp first; treat any new object as a separate
forensic target.
