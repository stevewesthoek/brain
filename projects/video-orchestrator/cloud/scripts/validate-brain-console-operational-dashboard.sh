#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/Users/Office/Repos/stevewesthoek/brain}"
MAIN="$ROOT_DIR/projects/brain-console-obsidian/src/main.ts"
PANEL="$ROOT_DIR/projects/brain-console-obsidian/src/components/VO/AwsVideoPipelinePanel.ts"
CLIENT="$ROOT_DIR/projects/brain-console-obsidian/src/client.ts"
PLUGIN_DIR="/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console"
PLUGIN_MAIN="$PLUGIN_DIR/main.js"

fail() {
  echo "✗ $1" >&2
  exit 1
}

pass() {
  echo "✓ $1"
}

[[ -f "$MAIN" ]] || fail "main.ts missing"
[[ -f "$PANEL" ]] || fail "AwsVideoPipelinePanel.ts missing"
[[ -f "$CLIENT" ]] || fail "client.ts missing"
[[ -f "$PLUGIN_MAIN" ]] || fail "Installed plugin main.js missing at $PLUGIN_DIR"

# Build marker checks (source)
grep -q "BRAIN_CONSOLE_BUILD_ID = 'v2.19-aws-video-fix'" "$MAIN" || fail "main.ts must have BRAIN_CONSOLE_BUILD_ID = 'v2.19-aws-video-fix'"

# Build marker checks (installed bundle)
grep -q "v2.19-aws-video-fix" "$PLUGIN_MAIN" || fail "Installed plugin must contain marker v2.19-aws-video-fix"
! grep -q "v2.18" "$PLUGIN_MAIN" || fail "Installed plugin must not contain stale marker v2.18"

# Diagnostics checks
grep -q "private lastRefreshTime: Date | null" "$PANEL" || fail "lastRefreshTime state missing"
grep -q "private statusFetchStatus:" "$PANEL" || fail "statusFetchStatus state missing"
grep -q "private jobsFetchStatus:" "$PANEL" || fail "jobsFetchStatus state missing"
grep -q "private renderDiagnostics" "$PANEL" || fail "renderDiagnostics function missing"
grep -q "Build:" "$PANEL" || fail "Diagnostics must show build marker"
grep -q "Brain Core:" "$PANEL" || fail "Diagnostics must show Brain Core URL"
grep -q "Last Refresh:" "$PANEL" || fail "Diagnostics must show last refresh timestamp"
grep -q "Last status endpoint error" "$PANEL" || fail "Diagnostics must show last status endpoint error"
grep -q "Last jobs endpoint error" "$PANEL" || fail "Diagnostics must show last jobs endpoint error"
grep -q "Loaded jobs:" "$PANEL" || fail "Diagnostics must show loaded jobs count"

# Event delegation checks
grep -q "closest(" "$PANEL" || fail "Event delegation using closest() missing"
grep -q "data-action" "$PANEL" || fail "data-action attributes missing for delegation"
grep -q "data-job-id" "$PANEL" || fail "data-job-id attributes missing"
grep -q "listenersAttached" "$PANEL" || fail "One-time listener guard missing"
grep -q "this.container.onclick" "$PANEL" || fail "Delegated click handler missing"

