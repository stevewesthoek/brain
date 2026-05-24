# Homebrew (Apple Silicon)
eval "$(/opt/homebrew/bin/brew shellenv)"

# nvm

# Added by Antigravity
export PATH="$HOME/.antigravity/antigravity/bin:$PATH"

# Avoid unknown terminals on Linux servers — but do NOT override when Ghostty has already set TERM
# (overriding locally breaks readline cursor/width calculations in Ghostty)
# Original line was: export TERM=xterm-256color
[[ "$TERM" == "xterm-ghostty" ]] || export TERM=xterm-256color

export STARSHIP_LOG="error"

eval "$(starship init zsh)"

alias MacBook="ssh MacBook"
alias macbook="ssh macbook"
alias dokploy="ssh dokploy"
alias supabase="ssh supabase"
alias cloudpanel="ssh cloudpanel"

setopt interactivecomments

# Added by LM Studio CLI (lms)
export PATH="$PATH:$HOME/.lmstudio/bin"
# End of LM Studio CLI section

export PATH="$HOME/.local/bin:$PATH"

BRAIN_CLAUDE_BEDROCK_ENV="$HOME/Repos/stevewesthoek/brain/tools/scripts/claude-bedrock-env.sh"
[[ -f "$BRAIN_CLAUDE_BEDROCK_ENV" ]] && source "$BRAIN_CLAUDE_BEDROCK_ENV"
unset BRAIN_CLAUDE_BEDROCK_ENV

# bun completions
[ -s "$HOME/.bun/_bun" ] && source "$HOME/.bun/_bun"

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"

# Local-only secrets and machine-specific credentials
LOCAL_SHELL_ENV="$HOME/Repos/stevewesthoek/brain/operations/system-configs/shell/.zshrc.local"
[[ -f "$LOCAL_SHELL_ENV" ]] && source "$LOCAL_SHELL_ENV"

# Brain scripts and tools
export PATH="$HOME/Repos/stevewesthoek/brain/tools/scripts:$PATH"

claude() {
  local bedrock_env="$HOME/Repos/stevewesthoek/brain/tools/scripts/claude-bedrock-env.sh"
  [[ -f "$bedrock_env" ]] && source "$bedrock_env"

  local arg
  for arg in "$@"; do
    case "$arg" in
      --model|--model=*)
        command claude "$@"
        return
        ;;
    esac
  done

  case "${1:-}" in
    agents|auth|auto-mode|doctor|install|mcp|plugin|plugins|project|setup-token|ultrareview|update|upgrade|-h|--help|-v|--version)
      command claude "$@"
      ;;
    *)
      command claude --model haiku "$@"
      ;;
  esac
}

# Unified pickers — one command for both AI tools
repos() {
  bash ~/Repos/stevewesthoek/brain/tools/scripts/repos.sh
}

sessions() {
  bash ~/Repos/stevewesthoek/brain/tools/scripts/sessions.sh
}

jump() {
  local path=$($HOME/.local/bin/jump)
  if [[ -n "$path" && -d "$path" ]]; then
    cd "$path"
  fi
}

export PATH=$HOME/bin:$PATH


# nvm must load after all PATH mutations so nvm's Node wins over Homebrew Node.
export NVM_DIR="$HOME/.nvm"
if [[ -s "/opt/homebrew/opt/nvm/nvm.sh" ]]; then
  source "/opt/homebrew/opt/nvm/nvm.sh"
  nvm use --silent default >/dev/null 2>&1 || true
fi

# Force nvm's active Node bin to the front of PATH in zsh.
# This prevents /opt/homebrew/bin/node from hijacking node.
if [[ -n "$NVM_BIN" && -d "$NVM_BIN" ]]; then
  path=("$NVM_BIN" "${path[@]:#$NVM_BIN}")
  export PATH
fi

hash -r
