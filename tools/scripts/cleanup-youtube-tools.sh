#!/usr/bin/env bash

set -e

echo "Starting cleanup..."

# 1. Remove Homebrew packages (if installed via brew)
if command -v brew >/dev/null 2>&1; then
  echo "Removing brew packages..."
  brew uninstall yt-dlp 2>/dev/null || true
  brew uninstall ffmpeg 2>/dev/null || true
fi

# 2. Remove pipx installs
if command -v pipx >/dev/null 2>&1; then
  echo "Removing pipx packages..."
  pipx uninstall yt-dlp 2>/dev/null || true
fi

# 3. Remove pip user installs (fallback case)
echo "Removing pip user installs..."
rm -rf ~/.local/bin/yt-dlp 2>/dev/null || true
rm -rf ~/.local/pipx 2>/dev/null || true
rm -rf ~/.local/share/pipx 2>/dev/null || true

# 4. Remove yt-dlp config & cache
echo "Cleaning configs..."
rm -rf ~/.config/yt-dlp 2>/dev/null || true
rm -rf ~/.cache/yt-dlp 2>/dev/null || true

# 5. Remove temp files we created
echo "Cleaning temp files..."
rm -rf /tmp/probot-audio.* 2>/dev/null || true
rm -rf /tmp/test.* 2>/dev/null || true

echo "Cleanup complete."
