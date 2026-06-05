#!/usr/bin/env bash
set -euo pipefail

BUCKET="prochat-video-dev-909439522876-eu-north-1-an"
REGION="eu-north-1"

MODE="${1:-}"
JOB_ID="${2:-}"
REQUIRE_REVIEW_APPROVED=0

if [[ "${1:-}" == "--require-review-approved" ]]; then
  REQUIRE_REVIEW_APPROVED=1
  MODE="${2:-}"
  JOB_ID="${3:-}"
fi

usage() {
  printf 'Usage: %s <mode> <jobId>\n' "$0"
  printf '       %s --require-review-approved <mode> <jobId>\n' "$0"
  printf 'Modes: fixture, hybrid, hybrid_tts, hybrid_storyboard, hybrid_slideshow, hybrid_image_slideshow\n'
}

failures=0
tmp_dir=""
review_status=""
publish_check_json=""

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

require_json_number_equals() {
  local file="$1"
  local expr="$2"
  local expected="$3"
  local actual
  if [[ ! -f "$file" ]]; then
    fail "cannot check $expr because JSON file is missing: $file"
    return
  fi
  actual="$(jq -r "$expr // empty" "$file")"
  if [[ "$actual" == "$expected" ]]; then
    pass "$expr == $expected"
  else
    fail "$expr expected '$expected' but got '${actual:-<empty>}'"
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

require_first_existing_image() {
  local base="$1"
  local found=""
  for ext in png jpg jpeg; do
    local key
    key="$(object_key "${base}.${ext}")"
    if object_exists "$key"; then
      found="$key"
      break
    fi
  done
  if [[ -z "$found" ]]; then
    fail "missing required generated scene image: ${base}.png|jpg|jpeg"
    return
  fi
  pass "exists: $found"
  local dest="$tmp_dir/scene-001.${found##*.}"
  download_object "$found" "$dest"
  local file_output
  file_output="$(file "$dest")"
  if [[ "$file_output" == *"PNG image data"* || "$file_output" == *"JPEG image data"* ]]; then
    pass "downloads as image: $found"
    info "$file_output"
  else
    fail "downloaded scene image is not PNG/JPEG: $file_output"
  fi
}

expected_generation_mode() {
  case "$MODE" in
    fixture) printf 'fixture_assembly' ;;
    hybrid) printf 'hybrid_scene_plan_fixture_media' ;;
    hybrid_tts) printf 'hybrid_tts_fixture_video' ;;
    hybrid_storyboard) printf 'hybrid_storyboard_fixture_video' ;;
    hybrid_slideshow) printf 'hybrid_slideshow_video' ;;
    hybrid_image_slideshow) printf 'hybrid_image_slideshow_video' ;;
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
    hybrid_image_slideshow)
      printf '  - metadata/scene-plan.json\n'
      printf '  - audio/narration-script.txt\n'
      printf '  - audio/narration.mp3 (MP3)\n'
      printf '  - metadata/storyboard.json\n'
      printf '  - images/scene-001.png or .jpg\n'
      printf '  - video-generated/generated-001.mp4 (video)\n'
      ;;
  esac
}

if [[ -z "$MODE" || -z "$JOB_ID" ]]; then
  usage
  exit 2
fi

