---
name: google-ads
description: Use when the user wants to manage or automate the Yeshua Academy Google Ad Grants account, inspect nonprofit Google Ads operating state, run the AI-agnostic Google Ads CLI, review pacing and compliance, or update the documented Google Ad Grants automation stack.
---

# Google Ads Automation

## What this skill is for
Use this skill for the shared, AI-agnostic Google Ads automation system in `brain`.

This skill is specifically for:
- Yeshua Academy's Google Ad Grants setup
- the nonprofit-only Google Ads operating model
- the shared CLI in `tools/google-ads/cli.py`
- policy/compliance monitoring against official Google documentation
- pacing, reporting, and operational runbooks

This is not for general commercial paid media. Until the repo docs say otherwise, this stack is nonprofit-only.

## Canonical account boundary

**Only use `steve@yeshua.academy` for Google Ads work.**

That includes:
- Google Ads Manager login
- Google Ads API developer token setup
- any OAuth client created for this automation system
- any Google Cloud config used for Google Ads work

Do not use:
- `westhoek@hotmail.com`
- `info@prochat.tools`

For `gcloud`, the dedicated config is:

```bash
~/.local/bin/gcp-cli config configurations activate google-ads-nonprofit
```

## Files and entrypoints

Primary CLI:

```bash
python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py doctor
python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py pace
python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py report
python3 ~/Repos/stevewesthoek/brain/tools/google-ads/cli.py policy-watch
```

Config:

```text
config/google-ads/account.toml
config/google-ads/goals.toml
config/google-ads/rules.toml
config/google-ads/sources.toml
```

Docs:

```text
docs/google-ads/
```

Reports:

```text
reports/google-ads/
```

State:

```text
data/google-ads/google_ads.sqlite3
```

## Workflow

1. Activate the dedicated GCP config.
2. Run `doctor` to confirm account boundary and credential readiness.
3. Use `policy-watch` to refresh Google Ad Grants source awareness.
4. Use `sync` only when Ads API credentials are provisioned.
5. Use `pace` and `report` for ongoing nonprofit budget governance.

## Guardrails

- Treat this stack as Ad Grants-only unless the docs are expanded deliberately.
- Do not auto-apply broad structural changes without explicit approval.
- Do not create or use Google Ads credentials under any account except `steve@yeshua.academy`.
- Do not commit secrets, tokens, refresh tokens, or OAuth client secrets into the repo.
- If official Ad Grants documentation changes materially, update `docs/google-ads/COMPLIANCE.md` and related rule/config files in the same change.
