#!/usr/bin/env bash
set -euo pipefail

state_dir="${FAKE_CURL_STATE_DIR:?FAKE_CURL_STATE_DIR is required}"
mkdir -p "$state_dir"

count_file="$state_dir/invocation-count"
count=0
if [[ -f "$count_file" ]]; then
  count="$(<"$count_file")"
fi
count="$((count + 1))"
printf '%s\n' "$count" >"$count_file"

method=""
url=""
output_file=""
data_source=""
connect_timeout=""
total_timeout=""
retry_count=""
maximum_redirects=""
proxy_bypass=""
allowed_protocols=""
maximum_response_bytes=""
http_version=""
ambient_config_disabled=false
follow_redirects=false
retry_all_errors=false
secret_header_via_file=false
write_out=""
header_names=()

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --disable)
      ambient_config_disabled=true
      shift
      ;;
    --silent|--show-error|--globoff|--fail)
      shift
      ;;
    --http1.1)
      http_version="1.1"
      shift
      ;;
    --location)
      follow_redirects=true
      shift
      ;;
    --retry-all-errors)
      retry_all_errors=true
      shift
      ;;
    --request|-X)
      method="$2"
      shift 2
      ;;
    --connect-timeout)
      connect_timeout="$2"
      shift 2
      ;;
    --max-time)
      total_timeout="$2"
      shift 2
      ;;
    --retry)
      retry_count="$2"
      shift 2
      ;;
    --max-redirs)
      maximum_redirects="$2"
      shift 2
      ;;
    --noproxy)
      proxy_bypass="$2"
      shift 2
      ;;
    --proto)
      allowed_protocols="$2"
      shift 2
      ;;
    --max-filesize)
      maximum_response_bytes="$2"
      shift 2
      ;;
    --header|-H)
      if [[ "$2" == @* ]]; then
        secret_header_via_file=true
        header_names[${#header_names[@]}]="X-N8N-API-KEY"
      else
        header_names[${#header_names[@]}]="${2%%:*}"
      fi
      shift 2
      ;;
    --data-binary)
      data_source="$2"
      shift 2
      ;;
    --output|-o)
      output_file="$2"
      shift 2
      ;;
    --write-out|-w)
      write_out="$2"
      shift 2
      ;;
    --*)
      printf 'fake curl rejected unsupported option\n' >&2
      exit 96
      ;;
    *)
      if [[ -n "$url" ]]; then
        printf 'fake curl rejected multiple URLs\n' >&2
        exit 96
      fi
      url="$1"
      shift
      ;;
  esac
done

if [[ "$url" != https://n8n.invalid/* ]]; then
  printf 'fake curl rejected non-synthetic URL\n' >&2
  exit 97
fi

payload_transport="none"
if [[ "$data_source" == @- ]]; then
  payload_transport="stdin"
  cat >"$state_dir/request-body-$count"
elif [[ "$data_source" == @* ]]; then
  payload_transport="file"
  cp -- "${data_source#@}" "$state_dir/request-body-$count"
fi

secret_env_present=false
if [[ -n "${N8N_API_KEY:-}" ]]; then
  secret_env_present=true
fi

header_list=""
if [[ "${#header_names[@]}" -gt 0 ]]; then
  old_ifs="$IFS"
  IFS=,
  header_list="${header_names[*]}"
  IFS="$old_ifs"
fi

{
  printf 'method=%s\n' "$method"
  printf 'url=%s\n' "$url"
  printf 'payload_transport=%s\n' "$payload_transport"
  printf 'connect_timeout=%s\n' "$connect_timeout"
  printf 'total_timeout=%s\n' "$total_timeout"
  printf 'retry_count=%s\n' "$retry_count"
  printf 'maximum_redirects=%s\n' "$maximum_redirects"
  printf 'proxy_bypass=%s\n' "$proxy_bypass"
  printf 'allowed_protocols=%s\n' "$allowed_protocols"
  printf 'maximum_response_bytes=%s\n' "$maximum_response_bytes"
  printf 'http_version=%s\n' "$http_version"
  printf 'ambient_config_disabled=%s\n' "$ambient_config_disabled"
  printf 'follow_redirects=%s\n' "$follow_redirects"
  printf 'retry_all_errors=%s\n' "$retry_all_errors"
  printf 'secret_header_via_file=%s\n' "$secret_header_via_file"
  printf 'secret_env_present=%s\n' "$secret_env_present"
  printf 'header_names=%s\n' "$header_list"
} >"$state_dir/request-$count"

response_path="${FAKE_CURL_RESPONSE_PATH:-}"
if [[ -n "$output_file" ]]; then
  if [[ -n "$response_path" ]]; then
    cp -- "$response_path" "$output_file"
  else
    : >"$output_file"
  fi
elif [[ -n "$response_path" ]]; then
  cat "$response_path"
fi

if [[ -n "${FAKE_CURL_STDERR:-}" ]]; then
  printf '%s' "$FAKE_CURL_STDERR" >&2
fi

if [[ -n "$write_out" ]]; then
  printf '%s' "${FAKE_CURL_HTTP_STATUS:-200}"
fi

exit "${FAKE_CURL_EXIT_CODE:-0}"
