# Office Mac ↔ MacBook Connectivity Standard

**Status:** Canonical network/SSH topology for workstation operations
**Effective:** 2026-08-12
**Related:** `operations/specs/workstation-config-ownership.json`, `operations/system-configs/ssh/config`, `operations/runbooks/codex-managed-runtime-root.md`

## Roles

- **Office Mac mini** — primary repository host and control plane. Repositories under `/Users/Office/Repos` live here.
- **MacBook M1** — interactive client/secondary node. It may connect locally through Thunderbolt or remotely through Tailscale.
- **Codex macOS app on MacBook** — client UI. When it opens Office-hosted repositories, the remote Codex runtime and repository operations execute on the Office Mac.

## Canonical Addresses

Only fixed addresses belong in Brain configuration.

| Machine | Thunderbolt | Tailscale |
| --- | --- | --- |
| Office Mac mini | `192.168.2.1` | `100.86.124.66` |
| MacBook M1 | `192.168.2.2` | `100.70.12.18` |

DHCP-assigned Wi-Fi/LAN addresses are intentionally noncanonical. Home Wi-Fi, mobile/5G, Ethernet, hotspot, or another internet path may carry Tailscale traffic without changing the stable SSH identity.

## Route Policy

### MacBook → Office

1. **Thunderbolt** `192.168.2.1` when directly connected and SSH is reachable.
2. **Tailscale** `100.86.124.66` otherwise.

The canonical `office` SSH identity should preserve this behavior. Tailscale is the stable fallback on home Wi-Fi, mobile/5G, or another internet underlay.

### Office → MacBook

1. **Thunderbolt** `192.168.2.2` when directly connected.
2. **Tailscale** `100.70.12.18` otherwise.

`MacBook` / `macbook` are the canonical MacBook aliases. Host migration must preserve both the direct Thunderbolt route and a stable Tailscale route; do not replace either with DHCP Wi-Fi addresses.

## Why Wi-Fi IPs Are Not Canonical

The local Wi-Fi addresses are DHCP-assigned and may change after reboot, lease renewal, network changes, or moving between access points. Brain therefore treats Wi-Fi as an underlay rather than an identity.

Tailscale provides stable per-device addresses across:

- home Wi-Fi;
- mobile/5G tethering or hotspot;
- remote internet connections;
- other IP underlays.

This removes the need to maintain a separate home-LAN SSH address while keeping Thunderbolt as the preferred direct local path.

## Codex Mac App Remote SSH Contract

Historical failure mode:

- MacBook Codex app connected to the Office Mac over SSH;
- remote Codex runtime used a whole-directory `~/.codex` symlink;
- `$CODEX_HOME/app-server-control/app-server-control.sock` resolved to a `114`-byte path;
- macOS Unix-domain socket limit is `103` bytes;
- remote Codex app server failed with `path must be shorter than SUN_LEN`.

Accepted compatibility requirement:

- Office `~/.codex` is a short **physical** local runtime root;
- the remote control socket stays below 103 bytes;
- sessions/auth/SQLite/plugins/caches remain physical runtime state on Office;
- tracked `config.toml` is materialized as a physical `GENERATED-COPY` at `~/.codex/config.toml`;
- `config.toml` does **not** need to be a symlink;
- stable narrow Codex configuration entries may still be symlinked where declared by the workstation ownership spec.

Changing entry-level ownership must never restore a whole `~/.codex` symlink.

## SSH Configuration Ownership

The live `~/.ssh/config` migration target is `INCLUDE`, not a direct Brain symlink.

Desired shape:

```text
~/.ssh/config                  physical local root config
  Include <Brain tracked SSH config>
  Include ~/.ssh/config.local
```

The Brain tracked SSH config owns reproducible host aliases/routing rules. Local-only state includes:

- private keys;
- `known_hosts`;
- local overrides;
- agent state;
- credentials.

Never copy private keys into Brain or print them during validation.

## Connectivity Validation

Before any live config-root migration, capture a read-only baseline.

Required resolution checks:

```text
ssh -G office
ssh -G MacBook
ssh -G macbook
```

Verify that the effective route and identity-file paths are expected without printing private key contents.

Required non-destructive route checks after migration:

### Direct Thunderbolt present

- MacBook can reach Office SSH through `192.168.2.1`.
- Office can reach MacBook SSH through `192.168.2.2`.
- `office` selects the intended Thunderbolt path when its conditional rule is active.

### Thunderbolt absent

- MacBook can reach Office through Tailscale `100.86.124.66`.
- Office can reach MacBook through Tailscale `100.70.12.18`.
- no DHCP Wi-Fi IP is required for configuration correctness.

### Codex end-to-end

From the MacBook Codex macOS app:

1. connect to the Office Mac using the canonical remote profile;
2. open a repository under `/Users/Office/Repos`;
3. verify remote Codex app-server startup succeeds;
4. verify existing remote Codex sessions/history remain visible as expected;
5. verify `codex mcp list` and required MCP integrations;
6. verify one bounded read-only repository action;
7. verify the resolved remote control-socket path remains within the 103-byte macOS limit.

Do not delete migration backups until repeated local and remote sessions succeed.

## Failure and Rollback

If SSH alias resolution, Thunderbolt/Tailscale fallback, Codex Remote SSH, session memory, auth, MCP integrations, or application startup regress:

1. stop only the affected application;
2. use the migration receipt to restore the previous root/config state;
3. restore the exact preserved symlink/config backup;
4. rerun the pre-migration route and Codex checks;
5. stop the migration until the cause is understood.

Do not weaken SSH authentication or bypass key protections to make validation pass.

## New-Machine Rule

A new Office/MacBook installation should be considered correctly configured only when:

- Brain canonical config is installed through the workstation ownership modes;
- both fixed Tailscale identities are documented and reachable where expected;
- Thunderbolt fixed addresses are configured for direct operation;
- Wi-Fi DHCP addresses are not embedded in Brain config;
- SSH aliases resolve correctly;
- Codex Remote SSH uses a short physical Office `~/.codex` runtime root;
- sessions/auth/runtime state remain application-owned and local.
