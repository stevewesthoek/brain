# Stripe CLI and ProBot

Canonical runbook for how Stripe CLI authentication, profiles, live/test access, and ProBot dashboard integration work in this workspace.

This document is AI-agnostic. Claude, Codex, and Gemini should all follow the same model.

## Purpose

Use this runbook when:

- authenticating Stripe CLI profiles
- inspecting which Stripe accounts are available locally
- understanding the difference between live mode, test mode, and separate sandbox profiles
- building or debugging Stripe features in ProBot
- documenting which local Stripe profiles map to which Stripe accounts

## Source of truth

- Local Stripe CLI config: `~/.config/stripe/config.toml`
- Indexed account inventory: `operations/accounts/credentials-index.md`
- Shared Stripe CLI skill: `ai/skills/custom/stripe/stripe-cli/SKILL.md`
- ProBot implementation docs: `projects/probot/README.md` and `projects/probot/SPEC.md`

## Stripe CLI model in this workspace

The Stripe CLI is profile-based.

Workspace default:

- `prochat-main` is the default Stripe CLI profile unless a repo-specific doc says otherwise.
- Repo-specific guidance can override the default profile for that repo's Stripe account.

Each profile is stored in `~/.config/stripe/config.toml` and can contain:

- `account_id`
- `display_name`
- `live_mode_*` credentials
- `test_mode_*` credentials

Important:

- Most Stripe accounts do not have a separate sandbox account ID.
- In normal Stripe usage, a single account has both live mode and test mode.
- The CLI reflects that by storing both live and test credentials inside the same profile.
- A separate sandbox profile only exists when Stripe presents a distinct account context for sandbox usage.

## Account switching model

Stripe dashboard account switching is not the same thing as Stripe Connect account enumeration.

That means:

- the dashboard switcher can show multiple accounts you can access
- the authenticated account's API does not necessarily expose those other accounts through `GET /v1/accounts`
- separate CLI authentication may be required per dashboard-visible account

This workspace uses one Stripe CLI profile per account when needed.

## Authentication workflow

### Verify install

```bash
stripe --version
```

### Inspect configured profiles

```bash
cat ~/.config/stripe/config.toml
```

### Authenticate a profile

```bash
stripe login --project-name <profile-name>
```

Examples:

```bash
stripe login --project-name prochat-main
stripe login --project-name feel-good-with-ana
stripe login --project-name jpv-bootcamp
```

### Verify the authenticated account

Do not rely on `stripe whoami` in this workspace. The installed CLI build does not support it.

Use:

```bash
stripe get /v1/account -p <profile-name>
```

Example:

```bash
stripe get /v1/account -p prochat-main
```

### Check whether a profile has live and test access

Inspect the profile entry in `~/.config/stripe/config.toml`.

If both are present:

- `live_mode_api_key`
- `test_mode_api_key`

then the profile has both live and test access for that account.

## Current profile strategy

The local machine currently uses dedicated profiles for the dashboard-visible live accounts, plus one distinct sandbox profile for Says the Bible.

The workspace default profile is `prochat-main` unless a repo-specific doc overrides it.

See `operations/accounts/credentials-index.md` for the current account roster and IDs.

## Live vs test mode

For ProBot and future automation:

- treat each Stripe profile as one account with two operating contexts:
  - live
  - test
- do not assume test mode has a different account ID
- do not invent a separate sandbox row unless Stripe actually exposes one as a separate profile/account

Current known exception:

- `says the bible sandbox` is a separate test-only profile

## ProBot dashboard implementation model

The ProBot Stripe dashboard should be built around profiles, not around a single platform account enumerating all others.

Correct model:

1. Define a registry of Stripe CLI profiles ProBot should inspect.
2. For each profile, query Stripe in that profile's account context.
3. For each profile/account, show:
   - account identity
   - live/test availability
   - revenue and balance metrics
   - product and price inventory
   - subscriptions, customers, payment volume, payout context, and other safe read-only metrics that the account API exposes
4. Keep live and test metrics clearly separated in the UI.

This avoids the false assumption that one Stripe profile can enumerate every other dashboard-visible account.

## ProBot implementation constraints

- Read-only by default.
- Never print secrets into logs, chat replies, or committed files.
- Use the Stripe CLI or API in the target profile context explicitly.
- Preserve existing production wiring, especially the current `prochat-main` default profile and any repo-specific overrides.

## Operational safety rules

- Do not rotate or overwrite the `default` Stripe profile unless explicitly asked.
- Prefer adding a new named profile over replacing an existing one.
- Before any live write operation, confirm intent explicitly.
- For inspection and dashboard work, stay read-only.

## Documentation maintenance rules

Whenever Stripe account access changes:

1. update `operations/accounts/credentials-index.md`
2. update this runbook if the operating model changed
3. update ProBot docs if dashboard behavior or configuration changed
4. keep the docs phrased so Claude, Codex, and Gemini can all follow them without engine-specific assumptions
