#!/bin/bash
# models-sync-bedrock.sh
# Sync Claude Code / Amazon Bedrock Claude model IDs.
# Safe behavior: never let stale AWS discovery or stale shell env downgrade pinned stable fallbacks.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODELS_DIR="$SCRIPT_DIR/ai/models"
CACHE_FILE="$MODELS_DIR/bedrock-models.generated.json"
EXPORT_FILE="$SCRIPT_DIR/tools/scripts/bedrock-models.generated.sh"
REGION="${AWS_REGION:-us-east-1}"
PROFILE="${AWS_PROFILE:-}"
ALLOW_PREVIEW_MODELS="${ALLOW_PREVIEW_MODELS:-0}"
PREFER_PINNED="${PREFER_PINNED_MODELS:-0}"

PINNED_OPUS="us.anthropic.claude-opus-4-7"
PINNED_SONNET="us.anthropic.claude-sonnet-4-6"
PINNED_HAIKU="us.anthropic.claude-haiku-4-5-20251001-v1:0"

mkdir -p "$MODELS_DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}ℹ${NC} $*"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $*"; }
log_error() { echo -e "${RED}✗${NC} $*" >&2; }
log_success() { echo -e "${GREEN}✓${NC} $*"; }

aws_bedrock_cmd() {
  local cmd=(aws bedrock)
  if [[ -n "$PROFILE" ]]; then
    cmd+=(--profile "$PROFILE")
  fi
  "${cmd[@]}" "$@"
}

version_key() {
  local model_id="$1"
  echo "$model_id" \
    | sed -E 's/.*claude-[a-z]+-//' \
    | sed -E 's/[^0-9]+/./g; s/^\.//; s/\.$//'
}

compare_models() {
  local left="$1"
  local right="$2"
  local left_key right_key newest
  left_key="$(version_key "$left")"
  right_key="$(version_key "$right")"

  if [[ -z "$left_key" && -z "$right_key" ]]; then
    echo 0
    return 0
  fi
  if [[ -z "$left_key" ]]; then
    echo -1
    return 0
  fi
  if [[ -z "$right_key" ]]; then
    echo 1
    return 0
  fi
  if [[ "$left_key" == "$right_key" ]]; then
    echo 0
    return 0
  fi

  newest="$(printf '%s\n%s\n' "$left_key" "$right_key" | sort -V | tail -n1)"
  if [[ "$newest" == "$left_key" ]]; then
    echo 1
  else
    echo -1
  fi
}

is_stable_model() {
  local model_id="$1"
  if [[ "$ALLOW_PREVIEW_MODELS" == "1" ]]; then
    return 0
  fi
  ! echo "$model_id" | grep -Eiq 'preview|beta|experimental|exp|rc|test|deprecated'
}

is_tier_model() {
  local model_id="$1"
  local tier="$2"
  [[ "$model_id" == us.anthropic.claude-"$tier"* || "$model_id" == anthropic.claude-"$tier"* || "$model_id" == claude-"$tier"* ]]
}

json_or_empty() {
  local raw="$1"
  if echo "$raw" | jq empty >/dev/null 2>&1; then
    echo "$raw"
  else
    echo '{}'
  fi
}

discover_json() {
  local foundation_json='{}'
  local profiles_json='{}'
  local foundation_ok=0
  local profiles_ok=0

  log_info "Discovering Bedrock models in region $REGION..." >&2

  if raw_foundation="$(aws_bedrock_cmd list-foundation-models --region "$REGION" --output json 2>&1)"; then
    foundation_json="$(json_or_empty "$raw_foundation")"
  else
    foundation_ok=1
    log_warn "Failed to list foundation models: $(echo "$raw_foundation" | head -1)" >&2
  fi

  if raw_profiles="$(aws_bedrock_cmd list-inference-profiles --region "$REGION" --output json 2>&1)"; then
    profiles_json="$(json_or_empty "$raw_profiles")"
  else
    profiles_ok=1
    log_warn "Failed to list inference profiles: $(echo "$raw_profiles" | head -1)" >&2
  fi

  if [[ "$foundation_ok" -ne 0 && "$profiles_ok" -ne 0 ]]; then
    return 1
  fi

  jq -n --argjson foundation "$foundation_json" --argjson profiles "$profiles_json" '{foundation:$foundation,profiles:$profiles}'
}

extract_candidates() {
  local discovery_json="$1"
  jq -r '
    [
      .profiles.inferenceProfileSummaries[]?.inferenceProfileId,
      .foundation.modelSummaries[]?.modelId
    ]
    | map(select(type == "string"))
    | .[]
  ' <<< "$discovery_json" 2>/dev/null \
    | grep -E '(^us\.anthropic\.claude-|^anthropic\.claude-|^claude-)' \
    | sort -u || true
}

select_tier() {
  local tier="$1"
  local candidates="$2"
  local stable_candidates preferred

  stable_candidates="$(while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if is_tier_model "$candidate" "$tier" && is_stable_model "$candidate"; then
      echo "$candidate"
    fi
  done <<< "$candidates")"

  if [[ -z "$stable_candidates" ]]; then
    echo ""
    return 0
  fi

  preferred="$(echo "$stable_candidates" | grep '^us\.anthropic\.' || true)"
  if [[ -z "$preferred" ]]; then
    preferred="$stable_candidates"
  fi

  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    printf '%s\t%s\n' "$(version_key "$candidate")" "$candidate"
  done <<< "$preferred" | sort -V | tail -n1 | cut -f2-
}

