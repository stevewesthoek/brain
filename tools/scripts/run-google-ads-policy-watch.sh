#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
python3 tools/google-ads/cli.py policy-watch
