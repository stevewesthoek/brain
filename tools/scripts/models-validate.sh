#!/bin/bash
# models-validate.sh
# Validate that the Bedrock model router resolves exactly one model per Claude tier.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AGENTS_DIR="$SCRIPT_DIR/operations/system-configs/claude/agents"
MODELS_DIR="$SCRIPT_DIR/ai/models"
CACHE_FILE="$MODELS_DIR/bedrock-models.generated.json"
ENV_FILE="$SCRIPT_DIR/tools/scripts/bedrock-models.generated.sh"

FALLBACK_OPUS="us.anthropic.claude-opus-4-7"
FALLBACK_SONNET="us.anthropic.claude-sonnet-4-6"
FALLBACK_HAIKU="us.anthropic.claude-haiku-4-5-20251001-v1:0"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}ℹ${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*" >&2; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }

version_key() {
  local model_id="$1"
  echo "$model_id" \
    | sed -E 's/.*claude-[a-z]+-//' \
    | sed -E 's/[^0-9]+/./g; s/^\.//; s/\.$//'
}

compare_models() {
  local left="$1"
  local right="$2"
  local left_key right_key
  left_key="$(version_key "$left")"
  right_key="$(version_key "$right")"

  if [[ "$left_key" == "$right_key" ]]; then
    echo 0
  elif [[ "$(printf '%s\n%s\n' "$left_key" "$right_key" | sort -V | tail -n1)" == "$left_key" ]]; then
    echo 1
  else
    echo -1
  fi
}

get_agent_model() {
  local agent_file="$1"
  if [[ -f "$agent_file" ]]; then
    grep '^model:' "$agent_file" | awk '{print $2}' | head -1
  fi
}

require_model() {
  local tier="$1"
  local value="$2"
  if [[ -z "$value" || "$value" == "null" ]]; then
    log_error "$tier model is empty"
    return 1
  fi
  if [[ "$value" != us.anthropic.* ]]; then
    log_error "$tier model is not a Bedrock geo inference/profile ID: $value"
    return 1
  fi
}

main() {
  log_info "Validating Bedrock model router"
  echo ""

  if [[ ! -f "$CACHE_FILE" ]]; then
    log_error "Cache file not found: $CACHE_FILE"
    log_info "Run: npm run models:sync:bedrock"
    exit 1
  fi

  local opus sonnet haiku opus_src sonnet_src haiku_src
  opus="$(jq -r '.models.opus' "$CACHE_FILE" 2>/dev/null || true)"
  sonnet="$(jq -r '.models.sonnet' "$CACHE_FILE" 2>/dev/null || true)"
  haiku="$(jq -r '.models.haiku' "$CACHE_FILE" 2>/dev/null || true)"
  opus_src="$(jq -r '.sources.opus // "unknown"' "$CACHE_FILE" 2>/dev/null || true)"
  sonnet_src="$(jq -r '.sources.sonnet // "unknown"' "$CACHE_FILE" 2>/dev/null || true)"
  haiku_src="$(jq -r '.sources.haiku // "unknown"' "$CACHE_FILE" 2>/dev/null || true)"

  local valid=0
  require_model Opus "$opus" || valid=1
  require_model Sonnet "$sonnet" || valid=1
  require_model Haiku "$haiku" || valid=1

  if [[ "$(compare_models "$opus" "$FALLBACK_OPUS")" == "-1" ]]; then
    log_error "Resolved Opus is older than pinned fallback: $opus < $FALLBACK_OPUS"
    valid=1
  fi

  if [[ "$sonnet" != "$FALLBACK_SONNET" ]]; then
    log_warn "Sonnet differs from pinned fallback: $sonnet (fallback: $FALLBACK_SONNET)"
  fi

  if [[ "$haiku" != "$FALLBACK_HAIKU" ]]; then
    log_warn "Haiku differs from pinned fallback: $haiku (fallback: $FALLBACK_HAIKU)"
  fi

  local cheap_prep_model coder_default_model deep_architect_model
  cheap_prep_model="$(get_agent_model "$AGENTS_DIR/cheap-prep.md")"
  coder_default_model="$(get_agent_model "$AGENTS_DIR/coder-default.md")"
  deep_architect_model="$(get_agent_model "$AGENTS_DIR/deep-architect.md")"

  log_info "Agent model assignments:"
  echo "  • cheap-prep:     $cheap_prep_model"
  echo "  • coder-default:  $coder_default_model"
  echo "  • deep-architect: $deep_architect_model"
  echo ""

  if [[ "$deep_architect_model" != "$opus" ]]; then
    log_warn "deep-architect model differs from resolved Opus cache: $deep_architect_model vs $opus"
  fi

  log_info "Resolved Bedrock model map:"
  echo "  • Opus:   $opus [$opus_src]"
  echo "  • Sonnet: $sonnet [$sonnet_src]"
  echo "  • Haiku:  $haiku [$haiku_src]"
  echo ""

  if [[ -f "$ENV_FILE" ]]; then
    log_success "Claude Code export file exists: $ENV_FILE"
  else
    log_warn "Claude Code export file missing: $ENV_FILE"
    log_info "Run: npm run models:sync:bedrock"
  fi

  if [[ -n "${ANTHROPIC_DEFAULT_OPUS_MODEL:-}" && "${ANTHROPIC_DEFAULT_OPUS_MODEL}" != "$opus" ]]; then
    log_warn "Current shell ANTHROPIC_DEFAULT_OPUS_MODEL is stale: ${ANTHROPIC_DEFAULT_OPUS_MODEL}"
    log_info "Source generated exports before starting Claude Code: source tools/scripts/bedrock-models.generated.sh"
  fi

  if [[ $valid -ne 0 ]]; then
    log_error "Validation failed"
    exit 1
  fi

  log_success "Validation complete"
  echo ""
  echo "To update Claude Code's /model selector in a new session:"
  echo "  source tools/scripts/bedrock-models.generated.sh"
  echo "  claude"
}

main "$@"
