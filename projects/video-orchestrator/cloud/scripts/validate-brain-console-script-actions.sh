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

grep -Fq "ScriptDraftsPanel" "$PLUGIN_JS" || fail "Script Drafts view missing"
grep -Fq "approveVideoScript" "$PLUGIN_JS" || fail "approve client method missing"
grep -Fq "requestVideoScriptChanges" "$PLUGIN_JS" || fail "request changes client method missing"
grep -Fq '/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/approve' "$PLUGIN_JS" || fail "approve API route missing"
grep -Fq '/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/request-changes' "$PLUGIN_JS" || fail "request-changes API route missing"
grep -Fq 'data-script-action="review"' "$PLUGIN_JS" || fail "Review button missing"
grep -Fq 'data-script-action="approve"' "$PLUGIN_JS" || fail "Approve button missing"
grep -Fq 'data-script-action="request-changes"' "$PLUGIN_JS" || fail "Request changes button missing"
if grep -Fq "not wired yet" "$PLUGIN_JS"; then
  fail "placeholder disabled labels still present"
fi
grep -Fq "Theology review required before approval." "$PLUGIN_JS" || fail "theology safety warning missing"
grep -Fq "pending" "$PLUGIN_JS" || fail "pending status missing"
grep -Fq "approved" "$PLUGIN_JS" || fail "approved status missing"
grep -Fq "changes_requested" "$PLUGIN_JS" || fail "changes_requested status missing"
grep -Fq "notesRequired" "$PLUGIN_JS" || fail "notes validation missing"
grep -Fq "approvedBy: Steve" "$PLUGIN_JS" || fail "approvedBy default missing"
grep -Fq "requestedBy: Steve" "$PLUGIN_JS" || fail "requestedBy default missing"
grep -Fq "Brain Core request failed." "$PLUGIN_JS" || fail "safe error fallback missing"
grep -Fq "vo-script-modal__overlay" "$PLUGIN_CSS" || fail "approval modal styles missing"

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

echo "Brain Console script approval actions validation passed."
