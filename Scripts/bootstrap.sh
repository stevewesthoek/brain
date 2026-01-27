#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
DRY_RUN="${DRY_RUN:-0}"
if [ "$DRY_RUN" = "1" ]; then
  DRY_RUN=1 bash brain-configs-link.sh
else
  bash brain-configs-link.sh
fi
