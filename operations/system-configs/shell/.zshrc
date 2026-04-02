# Tailscale
alias cloudpanel='tailscale ssh master@cloudpanel'

# Homebrew (Apple Silicon)
eval "$(/opt/homebrew/bin/brew shellenv)"

# nvm
export NVM_DIR="$HOME/.nvm"
source "$(brew --prefix nvm)/nvm.sh"

# Added by Antigravity
export PATH="/Users/Office/.antigravity/antigravity/bin:$PATH"

# Avoid unknown terminals on Linux servers
export TERM=xterm-256color

eval "$(starship init zsh)"
alias dokploy='ssh dokploy'
alias dokploy='ssh dokploy'
alias dokploy="ssh dokploy"
alias supabase="ssh supabase"
setopt interactivecomments

# Added by Antigravity
export PATH="/Users/Office/.antigravity/antigravity/bin:$PATH"

# Added by Antigravity
export PATH="/Users/Office/.antigravity/antigravity/bin:$PATH"

# Added by Antigravity
export PATH="/Users/Office/.antigravity/antigravity/bin:$PATH"
export PATH="$HOME:$PATH"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/Users/Office/.lmstudio/bin"
# End of LM Studio CLI section

alias probot="ssh probot"
alias ubuntu="ssh ubuntu"
export PATH="$HOME/.local/bin:$PATH"
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

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Local-only secrets and machine-specific credentials
LOCAL_SHELL_ENV="$HOME/Repos/stevewesthoek/brain/operations/system-configs/shell/.zshrc.local"
[[ -f "$LOCAL_SHELL_ENV" ]] && source "$LOCAL_SHELL_ENV"

# Repo picker — repo-claude opens Claude, repo-codex opens Codex
repo-claude() {
  local repo_path
  repo_path=$(bash ~/Repos/stevewesthoek/brain/tools/scripts/repo-picker.sh)
  [[ -z "$repo_path" ]] && return 0
  cd "$repo_path" && claude
}

repo-codex() {
  local repo_path
  repo_path=$(bash ~/Repos/stevewesthoek/brain/tools/scripts/repo-picker.sh)
  [[ -z "$repo_path" ]] && return 0
  cd "$repo_path" && codex
}

# Session picker — session-claude for Claude, session-codex for Codex
session-claude() {
  bash ~/Repos/stevewesthoek/brain/tools/scripts/claude-session-picker.sh
}

session-codex() {
  bash ~/Repos/stevewesthoek/brain/tools/scripts/codex-session-picker.sh
}