case "$MODE" in
  fixture|hybrid|hybrid_tts|hybrid_storyboard|hybrid_slideshow|hybrid_image_slideshow) ;;
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
  hybrid_image_slideshow)
    require_object "$(object_key "metadata/scene-plan.json")"
    require_object "$(object_key "audio/narration-script.txt")"
    require_mp3 "$(object_key "audio/narration.mp3")"
    require_object "$(object_key "metadata/storyboard.json")"
    require_object "$(object_key "metadata/image-generation.json")"
    require_first_existing_image "images/scene-001"
    require_video_file "$(object_key "video-generated/generated-001.mp4")"
    require_json_nonempty "$assets_json" '.imageGenerationKey'
    require_json_equals "$assets_json" '.imageProvider' 'aws-bedrock-nova-canvas'
    require_json_equals "$assets_json" '.imageModelId' 'amazon.nova-canvas-v1:0'
    require_json_equals "$assets_json" '.imageGeneration.provider' 'aws-bedrock-nova-canvas'
    require_json_equals "$assets_json" '.imageGeneration.modelId' 'amazon.nova-canvas-v1:0'
    require_json_equals "$assets_json" '.imageGeneration.region' 'us-east-1'
    require_json_true "$assets_json" '.imageGenerated'
    require_json_true "$assets_json" '.partialAiGenerated'
    require_json_equals "$assets_json" '.imageGeneration.settings.width' '1280'
    require_json_equals "$assets_json" '.imageGeneration.settings.height' '720'
    require_json_equals "$assets_json" '.imageGeneration.settings.cfgScale' '6.5'
    require_json_equals "$assets_json" '.imageGeneration.settings.quality' 'standard'
    require_json_equals "$assets_json" '.imageGeneration.settings.seed' '42'
    require_json_nonempty "$assets_json" '.imageGeneration.promptHashes[0]'
    require_json_nonempty "$assets_json" '.imageGeneration.generatedImageKeys[0]'
    require_json_nonempty "$assets_json" '.imageGenerationKey'
    storyboard_json="$(object_key "metadata/storyboard.json")"
    image_generation_json="$(object_key "metadata/image-generation.json")"
    download_object "$storyboard_json" "$tmp_dir/storyboard.json"
    download_object "$image_generation_json" "$tmp_dir/image-generation.json"
    require_json_nonempty "$tmp_dir/storyboard.json" '.scenes[0].finalImagePrompt'
    require_json_nonempty "$tmp_dir/storyboard.json" '.scenes[0].promptHash'
    require_json_equals "$tmp_dir/storyboard.json" '.scenes[0].imageModelId' 'amazon.nova-canvas-v1:0'
    require_json_equals "$tmp_dir/storyboard.json" '.scenes[0].imageRegion' 'us-east-1'
    require_json_number_equals "$tmp_dir/storyboard.json" '.scenes[0].width' '1280'
    require_json_number_equals "$tmp_dir/storyboard.json" '.scenes[0].height' '720'
    require_json_nonempty "$tmp_dir/storyboard.json" '.scenes[0].generatedAt'
    require_json_nonempty "$tmp_dir/image-generation.json" '.provider'
    require_json_equals "$tmp_dir/image-generation.json" '.modelId' 'amazon.nova-canvas-v1:0'
    require_json_equals "$tmp_dir/image-generation.json" '.region' 'us-east-1'
    require_json_number_equals "$tmp_dir/image-generation.json" '.settings.width' '1280'
    require_json_number_equals "$tmp_dir/image-generation.json" '.settings.height' '720'
    require_json_equals "$tmp_dir/image-generation.json" '.settings.quality' 'standard'
    require_json_true "$assets_json" '.imageGenerated'
    require_json_true "$assets_json" '.slideshowGenerated'
    require_json_equals "$assets_json" '.videoProvider' 'local-ffmpeg-slideshow'
    require_json_equals "$assets_json" '.videoSourceKey' "$(object_key "video-generated/generated-001.mp4")"
    image_provider="$(json_value "$assets_json" '.imageProvider')"
    if [[ -z "$image_provider" ]]; then
      fail '.imageProvider is missing'
    elif [[ "$image_provider" == 'deterministic-placeholder' && "${AWS_VIDEO_VERIFY_ALLOW_PLACEHOLDER_IMAGE_PROVIDER:-0}" != '1' ]]; then
      fail '.imageProvider must not be deterministic-placeholder for hybrid_image_slideshow unless AWS_VIDEO_VERIFY_ALLOW_PLACEHOLDER_IMAGE_PROVIDER=1'
    else
      pass ".imageProvider accepted: $image_provider"
    fi
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
  if [[ -n "$publish_video_key" ]]; then
    require_not_s3_uri "publish.json videoKey" "$publish_video_key"
  else
    info "publish.json videoKey not populated yet"
  fi
  if [[ -n "$publish_thumbnail_key" ]]; then
    require_not_s3_uri "publish.json thumbnailKey" "$publish_thumbnail_key"
  else
    info "publish.json thumbnailKey not populated yet"
  fi
else
  info "metadata/publish.json not present; publish contract check skipped"
fi

