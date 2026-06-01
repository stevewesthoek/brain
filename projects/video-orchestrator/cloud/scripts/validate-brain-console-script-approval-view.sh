#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_JS="$ROOT/.obsidian/plugins/brain-console/main.js"
PLUGIN_CSS="$ROOT/.obsidian/plugins/brain-console/styles.css"

fail() {
  echo "FAIL: $1" >&2
  exit 1
}

test -f "$PLUGIN_JS" || fail "Brain Console main.js not found"
test -f "$PLUGIN_CSS" || fail "Brain Console styles.css not found"

grep -q "class .*ScriptDraftsPanel\\|var ScriptDraftsPanel" "$PLUGIN_JS" || fail "Script Drafts view missing"
grep -q 'data-tab="scripts"' "$PLUGIN_JS" || fail "Scripts tab missing"
grep -q "readBrainCoreVideoOrchestratorScripts" "$PLUGIN_JS" || fail "Brain Core script client method missing"
grep -q '"/video-orchestrator/script"' "$PLUGIN_JS" || fail "Brain Core script endpoint not wired"
grep -q "No script drafts found\\." "$PLUGIN_JS" || fail "empty state missing"
grep -q "Brain Core script endpoint unavailable\\." "$PLUGIN_JS" || fail "error state missing"
grep -q "Theology review required" "$PLUGIN_JS" || fail "Says the Bible theology review badge missing"
grep -q "Standard approval required" "$PLUGIN_JS" || fail "ProChat approval badge missing"
grep -q "not wired yet" "$PLUGIN_JS" || fail "disabled action labels missing"

if grep -Eq "require\\([\"']aws-sdk|from [\"']aws-sdk" "$PLUGIN_JS" || grep -Eq "require\\([\"']@aws-sdk/|from [\"']@aws-sdk/" "$PLUGIN_JS"; then
  fail "AWS SDK import found"
fi

for forbidden in "S3Client" "GetObjectCommand" "PutObjectCommand" "ListObjects" "s3://" "AWS.S3" "getObject(" "putObject(" "listObjects"; do
  if grep -Fq "$forbidden" "$PLUGIN_JS"; then
    fail "direct S3 access found: $forbidden"
  fi
done

node --check "$PLUGIN_JS" >/dev/null

if test -f "$ROOT/package.json"; then
  if grep -q '"typecheck"' "$ROOT/package.json"; then
    npm run typecheck
  fi
  if grep -q '"build"' "$ROOT/package.json"; then
    npm run build
  fi
fi

echo "Brain Console script approval view validation passed."
