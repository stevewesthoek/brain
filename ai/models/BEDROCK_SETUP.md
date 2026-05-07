# Bedrock Model Router Setup

Local Claude Code / AWS Bedrock model discovery and configuration.

## Overview

This setup keeps Claude Code’s Bedrock model routing safe and current:

- Dynamic discovery uses AWS Bedrock when available.
- Pinned fallbacks prevent AWS/IAM/SCP failures from breaking the router.
- Stale discovery or stale environment variables must not downgrade newer pinned models.
- Claude Code `/model` only updates after starting a new session with the correct environment exports.

## Pinned fallbacks

| Tier | Model ID |
|---|---|
| Opus | `us.anthropic.claude-opus-4-7` |
| Sonnet | `us.anthropic.claude-sonnet-4-6` |
| Haiku | `us.anthropic.claude-haiku-4-5-20251001-v1:0` |

## Commands

```bash
npm run models:sync:bedrock
npm run models:validate
```

`models:sync:bedrock` calls both:

```bash
aws bedrock list-foundation-models --region "${AWS_REGION:-us-east-1}" --output json
aws bedrock list-inference-profiles --region "${AWS_REGION:-us-east-1}" --output json
```

It filters to stable Anthropic Claude IDs, prefers `us.anthropic.*` inference/profile IDs, groups by `opus`, `sonnet`, and `haiku`, then writes:

- `ai/models/bedrock-models.generated.json`
- `tools/scripts/bedrock-models.generated.sh`

## Required AWS permissions

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:ListInferenceProfiles",
    "bedrock:ListFoundationModels"
  ],
  "Resource": "*"
}
```

If those calls fail due to IAM or SCP restrictions, the script prints warnings and keeps the pinned fallbacks.

## Applying the models to Claude Code

Run sync, then source the generated shell exports before starting Claude Code:

```bash
npm run models:sync:bedrock
source tools/scripts/bedrock-models.generated.sh
claude
```

Expected exports:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL="us.anthropic.claude-opus-4-7"
export ANTHROPIC_DEFAULT_SONNET_MODEL="us.anthropic.claude-sonnet-4-6"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="us.anthropic.claude-haiku-4-5-20251001-v1:0"
```

If `/model` still shows `us.anthropic.claude-opus-4-6-v1`, the current Claude Code process was started with stale environment variables. Exit Claude Code, source `tools/scripts/bedrock-models.generated.sh`, and start Claude Code again.

## Validation behavior

`npm run models:validate` verifies:

- exactly one non-empty model for Opus, Sonnet, and Haiku
- all resolved models use `us.anthropic.*`
- resolved Opus is not older than pinned Opus 4.7
- `deep-architect` matches the resolved Opus cache
- the generated sourceable shell export file exists
- the current shell is not still using a stale `ANTHROPIC_DEFAULT_OPUS_MODEL`

## Files

- `tools/scripts/models-sync-bedrock.sh` — discovery and cache/export generation
- `tools/scripts/models-validate.sh` — validation and stale environment warning
- `tools/scripts/bedrock-models.generated.sh` — sourceable Claude Code exports
- `ai/models/bedrock-models.generated.json` — generated resolved model cache
- `operations/system-configs/claude/agents/deep-architect.md` — Opus agent configuration
- `ai/skills/custom/model-router/SKILL.md` — model-router skill text
- `ai/policy/routing.md` — canonical routing policy

Last updated: 2026-05-07
