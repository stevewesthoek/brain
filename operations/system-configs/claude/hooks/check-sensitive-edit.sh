#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

extract_path() {
  printf '%s' "$INPUT" | python3 -c 'import json,sys
try:
    payload = json.loads(sys.stdin.read())
    tool_input = payload.get("tool_input", {})
    print(tool_input.get("file_path") or tool_input.get("path") or "")
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

TARGET_PATH="$(extract_path)"
[ -n "$TARGET_PATH" ] || allow

TARGET_LOWER=$(printf '%s' "$TARGET_PATH" | tr '[:upper:]' '[:lower:]')

case "$TARGET_LOWER" in
  *"/operations/system-configs/claude/settings.json"|*"/operations/system-configs/codex/config.toml")
    ask "Editing a global AI configuration file changes agent behavior across sessions. Confirm before proceeding."
    ;;
esac

case "$TARGET_LOWER" in
  *"/.ssh/"*|*"id_rsa"*|*"id_ed25519"*|*.pem|*.key|*.p12|*.cer|*.crt|*"auth.json"*|*"credentials.json"*|*"/.aws/credentials"*|*"application_default_credentials.json"*|*.npmrc|*.pypirc|*"oauth_creds"*|*"oauth-creds"*|*"_accounts.json"*|*"client_secret"*|*"embedded.provisionprofile"*|*.mobileprovision|*"/.kube/config"*|*"/.docker/config.json"*|*"token"*|*"secret"*|*"private"*|*"credential"*|*"keychain"*)
    ask "Editing a sensitive credentials file detected. Confirm before changing secret-bearing material."
    ;;
esac

case "$TARGET_LOWER" in
  */.env|*/.env.*)
    case "$TARGET_LOWER" in
      *.env.example|*.env.sample|*.env.template)
        allow
        ;;
      *)
        ask "Editing an environment file detected. Confirm before changing secret or config values."
        ;;
    esac
    ;;
esac

allow
