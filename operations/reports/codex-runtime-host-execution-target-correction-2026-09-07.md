# Codex runtime host and execution-target correction — 2026-09-07

## Executive conclusion

Commit `0541f2ab` added useful host-local runtime-instance metadata, but it
conflated two different relations: the remote MacBook-to-Office access path
also carried a list of Office Codex runtime instances. That was a semantic
architecture error, not evidence that OAuth had been copied. It made a network
transport look like it selected or reached a particular authenticated Codex
runtime and could therefore mislead future account switching or health logic.

The correction preserves the commit's account/profile isolation while making
the runtime host, execution target, protocol, and network path explicit.

## Corrected model

```text
account policy
  → surface binding
    → logical runtime profile
      → host-local runtime instance
        → application-owned auth/session
          → execution connection
              → protocol + transport-only network path
              → host/workspace target
              → optional target runtime instance
```

The distinctions are contractual:

- `runtimeInstance.runtimeHostId` is where the Codex application/session runs.
- `accessPath` is a transport-only network path between hosts. It has no
  runtime-instance target.
- `executionConnection` starts at a source runtime instance and targets a
  host/workspace. `targetRuntimeInstanceId` is optional and is null for a
  host/workspace execution target that does not select a target Codex runtime.
- `protocol` is the execution protocol, such as SSH. Tailscale and Thunderbolt
  are network-path choices, not authentication identities or Codex runtimes.
- Account identity is never inferred from the execution target. A remote
  operation remains attributable to the source runtime/account.

## Current multi-host topology

| Runtime | Account/profile | Host | Evidence posture |
| --- | --- | --- | --- |
| `runtime_instance:office.openai.01.cli` | `account:openai.01` / `runtime_profile:openai.01.cli` | `host:office` | authenticated and previously admitted by supported CLI evidence |
| `runtime_instance:office.openai.02.cli` | `account:openai.02` / `runtime_profile:openai.02.cli` | `host:office` | authenticated and previously admitted by supported CLI evidence |
| `runtime_instance:macbook.openai.02.desktop` | `account:openai.02` / `runtime_profile:openai.02.desktop` | `host:macbook` | operator-attested local Codex desktop; provider identity not inspected |

The MacBook runtime is both a local Codex desktop session boundary and the
source of two SSH execution connections:

- MacBook → Office host/workspace over the Thunderbolt network path.
- MacBook → Office host/workspace over the Tailscale network path.

Both connections have `targetRuntimeInstanceId: null`. They do not reauthenticate
the Office host, select the Office account 01 runtime, or copy any auth state.
The Office account 01 and account 02 CLI runtimes remain independently
host-local. The model also supports the reverse account arrangement, the same
account on different hosts, transport changes, offline targets, and arbitrary
N accounts × N hosts × N surfaces without changing canonical identity IDs.

## Live evidence and boundaries

On 2026-09-07, the local Office host observed:

- Tailscale reachability to `macbook` (`100.70.12.18`) through direct
  `10.0.0.4`; the probe passed in approximately 3 ms.
- Fixed SSH aliases for `MacBook` (`192.168.2.2`, host-key alias `macbook-m1`)
  and `office` (`192.168.2.1`, host-key alias `office-m4`).
- Read-only MacBook system evidence: macOS `26.6.2`, arm64, default
  `~/.codex` present, no CLI executable in PATH, and no dedicated CLI profile
  parent. This does not authorize reading desktop auth state.

The MacBook account binding is therefore deliberately operator-attested. The
implementation does not inspect `auth.json`, Keychain items, browser storage,
OAuth callbacks, tokens, cookies, or session contents. It does not initiate a
Mac Mini reauthentication and does not touch WebGPT.

The Tailscale client/server version warning is maintenance drift only; it is
not an authentication failure and does not change the ownership model.

## Custody and health

- Codex OAuth/session state remains application-owned in each host-local
  application namespace.
- Brain owns only non-secret identity intent, topology metadata, policy,
  leases, evidence, health projections, and recovery proposals.
- SSH credentials are represented by an opaque custody reference and remain
  separate from Codex OAuth. Tailscale and Thunderbolt state remain owned by
  their respective network/application boundaries.
- OnePassword or macOS Keychain is not made a second owner of Codex OAuth by
  this correction. Brain-managed secrets remain a separate, approval-gated
  credential class.
- Source authentication health, execution-connection health, network-path
  health, and target-host health are reported separately. An offline target
  cannot make the source account unauthenticated.

## Validation result

The corrected catalog contains two accounts, three runtime instances, two
transport-only access paths, two execution connections, three profiles, and
one session record for the newly admitted desktop observation. The corrected
schema, relationship validator, admission closure, runtime-profile view, and
architecture tests cover:

- distinct runtime host and execution target;
- optional target runtime versus host/workspace-only execution;
- transport changes between Thunderbolt and Tailscale;
- offline target health independent of source authentication;
- same-account independent host instances;
- different-account remote execution;
- sequential account/profile proof and existing credential-health contracts.

All secret-sensitive surfaces remain excluded from the catalog and reports.
