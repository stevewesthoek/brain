---
name: gcp
description: Use when the user asks to work with Google Cloud via the CLI — especially to inspect projects, accounts, configs, compute, Cloud Run, Storage, IAM, billing context, or other GCP resources through `gcloud`.
---

# Google Cloud CLI

## What this skill is for
Help Claude, Codex, and Gemini use the Google Cloud CLI (`gcloud`) safely and consistently for Google Cloud infrastructure discovery and management.

This skill is for the Google Cloud infrastructure layer:
- projects and account context
- configs and active project selection
- Compute Engine, Cloud Run, GKE, networking, IAM, and APIs
- Cloud Storage inventory through `gcloud storage`
- machine-readable inventory and scripting

This skill is not for Google Workspace admin work such as Gmail, Calendar, Drive, or user provisioning. Use `/gws` for Google Workspace.

## Use this skill when
- Listing Google Cloud accounts, projects, or active configs
- Inspecting enabled APIs, billing context, IAM bindings, or service accounts
- Managing Google Cloud resources through `gcloud`
- Building machine-readable inventory or automation around GCP resources
- Preparing later deployment workflows on Google Cloud

## Do not use this skill for
- Guessing the active project
- Making Google Cloud mutations before stating the exact project and region
- Google Workspace admin work that belongs under `/gws`
- Destructive resource deletion without explicit confirmation

## Safety rules
1. **Verify auth first.** Run `~/.local/bin/gcp-cli auth list` and `~/.local/bin/gcp-cli config configurations list` before assuming access exists.
2. **Always state the target project.** Before any mutation, explicitly identify the GCP project ID and, when relevant, region or zone.
3. **Read-only discovery first.** Start with account, config, project, and resource listing before any create, update, or delete action.
4. **Do not expose secrets.** Never print access tokens, refresh tokens, service-account key files, or raw credential JSON into chat output.
5. **Treat billing, IAM, APIs, and deletion as high impact.** Enabling services, changing IAM, attaching billing accounts, and deleting resources require explicit confirmation.
6. **Prefer machine-readable output.** Use `--format=json` and projections/filters in automation-oriented workflows.

## Stable local entrypoint

Use this command path for Claude, Codex, and Gemini:

```bash
~/.local/bin/gcp-cli
```

Repo-managed wrapper source:

```bash
operations/system-configs/bin/gcp-cli
```

Installed binary on this machine:

```bash
/opt/homebrew/bin/gcloud
```

## Official installation

The shared installation path on this Mac is Homebrew:

```bash
brew install google-cloud-sdk
```

Verified on this machine:
- `gcloud` version: `564.0.0`
- installed via Homebrew on 2026-04-11

Official docs:
- Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install
- Quickstart for `gcloud`: https://cloud.google.com/sdk/docs/quickstarts

## Auth contract

Google Cloud CLI typically stores local auth/config state in:

```bash
~/.config/gcloud/
```

Optional local-only wrapper env file:

```bash
~/.config/gcp/.env
```

Example local-only env file:

```bash
export CLOUDSDK_ACTIVE_CONFIG_NAME=default
# optional:
# export CLOUDSDK_PYTHON=/opt/homebrew/bin/python3.13
```

Important:
- Keep Google Cloud auth local only
- Never commit `~/.config/gcp/.env`
- Never commit service-account keys or raw credential files into any repo

Recommended interactive login:

```bash
~/.local/bin/gcp-cli auth login
~/.local/bin/gcp-cli auth application-default login
```

## Read-only discovery commands

```bash
~/.local/bin/gcp-cli version
~/.local/bin/gcp-cli auth list --format=json
~/.local/bin/gcp-cli config list --format=json
~/.local/bin/gcp-cli config configurations list --format=json
~/.local/bin/gcp-cli projects list --format=json
~/.local/bin/gcp-cli services list --enabled --format=json

~/.local/bin/gcp-cli compute instances list --format=json
~/.local/bin/gcp-cli run services list --platform=managed --format=json
~/.local/bin/gcp-cli storage buckets list --format=json
```

## Common mutation commands

```bash
~/.local/bin/gcp-cli config set project <project-id>
~/.local/bin/gcp-cli services enable <service-name>
~/.local/bin/gcp-cli run deploy ...
~/.local/bin/gcp-cli compute instances create ...
~/.local/bin/gcp-cli storage cp ...
```

## Workflow guidance

Default workflow:
1. Verify installed version and auth state
2. List configs and determine the target project
3. State the exact project, region, and resource target
4. Do read-only discovery
5. Only then perform approved mutations

## Notes
- This skill applies to Claude, Codex, and Gemini.
- Until local auth is configured under `~/.config/gcloud`, the CLI is installed but may not be authenticated.
- Use `/gws` for Google Workspace rather than Google Cloud infrastructure.
