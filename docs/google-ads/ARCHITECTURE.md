# Google Ads Automation Architecture

## Purpose

Build an AI-agnostic, nonprofit-specific Google Ads operating system inside `brain` for the Yeshua Academy Google Ad Grants account.

This system is designed for:
- shared use by Claude, Codex, and Gemini
- versioned documentation and policy
- deterministic guardrails first, AI assistance second
- high confidence about which account, config, and workflow to use

## Scope

Included:
- Ad Grants pacing
- operational documentation
- policy-source monitoring
- local state and report generation
- future Google Ads API execution through one shared CLI

Excluded for now:
- commercial paid media
- unsupported UI-only Google Ads features
- unattended strategic expansion without review

## Current external dependency

The repo currently does not control a Google Ads manager account yet.

Current real-world shape:
- client account: `592-920-2435` (`Vila Solidária`)
- upstream Google-managed manager: `715-717-3541` (`Ad Grants Netherlands`)

Required future shape:
- client account remains `592-920-2435`
- add a customer-owned manager account controlled by `steve@yeshua.academy`
- use that customer-owned manager account for API Center and developer token management

## Control plane

The AI is not the execution layer.

The execution layer is the repo-local CLI:

```text
tools/google-ads/cli.py
```

All three AIs use the same:
- docs in `docs/google-ads/`
- config in `config/google-ads/`
- state in `data/google-ads/`
- reports in `reports/google-ads/`

## Core loop

1. `doctor`
- confirms account boundary
- checks gcloud config
- checks whether API credentials exist

2. `policy-watch`
- fetches official Google sources
- snapshots metadata and content hashes
- flags changes that may require strategy updates

3. `sync`
- future live pull from Google Ads API
- stores snapshots in SQLite
- writes run history and blocks when credentials are missing

4. `pace`
- computes daily pacing against the grant budget
- compares actual spend to target bands

5. `report`
- writes operator-facing markdown reports
- combines account state, pacing, and policy-watch findings

## State model

SQLite database:

```text
data/google-ads/google_ads.sqlite3
```

Tables:
- `runs`
- `metrics_snapshots`
- `policy_snapshots`

This is intentionally small and local-first until live API connectivity is enabled.

## Nonprofit guardrails

- nonprofit only
- Search-first operating model
- mission-aligned keywords only
- no silent account switching
- no secrets in repo
- no structural auto-apply by default

## Planned production extension

When credentials exist, the next implementation phase should add:
- Google Ads API client setup
- campaign/ad group/keyword read sync
- search terms ingest
- recommendation ingest
- change-event reconciliation
- approval-gated mutation commands
