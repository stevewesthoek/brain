#!/usr/bin/env bash
set -euo pipefail

BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"

MODE="${1:-}"
JOB_ID="${2:-}"

usage() {
  printf 'Usage: %s <mode> <jobId>\n' "$0"
  printf 'Modes: fixture, hybrid, hybrid_tts, hybrid_storyboard, hybrid_slideshow\n'
}

failures=0
tmp_dir=""

cleanup() {
  if [[ -n "$tmp_dir" && -d "$tmp_dir" ]]; then
    rm -rf "$tmp_dir"
  fi
}
trap cleanup EXIT

fail() {
  failures=$((failures + 1))
  printf 'FAIL: %s\n' "$*"
}

pass() {
  printf 'PASS: %s\n' "$*"
}

info() {
  printf 'INFO: %s\n' "$*"
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "required command not found: $1"
  fi
}

object_key() {
  printf 'jobs/%s/%s' "$JOB_ID" "$1"
}

s3_uri() {
  printf 's3://%s/%s' "$BUCKET" "$1"
}

object_exists() {
  aws s3api head-object \
    --bucket "$BUCKET" \
    --key "$1" \
    --region "$REGION" \
    --no-cli-pager >/dev/null 2>&1
}

require_object() {
  local key="$1"
  if object_exists "$key"; then
    pass "exists: $key"
  else
    fail "missing required S3 object: $key"
  fi
}

optional_object() {
  local key="$1"
  object_exists "$key"
}

download_object() {
  local key="$1"
  local dest="$2"
  aws s3 cp "$(s3_uri "$key")" "$dest" --region "$REGION" --no-cli-pager >/dev/null
}

json_value() {
  local file="$1"
  local expr="$2"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  jq -r "$expr // empty" "$file"
}

require_json_equals() {
  local file="$1"
  local expr="$2"
  local expected="$3"
  local actual
  if [[ ! -f "$file" ]]; then
    fail "cannot check $expr because JSON file is missing: $file"
    return
  fi
  actual="$(json_value "$file" "$expr")"
  if [[ "$actual" == "$expected" ]]; then
    pass "$expr == $expected"
  else
    fail "$expr expected '$expected' but got '${actual:-<empty>}'"
  fi
}

require_json_true() {
  local file="$1"
  local expr="$2"
  local actual
  if [[ ! -f "$file" ]]; then
    fail "cannot check $expr because JSON file is missing: $file"
    return
  fi
  actual="$(jq -r "$expr" "$file")"
  if [[ "$actual" == "true" ]]; then
    pass "$expr == true"
  else
    fail "$expr expected true but got '${actual:-<empty>}'"
  fi
}

require_json_nonempty() {
  local file="$1"
  local expr="$2"
  local actual
  if [[ ! -f "$file" ]]; then
    fail "cannot check $expr because JSON file is missing: $file"
    return
  fi
  actual="$(json_value "$file" "$expr")"
  if [[ -n "$actual" && "$actual" != "null" ]]; then
    pass "$expr is documented: $actual"
  else
    fail "$expr is missing or empty"
  fi
}

require_not_s3_uri() {
  local label="$1"
  local value="$2"
  if [[ -z "$value" || "$value" == "null" ]]; then
    fail "$label is missing"
  elif [[ "$value" == s3://* ]]; then
    fail "$label must be an object key, not an s3:// URI: $value"
  else
    pass "$label is object key: $value"
  fi
}

require_mp3() {
  local key="$1"
  local dest="$tmp_dir/narration.mp3"
  require_object "$key"
  if object_exists "$key"; then
    download_object "$key" "$dest"
    local file_output
    file_output="$(file "$dest")"
    if [[ "$file_output" == *"MPEG"* || "$file_output" == *"Audio file"* || "$file_output" == *"MP3"* ]]; then
      pass "downloads as MP3: $key"
      info "$file_output"
    else
      fail "downloaded narration is not recognized as MP3: $file_output"
    fi
  fi
}

require_video_file() {
  local key="$1"
  local dest="$tmp_dir/generated-001.mp4"
  require_object "$key"
  if object_exists "$key"; then
    download_object "$key" "$dest"
    local file_output
    file_output="$(file "$dest")"
    if [[ "$file_output" == *"MP4"* || "$file_output" == *"ISO Media"* || "$file_output" == *"MPEG"* ]]; then
      pass "downloads as valid video: $key"
      info "$file_output"
    else
      fail "downloaded video is not recognized as valid video: $file_output"
    fi
    if command -v ffprobe >/dev/null 2>&1; then
      local codec
      codec="$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$dest" 2>/dev/null || true)"
      if [[ "$codec" == "h264" ]]; then
        pass "video codec is h264"
      elif [[ -n "$codec" ]]; then
        pass "video codec detected: $codec"
      else
        fail "ffprobe could not detect a video stream"
      fi
    fi
  fi
}

expected_generation_mode() {
  case "$MODE" in
    fixture) printf 'fixture_assembly' ;;
    hybrid) printf 'hybrid_scene_plan_fixture_media' ;;
    hybrid_tts) printf 'hybrid_tts_fixture_video' ;;
    hybrid_storyboard) printf 'hybrid_storyboard_fixture_video' ;;
    hybrid_slideshow) printf 'hybrid_slideshow_video' ;;
    *) return 1 ;;
  esac
}

