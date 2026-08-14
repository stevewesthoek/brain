# Office + MacBook Host Activation

**Status:** executable packet; live execution remains owner-triggered
**Runner:** `operations/scripts/host-activation.sh`
**Validated integration base:** `ab6e6763097505e60e4104b91de5d379b9dd9c57`
**Branch:** `maintenance/host-activation-integration-20260813`

This is the bounded final activation procedure for the workstation ownership
contract. Preparing, testing, or committing this packet does not authorize an
AI application to execute it. Steve starts the live run later from a plain
MacBook Terminal after both hosts are quiescent.

## Safety model

The runner is fail-closed and receipt-backed:

- its default action is read-only `dry-run`;
- `execute` requires the exact final 40-character packet commit;
- both candidate Brain clones must be clean, on the integration branch, at the
  same exact commit, and descended from the reviewed integration base;
- fixed-address reachability and authenticated SSH must pass in both directions;
- the dirty old Office canonical Brain checkout is explicitly allowed but must
  still be at `10622fabd4f931884c87fbe291fa70dd38849348`;
- no live path changes until complete owner-only backups and verified stages
  exist on **both** hosts and Steve types the exact `ACTIVATE` confirmation;
- every mutable runtime snapshot requires identical source-before,
  source-after, and destination digests; a source that changes during copying
  is rejected and every rejected attempt is retained;
- narrow file/symlink/directory snapshots use the same stability rule and
  verify content, targets, ownership, modes, timestamps, ACLs, xattrs, and
  hard-link relationships before they can become rollback inputs;
- Office and MacBook each prepare and verify a complete `.codex` rollback tree
  before the first live path changes; rollback never removes a live Codex root
  before its replacement exists;
- Codex application-owned files plus a normalized logical dump of the thread
  database must match the pre-change continuity manifest before Phase 9 permits
  Codex/ChatGPT to reopen;
- Codex SQLite verification uses an owner-only disposable copy of the complete
  database/WAL family, so WAL-mode checks never open or create sidecars beside
  the live or retained database;
- detached ChatGPT/Codex helper processes adopted by launchd receive only a
  graceful `TERM` request; children of a running application are never
  signaled, no force signal is used, and any survivor blocks before mutation;
- swaps use same-volume moves; no source or backup is deleted;
- a MacBook→Office rescue SSH control connection remains open while SSH changes;
- future HostKeyAlias entries are added only when both live fixed-address
  ED25519 keys exactly match the keys already trusted in local `known_hosts`;
- fresh SSH failure restores Office SSH through rescue before full rollback;
- Codex uses its dedicated `check` → `repair` flow and never root `migrate`;
- any error after the first live swap rolls phases back in reverse order and
  preserves the failed/new state for diagnosis;
- a repeat `execute` against an already-active canonical packet fails before
  mutation; rollback snapshots are copied rather than consumed, and explicit
  rollback is retryable as well as idempotent after its receipt reaches phase 0;
- a completed run retains all backups and the old canonical Brain archive.

The runner never calls `launchctl`, starts/stops a registered service, weakens host-key
verification, touches model caches, changes Mind content, invokes an n8n
webhook, or performs Save-to-Mind mutation.

## Receipt and backup convention

Each execution gets UTC run ID `YYYYmmddTHHMMSSZ-pid`.

```text
Office receipts/backups/staging:
  /Users/Office/.brain-host-activation/<run-id>/

Office lossless old canonical Brain archive:
  /Users/Office/Repos/stevewesthoek/brain-host-activation-archives/<run-id>/brain-before-activation

MacBook receipts/backups:
  /Users/Steve/.brain-host-activation/<run-id>/
```

Receipt roots and archive parents are mode `0700`; receipt/state/metadata files
are mode `0600`. Metadata records path type, symlink target, uid/gid, mode,
counts, bytes, xattr counts, and content digests without recording file content.
Secrets remain inside owner-only backups and are never printed.

## Exact phases

0. **Preflight:** verify users, exact clean packet commits, old canonical/Mind
   commits, allowed Mind dirt, source files, expected path types/targets,
   quiescence, private-copy Codex database integrity/readability, both fixed SSH
   routes, authentication, and free space.
1. **Backup/receipts:** stably copy and digest Office `.claude`, `.cursor`, `.gemini`,
   `.kiro`, `.codex`, and old canonical Brain; snapshot Git, SSH, shell,
   Ghostty, Starship, `known_hosts`, approval, and Claude registration paths; create a clean
   standalone canonical candidate. Source-before/source-after/destination must
   all match. Backup failure stops before mutation.
2. **Stage:** copy and digest physical Office runtime stages for the four
   legacy whole-root symlinks; prepare a complete verified Office Codex rollback
   tree. Then prepare the equivalent MacBook snapshots, continuity baseline,
   and Codex rollback tree. The runner reports no live changes and requires the
   exact `ACTIVATE` response before continuing.
3. **Convert roots:** atomically swap only `.claude`, `.cursor`, `.gemini`, and
   `.kiro`; keep `.codex` physical and use only its check/repair manager.
4. **Replace canonical Brain:** move the complete old dirty checkout into the
   timestamped archive and place the verified standalone packet clone at
   `/Users/Office/Repos/stevewesthoek/brain`.
5. **Activate Office config:** create physical mode-0600 Git/SSH INCLUDE roots;
   run the canonical narrow linker and Codex repair/check; reject any managed
   target containing `brain-next`, `brain-host-activation`, or `/Volumes/Office`.
