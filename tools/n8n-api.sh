#!/usr/bin/env bash
set -euo pipefail

CONFIG_FILE="${N8N_CONFIG_FILE:-$HOME/.config/n8n/.env}"

usage() {
  cat <<'EOF'
Usage:
  n8n-api.sh help
  n8n-api.sh request <METHOD> <PATH> [json_file|-]
  n8n-api.sh list-workflows
  n8n-api.sh get-workflow <id>
  n8n-api.sh create-workflow <json_file|->
  n8n-api.sh update-workflow <id> <json_file|->
  n8n-api.sh delete-workflow <id>
  n8n-api.sh activate-workflow <id> [versionId]
  n8n-api.sh deactivate-workflow <id>
  n8n-api.sh credential-schema <credentialTypeName>
  n8n-api.sh create-credential <json_file|->
  n8n-api.sh update-credential <id> <json_file|->
  n8n-api.sh list-projects
  n8n-api.sh list-variables
  n8n-api.sh create-variable <json_file|->

Environment:
  Reads credentials from ~/.config/n8n/.env by default.
  Required vars: N8N_API_URL, N8N_API_KEY
EOF
}

load_env() {
  if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
  fi

  : "${N8N_API_URL:?N8N_API_URL is required}"
  : "${N8N_API_KEY:?N8N_API_KEY is required}"
}

pretty_print() {
  if command -v jq >/dev/null 2>&1; then
    jq .
  else
    cat
  fi
}

api_request() {
  local method="$1"
  local path="$2"
  local body_source="${3:-}"
  local url="${N8N_API_URL}${path}"
  local -a curl_args=(
    -fsS
    -X "$method"
    -H "X-N8N-API-KEY: $N8N_API_KEY"
    -H "Accept: application/json"
    "$url"
  )

  if [[ -n "$body_source" ]]; then
    curl_args+=(-H "Content-Type: application/json")
    if [[ "$body_source" == "-" ]]; then
      curl_args+=(--data-binary @-)
    else
      curl_args+=(--data-binary "@$body_source")
    fi
  fi

  curl "${curl_args[@]}"
}

post_without_body() {
  local path="$1"
  curl -fsS -X POST \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Accept: application/json" \
    "${N8N_API_URL}${path}"
}

main() {
  local cmd="${1:-help}"
  load_env

  case "$cmd" in
    help|-h|--help)
      usage
      ;;
    request)
      local method="${2:?METHOD is required}"
      local path="${3:?PATH is required}"
      local body="${4:-}"
      api_request "$method" "$path" "$body" | pretty_print
      ;;
    list-workflows)
      api_request GET "/workflows" | pretty_print
      ;;
    get-workflow)
      api_request GET "/workflows/${2:?workflow id is required}" | pretty_print
      ;;
    create-workflow)
      api_request POST "/workflows" "${2:?json file or - is required}" | pretty_print
      ;;
    update-workflow)
      api_request PUT "/workflows/${2:?workflow id is required}" "${3:?json file or - is required}" | pretty_print
      ;;
    delete-workflow)
      api_request DELETE "/workflows/${2:?workflow id is required}" | pretty_print
      ;;
    activate-workflow)
      local workflow_id="${2:?workflow id is required}"
      local version_id="${3:-}"
      if [[ -n "$version_id" ]]; then
        api_request POST "/workflows/${workflow_id}/activate" - <<EOF | pretty_print
{"versionId":"$version_id"}
EOF
      else
        post_without_body "/workflows/${workflow_id}/activate" | pretty_print
      fi
      ;;
    deactivate-workflow)
      post_without_body "/workflows/${2:?workflow id is required}/deactivate" | pretty_print
      ;;
    credential-schema)
      api_request GET "/credentials/schema/${2:?credential type name is required}" | pretty_print
      ;;
    create-credential)
      api_request POST "/credentials" "${2:?json file or - is required}" | pretty_print
      ;;
    update-credential)
      api_request PATCH "/credentials/${2:?credential id is required}" "${3:?json file or - is required}" | pretty_print
      ;;
    list-projects)
      api_request GET "/projects" | pretty_print
      ;;
    list-variables)
      api_request GET "/variables" | pretty_print
      ;;
    create-variable)
      api_request POST "/variables" "${2:?json file or - is required}" | pretty_print
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
}

main "$@"