print_expected_artifacts() {
  printf 'Expected artifacts:\n'
  printf '  - metadata/status.json\n'
  printf '  - metadata/assets.json\n'
  case "$MODE" in
    fixture)
      printf '  - audio/narration.mp3\n'
      printf '  - video-generated/generated-001.mp4\n'
      ;;
    hybrid)
      printf '  - metadata/scene-plan.json\n'
      printf '  - audio/narration-script.txt\n'
      printf '  - audio/narration.mp3\n'
      printf '  - video-generated/generated-001.mp4\n'
      ;;
    hybrid_tts)
      printf '  - metadata/scene-plan.json\n'
      printf '  - audio/narration-script.txt\n'
      printf '  - audio/narration.mp3 (MP3)\n'
      printf '  - video-generated/generated-001.mp4\n'
      ;;
    hybrid_storyboard)
      printf '  - metadata/scene-plan.json\n'
      printf '  - audio/narration-script.txt\n'
      printf '  - audio/narration.mp3\n'
      printf '  - metadata/storyboard.json\n'
      printf '  - images/scene-001.svg\n'
      ;;
    hybrid_slideshow)
      printf '  - metadata/scene-plan.json\n'
      printf '  - audio/narration-script.txt\n'
      printf '  - audio/narration.mp3\n'
      printf '  - metadata/storyboard.json\n'
      printf '  - images/scene-001.svg\n'
      printf '  - images/scene-001.png\n'
      printf '  - video-generated/generated-001.mp4 (video)\n'
      ;;
  esac
}

if [[ -z "$MODE" || -z "$JOB_ID" ]]; then
  usage
  exit 2
fi

case "$MODE" in
  fixture|hybrid|hybrid_tts|hybrid_storyboard|hybrid_slideshow) ;;
  *)
    usage
    exit 2
    ;;
esac

require_cmd aws
require_cmd jq
require_cmd file

if [[ "$failures" -gt 0 ]]; then
  printf 'SUMMARY: FAIL mode=%s jobId=%s failures=%s\n' "$MODE" "$JOB_ID" "$failures"
  exit 1
fi

tmp_dir="$(mktemp -d)"
expected_generation_mode_value="$(expected_generation_mode)"
status_key="$(object_key "metadata/status.json")"
assets_key="$(object_key "metadata/assets.json")"
status_json="$tmp_dir/status.json"
assets_json="$tmp_dir/assets.json"

printf 'AWS Video generation mode verification\n'
printf 'Mode: %s\n' "$MODE"
printf 'Job ID: %s\n' "$JOB_ID"
printf 'Bucket: %s\n' "$BUCKET"
printf 'Region: %s\n' "$REGION"
printf 'Expected generationMode: %s\n' "$expected_generation_mode_value"
print_expected_artifacts
printf '\n'

require_object "$status_key"
require_object "$assets_key"

if object_exists "$status_key"; then
  download_object "$status_key" "$status_json"
fi
if object_exists "$assets_key"; then
  download_object "$assets_key" "$assets_json"
fi

if [[ -f "$assets_json" ]]; then
  require_json_equals "$assets_json" '.generationMode' "$expected_generation_mode_value"
