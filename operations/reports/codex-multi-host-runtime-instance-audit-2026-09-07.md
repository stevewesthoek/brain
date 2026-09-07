# Codex multi-host runtime-instance audit — 2026-09-07

This report was corrected by
`codex-runtime-host-execution-target-correction-2026-09-07.md`. The original
version conflated a remote access path with a target Codex runtime; the current
model uses transport-only network paths and explicit execution connections.

## Result

The accepted account-independent Codex profile model now has an explicit
host-local runtime-instance layer and a separate remote access-path layer.
Canonical Identity & Access validation passes with two accounts, three
runtime instances, two verified MacBook-to-Office network paths, and two
MacBook-to-Office SSH execution connections.

This is a topology and custody admission. It does not copy, read, export, or
centralize Codex OAuth state.

## Admitted topology

| Logical identity | Host-local instance | Root | Custody |
| --- | --- | --- | --- |
| `account:openai.01` / `runtime_profile:openai.01.cli` | `runtime_instance:office.openai.01.cli` on `host:office` | `~/.brain/codex-runtime-profiles/openai.01.cli` | Codex application-owned file-mode auth |
| `account:openai.02` / `runtime_profile:openai.02.cli` | `runtime_instance:office.openai.02.cli` on `host:office` | `~/.brain/codex-runtime-profiles/openai.02.cli` | Codex application-owned file-mode auth |
| `account:openai.02` / `runtime_profile:openai.02.desktop` | `runtime_instance:macbook.openai.02.desktop` on `host:macbook` | `~/.codex` | Codex desktop application-owned state; operator-attested, not provider-verified |

The logical profile IDs are host-independent. The instance IDs are derived from
the profile/host pair, so adding another admitted host creates a distinct
instance without renumbering the account or profile. Host retirement affects
only that host's instances and access paths.

The current paths are:

- `access_path:macbook.office.thunderbolt`
- `access_path:macbook.office.tailscale`

Both are network paths from `host:macbook` to `host:office`, recorded as
available, verified, and healthy. They do not target an Office Codex runtime.
The corresponding SSH execution connections originate at the MacBook desktop
runtime, target `host:office` and `workspace:brain`, and leave
`targetRuntimeInstanceId` unset.

## Live evidence

- Local host: Office Mac mini, macOS `26.6.2`, `arm64`.
- Tailscale reached `macbook` at `100.70.12.18` through direct `10.0.0.4` in
  2 ms.
- Fixed SSH configuration resolved `MacBook` to `192.168.2.2` with
  `hostkeyalias macbook-m1`.
- Fixed SSH configuration resolved `office` to `192.168.2.1` with
  `hostkeyalias office-m4`.
- Remote read-only inspection of the MacBook reported macOS `26.6.2`,
  `arm64`, no `codex` executable in `PATH`, no
  `~/.brain/codex-runtime-profiles` parent, and an existing default
  `~/.codex` directory.

The MacBook is modeled as both a local Codex desktop runtime and a remote
execution client. Its account/profile binding is operator-attested because the
inspection did not read application authentication or obtain provider identity
evidence. No OAuth was copied or inspected.

Tailscale reported a client/server version mismatch warning (`1.96.4` versus
`1.102.3`), but the path probe passed. This is maintenance drift, not evidence
of an authentication or topology failure.

## Custody and health boundary

- Codex OAuth remains application-owned inside each dedicated `CODEX_HOME`.
- Brain owns only non-secret profile intent, instance/path metadata, leases,
  evidence, policy, and recovery proposals.
- OnePassword/macOS Keychain are not used as a second owner for Codex OAuth.
- The canonical catalog currently contains zero credential records, so no
  Brain-managed secret was enrolled or migrated by this audit.
- Read-only credential-health infrastructure remains active for credential
  records when they are admitted; provider-specific renewal and artificial
  keepalive remain forbidden.
- WebGPT production and its application-owned session were not touched.

## Validation

Passing gates:

- `node tools/validate-infrastructure-identity-access.mjs`
- `npm run test:codex-runtime-architecture` — 40/40
- `npm run test:infrastructure-identity-access` — 10/10
- `npm run test:codex-profile-admission` — 5/5
- `node tools/validate-infrastructure-catalog.mjs` — valid; 22 existing stale
  provenance warnings remain outside this change
- `node tools/validate-infrastructure-credential-health.mjs`
- `node tools/validate-infinite-brain-contract-registry.mjs`
- `node tools/validate-infinite-brain-contract-layers.mjs`
- contract registry/layers tests — 7/7
- `git diff --check`

The new read-only operator view is:

```bash
npm run runtime:profiles -- instances
```

It returns instance/path metadata with `secretsExcluded=true` and
`authContentsRead=false`.

## Limits and next gates

This audit proves the multi-host data model, current Office authentication
admission, a MacBook-local operator-attested Codex runtime, and remote SSH
reachability. It does not claim provider-stable account principal evidence for
the MacBook instance. The next safe expansion is read-only inventory of
Brain-managed credentials, followed by per-provider health checks and alerts.
Any renewal, rotation, OAuth reauthentication, or vault adoption remains a
separate approval-gated action.
