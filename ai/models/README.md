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

New login/interactive shells source the generated exports through Brain's shell config. In an already-open shell, source the generated exports before starting Claude Code so `/model` sees the latest resolved Bedrock IDs:

```bash
source tools/scripts/bedrock-models.generated.sh
claude
```

## Current resolved model map

```json
{
  "opus": "us.anthropic.claude-opus-4-7",
  "sonnet": "us.anthropic.claude-sonnet-4-6",
  "haiku": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
```

## Pinned fallback models

These are safe defaults used when AWS discovery fails or returns stale/missing models:

```json
{
  "opus": "us.anthropic.claude-opus-4-7",
  "sonnet": "us.anthropic.claude-sonnet-4-6",
  "haiku": "us.anthropic.claude-haiku-4-5-20251001-v1:0"
}
```

The sync script must never silently downgrade Opus below the pinned fallback. If AWS discovery returns an older Opus, the pinned fallback wins and the command prints a warning.

## Agent assignments

| Agent | Current model | Tier |
|---|---|---|
| `cheap-prep` | `haiku` | Haiku |
| `coder-default` | `sonnet` | Sonnet |
| `deep-architect` | `opus` | Opus |

The exact Bedrock IDs come from `tools/scripts/bedrock-models.generated.sh`, not from agent frontmatter.

## Configuration options

```bash
# Region, default us-east-1
AWS_REGION=us-west-2 npm run models:sync:bedrock

# AWS profile
AWS_PROFILE=work npm run models:sync:bedrock

# Force pinned models
PREFER_PINNED_MODELS=1 npm run models:sync:bedrock

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
    "bedrock:ListFoundationModels"
  ],
  "Resource": "*"
}
```

If IAM or SCP policy blocks discovery, the command warns and keeps pinned fallbacks.

## Troubleshooting `/model`

Claude Code's `/model` selector includes built-in Claude options that the Brain repo cannot remove. The repo controls the custom/default Bedrock environment values, not Claude Code's built-in menu list.

After syncing, restart Claude Code from a shell where the generated exports have been sourced:

```bash
source tools/scripts/bedrock-models.generated.sh
echo "$ANTHROPIC_DEFAULT_OPUS_MODEL"
claude
```

Expected Opus export:

```bash
us.anthropic.claude-opus-4-7
```

If `/model` still has several Opus entries, that is Claude Code's built-in selector. Use the Opus 4.7/default entry and ignore older built-ins such as Opus 4.1, Opus 4.6, or long-context Opus 4.6. If the custom environment value still shows an older Opus 4.6 ID, the running Claude Code process was started with stale environment variables; exit it, open a new shell, or source the generated script, then start Claude Code again.

## Related files

- `tools/scripts/models-sync-bedrock.sh`
- `tools/scripts/models-validate.sh`
- `tools/scripts/bedrock-models.generated.sh`
- `ai/models/bedrock-models.generated.json`
- `operations/system-configs/shell/.zprofile`
- `operations/system-configs/shell/.zshrc`
- `ai/policy/routing.md`
- `operations/system-configs/claude/agents/deep-architect.md`

Last updated: 2026-05-23