youtube_package_key="$(object_key "metadata/youtube-package.json")"
if [[ "$MODE" == hybrid_slideshow || "$MODE" == hybrid_image_slideshow ]]; then
  if optional_object "$youtube_package_key"; then
    youtube_package_json="$tmp_dir/youtube-package.json"
    download_object "$youtube_package_key" "$youtube_package_json"
    pass "exists: $youtube_package_key"

    # Verify youtube-package.json fields
    pkg_title="$(json_value "$youtube_package_json" '.title')"
    pkg_description="$(json_value "$youtube_package_json" '.description')"
    pkg_tags="$(json_value "$youtube_package_json" '.tags')"
    pkg_video_key="$(json_value "$youtube_package_json" '.videoKey')"
    pkg_thumbnail_key="$(json_value "$youtube_package_json" '.thumbnailKey')"

    if [[ -z "$pkg_title" ]]; then
      fail "youtube-package.json must have .title"
    else
      pass "youtube-package.json .title present: ${pkg_title:0:50}..."
    fi

    if [[ -z "$pkg_description" ]]; then
      fail "youtube-package.json must have .description"
    else
      pass "youtube-package.json .description present: ${pkg_description:0:50}..."
    fi

    if [[ -z "$pkg_tags" ]]; then
      fail "youtube-package.json must have .tags array"
    else
      pass "youtube-package.json .tags present"
    fi
  else
    info "metadata/youtube-package.json not present for $MODE (expected once generation + review complete)"
  fi
else
  info "youtube-package.json check skipped for mode: $MODE"
fi

# Check canonical thumbnail metadata and file
thumbnail_metadata_key="$(object_key "metadata/thumbnail.json")"
if [[ "$MODE" == hybrid_image_slideshow ]]; then
  if optional_object "$thumbnail_metadata_key"; then
    thumbnail_metadata_json="$tmp_dir/thumbnail.json"
    download_object "$thumbnail_metadata_key" "$thumbnail_metadata_json"
    pass "exists: $thumbnail_metadata_key"

    thumb_key="$(json_value "$thumbnail_metadata_json" '.thumbnailKey')"
    thumb_provider="$(json_value "$thumbnail_metadata_json" '.provider')"
    thumb_status="$(json_value "$thumbnail_metadata_json" '.thumbnailStatus')"
    thumb_width="$(json_value "$thumbnail_metadata_json" '.width')"
    thumb_height="$(json_value "$thumbnail_metadata_json" '.height')"

    if [[ -z "$thumb_status" ]]; then
      fail "thumbnail.json must have .thumbnailStatus"
    else
      pass "thumbnail.json .thumbnailStatus: $thumb_status"
    fi

    if [[ "$thumb_status" == "generated" ]]; then
      if [[ -z "$thumb_key" ]]; then
        fail "thumbnail.json .thumbnailKey missing (status=generated)"
      else
        pass "thumbnail.json .thumbnailKey: $thumb_key"
        if optional_object "$thumb_key"; then
          pass "canonical thumbnail file exists at: $thumb_key"
        else
          fail "canonical thumbnail file not found in S3: $thumb_key"
        fi
      fi
      if [[ -z "$thumb_provider" ]]; then
        fail "thumbnail.json .provider missing"
      else
        pass "thumbnail.json .provider: $thumb_provider"
      fi
      if [[ -z "$thumb_width" || -z "$thumb_height" ]]; then
        fail "thumbnail.json dimensions missing"
      else
        pass "thumbnail.json dimensions: ${thumb_width}x${thumb_height}"
      fi
    fi
  else
    info "metadata/thumbnail.json not present; thumbnail generation may still be pending"
  fi
else
  info "canonical thumbnail check skipped for mode: $MODE"
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

review_key="$(object_key "metadata/review.json")"
review_json="$tmp_dir/review.json"
if optional_object "$review_key"; then
  download_object "$review_key" "$review_json"
  pass "exists: $review_key"
  review_status="$(json_value "$review_json" '.reviewStatus')"
  info "reviewStatus: ${review_status:-<empty>}"
  if [[ "$review_status" != "pending" && "$review_status" != "approved" && "$review_status" != "changes_requested" ]]; then
    fail "reviewStatus must be pending, approved, or changes_requested"
  fi
