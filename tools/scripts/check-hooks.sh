#!/usr/bin/env bash
# check-hooks.sh — smoke test for Claude Code hook safety configuration
#
# Verifies that:
#   1. settings.json has all expected hooks registered
#   2. Each hook script exists and is executable
#   3. defaultMode is bypassPermissions (expected — hooks are the control plane)
#
# Run manually at any time:
#   bash tools/scripts/check-hooks.sh

SETTINGS="${HOME}/.claude/settings.json"
HOOKS_DIR="${HOME}/.claude/hooks"

pass=0
fail=0

ok()   { printf '  ✓ %s\n' "$*"; pass=$((pass+1)); }
warn() { printf '  ✗ %s\n' "$*" >&2; fail=$((fail+1)); }

echo "=== Claude Code hook smoke test ==="
echo ""

# 1. settings.json exists
if [ -f "$SETTINGS" ]; then
  ok "settings.json exists"
else
  warn "settings.json MISSING at $SETTINGS — hooks not registered"
  exit 1
fi

# 2. defaultMode is bypassPermissions
mode=$(python3 -c "import json; d=json.load(open('$SETTINGS')); print(d.get('permissions',{}).get('defaultMode',''))" 2>/dev/null || echo "")
if [ "$mode" = "bypassPermissions" ]; then
  ok "defaultMode=bypassPermissions (hooks are the control plane — expected)"
else
  warn "defaultMode='$mode' — expected 'bypassPermissions'. Hooks may not be active."
fi

# 3. Hook scripts: exist + executable + registered
echo ""
echo "Hook scripts:"

check_script() {
  local script="$1"
  local desc="$2"
  local path="$HOOKS_DIR/$script"

  if [ ! -f "$path" ]; then
    warn "$script MISSING — $desc"
    return
  fi
  if [ ! -x "$path" ]; then
    warn "$script not executable — hook will fail silently ($desc)"
    return
  fi

  registered=$(python3 -c "
import json
d = json.load(open('$SETTINGS'))
hooks = d.get('hooks', {})
cmds = [h.get('command','') for ev in hooks.values() for e in ev for h in e.get('hooks',[])]
print('yes' if any('$script' in c for c in cmds) else 'no')
" 2>/dev/null || echo "no")

  if [ "$registered" = "yes" ]; then
    ok "$script ($desc)"
  else
    warn "$script exists but NOT registered in settings.json ($desc)"
  fi
}

check_script "check-risky-command.sh"  "PreToolUse[Bash] — destructive/deploy/db/credential guard"
check_script "check-sensitive-edit.sh" "PreToolUse[Edit/Write/MultiEdit] — credential file edit guard"
check_script "inject-handoff.sh"       "UserPromptSubmit — injects .ai/current.md into session"
check_script "auto-handoff.sh"         "Stop — writes .ai/current.md on session end"

echo ""
echo "=== Results: $pass passed, $fail failed ==="

if [ "$fail" -gt 0 ]; then
  echo "ACTION REQUIRED: fix the failed checks above to restore hook safety coverage."
  exit 1
else
  echo "All hooks healthy."
  exit 0
fi
