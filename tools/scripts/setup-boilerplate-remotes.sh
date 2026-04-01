#!/usr/bin/env bash
set -euo pipefail

echo "=== Configuring ProKit remotes ==="
cd "/Users/Office/Repos/Organisation/ProChat/Boilerplates/Products/prokit"

# Show current remotes for visibility
git remote -v || true

# Ensure origin points to org repo
git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/prochattools/prokit.git"

# (Re)define demo remote to your personal demo repo
git remote remove demo 2>/dev/null || true
git remote add demo "https://github.com/stevewesthoek/prokit-demo.git"

echo
echo "ProKit remotes now:"
git remote -v

echo
echo "=== Configuring SaaSKit remotes ==="
cd "/Users/Office/Repos/Organisation/ProChat/Boilerplates/Products/saaskit"

git remote -v || true

git remote remove origin 2>/dev/null || true
git remote add origin "https://github.com/prochattools/saaskit.git"

git remote remove demo 2>/dev/null || true
git remote add demo "https://github.com/stevewesthoek/saaskit-demo.git"

echo
echo "SaaSKit remotes now:"
git remote -v

echo
echo "=== Setting global git aliases (pushall / pushallt) ==="
git config --global alias.pushall '!git push origin main && git push demo main'
git config --global alias.pushallt '!git push origin --tags && git push demo --tags'

echo
echo "Done."
echo "- Use:  git pushall    # push main to both remotes"
echo "- Use:  git pushallt   # push tags to both remotes"