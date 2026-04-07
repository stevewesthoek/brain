# Tailscale
alias cloudpanel='tailscale ssh master@cloudpanel'

# Homebrew (Apple Silicon)
eval "$(/opt/homebrew/bin/brew shellenv)"

# nvm
export NVM_DIR="$HOME/.nvm"
source "$(brew --prefix nvm)/nvm.sh"

# Added by Antigravity
export PATH="/Users/Office/.antigravity/antigravity/bin:$PATH"

# Avoid unknown terminals on Linux servers — but do NOT override when Ghostty has already set TERM
# (overriding locally breaks readline cursor/width calculations in Ghostty)
# Original line was: export TERM=xterm-256color
[[ "$TERM" == "xterm-ghostty" ]] || export TERM=xterm-256color

eval "$(starship init zsh)"

alias dokploy="ssh dokploy"
alias supabase="ssh supabase"
alias probot="ssh probot"
alias ubuntu="ssh ubuntu"

setopt interactivecomments

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/Office/.lmstudio/bin"
# End of LM Studio CLI section

export PATH="$HOME/.local/bin:$PATH"

export CLAUDE_CODE_USE_BEDROCK=1
export AWS_REGION=us-east-1

export ANTHROPIC_DEFAULT_OPUS_MODEL='us.anthropic.claude-opus-4-6-v1'
export ANTHROPIC_DEFAULT_SONNET_MODEL='us.anthropic.claude-sonnet-4-6'
export ANTHROPIC_DEFAULT_HAIKU_MODEL='us.anthropic.claude-haiku-4-5-20251001-v1:0'

# bun completions
[ -s "/Users/Office/.bun/_bun" ] && source "/Users/Office/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Local-only secrets and machine-specific credentials
LOCAL_SHELL_ENV="$HOME/Repos/stevewesthoek/brain/operations/system-configs/shell/.zshrc.local"
[[ -f "$LOCAL_SHELL_ENV" ]] && source "$LOCAL_SHELL_ENV"

# Unified pickers — one command for both AI tools
repos() {
  bash ~/Repos/stevewesthoek/brain/tools/scripts/repos.sh
}

sessions() {
  bash ~/Repos/stevewesthoek/brain/tools/scripts/sessions.sh
}