choose_model() {
  local tier="$1"
  local discovered="$2"
  local pinned="$3"

  if [[ "$PREFER_PINNED" == "1" ]]; then
    echo "$pinned|pinned"
    return 0
  fi

  if [[ -z "$discovered" || "$discovered" == "null" ]]; then
    echo "$pinned|pinned (not discovered)"
    return 0
  fi

  local cmp
  cmp="$(compare_models "$discovered" "$pinned")"
  if [[ "$cmp" == "-1" ]]; then
    log_warn "AWS discovery returned older $tier ($discovered); using pinned $pinned" >&2
    echo "$pinned|pinned (newer than discovery)"
  else
    echo "$discovered|discovered"
  fi
}

write_outputs() {
  local opus="$1" sonnet="$2" haiku="$3" opus_source="$4" sonnet_source="$5" haiku_source="$6"

  if [[ -z "$opus" || -z "$sonnet" || -z "$haiku" ]]; then
    log_error "Refusing to write empty model value. opus='$opus' sonnet='$sonnet' haiku='$haiku'"
    exit 1
  fi

  cat > "$CACHE_FILE" <<EOF
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "region": "$REGION",
  "discovery_method": "bedrock:list-foundation-models + bedrock:list-inference-profiles",
  "fallback": {
    "opus": "$PINNED_OPUS",
    "sonnet": "$PINNED_SONNET",
    "haiku": "$PINNED_HAIKU"
  },
  "models": {
    "opus": "$opus",
    "sonnet": "$sonnet",
    "haiku": "$haiku"
  },
  "sources": {
    "opus": "$opus_source",
    "sonnet": "$sonnet_source",
    "haiku": "$haiku_source"
  }
}
EOF

  cat > "$EXPORT_FILE" <<EOF
# Generated by tools/scripts/models-sync-bedrock.sh. Source this before starting Claude Code.
export ANTHROPIC_DEFAULT_OPUS_MODEL="$opus"
export ANTHROPIC_DEFAULT_SONNET_MODEL="$sonnet"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="$haiku"
EOF

  log_success "Wrote model cache to $CACHE_FILE"
  log_success "Wrote Claude Code exports to $EXPORT_FILE"
}

validate_outputs() {
  local opus="$1" sonnet="$2" haiku="$3"

  for model in "$opus" "$sonnet" "$haiku"; do
    if [[ -z "$model" || "$model" != us.anthropic.* ]]; then
      log_error "Invalid Bedrock model: $model"
      exit 1
    fi
  done

  if [[ "$(compare_models "$opus" "$PINNED_OPUS")" == "-1" ]]; then
    log_error "Resolved Opus is older than pinned fallback: $opus < $PINNED_OPUS"
    exit 1
  fi

  log_success "Resolved model map:"
  echo "  • Opus:  $opus"
  echo "  • Sonnet: $sonnet"
  echo "  • Haiku:  $haiku"
}

main() {
  log_info "Bedrock model discovery and sync"
  echo ""

  local candidates='' discovery='' discovered_opus='' discovered_sonnet='' discovered_haiku=''
  if [[ "$PREFER_PINNED" == "1" ]]; then
    log_info "PREFER_PINNED_MODELS=1: using pinned models."
  elif discovery="$(discover_json)"; then
    candidates="$(extract_candidates "$discovery")"
    discovered_opus="$(select_tier opus "$candidates")"
    discovered_sonnet="$(select_tier sonnet "$candidates")"
    discovered_haiku="$(select_tier haiku "$candidates")"

    if [[ -z "$discovered_opus$discovered_sonnet$discovered_haiku" ]]; then
      log_warn "AWS calls returned no parseable stable Claude IDs; using pinned fallbacks."
    else
      log_success "Discovery parsed stable Claude model/profile candidates."
    fi
  else
    log_warn "AWS discovery failed; using pinned fallbacks."
  fi

  local opus_pair sonnet_pair haiku_pair opus sonnet haiku opus_source sonnet_source haiku_source
  opus_pair="$(choose_model opus "$discovered_opus" "$PINNED_OPUS")"
  sonnet_pair="$(choose_model sonnet "$discovered_sonnet" "$PINNED_SONNET")"
  haiku_pair="$(choose_model haiku "$discovered_haiku" "$PINNED_HAIKU")"

  opus="${opus_pair%%|*}"; opus_source="${opus_pair#*|}"
  sonnet="${sonnet_pair%%|*}"; sonnet_source="${sonnet_pair#*|}"
  haiku="${haiku_pair%%|*}"; haiku_source="${haiku_pair#*|}"

  write_outputs "$opus" "$sonnet" "$haiku" "$opus_source" "$sonnet_source" "$haiku_source"
  echo ""
  cat "$CACHE_FILE"
  echo ""
  echo ""
  validate_outputs "$opus" "$sonnet" "$haiku"
  log_success "Sync complete"
}

main "$@"
