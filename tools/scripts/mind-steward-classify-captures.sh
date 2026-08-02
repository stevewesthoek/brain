#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${MIND_STEWARD_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
STEWARD_DIR="${MIND_STEWARD_DIR:-$REPO_ROOT/projects/mind-steward}"
MIND_ROOT="${MIND_STEWARD_MIND_ROOT:-$HOME/Repos/stevewesthoek/mind}"
OUTPUT_DIR="${MIND_STEWARD_RUNTIME_DIR:-$REPO_ROOT/runtime/local/mind-steward}"
JSON_OUTPUT="$OUTPUT_DIR/classify-latest.json"
MD_OUTPUT="$OUTPUT_DIR/classify-latest.md"
CLI_PATH="$STEWARD_DIR/src/cli/classify-captures.ts"

MODE="dry-run"
case "$#" in
  0)
    ;;
  1)
    case "$1" in
      --mode=dry-run) MODE="dry-run" ;;
      --mode=apply) MODE="apply" ;;
      *)
        echo "usage: $0 [--mode=dry-run|--mode=apply]" >&2
        exit 64
        ;;
    esac
    ;;
  2)
    if [[ "$1" == "--mode" && ( "$2" == "dry-run" || "$2" == "apply" ) ]]; then
      MODE="$2"
    else
      echo "usage: $0 [--mode=dry-run|--mode=apply]" >&2
      exit 64
    fi
    ;;
  *)
    echo "usage: $0 [--mode=dry-run|--mode=apply]" >&2
    exit 64
    ;;
esac

mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"

ARGS=(
  npx --yes --prefix "$STEWARD_DIR" tsx "$CLI_PATH"
  --mind-root "$MIND_ROOT"
  --output-json "$JSON_OUTPUT"
  --output-md "$MD_OUTPUT"
  --mode "$MODE"
)

if [[ -n "${AI_SELECTOR_URL:-}" ]]; then
  ARGS+=(--selector-url "$AI_SELECTOR_URL")
fi

if [[ -n "${MIND_STEWARD_CLASSIFY_LIMIT:-}" ]]; then
  ARGS+=(--limit "$MIND_STEWARD_CLASSIFY_LIMIT")
fi

"${ARGS[@]}"
chmod 600 "$JSON_OUTPUT" "$MD_OUTPUT"
