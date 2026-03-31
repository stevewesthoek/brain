#!/usr/bin/env bash
set -euo pipefail

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI is not installed or not in PATH." >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: codex-review.sh '<prompt or context>'" >&2
  exit 1
fi

INPUT="$1"
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

codex exec "$PROMPT" -s read-only -c 'model_reasoning_effort="high"'
