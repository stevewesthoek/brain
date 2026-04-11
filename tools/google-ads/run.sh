#!/bin/bash
# Wrapper to run the Google Ads CLI within the venv

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
CWD="$PWD"

# Ensure venv exists
if [ ! -d "$VENV_DIR" ]; then
    echo "Creating virtual environment..." >&2
    python3 -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip setuptools wheel > /dev/null 2>&1 || true
    pip install -r "$SCRIPT_DIR/requirements.txt"
else
    source "$VENV_DIR/bin/activate"
fi

# Change back to original working directory and run the CLI
cd "$CWD"
python3 "$SCRIPT_DIR/cli.py" "$@"
