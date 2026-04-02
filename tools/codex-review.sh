#!/usr/bin/env bash
# codex-review.sh — secondary code review via Codex CLI
#
# Usage:
#   codex-review.sh '<prompt>'           # standard tier (default)
#   codex-review.sh '<prompt>' mini      # mini tier — fast, cheap, simple review
#   codex-review.sh '<prompt>' standard  # standard tier (explicit)
#   codex-review.sh '<prompt>' max       # max tier — deep reasoning, expensive
#
# Tier routing:
#   mini     → codex-mini-latest, reasoning_effort="low"   — quick pass, obvious issues
#   standard → config default,    reasoning_effort="high"  — normal second opinion
#   max      → config default,    reasoning_effort="xhigh" — deep review, risky code

set -euo pipefail

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI is not installed or not in PATH." >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: codex-review.sh '<prompt>' [mini|standard|max]" >&2
  exit 1
fi

INPUT="$1"
TIER="${2:-standard}"
MAX_CHARS=12000

if [ "${#INPUT}" -gt "$MAX_CHARS" ]; then
  INPUT="${INPUT:0:$MAX_CHARS}"
fi

PROMPT="You are acting as a strict secondary code reviewer.

Your job:
- review the proposed code, plan, or debugging context
- identify likely bugs, weak assumptions, missing edge cases, or simpler alternatives
- be concise and practical
- do not rewrite everything unless necessary
- prefer short bullet points
- if the code looks fine, say so clearly

Important constraints:
- this is a second-opinion pass
- do not assume hidden context
- do not invent files or APIs
- focus on correctness, risk, and implementation quality

Context to review:

$INPUT"

case "$TIER" in
  mini)
    echo "[codex-review] tier=mini (fast, cheap)" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model="codex-mini-latest"' \
      -c 'model_reasoning_effort="low"'
    ;;
  max)
    echo "[codex-review] tier=max (deep reasoning)" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model_reasoning_effort="xhigh"'
    ;;
  standard|*)
    echo "[codex-review] tier=standard" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model_reasoning_effort="high"'
    ;;
esac
