#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
OUTPUT_DIR=${EVERMIND_HELPER_OUTPUT:-"${TMPDIR:-/tmp}/evermind-notification-helper"}

if [ "${1:-}" = "--output" ]; then
  if [ "$#" -ne 2 ] || [ -z "${2:-}" ]; then
    echo "usage: build-helper.sh [--output PATH]" >&2
    exit 2
  fi
  OUTPUT_DIR=$2
fi

if [ "$(uname -s)" != "Darwin" ]; then
  echo "macOS is required to build the UserNotifications helper" >&2
  exit 2
fi

SWIFTC=$(xcrun --find swiftc)
SDK=$(xcrun --sdk macosx --show-sdk-path)
APP="$OUTPUT_DIR/EvermindNotificationHelper.app"
mkdir -p "$APP/Contents/MacOS"
TARGET_ARCH=$(uname -m)
DEPLOYMENT_TARGET=${MACOSX_DEPLOYMENT_TARGET:-15.0}

"$SWIFTC" -sdk "$SDK" -target "${TARGET_ARCH}-apple-macosx${DEPLOYMENT_TARGET}" -O -framework AppKit -framework UserNotifications \
  -o "$APP/Contents/MacOS/EvermindNotificationHelper" \
  "$SCRIPT_DIR/EvermindNotificationHelper.swift"
cp "$SCRIPT_DIR/Info.plist" "$APP/Contents/Info.plist"
chmod 755 "$APP/Contents/MacOS/EvermindNotificationHelper"
codesign --force --deep --sign - "$APP" >/dev/null

printf '%s\n' "$APP"
