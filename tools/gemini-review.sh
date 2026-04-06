#!/usr/bin/env bash
# gemini-review.sh — large-context preprocessing and analysis via Gemini CLI
#
# Usage:
#   gemini-review.sh '<prompt>'        # flash tier (default) — free, 1M token context
#   gemini-review.sh '<prompt>' flash  # flash tier (explicit)
#   gemini-review.sh '<prompt>' pro    # pro tier — deeper reasoning, limited free quota (~50 RPD)
#
# Tier routing:
#   flash → gemini-2.5-flash — fast, free, 1M token context — DEFAULT
#   pro   → gemini-2.5-pro   — deep reasoning, limited free tier
#
# Primary use case: preprocess large inputs into compact summaries for Claude/Codex.
# This reduces token costs on paid engines by doing the heavy lifting on free Flash.

set -euo pipefail

if ! command -v gemini >/dev/null 2>&1; then
  echo "ERROR: gemini CLI is not installed or not in PATH." >&2
  echo "Install with: npm install -g @google/gemini-cli" >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: gemini-review.sh '<prompt>' [flash|pro]" >&2
  exit 1
fi

INPUT="$1"
TIER="${2:-flash}"
MAX_CHARS=500000

if [ "${#INPUT}" -gt "$MAX_CHARS" ]; then
  INPUT="${INPUT:0:$MAX_CHARS}"
fi

PROMPT="You are acting as a large-context analysis engine in a multi-AI workflow.

Your job:
- process the provided content thoroughly using your full context window
- produce a compact, structured summary that another AI (Claude or Codex) can act on efficiently
- identify key findings, patterns, issues, or relevant information
- be concise — your output will be used as input for downstream AI work
- prefer bullet points and structured sections over prose
- do not include filler or preamble

Important constraints:
- you are a preprocessing step, not the final decision maker
- do not invent context that wasn't provided
- focus on what is actionable or important
- if the input is code: identify structure, patterns, bugs, risks
- if the input is logs: extract errors, anomalies, key events
- if the input is documents: extract key facts, decisions, requirements

Content to analyze:

$INPUT"

case "$TIER" in
  pro)
    echo "[gemini-review] tier=pro (deep reasoning, ~50 RPD free quota)" >&2
    printf '%s' "$PROMPT" | gemini --model gemini-2.5-pro
    ;;
  flash|*)
    echo "[gemini-review] tier=flash (free, 1M token context)" >&2
    printf '%s' "$PROMPT" | gemini --model gemini-2.5-flash
    ;;
esac
