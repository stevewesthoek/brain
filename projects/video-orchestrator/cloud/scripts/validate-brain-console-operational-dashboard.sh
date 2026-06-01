#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/Users/Office/Repos/stevewesthoek/brain}"
PANEL="$ROOT_DIR/projects/brain-console-obsidian/src/components/VO/AwsVideoPipelinePanel.ts"
CLIENT="$ROOT_DIR/projects/brain-console-obsidian/src/client.ts"

fail() {
  echo "✗ $1" >&2
  exit 1
}

pass() {
  echo "✓ $1"
}

[[ -f "$PANEL" ]] || fail "AwsVideoPipelinePanel.ts missing"
[[ -f "$CLIENT" ]] || fail "client.ts missing"

grep -q "private recentJobs: BrainCoreVideoJobSummary\[\]" "$PANEL" || fail "recentJobs state field missing"
grep -q "private selectedJobId: string | null" "$PANEL" || fail "selectedJobId state field missing"
grep -q "private renderRecentJobs" "$PANEL" || fail "renderRecentJobs function missing"
grep -q "private renderSelectedJobDetail" "$PANEL" || fail "renderSelectedJobDetail function missing"
grep -q "renderCreateDraftModal" "$PANEL" || fail "Create Draft modal renderer missing"
grep -q "confirm('Generate video artifacts only. This will not publish to YouTube.')" "$PANEL" || fail "Generate confirmation missing"
grep -q "Generate artifacts" "$PANEL" || fail "Generate button label missing"
grep -q "/api/video-orchestrator/jobs/recent" "$PANEL" || fail "recent jobs endpoint missing"
grep -q "/api/video-orchestrator/jobs/.*timeline" "$PANEL" || fail "timeline endpoint missing"
grep -q "/api/video-orchestrator/scripts/.*generate" "$PANEL" || fail "generate endpoint missing"
grep -q "BrainCoreVideoJobSummary" "$CLIENT" || fail "client job summary type missing"
grep -q "getBrainCoreRecentVideoJobs" "$CLIENT" || fail "client recent jobs helper missing"

if grep -E "from ['\"]aws|import .*aws|S3|s3://" "$PANEL" >/dev/null; then
  fail "Panel must not import AWS SDK or read S3 directly"
fi

pass "static operational dashboard checks passed"

cd "$ROOT_DIR/projects/brain-console-obsidian"
npm run typecheck
pass "brain-console typecheck passed"
