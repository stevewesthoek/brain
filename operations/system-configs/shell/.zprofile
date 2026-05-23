# Homebrew Apple Silicon
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION="${AWS_REGION:-us-east-1}"

BRAIN_BEDROCK_MODELS_ENV="$HOME/Repos/stevewesthoek/brain/tools/scripts/bedrock-models.generated.sh"
if [[ -f "$BRAIN_BEDROCK_MODELS_ENV" ]]; then
  source "$BRAIN_BEDROCK_MODELS_ENV"
else
  export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-7'
  export ANTHROPIC_DEFAULT_SONNET_MODEL='us.anthropic.claude-sonnet-4-6'
  export ANTHROPIC_DEFAULT_HAIKU_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'
fi
unset BRAIN_BEDROCK_MODELS_ENV
