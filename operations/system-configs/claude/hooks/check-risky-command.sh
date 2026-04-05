#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

extract_command() {
  printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    payload = json.loads(sys.stdin.read())
    tool_input = payload.get("tool_input", {})
    print(tool_input.get("command", ""))
except Exception:
    pass
' 2>/dev/null || true
}

ask() {
  local reason="$1"
  python3 - <<'PY' "$reason"
import json, sys
reason = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "ask",
        "permissionDecisionReason": reason,
    }
}))
PY
  exit 0
}

allow() {
  echo '{}'
  exit 0
}

auto_allow_sensitive() {
  local reason="$1"
  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  local log_file="/Users/Office/Repos/stevewesthoek/brain/operations/security-auto-approvals.log"

  # Log the event
  printf '[%s] AUTO-APPROVED | %s\nCommand: %s\n\n' \
    "$timestamp" "$reason" "$CMD" >> "$log_file"

  # Auto-commit the log entry (non-blocking background process)
  (
    cd /Users/Office/Repos/stevewesthoek/brain
    git add operations/security-auto-approvals.log
    git commit -m "security: auto-approved sensitive file access at $timestamp" 2>/dev/null
  ) &

  # Notify Claude so it surfaces in the conversation
  printf '[Security Guard] NOTICE: Sensitive credential file access detected.\nReason: %s\nTime: %s\nAuto-approved and logged to %s\n' \
    "$reason" "$timestamp" "$log_file" >&2

  python3 - <<PY "$reason"
import json, sys
reason = sys.argv[1]
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "allow",
        "permissionDecisionReason": f"[Security Guard] Auto-approved and logged: {reason}",
    }
}))
PY
  exit 0
}

CMD="$(extract_command)"
[ -n "$CMD" ] || allow

CMD_LOWER=$(printf '%s' "$CMD" | tr '[:upper:]' '[:lower:]')

is_local_db_command=false
if printf '%s' "$CMD_LOWER" | grep -Eq 'localhost|127\.0\.0\.1|::1|docker exec|postgres://postgres:postgres@localhost|postgresql://postgres:postgres@localhost'; then
  is_local_db_command=true
fi

# Safe cleanup exceptions for common build artifacts.
if printf '%s' "$CMD" | grep -qE 'rm[[:space:]]+(-[A-Za-z]*r[A-Za-z]*|--recursive)' 2>/dev/null; then
  safe_only=true
  rm_args=$(printf '%s' "$CMD" | sed -E 's/.*rm[[:space:]]+(-[A-Za-z]+[[:space:]]+)*//;s/--recursive[[:space:]]*//')
  for target in $rm_args; do
    case "$target" in
      */node_modules|node_modules|*/.next|.next|*/dist|dist|*/__pycache__|__pycache__|*/.cache|.cache|*/build|build|*/.turbo|.turbo|*/coverage|coverage)
        ;;
      -*)
        ;;
      *)
        safe_only=false
        break
        ;;
    esac
  done
  if [ "$safe_only" = true ]; then
    allow
  fi
fi

# 1. Destructive filesystem and git operations.
if printf '%s' "$CMD" | grep -qE 'rm[[:space:]]+(-[A-Za-z]*r|--recursive)' 2>/dev/null; then
  ask "Recursive delete detected. Target and blast radius should be confirmed before removing files."
fi

if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+push[[:space:]].*(-f\b|--force)' 2>/dev/null; then
  ask "Force-push detected. This rewrites remote history and should be confirmed."
fi

if printf '%s' "$CMD" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard|git[[:space:]]+(checkout|restore)[[:space:]]+\.' 2>/dev/null; then
  ask "History or working-tree destructive git command detected. Confirm before discarding work."
fi

# 2. Deployments and remote infra mutations.
if printf '%s' "$CMD_LOWER" | grep -qE '\b(wrangler[[:space:]]+deploy|vercel([[:space:]].*)?[[:space:]]+deploy|flyctl?[[:space:]]+deploy|netlify[[:space:]]+deploy|terraform[[:space:]]+(apply|destroy)|pulumi[[:space:]]+(up|destroy)|kubectl[[:space:]]+(apply|delete|scale|rollout[[:space:]]+restart|set[[:space:]]+image)|helm[[:space:]]+(upgrade|install|uninstall|rollback)|dokploy(-cli)?[[:space:]].*\bdeploy\b|npm[[:space:]]+publish|cargo[[:space:]]+publish|gh[[:space:]]+release[[:space:]]+create)\b' 2>/dev/null; then
  ask "Deployment or infrastructure mutation detected. Confirm target environment and rollback before proceeding."
fi

# 3. Database mutations against non-local or unclear targets.
if [ "$is_local_db_command" != true ] && printf '%s' "$CMD_LOWER" | grep -qE '\b(supabase[[:space:]]+db[[:space:]]+push|supabase[[:space:]]+migration|prisma[[:space:]]+migrate[[:space:]]+deploy|prisma[[:space:]]+migrate[[:space:]]+reset|drizzle-kit[[:space:]]+push|alembic[[:space:]]+upgrade|rails[[:space:]]+db:migrate|knex[[:space:]]+migrate:latest|sequelize[[:space:]]+db:migrate|pg_restore|createdb|dropdb)\b' 2>/dev/null; then
  ask "Database migration or mutation command detected. Confirm environment, rollback path, and data risk first."
fi

if [ "$is_local_db_command" != true ] && printf '%s' "$CMD_LOWER" | grep -qE '\b(psql|mysql|mongosh)\b' 2>/dev/null && printf '%s' "$CMD_LOWER" | grep -qE 'drop[[:space:]]+(table|database|schema)|truncate|alter[[:space:]]+table|create[[:space:]]+database|delete[[:space:]]+from|update[[:space:]]+[a-z_]|insert[[:space:]]+into' 2>/dev/null; then
  ask "Potential remote database mutation detected. Confirm target environment and data safety first."
fi

# 4. Sensitive file printing or mutation.
if printf '%s' "$CMD" | grep -qE '(^|[[:space:]])(cat|less|more|head|tail|cp|mv|rm|scp|pbcopy|tee|sed[[:space:]]+-i|perl[[:space:]]+-0pi)\b' 2>/dev/null; then
  if printf '%s' "$CMD" | grep -qE '(^|[[:space:]])([^[:space:]]*\.pem|[^[:space:]]*\.key|[^[:space:]]*id_rsa|[^[:space:]]*id_ed25519|[^[:space:]]*auth\.json|[^[:space:]]*credentials\.json|[^[:space:]]*\.npmrc|[^[:space:]]*\.pypirc|[^[:space:]]*\.env([[:space:]]|$)|[^[:space:]]*/\.aws/credentials|[^[:space:]]*application_default_credentials\.json)' 2>/dev/null; then
    if ! printf '%s' "$CMD" | grep -qE '\.env\.(example|sample|template)' 2>/dev/null; then
      auto_allow_sensitive "Sensitive credential file access or mutation detected."
    fi
  fi
fi

allow
