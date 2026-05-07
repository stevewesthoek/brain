#!/usr/bin/env bash
# rtk-safe-bash-hook.sh — PreToolUse(Bash)
# Preserve brain's risky-command guard, then let RTK rewrite safe shell output
# to compact token-saving equivalents.

set -euo pipefail

INPUT=$(cat)
GUARD="$HOME/.claude/hooks/check-risky-command.sh"

if [ -x "$GUARD" ]; then
  GUARD_OUTPUT=$(printf '%s' "$INPUT" | "$GUARD" 2>/dev/null || true)

  # The guard returns "{}" for ordinary allow. Any richer response is a
  # permission decision or notice that should not be bypassed by RTK.
  if [ -n "$GUARD_OUTPUT" ] && [ "$GUARD_OUTPUT" != "{}" ]; then
    printf '%s\n' "$GUARD_OUTPUT"
    exit 0
  fi
fi

if command -v rtk >/dev/null 2>&1; then
  RTK_OUTPUT=$(printf '%s' "$INPUT" | rtk hook claude 2>/dev/null || true)
  if [ -n "$RTK_OUTPUT" ]; then
    printf '%s\n' "$RTK_OUTPUT"
    exit 0
  fi
fi

printf '{}\n'