fi

case "$MODE" in
  fixture)
    require_object "$(object_key "audio/narration.mp3")"
    require_object "$(object_key "video-generated/generated-001.mp4")"
    ;;
  hybrid)
    require_object "$(object_key "metadata/scene-plan.json")"
    require_object "$(object_key "audio/narration-script.txt")"
    require_object "$(object_key "audio/narration.mp3")"
    require_object "$(object_key "video-generated/generated-001.mp4")"
    require_json_equals "$assets_json" '.providers.narrationAudio' 'fixture'
    require_json_equals "$assets_json" '.providers.video' 'fixture'
    ;;
  hybrid_tts)
    require_object "$(object_key "metadata/scene-plan.json")"
    require_object "$(object_key "audio/narration-script.txt")"
    require_mp3 "$(object_key "audio/narration.mp3")"
    require_object "$(object_key "video-generated/generated-001.mp4")"
    require_json_true "$assets_json" '.ttsGenerated'
    require_json_equals "$assets_json" '.audioProvider' 'aws-polly'
    ;;
  hybrid_storyboard)
    require_object "$(object_key "metadata/scene-plan.json")"
    require_object "$(object_key "audio/narration-script.txt")"
    require_object "$(object_key "audio/narration.mp3")"
    require_object "$(object_key "metadata/storyboard.json")"
    require_object "$(object_key "images/scene-001.svg")"
    require_json_true "$assets_json" '.storyboardGenerated'
    require_json_equals "$assets_json" '.imageProvider' 'deterministic-placeholder'
    require_json_nonempty "$assets_json" '.videoSourceKey'
    ;;
  hybrid_slideshow)
    require_object "$(object_key "metadata/scene-plan.json")"
    require_object "$(object_key "audio/narration-script.txt")"
    require_object "$(object_key "audio/narration.mp3")"
    require_object "$(object_key "metadata/storyboard.json")"
    require_object "$(object_key "images/scene-001.svg")"
    if object_exists "$(object_key "images/scene-001.png")"; then
      pass "exists: $(object_key "images/scene-001.png")"
    else
      fail "missing PNG companion frame: $(object_key "images/scene-001.png")"
    fi
    require_video_file "$(object_key "video-generated/generated-001.mp4")"
    require_json_true "$assets_json" '.slideshowGenerated'
    require_json_equals "$assets_json" '.videoProvider' 'local-ffmpeg-slideshow'
    require_json_equals "$assets_json" '.videoSourceKey' "$(object_key "video-generated/generated-001.mp4")"
    ;;
esac

publish_key="$(object_key "metadata/publish.json")"
if optional_object "$publish_key"; then
  publish_json="$tmp_dir/publish.json"
  download_object "$publish_key" "$publish_json"
  pass "exists: $publish_key"
  publish_status="$(json_value "$publish_json" '.publishStatus')"
  info "publishStatus: ${publish_status:-<empty>}"
  publish_video_key="$(json_value "$publish_json" '.videoKey')"
  publish_thumbnail_key="$(json_value "$publish_json" '.thumbnailKey')"
  require_not_s3_uri "publish.json videoKey" "$publish_video_key"
  require_not_s3_uri "publish.json thumbnailKey" "$publish_thumbnail_key"
else
  info "metadata/publish.json not present; publish contract check skipped"
fi

publish_check_key="$(object_key "metadata/publish-check.json")"
if optional_object "$publish_check_key"; then
  publish_check_json="$tmp_dir/publish-check.json"
  download_object "$publish_check_key" "$publish_check_json"
  pass "exists: $publish_check_key"
  dry_run_status="$(json_value "$publish_check_json" '.youtubeDryRun.status')"
  info "youtubeDryRun.status: ${dry_run_status:-<empty>}"
else
  info "metadata/publish-check.json not present; dry-run proof check skipped"
fi

printf '\n'
if [[ "$failures" -eq 0 ]]; then
  printf 'SUMMARY: PASS mode=%s jobId=%s\n' "$MODE" "$JOB_ID"
  exit 0
fi

printf 'SUMMARY: FAIL mode=%s jobId=%s failures=%s\n' "$MODE" "$JOB_ID" "$failures"
exit 1
