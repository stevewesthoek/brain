#!/usr/bin/env bash
# codex-review.sh — secondary code review via Codex CLI
#
# Usage:
#   codex-review.sh '<prompt>'              # default tier
#   codex-review.sh '<prompt>' cheap
#   codex-review.sh '<prompt>' default
#   codex-review.sh '<prompt>' hard
#   codex-review.sh '<prompt>' risk
#   codex-review.sh '<prompt>' critical
#
# Tier routing:
#   cheap    -> gpt-5.4-mini, low effort      — tiny edits, narrow checks
#   default  -> gpt-5.4-mini, medium effort   — DEFAULT; normal code review/debugging
#   hard     -> gpt-5.4-mini, high effort     — weird bugs, subtle breakage, multi-file refactors
#   risk     -> gpt-5.4, low/medium effort    — auth, migrations, prod-touching decisions
#   critical -> gpt-5.4, high effort          — rare panic-room use only
#
# Policy:
# - Start on the cheapest tier that plausibly fits the task
# - Escalate effort first, model second
# - Keep output terse and structured

set -euo pipefail

if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI is not installed or not in PATH." >&2
  exit 1
fi

if [ "$#" -lt 1 ]; then
  echo "Usage: codex-review.sh '<prompt>' [cheap|default|hard|risk|critical]" >&2
  exit 1
fi

INPUT="$1"
TIER="${2:-default}"
MAX_CHARS=12000

if [ "${#INPUT}" -gt "$MAX_CHARS" ]; then
  INPUT="${INPUT:0:$MAX_CHARS}"
fi

PROMPT="You are acting as a strict secondary code reviewer.

Your job:
- review the proposed code, plan, diff, or debugging context
- identify likely bugs, weak assumptions, missing edge cases, and simpler alternatives
- focus on correctness, risk, and implementation quality
- be concise and practical
- prefer short bullet points
- if the code looks fine, say so clearly

Output format:
- Verdict
- Key risks
- Missing checks
- Simpler option
- Next step

Important constraints:
- this is a second-opinion pass
- do not assume hidden context
- do not invent files, APIs, or requirements
- do not rewrite everything unless necessary
- avoid narrative prose

Context to review:

$INPUT"

run_codex() {
  local model="$1"
  local effort="$2"

  codex exec "$PROMPT" -s read-only \
    -c "model=\"$model\"" \
    -c "model_reasoning_effort=\"$effort\"" \
    -c 'model_verbosity="low"'
}

case "$TIER" in
  cheap)
    echo "[codex-review] tier=cheap (gpt-5.4-mini, low effort)" >&2
    run_codex "gpt-5.4-mini" "low"
    ;;
  default)
    echo "[codex-review] tier=default (gpt-5.4-mini, medium effort)" >&2
    run_codex "gpt-5.4-mini" "medium"
    ;;
  hard)
    echo "[codex-review] tier=hard (gpt-5.4-mini, high effort)" >&2
    run_codex "gpt-5.4-mini" "high"
    ;;
  risk)
    echo "[codex-review] tier=risk (gpt-5.4, medium effort)" >&2
    run_codex "gpt-5.4" "medium"
    ;;
  critical)
    echo "[codex-review] tier=critical (gpt-5.4, high effort)" >&2
    run_codex "gpt-5.4" "high"
    ;;
  *)
    echo "ERROR: unknown tier '$TIER'. Use one of: cheap, default, hard, risk, critical." >&2
    exit 1
    ;;
esac