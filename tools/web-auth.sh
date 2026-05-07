#!/usr/bin/env bash
# web-auth — Save and restore named browser auth profiles for the /web orchestrator.
# Usage:
#   web-auth save <name>           Save current browse session cookies to a named profile
#   web-auth restore <name>        Restore a named profile into the current browse session
#   web-auth list                  List all saved profiles
#   web-auth delete <name>         Delete a named profile
#   web-auth show <name>           Show profile metadata (no cookie values)
#
# Profiles stored in: ~/.web-profiles/
# Never commits profiles to git (they contain session tokens).

set -euo pipefail

PROFILES_DIR="${HOME}/.web-profiles"
mkdir -p "$PROFILES_DIR"

cmd="${1:-help}"
shift 2>/dev/null || true

case "$cmd" in

  save)
    name="${1:?Usage: web-auth save <name>}"
    profile="${PROFILES_DIR}/${name}.json"

    echo "Dumping cookies from current browse session..."
    cookies_json="$(browse cookies 2>/dev/null)" || {
      echo "Error: could not read cookies. Is browse running? Try: browse goto <url> first." >&2
      exit 1
    }

    if [ -z "$cookies_json" ] || [ "$cookies_json" = "[]" ]; then
      echo "Warning: no cookies in current session. Log in first, then save." >&2
      exit 1
    fi

    # Detect domain from first cookie
    domain="$(echo "$cookies_json" | grep -o '"domain":"[^"]*"' | head -1 | cut -d'"' -f4)"
    saved="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

    # Write profile with metadata wrapper
    tmp="$(mktemp)"
    cat > "$tmp" <<JSON
{
  "name": "${name}",
  "domain": "${domain:-unknown}",
  "saved": "${saved}",
  "note": "",
  "cookies": ${cookies_json}
}
JSON
    mv "$tmp" "$profile"

    echo "✓ Auth profile saved: ${name}"
    echo "  Domain : ${domain:-unknown}"
    echo "  Saved  : ${saved}"
    echo "  Path   : ${profile}"
    echo ""
    echo "Restore anytime with: web-auth restore ${name}"
    ;;

  restore)
    name="${1:?Usage: web-auth restore <name>}"
    profile="${PROFILES_DIR}/${name}.json"

    if [ ! -f "$profile" ]; then
      echo "Error: profile '${name}' not found." >&2
      echo "Available profiles:" >&2
      ls "$PROFILES_DIR"/*.json 2>/dev/null | xargs -I{} basename {} .json | sed 's/^/  /' >&2
      exit 1
    fi

    # Extract cookies array only (strip metadata wrapper)
    tmp="/tmp/web-auth-restore-$$.json"
    # Use python for reliable JSON extraction (no jq dependency)
    python3 -c "
import json, sys
data = json.load(open('${profile}'))
json.dump(data['cookies'], sys.stdout)
" > "$tmp"

    echo "Restoring auth profile: ${name}..."
    browse cookie-import "$tmp"
    rm -f "$tmp"

    # Show metadata
    domain="$(grep -o '"domain":"[^"]*"' "$profile" | head -1 | cut -d'"' -f4)"
    saved="$(grep -o '"saved":"[^"]*"' "$profile" | head -1 | cut -d'"' -f4)"

    echo "✓ Auth profile restored: ${name}"
    echo "  Domain : ${domain:-unknown}"
    echo "  Saved  : ${saved}"
    echo ""
    echo "Session is now authenticated. Continue with: browse goto <url>"
    ;;

  list)
    profiles=("${PROFILES_DIR}"/*.json)
    if [ ! -e "${profiles[0]}" ]; then
      echo "No auth profiles saved yet."
      echo "Save one with: web-auth save <name>"
      exit 0
    fi

    echo "Saved auth profiles:"
    echo ""
    printf "  %-20s %-30s %s\n" "NAME" "DOMAIN" "SAVED"
    printf "  %-20s %-30s %s\n" "----" "------" "-----"
    for f in "${PROFILES_DIR}"/*.json; do
      n="$(basename "$f" .json)"
      domain="$(grep -o '"domain":"[^"]*"' "$f" | head -1 | cut -d'"' -f4)"
      saved="$(grep -o '"saved":"[^"]*"' "$f" | head -1 | cut -d'"' -f4)"
      printf "  %-20s %-30s %s\n" "$n" "${domain:-unknown}" "${saved:-unknown}"
    done
    echo ""
    echo "Restore with: web-auth restore <name>"
    ;;

  delete)
    name="${1:?Usage: web-auth delete <name>}"
    profile="${PROFILES_DIR}/${name}.json"

    if [ ! -f "$profile" ]; then
      echo "Error: profile '${name}' not found." >&2
      exit 1
    fi

    read -r -p "Delete auth profile '${name}'? This cannot be undone. [y/N] " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
      rm "$profile"
      echo "✓ Deleted: ${name}"
    else
      echo "Cancelled."
    fi
    ;;

  show)
    name="${1:?Usage: web-auth show <name>}"
    profile="${PROFILES_DIR}/${name}.json"

    if [ ! -f "$profile" ]; then
      echo "Error: profile '${name}' not found." >&2
      exit 1
    fi

    # Show metadata only — never print cookie values
    python3 -c "
import json
data = json.load(open('${profile}'))
print(f'Name    : {data.get(\"name\", \"?\")}')
print(f'Domain  : {data.get(\"domain\", \"?\")}')
print(f'Saved   : {data.get(\"saved\", \"?\")}')
print(f'Note    : {data.get(\"note\", \"(none)\")}')
print(f'Cookies : {len(data.get(\"cookies\", []))} entries (values hidden)')
"
    ;;

  help|--help|-h)
    cat <<'EOF'
web-auth — Named auth profile manager for the /web orchestrator

Commands:
  save <name>      Save current browse session cookies as a named profile
  restore <name>   Restore a named profile into the current browse session
  list             List all saved profiles (name, domain, date)
  delete <name>    Delete a saved profile (prompts for confirmation)
  show <name>      Show profile metadata without exposing cookie values

Profiles stored at: ~/.web-profiles/
Security: profiles contain session tokens — never commit to git.

Examples:
  web-auth save ing-bank       # After logging into ING
  web-auth restore ing-bank    # Next time — no re-login needed
  web-auth list                # See what you have
  web-auth delete old-session  # Clean up stale profiles

EOF
    ;;

  *)
    echo "Unknown command: ${cmd}" >&2
    echo "Run: web-auth help" >&2
    exit 1
    ;;

esac
