# IKHP live Codex WebGPT v5.0.3 recovery report

Date: 2026-09-05

Status: production runtime recovered and upgraded; desktop Codex model-picker
restart remains pending because the active Codex task was intentionally not
interrupted.

## Scope and safety boundary

This report records the gated production recovery and upgrade of Codex WebGPT.
It does not change the Brain-managed dynamic native account architecture. No
`auth.json`, OAuth token, cookie, browser storage, tunnel key, API key,
Authorization header, or Keychain secret value was read, copied, printed, or
committed.

WebGPT production and WebGPT DEV were treated as separate application
domains. No native account login, logout, profile materialization, or DEV
start/stop/update was performed.

## Before state and drift classification

- Installed production app: `/Applications/Codex Web GPT.app`, v5.0.2.
- Production home: `/Users/Office/.codex-chatgpt-web`.
- The integration journal was active and pointed at
  `/Users/Office/.codex/config.toml` with the loopback route
  `http://127.0.0.1:17841/v1`.
- The actual Codex route was commented out by the temporary-disable marker,
  while the journal still claimed the route. The bridge and tunnel were
  healthy and idle.
- The supported status command therefore refused to overwrite the changed
  route. That refusal is correct fail-closed behavior; it is not evidence
  that Brain caused the drift. The observed classification is stale/partial
  integration state with unknown provenance.
- The pre-repair model cache showed native Codex rows and no `chatgpt-web/`
  rows, matching the reported missing WebGPT picker entries.

## Recovery and update

1. A local owner-only rollback directory was created before repair:
   `/Users/Office/.codex-chatgpt-web/rollback/20260905T215000-v5.0.2-pre-repair`.
   It contains the v5.0.2 application and equal integration/recovery journal
   snapshots. It does not contain authentication or credential material.
2. The v5.0.2 launcher’s supported setup/replace-route operation reconciled
   the shared/default WebGPT route and journal. No TOML route hand-edit was
   used.
3. The official v5.0.3 checksum-verifying macOS updater installed
   `/Applications/Codex Web GPT.app` at v5.0.3 and relaunched the launcher.

## After-state evidence

| Check | Result |
| --- | --- |
| Installed WebGPT app | v5.0.3 |
| Bridge | healthy, Full mode, accepting turns |
| Integration route | active, exactly one route owner, no route errors |
| Integration journal | active; primary and recovery journals equal; config path preserved |
| Tunnel | launcher-owned; process running; healthy and ready |
| Connector | WebGPT MCP verifier reports `Codex Native2` available |
| Browser/session path | bounded WebGPT turn succeeded through the launcher browser path |
| Full Harness | bounded turn invoked exactly one local read-only `pwd` operation successfully |
| Native profiles | zero admitted canonical profiles before/after; no profile root targeted |
| Identity & Access | validator passed; no secret values exposed |
| Keychain/credential health | validators passed; no WebGPT custody mutation observed |
| DEV | remains configured as separate v5.0.2 `dev-harness`; not started or updated |

The production configuration preserved the allowlisted application identity,
Full mode, loopback host/port, context window, `Codex Native2` name, launcher
browser host, and production tunnel profile paths. Secret-bearing fields were
compared only as presence/ownership metadata.

## End-to-end proof

An ephemeral Codex CLI consumer selected `chatgpt-web/light` and completed a
bounded prompt that requested the sentinel `WEBGPT_E2E_OK`. The exact sentinel
was returned. The bridge recorded successful model-catalog requests and no
active turns remained afterward.

A second ephemeral `chatgpt-web/light` turn used exactly one local read-only
`pwd` operation and returned `FULL_HARNESS_E2E_OK`. This proves the production
connector-to-local-harness path without writing to the repository or reading
files.

The desktop Codex app hosting this Goal was not restarted. Its on-disk
`models_cache.json` consequently still contains eight native rows and zero
`chatgpt-web/` rows. This is the remaining consumer-refresh step: after the
active task is complete, fully quit and reopen the desktop Codex app, then
verify the picker contains the native rows plus the account-eligible
`chatgpt-web/` rows with no duplicates. The successful explicit WebGPT route
selection and turn prove the backend route is already operational.

## Ownership decision

The supported current architecture is direct WebGPT integration on the
owner-selected shared/default Codex consumer surface:

- Codex WebGPT owns its managed route fragment, journal, bridge, browser
  session, tunnel, connector relationship, launcher, and package update.
- Codex owns native OAuth/session state and the rest of the Codex consumer
  configuration.
- Brain observes, verifies, detects drift, coordinates supported repair, and
  owns rollback/evidence policy. It does not normally write the WebGPT route.
- Brain-managed dynamic native account profiles are separate runtime roots and
  are excluded from this integration.
- WebGPT DEV is a separate runtime namespace and lifecycle.

No unsupported external-router mode was introduced.

## Independent warnings observed

The bounded CLI proof emitted two pre-existing-looking Codex-side warnings:
the rollout state database fell back because of state-db discrepancies, and
Codex loaded hooks from both `/Users/Office/.codex/hooks.json` and
`config.toml`. Several hook invocations also reported failure while the
WebGPT response itself completed successfully. These observations are not
evidence that the WebGPT bridge or updater failed, but they are a separate
hook/state-database hygiene issue and may explain renewed hook-trust prompts.
They should be handled in a later controlled Codex hook/state Goal, without
changing the recovered WebGPT route during this Goal.

## Validation still required

The following must be performed after the active Codex task ends:

1. Restart only the desktop Codex consumer.
2. Confirm native and account-eligible WebGPT model rows are visible once each.

The relevant upstream and Brain validation suites, typechecks, and
`git diff --check` have already passed for this Goal. Existing unrelated
conformance failures for the admitted Workbench revision/digests remain
unchanged and were not repaired.

Do not use broad process kills or copy authentication state to accomplish the
consumer restart.
