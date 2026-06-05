#!/usr/bin/env bash
set -euo pipefail

PROVIDER="${1:-}"
PROMPT="${2:-}"
OUTPUT_FILE="${3:-}"

usage() {
  printf 'Usage: %s <provider> <prompt> <output-file>\n' "$0"
  printf 'Providers: nova\n'
}

if [[ -z "$PROVIDER" || -z "$PROMPT" || -z "$OUTPUT_FILE" ]]; then
  usage
  exit 2
fi

case "$PROVIDER" in
  nova)
    MODEL_ID="${AWS_VIDEO_IMAGE_MODEL_ID:-amazon.nova-canvas-v1:0}"
    REGION="${AWS_VIDEO_IMAGE_REGION:-us-east-1}"
    ;;
  *)
    usage
    exit 2
    ;;
esac

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'ERROR: required command not found: %s\n' "$1" >&2
    exit 1
  fi
}

require_cmd aws
require_cmd jq
require_cmd file

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

request_json="$tmp_dir/request.json"
response_json="$tmp_dir/response.json"
mkdir -p "$(dirname "$OUTPUT_FILE")"

jq -n \
  --arg prompt "$PROMPT" \
  '{
    taskType: "TEXT_IMAGE",
    textToImageParams: {
      text: $prompt
    },
    imageGenerationConfig: {
      numberOfImages: 1,
      height: 720,
      width: 1280,
      cfgScale: 6.5,
      seed: 42
    }
  }' > "$request_json"

aws bedrock-runtime invoke-model \
  --region "$REGION" \
  --model-id "$MODEL_ID" \
  --content-type application/json \
  --accept application/json \
  --body "fileb://$request_json" \
  "$response_json" \
  --cli-binary-format raw-in-base64-out \
  --no-cli-pager >/dev/null

jq -r '.images[0] // empty' "$response_json" | node -e '
const fs = require("fs");
const chunks = [];
process.stdin.on("data", chunk => chunks.push(chunk));
process.stdin.on("end", () => {
  const data = Buffer.concat(chunks).toString("utf8").trim();
  if (!data) {
    console.error("ERROR: Bedrock response did not include images[0]");
    process.exit(1);
  }
  fs.writeFileSync(process.argv[1], Buffer.from(data, "base64"));
});
' "$OUTPUT_FILE"

file_output="$(file "$OUTPUT_FILE")"
case "$file_output" in
  *"PNG image data"*|*"JPEG image data"*)
    printf 'PASS: generated image\n'
    printf 'Provider: %s\n' "$PROVIDER"
    printf 'Model ID: %s\n' "$MODEL_ID"
    printf 'Region: %s\n' "$REGION"
    printf 'Output: %s\n' "$OUTPUT_FILE"
    printf 'File: %s\n' "$file_output"
    ;;
  *)
    printf 'ERROR: generated file is not recognized as PNG/JPEG: %s\n' "$file_output" >&2
    exit 1
    ;;
esac
