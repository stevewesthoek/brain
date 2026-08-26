---
name: azure
description: Use when the user asks to work with Azure via the CLI — especially to inspect subscriptions, resource groups, services, and account context across one or more Azure accounts. Default to the Azure CLI (`az`) for account-aware infrastructure work, and use Azure Developer CLI (`azd`) only when the task is specifically app-template or developer-environment oriented.
---

# Azure CLI

## What this skill is for
Help Claude and Codex use Azure CLI safely and consistently for Azure infrastructure discovery and management across multiple Azure accounts.

This skill is closer to AWS CLI usage than to n8n:
- account and subscription discovery first
- read-only inventory before mutations
- explicit subscription targeting before any create, update, or delete action

## Use this skill when
- Listing Azure accounts, tenants, or subscriptions
- Inspecting resource groups and resources
- Managing Azure services through `az`
- Switching between multiple Azure accounts or subscriptions
- Building machine-readable inventory or automation around Azure resources
- Preparing later Azure deployment workflows

## Do not use this skill for
- Guessing the active subscription
- Making Azure mutations before stating the exact subscription and scope
- Using `azd` when plain `az` is the correct tool
- Performing destructive resource deletion without explicit confirmation

## Safety rules
1. **Verify auth first.** Run `~/.local/bin/azure-cli account list` before assuming Azure access exists.
2. **Always state the target subscription.** Before any mutation, explicitly identify subscription name and ID.
3. **Read-only discovery first.** Start with account, subscription, resource group, and resource listing before any create/update/delete action.
4. **Never expose tokens or secrets.** Do not print access tokens, refresh tokens, service principal secrets, or Key Vault secrets.
5. **Use explicit subscription targeting in automation.** Prefer the subscription-specific wrappers below instead of relying on ambient account context.
6. **Multi-account means multi-tenant caution.** The retired Dokploy subscription formerly displayed as `PROCHAT-APPS` and the active data subscription formerly displayed as `PROCHAT-DATA` live in different tenants; the active subscription is canonically `supabase-azure`. Do not assume one login context safely covers both.
7. **Provisioner is the default persona.** Discovery, sizing, create, update, start, stop, and bootstrap should use the `*-provisioner` wrappers.
8. **Destroyer is opt-in only.** Deletion and teardown require explicit user intent and the `*-destroyer` wrappers.

## Stable local entrypoints

Use these command paths for both Claude and Codex:

```bash
~/.local/bin/azure-cli
~/.local/bin/azure-apps-provisioner
~/.local/bin/azure-apps-destroyer
~/.local/bin/azure-data-provisioner
~/.local/bin/azure-data-destroyer
```

Repo-managed wrappers:

```bash
operations/system-configs/bin/azure-apps-provisioner
operations/system-configs/bin/azure-apps-destroyer
operations/system-configs/bin/azure-data-provisioner
operations/system-configs/bin/azure-data-destroyer
```

Installed binary on this machine:

```bash
/opt/homebrew/bin/az
```

Current subscription mapping:
- `PROCHAT-APPS` -> `1db6646e-69c0-4ee0-a4d5-53d40421a5a4`
- `supabase-azure` (historical display name `PROCHAT-DATA`) -> `6e99b82d-43e3-41cc-ad94-8733afeb2a7e`

Default operating rule:
- Use `azure-apps-provisioner` for non-destructive work in `PROCHAT-APPS`
- Use `azure-data-provisioner` for non-destructive work in `supabase-azure` (historical display name `PROCHAT-DATA`)
- Use the matching `*-destroyer` wrapper only for explicit teardown or cleanup
- Keep `~/.local/bin/azure-cli` as the generic base CLI for auth and account inspection

