#!/usr/bin/env bash
# Sourceable Claude Code Bedrock environment.
#
# Keep this as the single launcher-time source of truth for Claude Code model
# exports. The generated file is produced by models-sync-bedrock.sh from AWS
# discovery + access probes; the literals below are emergency fallbacks only.

export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="${AWS_REGION:-us-east-1}"

if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  _CLAUDE_BEDROCK_ENV_PATH="${BASH_SOURCE[0]}"
else
  _CLAUDE_BEDROCK_ENV_PATH="${(%):-%N}"
fi

_CLAUDE_BEDROCK_SCRIPT_DIR="$(cd "$(dirname "$_CLAUDE_BEDROCK_ENV_PATH")" && pwd)"
_CLAUDE_BEDROCK_MODELS_ENV="$_CLAUDE_BEDROCK_SCRIPT_DIR/bedrock-models.generated.sh"

if [[ -f "$_CLAUDE_BEDROCK_MODELS_ENV" ]]; then
  # shellcheck source=/dev/null
  source "$_CLAUDE_BEDROCK_MODELS_ENV"
else
  export ANTHROPIC_DEFAULT_OPUS_MODEL="${ANTHROPIC_DEFAULT_OPUS_MODEL:-us.anthropic.claude-opus-4-6-v1}"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="${ANTHROPIC_DEFAULT_SONNET_MODEL:-us.anthropic.claude-sonnet-4-6}"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="${ANTHROPIC_DEFAULT_HAIKU_MODEL:-us.anthropic.claude-haiku-4-5-20251001-v1:0}"
fi

# Guard against stale shells or old generated files selecting the inaccessible
# Opus 4.7 profile. Remove this only after the AWS account can invoke Opus 4.7.
if [[ "${ALLOW_UNAVAILABLE_OPUS_47:-0}" != "1" && "${ANTHROPIC_DEFAULT_OPUS_MODEL:-}" == *"opus-4-7"* ]]; then
  export ANTHROPIC_DEFAULT_OPUS_MODEL="us.anthropic.claude-opus-4-6-v1"
fi

export ANTHROPIC_DEFAULT_OPUS_MODEL
export ANTHROPIC_DEFAULT_SONNET_MODEL
export ANTHROPIC_DEFAULT_HAIKU_MODEL

unset _CLAUDE_BEDROCK_ENV_PATH
unset _CLAUDE_BEDROCK_SCRIPT_DIR
unset _CLAUDE_BEDROCK_MODELS_ENV