6. **Activate MacBook config:** back up existing narrow entries, repair them
   only from `/Users/Steve/Repos/stevewesthoek/brain`, preserve existing runtime
   roots, and do not manufacture an absent Claude root.
7. **Activate bridge:** reverify Mind at
   `c3dcefdd808501a7ead7ffc4671eb5ef3822c268`; atomically repin the mode-0600
   owner approval and Mind-local Claude registration; require healthy/read-only,
   exact `health`/`resolve`/`explain` tools, `mutationPathExposed=false`, and a
   bounded cited resolve.
8. **Connectivity:** require fresh direct and Tailscale connections both ways,
   `office`, `MacBook`, and `macbook` aliases, and fixed HostKeyAlias identities.
9. **Application acceptance:** only after deterministic Codex session-file and
   logical-thread continuity plus post-change topology metadata pass, reopen one item at a time and type `PASS` only
   after launch, auth, session/history, settings, skills/instructions, and MCP
   checks. Codex acceptance includes Remote SSH after reopening.
10. **Receipt:** mark both receipts PASS with exact Brain/Mind commits, route and
    bridge results, application results, rollback history, and deferred cleanup.

Save-to-Mind authenticated canonical readback remains a final acceptance item,
not a root-conversion prerequisite. Do not invoke a write-producing webhook.

## Close before live execution

On **Office**, close:

- ChatGPT/Codex desktop;
- Codex CLI/app-server and `node-repl`;
- Computer Use;
- Claude Code, Claude Desktop, and Claude background jobs;
- Cursor;
- Gemini and Antigravity;
- Kiro;
- Ghostty;
- interactive shells except the dedicated SSH/migration connections.

On **MacBook**, close:

- ChatGPT/Codex desktop and remote sessions;
- Codex CLI/app-server and Computer Use;
- Claude Code/Desktop and background jobs if installed;
- Cursor;
- Gemini and Antigravity;
- Kiro;
- Ghostty;
- interactive shells except the single plain Terminal used to launch migration.

Do not proceed merely because windows are hidden. The runner independently
checks affected processes and fails before backup/mutation if they remain.

## Read-only preview

From a plain MacBook Terminal, with the final packet present and clean on both
hosts:

```bash
cd /Users/Steve/Repos/stevewesthoek/brain && bash operations/scripts/host-activation.sh dry-run --expected-commit "$(git rev-parse HEAD)"
```

Dry-run inspects both hosts and prints planned phases. It creates no receipt,
backup, stage, socket, config, approval, or Git change. Because runtime roots
are mutable, this read-only inspection is deliberately **not** described as a
future execution guarantee. Dry-run exits nonzero if any affected process or
detached helper is still present; unlike execute, it never sends even a graceful
termination request. The live `execute` command repeats preflight,
captures stable copies, prepares both rollback paths, and stops before mutation
for the exact `ACTIVATE` confirmation.

## One live command

After closing the exact application lists above, run this single command from a
plain MacBook Terminal:

```bash
cd /Users/Steve/Repos/stevewesthoek/brain && bash operations/scripts/host-activation.sh execute --expected-commit "$(git rev-parse HEAD)"
```

The runner opens and checks the rescue control connection before any Office
mutation and prints its socket path. It first completes both hosts' backups and
rollback preparation and then prompts `ACTIVATE`; any other response stops with
no live path changed. **Do not close the Terminal, kill the
runner, or close the rescue SSH session until the runner reports that fresh
post-change SSH passed.** It closes rescue only after connectivity, application
acceptance, and final receipt completion.

## Acceptance prompts

At Phase 9, reopen and verify in this order:

1. Claude
2. Cursor
3. Gemini / Antigravity
4. Kiro
5. Codex / ChatGPT, including MacBook Codex Remote SSH to Office
6. shell
7. Ghostty

The runner does not issue the Codex/ChatGPT reopen instruction unless the exact
conversation-file hashes, session counts, thread counts, and normalized logical
thread database remain unchanged. Type exactly `PASS` for each verified item. Any other response stops acceptance.
Close any reopened affected apps and type `ROLLBACK` when instructed; the
runner restores both hosts while rescue remains available.

The final prompt is Save-to-Mind readback. Type `PASS` only after a safe
authenticated read-only canonical export/readback structure/hash comparison.
Type `DEFERRED` if that read-only surface is unavailable. The runner never
invokes the write-producing webhook merely to satisfy acceptance.

## Explicit rollback

Automatic rollback runs on phase failure. For a later owner-directed rollback,
first close the same application lists, then run from plain MacBook Terminal:

```bash
cd /Users/Steve/Repos/stevewesthoek/brain && bash operations/scripts/host-activation.sh rollback --run-id '<exact-run-id>'
```

Rollback restores pre-migration Git/SSH/shell/app managed paths, Office legacy
runtime symlinks, Office/MacBook Codex snapshots, Claude registration/approval,
and the old canonical Brain. It moves new/failed artifacts beneath each
receipt's `failed/` directory instead of deleting them. If automatic rollback
cannot complete, leave the printed rescue socket open and use the receipt paths
to restore the exact remaining item; do not retry activation.

## Packet validation

Preparation validation is:

```bash
bash -n operations/scripts/host-activation.sh
bash -n operations/scripts/tests/host-activation.test.sh
bash operations/scripts/tests/host-activation.test.sh
npm run test:codex-managed-root
npm run validate:workstation-config
npm run validate:local-text-policy
git diff --check
```

Also run a read-only two-host dry-run from MacBook and compare pre/post
fingerprints of the inspected live paths to prove no mutation.