Azure-side enforcement:
- `azure-apps-provisioner` runs as a dedicated service principal scoped to `PROCHAT-APPS` with the custom role `ClaudeCodexAppsProvisioner`
- `azure-apps-destroyer` runs as a dedicated service principal scoped to `PROCHAT-APPS` with `Contributor`
- `azure-data-provisioner` runs as a dedicated service principal scoped to `supabase-azure` (historical display name `PROCHAT-DATA`) with the custom role `ClaudeCodexDataProvisioner`
- `azure-data-destroyer` runs as a dedicated service principal scoped to `supabase-azure` (historical display name `PROCHAT-DATA`) with `Contributor`
- Local service-principal credentials are stored only under `~/.config/azure-ai/credentials/` and must never be committed or printed

## Official installation

Microsoft Learn says the recommended macOS install path is Homebrew:

```bash
brew update && brew install azure-cli
```

Verified on this machine:
- `azure-cli` version: `2.84.0`
- installed via Homebrew on 2026-04-03

Official docs:
- Install Azure CLI on macOS: https://learn.microsoft.com/cli/azure/install-azure-cli-macos
- Azure CLI getting started: https://learn.microsoft.com/cli/azure/get-started-with-azure-cli

## Authentication

Azure CLI stores local auth state in:

```bash
~/.azure/
```

Recommended login:

```bash
~/.local/bin/azure-cli login --use-device-code
```

Add a second Azure account:

```bash
~/.local/bin/azure-cli login --use-device-code
```

After both are added:

```bash
~/.local/bin/azure-cli account list --all --output json
```

## Multi-account workflow

When multiple Azure accounts are present:
1. List all subscriptions across all logged-in accounts
2. Identify the target subscription by name and ID
3. Set the active subscription only for interactive work
4. In scripts and AI automation, prefer the explicit wrappers instead of `account set`

Set active subscription:

```bash
~/.local/bin/azure-cli account set --subscription "<subscription-name-or-id>"
```

Show current context:

```bash
~/.local/bin/azure-cli account show --output json
```

## Read-only discovery commands

```bash
~/.local/bin/azure-cli --version
~/.local/bin/azure-cli account list --all --output json
~/.local/bin/azure-cli account show --output json

~/.local/bin/azure-apps-provisioner group list --output json
~/.local/bin/azure-apps-provisioner resource list --output json

~/.local/bin/azure-data-provisioner group list --output json
~/.local/bin/azure-data-provisioner resource list --output json
```

## Recommended inventory flow

```bash
# 1. Verify logged-in accounts and subscriptions
~/.local/bin/azure-cli account list --all --output json

# 2. Choose the explicit subscription wrapper
~/.local/bin/azure-apps-provisioner group list --output json
~/.local/bin/azure-data-provisioner group list --output json

# 3. Inspect all resources in that subscription
~/.local/bin/azure-apps-provisioner resource list --output json
~/.local/bin/azure-data-provisioner resource list --output json
```

## Provisioning and destructive examples

Safe-default wrappers:

```bash
~/.local/bin/azure-apps-provisioner vm create ...
~/.local/bin/azure-apps-provisioner network nsg rule create ...
~/.local/bin/azure-data-provisioner vm create ...
~/.local/bin/azure-data-provisioner disk create ...
```

Destructive wrappers:

```bash
~/.local/bin/azure-apps-destroyer vm delete ...
~/.local/bin/azure-apps-destroyer group delete ...
~/.local/bin/azure-data-destroyer vm delete ...
~/.local/bin/azure-data-destroyer disk delete ...
```

## Inventory helper

Repo helper:

```bash
brain/tools/scripts/azure-inventory.sh
```

This script builds a machine-readable inventory of subscriptions, resource groups, and resources for all logged-in Azure accounts.

## Notes
- `azd` is not the default tool for account inventory. Use it only for Azure Developer CLI workflows.
- Azure CLI auth is local-machine state in `~/.azure`; do not commit or expose it.
- Historical verification on 2026-04-03 confirmed Azure CLI authentication to the then-displayed subscriptions `PROCHAT-APPS` and `PROCHAT-DATA`; current identity is `supabase-azure` for the active data subscription.
- Verified on 2026-04-03 that service-principal-backed provisioner and destroyer wrappers work for both subscriptions.
- The two subscriptions live in different tenants, so the enforced Azure role model uses separate service principals per tenant/subscription pair.
