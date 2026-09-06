# Codex profile-scoped identity lifecycle

This runbook replaces the retired global-quiescence handoff. Isolated Codex
CLI profiles are separate `CODEX_HOME` roots, so native Codex/ChatGPT,
Computer Use, WebGPT, SSH, and MCP processes are not global blockers.

The old v1 packet
`/Users/Office/.brain/codex-identity-handoff/codex-identity-20260906T130049Z-91992.packet.json`
is historical evidence. Never execute it and never delete its evidence.

## Prepare a fresh profile-scoped packet

Run from the clean canonical `main` checkout. This is safe while native Codex
is running because it only reads Git metadata and writes one owner-only packet:

```bash
cd /Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01
node tools/codex-identity-lifecycle-handoff.mjs prepare
```

The packet contains only opaque account/profile metadata and non-secret paths.
It does not read `auth.json`, OAuth, browser state, Keychain values, or MCP
state. It records the initial two-profile acceptance set; the production model
remains a dynamic N-account collection.

## Inspect before execution

Use the exact packet path printed by `prepare`:

```bash
node tools/codex-identity-lifecycle-handoff.mjs inspect \
  --packet '/Users/Office/.brain/codex-identity-handoff/<exact-v2-packet>.packet.json'
```

The inspection must report `PROFILE_LIFECYCLE=INSPECT_OK` and declare:

```text
lifecycleScope=profile_scoped
globalProcessQuiescenceRequired=false
sharedDefaultRootMutation=false
webGptMutation=false
```

## Create isolated profile roots and request login handoffs

Run this with the exact fresh packet:

```bash
node tools/codex-identity-lifecycle-handoff.mjs execute \
  --packet '/Users/Office/.brain/codex-identity-handoff/<exact-v2-packet>.packet.json' \
  --confirm --login
```

Expected result is `PROFILE_LIFECYCLE=READY_FOR_PROVIDER_LOGIN`. The command
creates only dedicated owner-only profile roots and Brain-owned non-secret
configuration. It does not stop applications, log out, touch `~/.codex`,
change WebGPT, copy authentication, or mutate the canonical catalog.

For each printed profile handoff, run the official command with the printed
profile-local `CODEX_HOME`. Select the intended account in the provider UI:

```bash
CODEX_HOME='/Users/Office/.brain/codex-runtime-profiles/<profile>' \
  codex login --config 'cli_auth_credentials_store="file"'
```

Do not paste passwords, tokens, cookies, or OAuth material into a terminal,
report, or agent conversation. The login remains Codex/application-owned.

After each login, re-run the supported profile-scoped doctor with the same
catalog, root, and profile ID. Identity remains unresolved until the operator
attests the account shown by the official provider flow; `authenticated` alone
is not account attribution.

## Retry and evidence

Every execution writes a unique attempt evidence file beside the packet’s
original evidence path. A retry never overwrites an earlier blocked or partial
result. `HANDOFF_BLOCKED` is reserved for a target-profile safety failure;
global native process presence is not a blocker for this profile-scoped path.

Old v1 packets are rejected before execution with a fresh-packet message. That
behavior is intentional and protects the historical incident evidence.

## Boundaries and deferred gates

- The dirty historical feature checkout remains separate housekeeping.
- WebGPT repository, application state, browser state, and route remain
  untouched and independently upgradeable.
- Shared `~/.codex` maintenance remains a separate, explicitly authorized
  operation using its own managed-root runbook.
- Native Codex OAuth remains Codex-owned; MCP OAuth remains MCP-owned.
- Keychain enrollment is allowed only for an explicitly selected Brain-owned
  credential through the protected Keychain boundary.
- Canonical Identity & Access admission occurs only after real identity,
  isolation, coexistence, and health evidence exists.
- Credential renewal/keepalive is not generic; provider-owned credentials use
  their owning provider’s reauthentication or refresh contract.

The profile-scoped handoff is a preparation and login bridge, not proof of
production readiness. Completion still requires the full acceptance,
catalog, health, WebGPT, documentation, validation, audit, commit, and push
gates in the active Identity & Access goal.
