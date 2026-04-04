# Cloudflare AI Access

This directory documents the Cloudflare setup used by both Claude and Codex.

## Goal

Provide stable, AI-agnostic Cloudflare entrypoints with the same operating model as AWS and Azure:

- account-aware wrappers
- separate provisioner and destroyer entrypoints
- local credential files outside the repo
- documented safety guardrails

## Stable local entrypoints

```bash
~/.local/bin/cloudflare-cli
~/.local/bin/cloudflare-prochat-provisioner
~/.local/bin/cloudflare-prochat-destroyer
~/.local/bin/cloudflare-jpvbootcamp-provisioner
~/.local/bin/cloudflare-jpvbootcamp-destroyer
```

## Credential files

Credentials live outside the repo:

```bash
~/.config/cloudflare-ai/credentials/prochat-provisioner.env
~/.config/cloudflare-ai/credentials/prochat-destroyer.env
~/.config/cloudflare-ai/credentials/jpvbootcamp-provisioner.env
~/.config/cloudflare-ai/credentials/jpvbootcamp-destroyer.env
```

## Manual token creation

Create four custom API tokens in the Cloudflare dashboard:

1. `ClaudeCodexProChatProvisioner`
2. `ClaudeCodexProChatDestroyer`
3. `ClaudeCodexJPVBootcampProvisioner`
4. `ClaudeCodexJPVBootcampDestroyer`

Recommended permissions for each token:

- Account:
  - `Cloudflare Tunnel` -> `Edit`
- Zone:
  - `Zone` -> `Read`
  - `DNS` -> `Edit`

Recommended resource scope:

- ProChat tokens:
  - account: `ProChat Studio`
  - zones: all needed zones in that account, at minimum `prochat.tools`
- JPV Bootcamp tokens:
  - account: `JPV Bootcamp`
  - zones: all needed zones in that account

Cloudflare's token model does not cleanly separate non-destructive DNS/tunnel edit from destructive delete.
Because of that limitation, both token classes may need the same underlying permissions.
The local wrapper layer is responsible for blocking destructive actions unless the explicit destroyer wrapper is used.

## Save tokens locally

```bash
tools/cloudflare/save-token.sh prochat-provisioner <account-id> "ProChat Studio" prochat.tools info@prochat.tools
tools/cloudflare/save-token.sh prochat-destroyer <account-id> "ProChat Studio" prochat.tools info@prochat.tools
tools/cloudflare/save-token.sh jpvbootcamp-provisioner <account-id> "JPV Bootcamp" <default-zone> info@prochat.tools
tools/cloudflare/save-token.sh jpvbootcamp-destroyer <account-id> "JPV Bootcamp" <default-zone> info@prochat.tools
```

Known account IDs from live `wrangler whoami`:

- `ProChat Studio` -> `6a96282349f82a2cc05723f561b5eb3a`
- `JPV Bootcamp` -> `dedb53bdce3f63d2b9a74836448dba7e`

## Verification

```bash
~/.local/bin/cloudflare-prochat-provisioner verify
~/.local/bin/cloudflare-prochat-provisioner zones list prochat.tools
~/.local/bin/cloudflare-prochat-provisioner tunnels list
```

## Safety model

- Use provisioner wrappers for normal reads, DNS upserts, tunnel inspection, and route changes.
- Use destroyer wrappers only for delete or teardown actions.
- Provisioner wrappers block obvious destructive actions such as DNS delete and tunnel delete.
- Do not use raw `wrangler` or raw `cloudflared` when the wrapped commands are sufficient.
