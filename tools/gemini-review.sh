#!/usr/bin/env bash
# gemini-review.sh — free-first preprocessing and analysis via Gemini CLI
#
# Usage:
#   gemini-review.sh '<prompt>'           # lite tier (default)
#   gemini-review.sh '<prompt>' lite
#   gemini-review.sh '<prompt>' flash
#   gemini-review.sh '<prompt>' pro
#
# Tier routing:
#   lite  -> gemini-2.5-flash-lite   — default free preprocessor for triage, repo mapping, compression
#   flash -> gemini-2.5-flash        — stronger free synthesis for long-context analysis
#   pro   -> gemini-2.5-pro          — deep reasoning only when truly justified
#
# Primary use cases:
# - repo mapping
# - file triage
# - summarization
# - test/log triage
# - stack trace clustering
# - prompt compression
# - implementation briefing
# - selecting the smallest viable next agent
#
# Policy:
# - Prefer Gemini before paid models for breadth-first work
# - Prefer structured extraction over prose
# - Use stable model IDs where possible

set -euo pipefail

if ! command -v gemini >/dev/null 2>&1; then
  echo "ERROR: gemini CLI is not installed or not in PATH." >&2
  echo "Install with: npm install -g @google/gemini-cli" >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: gemini-review.sh '<prompt>' [lite|flash|pro]" >&2
  exit 1
fi

INPUT="$1"
TIER="${2:-lite}"
MAX_CHARS=500000

if [ "${#INPUT}" -gt "$MAX_CHARS" ]; then
  INPUT="${INPUT:0:$MAX_CHARS}"
fi

PROMPT="You are a free-first analysis engine in a multi-AI workflow.

Your job:
- process the provided content thoroughly
- produce a compact, structured output that another AI (Claude or Codex) can act on efficiently
- identify key findings, patterns, issues, dependencies, and relevant files
- extract only what matters
- be concise
- prefer bullet points and structured sections over prose
- do not include filler or preamble

Output format:
- Task summary
- Relevant files or areas
- Key findings
- Constraints
- Risks
- Open questions
- Recommended next step
- Recommended next agent

Important constraints:
- you are a preprocessing and triage step, not the final authority
- do not invent context that was not provided
- prefer compression and extraction over explanation
- if the input is code: identify structure, patterns, likely bugs, and risky areas
- if the input is logs: extract errors, anomalies, clusters, and likely causes
- if the input is documents: extract key facts, decisions, requirements, and actions
- if the input is broad or messy: create a bounded work order for the next agent
- prefer selecting the smallest viable next agent over escalating by habit

Content to analyze:

$INPUT"

run_gemini() {
  local model="$1"
  printf '%s' "$PROMPT" | gemini --model "$model"
}

case "$TIER" in
  lite)
    echo "[gemini-review] tier=lite (gemini-2.5-flash-lite)" >&2
    run_gemini "gemini-2.5-flash-lite"
    ;;
  flash)
    echo "[gemini-review] tier=flash (gemini-2.5-flash)" >&2
    run_gemini "gemini-2.5-flash"
    ;;
  pro)
    echo "[gemini-review] tier=pro (gemini-2.5-pro)" >&2
    run_gemini "gemini-2.5-pro"
    ;;
  *)
    echo "ERROR: unknown tier '$TIER'. Use one of: lite, flash, pro." >&2
    exit 1
    ;;
esac