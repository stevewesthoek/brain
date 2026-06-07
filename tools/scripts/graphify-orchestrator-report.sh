#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

KIND="${1:-}"

case "$KIND" in
  preflight-mind)
    npm run graphify:preflight:mind
    ;;
  preflight-brain)
    npm run graphify:preflight:brain
    ;;
  update-mind-blocked)
    npm run graphify:update:mind:blocked
    ;;
  update-brain-blocked)
    npm run graphify:update:brain:blocked
    ;;
  *)
    cat >&2 <<'EOF'
Unsupported Graphify orchestrator report kind.

Allowed kinds:
- preflight-mind
- preflight-brain
- update-mind-blocked
- update-brain-blocked
EOF
    exit 2
    ;;
esac
