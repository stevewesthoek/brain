#!/usr/bin/env bash
set -euo pipefail

"$(dirname "$0")/stop-local.sh"
"$(dirname "$0")/start-local.sh"
