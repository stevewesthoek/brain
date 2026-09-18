#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUTPUT_DIR=${EVERMIND_COMPANION_OUTPUT:-"${TMPDIR:-/tmp}/evermind-companion"}

if [ "${1:-}" = "--output" ]; then
  if [ "$#" -ne 2 ] || [ -z "${2:-}" ]; then
    echo "usage: build-companion.sh [--output PATH]" >&2
    exit 2
  fi
  OUTPUT_DIR=$2
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "macOS is required to build the Evermind companion app" >&2
  exit 2
fi

SWIFTC=$(xcrun --find swiftc)
SDK=$(xcrun --sdk macosx --show-sdk-path)
APP="$OUTPUT_DIR/Evermind.app"
mkdir -p "$APP/Contents/MacOS"
TARGET_ARCH=$(uname -m)
DEPLOYMENT_TARGET=${MACOSX_DEPLOYMENT_TARGET:-15.0}

"$SWIFTC" -sdk "$SDK" -target "${TARGET_ARCH}-apple-macosx${DEPLOYMENT_TARGET}" -parse-as-library -O -framework AppKit -framework SwiftUI \
  -o "$APP/Contents/MacOS/Evermind" \
  "$SCRIPT_DIR/Evermind.swift" \
  "$SCRIPT_DIR/AcceptanceHarness.swift"
cp "$SCRIPT_DIR/CompanionInfo.plist" "$APP/Contents/Info.plist"
chmod 755 "$APP/Contents/MacOS/Evermind"
codesign --force --deep --sign - "$APP" >/dev/null

printf '%s\n' "$APP"