else
  if [[ "$MODE" == hybrid_storyboard || "$MODE" == hybrid_slideshow || "$MODE" == hybrid_image_slideshow ]]; then
    fail "missing required review metadata for generated media: $review_key"
  else
    info "metadata/review.json not present; review gate not required for this mode"
  fi
fi

if [[ -f "$publish_check_json" || -f "$tmp_dir/publish-check.json" ]]; then
  if [[ "${review_status:-pending}" != "approved" ]]; then
    fail "dry-run proof exists but reviewStatus is not approved"
  fi
fi

if [[ "$REQUIRE_REVIEW_APPROVED" -eq 1 ]]; then
  if [[ "${review_status:-}" != "approved" ]]; then
    fail "--require-review-approved set but reviewStatus is not approved (got: ${review_status:-<empty>})"
  else
    pass "reviewStatus approved"
  fi
fi

if [[ "${review_status:-pending}" != "approved" && "$REQUIRE_REVIEW_APPROVED" -ne 1 ]]; then
  if [[ "$MODE" == hybrid_slideshow || "$MODE" == hybrid_image_slideshow ]]; then
    info "reviewStatus is ${review_status:-pending} (not approved yet); consider running with --require-review-approved once generation completes"
  fi
fi

# Check generated-media publish safety: ensure videoKey/thumbnailKey don't point to fixture
if [[ "$MODE" == hybrid_slideshow || "$MODE" == hybrid_image_slideshow ]]; then
  if [[ -f "$tmp_dir/publish.json" ]]; then
    pub_title="$(json_value "$tmp_dir/publish.json" '.title')"
    pub_video_key="$(json_value "$tmp_dir/publish.json" '.videoKey')"
    pub_thumbnail_key="$(json_value "$tmp_dir/publish.json" '.thumbnailKey')"
    pub_generation_mode="$(json_value "$tmp_dir/publish.json" '.generationMode')"

    # For hybrid_image_slideshow, title must NOT have [PIPELINE PROOF]
    if [[ "$MODE" == "hybrid_image_slideshow" ]]; then
      if [[ "$pub_title" == *"[PIPELINE PROOF]"* ]]; then
        fail "publish.json title must not have [PIPELINE PROOF] for generated-media mode: $pub_title"
      else
        pass "publish.json title does not have [PIPELINE PROOF]"
      fi
    fi

    # Check videoKey is not test-001 fixture
    if [[ -n "$pub_video_key" ]]; then
      if [[ "$pub_video_key" == *"jobs/test-001"* ]]; then
        fail "publish.json videoKey must not point to fixture test-001: $pub_video_key"
      elif [[ "$pub_video_key" != *"jobs/$JOB_ID"* ]]; then
        fail "publish.json videoKey must belong to this job ($JOB_ID): $pub_video_key"
      else
        pass "publish.json videoKey valid: $pub_video_key"
      fi
    else
      info "publish.json videoKey not set yet"
    fi

    # Check thumbnailKey is not test-001 fixture
    if [[ -n "$pub_thumbnail_key" ]]; then
      if [[ "$pub_thumbnail_key" == *"jobs/test-001"* ]]; then
        fail "publish.json thumbnailKey must not point to fixture test-001: $pub_thumbnail_key"
      elif [[ "$pub_thumbnail_key" != *"jobs/$JOB_ID"* ]]; then
        fail "publish.json thumbnailKey must belong to this job ($JOB_ID): $pub_thumbnail_key"
      elif [[ "$pub_thumbnail_key" != *"/exports/"* ]]; then
        fail "publish.json thumbnailKey must be in exports/ subdirectory: $pub_thumbnail_key"
      else
        pass "publish.json thumbnailKey valid: $pub_thumbnail_key"
      fi
    else
      info "publish.json thumbnailKey not set yet"
    fi
  fi
fi

printf '\n'
if [[ "$failures" -eq 0 ]]; then
  printf 'SUMMARY: PASS mode=%s jobId=%s\n' "$MODE" "$JOB_ID"
  exit 0
fi

printf 'SUMMARY: FAIL mode=%s jobId=%s failures=%s\n' "$MODE" "$JOB_ID" "$failures"
exit 1