# Core operational dashboard checks
grep -q "private recentJobs: BrainCoreVideoJobSummary\[\]" "$PANEL" || fail "recentJobs state field missing"
grep -q "private selectedJobId: string | null" "$PANEL" || fail "selectedJobId state field missing"
grep -q "private renderRecentJobs" "$PANEL" || fail "renderRecentJobs function missing"
grep -q "private renderSelectedJobDetail" "$PANEL" || fail "renderSelectedJobDetail function missing"
grep -q "renderCreateDraftModal" "$PANEL" || fail "Create Draft modal renderer missing"
grep -q "confirm('Generate video artifacts only. This will not publish to YouTube.')" "$PANEL" || fail "Generate confirmation missing"
grep -q "Generate artifacts" "$PANEL" || fail "Generate button label missing"
! grep -q "fetch(" "$PANEL" || fail "AwsVideoPipelinePanel must not use raw fetch()"
grep -q "readBrainCoreOperationalRecentVideoJobs" "$PANEL" || fail "Panel must use requestUrl-based recent jobs helper"
grep -q "readBrainCoreOperationalVideoJob" "$PANEL" || fail "Panel must use requestUrl-based job detail helper"
grep -q "readBrainCoreOperationalVideoJobTimeline" "$PANEL" || fail "Panel must use requestUrl-based timeline helper"
grep -q "requestBrainCoreOperationalGenerateVideoJob" "$PANEL" || fail "Panel must use requestUrl-based generate helper"
grep -q "requestBrainCoreOperationalApproveVideoJob" "$PANEL" || fail "Panel must use requestUrl-based approve helper"
grep -q "requestBrainCoreOperationalRequestVideoJobChanges" "$PANEL" || fail "Panel must use requestUrl-based request-changes helper"
grep -q "readBrainCoreAwsVideoPipelineStatus" "$PANEL" || fail "Panel must use requestUrl-based status helper"
grep -q "BrainCoreVideoJobSummary" "$CLIENT" || fail "client job summary type missing"
grep -q "readBrainCoreOperationalRecentVideoJobs" "$CLIENT" || fail "client recent jobs helper missing"
grep -q "readBrainCoreOperationalVideoJob" "$CLIENT" || fail "client job detail helper missing"
grep -q "readBrainCoreOperationalVideoJobTimeline" "$CLIENT" || fail "client timeline helper missing"
grep -q "requestBrainCoreOperationalGenerateVideoJob" "$CLIENT" || fail "client generate helper missing"
grep -q "requestBrainCoreOperationalApproveVideoJob" "$CLIENT" || fail "client approve helper missing"
grep -q "requestBrainCoreOperationalRequestVideoJobChanges" "$CLIENT" || fail "client request-changes helper missing"
grep -q "requestBrainCoreOperationalJson" "$CLIENT" || fail "client operational requestUrl transport missing"
grep -q "requestUrlFn" "$CLIENT" || fail "client must use Obsidian requestUrl transport"
grep -q "timed out after 5000ms" "$CLIENT" || fail "client must enforce 5000ms timeout"
grep -q "unwrapBrainCorePayload" "$CLIENT" || fail "client must parse direct and wrapped payloads"
grep -q "'data' in payload" "$CLIENT" || fail "client must parse wrapped { data } payloads"
grep -q "return payload as T" "$CLIENT" || fail "client must accept direct object payloads"
grep -q "normalizeRecentVideoJobsPayload" "$CLIENT" || fail "client must normalize recent jobs payload"
grep -q "/api/video-orchestrator/jobs/recent" "$CLIENT" || fail "recent jobs endpoint missing"
grep -q "/api/video-orchestrator/jobs/\${encodeURIComponent(jobId)}" "$CLIENT" || fail "job detail endpoint missing"
grep -q "/api/video-orchestrator/jobs/\${encodeURIComponent(jobId)}/timeline" "$CLIENT" || fail "timeline endpoint missing"
grep -q "/api/video-orchestrator/scripts/\${encodeURIComponent(jobId)}/generate" "$CLIENT" || fail "generate endpoint missing"
grep -q "/api/video-orchestrator/scripts/\${encodeURIComponent(jobId)}/approve" "$CLIENT" || fail "approve endpoint missing"
grep -q "/api/video-orchestrator/scripts/\${encodeURIComponent(jobId)}/changes" "$CLIENT" || fail "request changes endpoint missing"

grep -q "timed out after 5000ms" "$PLUGIN_MAIN" || fail "Installed plugin must contain 5000ms timeout message"
grep -q "/api/video-orchestrator/jobs/recent" "$PLUGIN_MAIN" || fail "Installed plugin must contain recent jobs endpoint"

if grep -E "from ['\"]aws|import .*aws|S3|s3://" "$PANEL" >/dev/null; then
  fail "Panel must not import AWS SDK or read S3 directly"
fi

pass "Build marker v2.19-aws-video-fix verified in source"
pass "Build marker verified in installed bundle (no stale v2.18)"
pass "AWS Video diagnostics implemented"
pass "Event delegation with closest() implemented"
pass "AWS Video panel uses requestUrl helpers with hard timeout"
pass "static operational dashboard checks passed"

cd "$ROOT_DIR/projects/brain-console-obsidian"
npm run typecheck
pass "brain-console typecheck passed"
