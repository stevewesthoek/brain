# Model Selection Configuration

Local Claude Code / AWS Bedrock model discovery and management.

## Quick start

```bash
npm run models:sync:bedrock
npm run models:validate
```

The sync command writes:

- `ai/models/bedrock-models.generated.json` — resolved model cache
- `tools/scripts/bedrock-models.generated.sh` — sourceable Claude Code model exports

New login/interactive shells source the generated exports through Brain's Claude Bedrock launcher env. In an already-open shell, source the launcher env before starting Claude Code so `/model` sees the latest resolved Bedrock IDs and stale Opus 4.7 selections are guarded:

```bash
source tools/scripts/claude-bedrock-env.sh
claude --model haiku
```

## Current resolved model map

```json
{
  "opus": "us.anthropic.claude-opus-4-6-v1",
  "sonnet": "us.anthropic.claude-sonnet-4-6",
  "haiku": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
```

## Pinned fallback models

These are safe emergency defaults used when AWS discovery/access probing fails or returns no callable model:

```json
{
  "opus": "us.anthropic.claude-opus-4-6-v1",
  "sonnet": "us.anthropic.claude-sonnet-4-6",
  "haiku": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
```

The sync script discovers stable Claude Bedrock candidates, probes actual `bedrock-runtime converse` access, and writes the newest callable model per tier. Opus 4.7 remains guarded until Bedrock account access is granted; Opus 4.6 is the safe Opus-tier fallback.

## Agent assignments

| Agent | Current model | Tier |
|---|---|---|
| `cheap-prep` | `haiku` | Haiku |
| `coder-default` | `sonnet` | Sonnet |
| `deep-architect` | `opus` | Opus |

The exact Bedrock IDs come from `tools/scripts/bedrock-models.generated.sh`, not from agent frontmatter.

## AI Model Selector Bedrock portfolio

Claude Code tier exports are separate from the runtime AI Model Selector portfolio.

The selector reads:

- `~/.config/video-orchestrator/ai-bedrock-models.json` — explicit model roster, prices, task roles, and enabled flags
- `~/.local/video-orchestrator/state/bedrock-model-access.json` — cached account/region access probes
- `~/.local/video-orchestrator/state/bedrock-model-outcomes.json` — model-level success/failure learning data

Current selector policy:

1. Use local Ollama first.
2. Use cheap capable Bedrock models before premium Claude.
3. Use Codex CLI when the Bedrock value portfolio is unavailable or the subscription-backed surface is a better fit.
4. Use Sonnet as a premium fallback.
5. Keep Opus disabled until the AWS account has explicit access.

Initial Bedrock value roster:

| Role | Model ID |
|---|---|
| Agentic default | `nvidia.nemotron-super-3-120b` |
| Coding specialist | `qwen.qwen3-coder-next` |
| General reasoning fallback | `deepseek.v3.2` |
| Reasoning challenger | `moonshot.kimi-k2-thinking` |
| General Moonshot fallback | `moonshotai.kimi-k2.5` |
| Cheap OpenAI open model | `openai.gpt-oss-120b-1:0` |
| Premium fallback | `us.anthropic.claude-sonnet-4-6` |
| Disabled until access is granted | `us.anthropic.claude-opus-4-7` |

## Configuration options

```bash
# Region, default us-east-1
AWS_REGION=us-west-2 npm run models:sync:bedrock

# AWS profile
AWS_PROFILE=work npm run models:sync:bedrock

# Force pinned models first, then discovered candidates
PREFER_PINNED_MODELS=1 npm run models:sync:bedrock

# Disable live access probes and trust discovery only
PROBE_BEDROCK_ACCESS=0 npm run models:sync:bedrock

# Allow preview/beta/experimental IDs when explicitly intended
ALLOW_PREVIEW_MODELS=1 npm run models:sync:bedrock
```

## AWS permissions

The sync command uses:

```json
{
  "Effect": "Allow",
  "Action": [
    "bedrock:ListInferenceProfiles",
    "bedrock:ListFoundationModels",
    "bedrock:InvokeModel"
  ],
  "Resource": "*"
}
```

If IAM or SCP policy blocks discovery, the command warns and keeps pinned fallbacks.

## Troubleshooting `/model`

Claude Code's `/model` selector includes built-in Claude options that the Brain repo cannot remove. The repo controls the custom/default Bedrock environment values, not Claude Code's built-in menu list.

After syncing, restart Claude Code from a shell where the launcher env has been sourced:

```bash
source tools/scripts/claude-bedrock-env.sh
echo "$ANTHROPIC_DEFAULT_OPUS_MODEL"
claude --model haiku
```

Expected Opus export:

```bash
us.anthropic.claude-opus-4-6-v1
```

If `/model` still has several built-in entries, that is Claude Code's own selector. Brain-owned launchers use the `haiku` alias by default and the generated Bedrock env controls the clean custom labels. Do not select Opus 4.7 until the AWS account has Bedrock access for that model.

## Related files

- `tools/scripts/models-sync-bedrock.sh`
- `tools/scripts/models-validate.sh`
- `tools/scripts/claude-bedrock-env.sh`
- `tools/scripts/bedrock-models.generated.sh`
- `tools/scripts/repos.sh`
- `tools/scripts/sessions.sh`
- `ai/models/bedrock-models.generated.json`
- `operations/system-configs/shell/.zprofile`
- `operations/system-configs/shell/.zshrc`
- `ai/policy/routing.md`
- `operations/system-configs/claude/agents/deep-architect.md`

Last updated: 2026-05-24
