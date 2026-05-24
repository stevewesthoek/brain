#!/usr/bin/env bash
# ai-auto-route.sh — choose the interactive AI runtime for a repo session.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
Usage:
  ai-auto-route.sh [--repo PATH] [--prompt TEXT] [--print-tool] [--exec]

Chooses Claude, Codex, or Gemini for an interactive repo session.
This routes the agent runtime only; app/workflow model calls still go through
the AI Model Selector.
EOF
}

REPO_PATH="$PWD"
PROMPT=""
PRINT_TOOL=0
EXEC_TOOL=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_PATH="${2:-}"
      shift 2
      ;;
    --prompt)
      PROMPT="${2:-}"
      shift 2
      ;;
    --print-tool)
      PRINT_TOOL=1
      shift
      ;;
    --exec)
      EXEC_TOOL=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$REPO_PATH" || ! -d "$REPO_PATH" ]]; then
  echo "Invalid repo path: $REPO_PATH" >&2
  exit 2
fi

choose_tool() {
  python3 - "$REPO_PATH" "$PROMPT" <<'PY'
import os
import re
import sys

repo = os.path.abspath(sys.argv[1])
prompt = sys.argv[2].lower()

def has_file(*parts):
    return os.path.exists(os.path.join(repo, *parts))

def count_files(limit=700):
    total = 0
    for root, dirs, files in os.walk(repo):
        dirs[:] = [d for d in dirs if d not in {'.git', 'node_modules', 'dist', 'build', '.next', '.venv', 'vendor'}]
        total += len(files)
        if total > limit:
            return total
    return total

large_context_words = {
    'summarize', 'summarise', 'ingest', 'analyze all', 'analyse all',
    'large context', 'huge', 'entire repo', 'all logs', 'full log',
}
review_words = {'review', 'diff', 'pr', 'second opinion', 'sanity check'}
small_exec_words = {'fix this', 'small fix', 'isolated', 'one file', 'quick patch'}
architecture_words = {'architecture', 'orchestrate', 'multi-file', 'repo-wide', 'implement', 'build', 'refactor'}

has_handoff = has_file('.ai', 'current.md') or has_file('CURRENT-HANDOFF.md') or has_file('handoff.md')
has_brain_or_mind_context = os.path.basename(repo) in {'brain', 'mind'} or has_file('AGENTS.md') or has_file('CLAUDE.md')

def contains_any(words):
    return any(word in prompt for word in words)

if contains_any(large_context_words):
    tool = 'Gemini'
    reason = 'large-context preprocessing is likely the cheapest first step'
elif contains_any(review_words) or contains_any(small_exec_words):
    tool = 'Codex'
    reason = 'isolated review or small execution fits Codex'
elif contains_any(architecture_words) or has_handoff or has_brain_or_mind_context:
    tool = 'Claude'
    reason = 'repo context, handoff, or multi-step work fits Claude'
else:
    tool = 'Claude'
    reason = 'default interactive orchestrator'

print(f'{tool}\t{reason}')
PY
}

decision="$(choose_tool)"
TOOL="${decision%%$'\t'*}"
REASON="${decision#*$'\t'}"

if [[ "$PRINT_TOOL" == "1" ]]; then
  printf '%s\n' "$TOOL"
  exit 0
fi

printf 'Auto selected: %s (%s)\n' "$TOOL" "$REASON" >&2

if [[ "$EXEC_TOOL" != "1" ]]; then
  exit 0
fi

cd "$REPO_PATH"
case "$TOOL" in
  Claude)
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/claude-bedrock-env.sh"
    exec claude --model "${ANTHROPIC_DEFAULT_SONNET_MODEL:-sonnet}"
    ;;
  Codex) exec codex ;;
  Gemini) exec gemini ;;
  *)
    echo "Unsupported tool: $TOOL" >&2
    exit 1
    ;;
esac
