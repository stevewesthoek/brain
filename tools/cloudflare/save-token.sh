#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 4 || $# -gt 5 ]]; then
  cat >&2 <<'EOF'
usage: save-token.sh <profile-name> <account-id> <account-name> <default-zone-name> [email]
EOF
  exit 1
fi

profile_name="$1"
account_id="$2"
account_name="$3"
default_zone_name="$4"
email="${5:-}"

cred_dir="${CLOUDFLARE_AI_CREDENTIALS_DIR:-$HOME/.config/cloudflare-ai/credentials}"
cred_file="${cred_dir}/${profile_name}.env"

mkdir -p "${cred_dir}"
chmod 700 "${cred_dir}"

printf 'Paste Cloudflare API token for %s: ' "${profile_name}" >&2
stty -echo
IFS= read -r api_token
stty echo
printf '\n' >&2

cat > "${cred_file}" <<EOF
CLOUDFLARE_PROFILE_NAME=${profile_name}
CLOUDFLARE_ACCOUNT_ID=${account_id}
CLOUDFLARE_ACCOUNT_NAME=$(printf '%q' "${account_name}")
CLOUDFLARE_DEFAULT_ZONE_NAME=${default_zone_name}
CLOUDFLARE_EMAIL=${email}
CLOUDFLARE_API_TOKEN=${api_token}
EOF

chmod 600 "${cred_file}"
echo "Saved ${cred_file}" >&2
