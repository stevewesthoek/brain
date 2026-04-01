#!/usr/bin/env bash
set -euo pipefail

# === CONFIG: paths and demo repos ===

PROKIT_REPO="/Users/Office/Repos/Organisation/ProChat/Boilerplates/Products/prokit"
SAASKIT_REPO="/Users/Office/Repos/Organisation/ProChat/Boilerplates/Products/saaskit"

# Personal demo repos (what Vercel is connected to)
PROKIT_DEMO_URL="git@github.com:stevewesthoek/prokit-demo.git"
SAASKIT_DEMO_URL="git@github.com:stevewesthoek/saaskit-demo.git"

# Default commit message if you don't pass one as an argument
COMMIT_MSG="${1:-chore: sync boilerplates to org + demo}"

sync_repo() {
  local repo_path="$1"
  local demo_url="$2"
  local label="$3"

  echo "====================================="
  echo "🚀 Syncing $label"
  echo "Repo: $repo_path"
  echo "Demo: $demo_url"
  echo "Commit msg: $COMMIT_MSG"
  echo "====================================="

  if [ ! -d "$repo_path/.git" ]; then
    echo "❌ $label: $repo_path is not a git repo, skipping."
    echo
    return
  fi

  cd "$repo_path"

  # Show current status
  echo "📌 git status --short:"
  git status --short || true
  echo

  # Check for local changes
  local STATUS
  STATUS="$(git status --porcelain || true)"

  if [ -n "$STATUS" ]; then
    echo "📦 Changes detected in $label, committing:"
    echo "$STATUS"
    echo

    git add .
    git commit -m "$COMMIT_MSG"
  else
    echo "✅ No local changes in $label, nothing to commit."
  fi

  # Push to org (origin/main)
  echo "⬆️ Pushing $label to origin/main..."
  git push origin main

  # Push same branch to demo repo via direct URL
  echo "⬆️ Pushing $label to DEMO main ($demo_url)..."
  git push "$demo_url" main:main

  echo "✅ Done with $label"
  echo
}

# === Run for both boilerplates ===

sync_repo "$PROKIT_REPO"  "$PROKIT_DEMO_URL"  "ProKit"
sync_repo "$SAASKIT_REPO" "$SAASKIT_DEMO_URL" "SaaSKit"

echo "🎉 All done. Org + demo are in sync (if there were changes)."
