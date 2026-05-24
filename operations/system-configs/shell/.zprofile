# Homebrew Apple Silicon
if [[ -x /opt/homebrew/bin/brew ]]; then
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

BRAIN_CLAUDE_BEDROCK_ENV="$HOME/Repos/stevewesthoek/brain/tools/scripts/claude-bedrock-env.sh"
[[ -f "$BRAIN_CLAUDE_BEDROCK_ENV" ]] && source "$BRAIN_CLAUDE_BEDROCK_ENV"
unset BRAIN_CLAUDE_BEDROCK_ENV
