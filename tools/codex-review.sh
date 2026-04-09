#!/usr/bin/env bash
# codex-review.sh — secondary code review via Codex CLI
#
# Usage:
#   codex-review.sh '<prompt>'           # low tier (default — start here, escalate if needed)
#   codex-review.sh '<prompt>' low       # low tier (explicit)
#   codex-review.sh '<prompt>' mini      # mini tier — codex-mini-latest, fast sanity check
#   codex-review.sh '<prompt>' standard  # standard tier — escalate when low is insufficient
#   codex-review.sh '<prompt>' max       # max tier — deep reasoning, high-stakes code
#
# Escalation ladder (start low, escalate when struggling):
#   low      → gpt-5.4, reasoning_effort="low"   — DEFAULT; most tasks start here
#   mini     → codex-mini-latest, reasoning_effort="low" — fast parallel filler only
#   standard → gpt-5.4, reasoning_effort="medium"  — escalate when low is insufficient
#   max      → gpt-5.4, reasoning_effort="xhigh" — auth, migrations, prod-touching

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
TIER="${2:-low}"
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
    echo "[codex-review] tier=mini (fast parallel filler — codex-mini-latest)" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model="codex-mini-latest"' \
      -c 'model_reasoning_effort="low"'
    ;;
  standard)
    echo "[codex-review] tier=standard (escalated — gpt-5.4, medium effort)" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model_reasoning_effort="medium"'
    ;;
  max)
    echo "[codex-review] tier=max (deep reasoning — gpt-5.4, xhigh effort)" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model_reasoning_effort="xhigh"'
    ;;
  low|*)
    echo "[codex-review] tier=low (default — gpt-5.4, low effort)" >&2
    codex exec "$PROMPT" -s read-only \
      -c 'model_reasoning_effort="low"'
    ;;
esac
