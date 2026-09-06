# Codex identity lifecycle handoff

This is the bounded bridge between a live Codex task and the external quiet
window required for native runtime maintenance. It is not a generic process
stopper, shared-root repair tool, or credential vault.

## Phase A — prepare while Codex is running

Run from the clean, reviewed `main` checkout. The command writes one owner-only
packet beneath `~/.brain/codex-identity-handoff/` and performs no application,
Git worktree, OAuth, Keychain, or WebGPT mutation:

```bash
cd /Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01
node tools/codex-identity-lifecycle-handoff.mjs prepare
```

The output contains the packet path, expected `main` SHA, and continuation
evidence path. The packet contains account/profile metadata only; it contains
no email address, OAuth material, authentication-file content, Keychain value,
or secret.

After the command reports `PHASE_A=HANDOFF_READY`, finish or preserve this
Codex task. Do not attempt to stop native Codex from inside the task.

## Phase B — external quiet window

From a plain external terminal, after gracefully quitting native Codex/ChatGPT
and related Computer Use processes, leave Codex WebGPT untouched and run the
exact packet command printed by Phase A:

```bash
cd /Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01
node tools/codex-identity-lifecycle-handoff.mjs execute \
  --packet '/Users/Office/.brain/codex-identity-handoff/<exact-id>.packet.json' \
  --confirm --login
```

The runner first performs a bounded multi-sample process-absence check. It
never kills, force-terminates, or restarts native processes. If any guarded
process is present or respawns, it writes `HANDOFF_BLOCKED` evidence and stops
before profile or Git mutation.

The runner may create/verify the two dedicated owner-only profile roots and
materialize only Brain-owned non-secret profile configuration. Official login
is executed separately for each profile with an allowlisted environment and
the operator chooses the intended account in the provider flow. Authentication
remains Codex/application-owned; it is never copied or inspected by Brain.

Canonical checkout relocation occurs only when the old canonical checkout is
clean and has no commits unique from `main`. Dirty or unique work is preserved
and produces `HANDOFF_PARTIAL_SAFE`; the runner never resets, stashes, cleans,
or deletes it. Keychain enrollment is deferred unless a clearly Brain-owned
credential has been explicitly selected through its dedicated protected
boundary.

The runner writes only redacted owner-only evidence. Terminal states are:

```text
HANDOFF_OK
HANDOFF_PARTIAL_SAFE
HANDOFF_BLOCKED
```

Do not reopen Codex until the runner has written a terminal evidence file.

## Phase C — fresh Codex verification

After reopening Codex, resume the closeout goal and inspect the exact evidence
file. Re-run the supported profile doctor/observer and CLI-pilot checks. Do not
promote `HANDOFF_PARTIAL_SAFE` to success. Canonical Identity & Access
admission, Keychain health activation, final documentation, final audit, push,
and branch/worktree cleanup remain separate gates.

## Explicit exclusions

- no `killall`, broad `pkill`, or unrelated SSH termination;
- no native Codex/ChatGPT lock, socket, database, or session deletion;
- no reading or copying `auth.json`, OAuth, browser storage, or Keychain values;
- no WebGPT stop, reinstall, route change, browser-state change, or DEV change;
- no generic shared `~/.codex` mutation;
- no automatic token refresh, keepalive, or renewal;
- no force-push or destructive Git cleanup.
