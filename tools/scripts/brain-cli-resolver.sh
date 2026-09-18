#!/usr/bin/env bash
# Resolve the verified Brain runtime used by repository launchers.
#
# The current-main source checkout does not expose the terminal `run` contract;
# prefer the installed, manifest-verified runtime and fail closed otherwise.
# An explicit file override remains available for tests and managed callers.

brain_cli_file_valid() {
  [[ -f "$1" && ! -d "$1" ]]
}

brain_node_compatible() {
  local node_bin="$1"
  local version major minor
  [[ -x "$node_bin" ]] || return 1
  version="$($node_bin --version 2>/dev/null || true)"
  [[ "$version" =~ ^v([0-9]+)\.([0-9]+)\. ]] || return 1
  major="${BASH_REMATCH[1]}"
  minor="${BASH_REMATCH[2]}"
  (( major > 22 || (major == 22 && minor >= 5) ))
}

brain_find_node() {
  local candidate
  local candidates=""
  if [[ -n "${BRAIN_NODE_BIN:-}" ]]; then
    candidates="${BRAIN_NODE_BIN}"
  else
    candidates="/opt/homebrew/bin/node"
    candidate="$(command -v node 2>/dev/null || true)"
    [[ -n "$candidate" && "$candidate" != "/opt/homebrew/bin/node" ]] && candidates="$candidates
$candidate"
  fi

  while IFS= read -r candidate; do
    [[ -z "$candidate" ]] && continue
    if brain_node_compatible "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done <<< "$candidates"
  return 1
}

brain_find_installed_cli() {
  local install_root="${BRAIN_AGENT_INSTALL_ROOT:-$HOME/Library/Application Support/Brain/agent-mode-rc6}"

  python3 - "$install_root" <<'PYEOF'
import json
import os
import sys

base = os.path.realpath(sys.argv[1])
install_path = os.path.join(base, "install.json")

def candidate_is_valid(release_root, expected_package_id=None):
    release_root = os.path.realpath(release_root)
    releases_root = os.path.join(base, "releases")
    try:
        if os.path.commonpath((release_root, releases_root)) != releases_root:
            return None
    except ValueError:
        return None
    manifest_path = os.path.join(release_root, "manifest.json")
    cli_path = os.path.join(release_root, "core", "dist", "bin", "brain-agent.js")
    if not os.path.isfile(manifest_path) or not os.path.isfile(cli_path):
        return None
    try:
        with open(manifest_path, encoding="utf-8") as handle:
            manifest = json.load(handle)
    except (OSError, ValueError):
        return None
    if manifest.get("schemaVersion") != "brain-runtime-package-v1":
        return None
    package_id = manifest.get("packageId")
    if not isinstance(package_id, str) or not package_id:
        return None
    if expected_package_id and package_id != expected_package_id:
        return None
    return cli_path

expected_package_id = None
release_root = None
if os.path.isfile(install_path):
    try:
        with open(install_path, encoding="utf-8") as handle:
            install = json.load(handle)
        expected_package_id = install.get("packageId")
        release_root = install.get("releaseRoot")
    except (OSError, ValueError):
        raise SystemExit(0)

if isinstance(release_root, str):
    result = candidate_is_valid(release_root, expected_package_id)
    if result:
        print(result)
    raise SystemExit(0)
if os.path.isfile(install_path):
    raise SystemExit(0)

releases_root = os.path.join(base, "releases")
if os.path.isdir(releases_root):
    for name in sorted(os.listdir(releases_root), reverse=True):
        result = candidate_is_valid(os.path.join(releases_root, name), None)
        if result:
            print(result)
            raise SystemExit(0)
PYEOF
}

brain_find_path_cli() {
  local candidate
  candidate="$(command -v brain-agent 2>/dev/null || true)"
  [[ -n "$candidate" && "$candidate" == /* && -f "$candidate" && -x "$candidate" ]] || return 1
  printf '%s\n' "$candidate"
}

brain_cli_supports_run() {
  local node_bin="$1"
  local cli="$2"
  local output
  output="$(env \
    -u BRAIN_AGENT_MODE_HARNESS_ROOT \
    -u BRAIN_AGENT_MODE_ACCOUNT_REF \
    -u BRAIN_AGENT_MODE_ROUTE_EVIDENCE_JSON \
    -u BRAIN_AGENT_MODE_ACCESS_EVIDENCE_JSON \
    "$node_bin" "$cli" run --help 2>&1 || true)"
  [[ "$output" == *'brain-agent run'* && "$output" != *'Usage: brain-agent capabilities'* ]]
}

brain_resolve_cli() {
  local candidate node_bin
  BRAIN_RESOLVED_CLI=""
  BRAIN_RESOLVED_NODE=""
  BRAIN_RESOLVED_KIND=""
  BRAIN_RESOLUTION_ERROR=""

  node_bin="$(brain_find_node 2>/dev/null || true)"
  if [[ -z "$node_bin" ]]; then
    BRAIN_RESOLUTION_ERROR="no compatible Node.js runtime found (Brain requires Node >=22.5.0)"
    return 1
  fi

  if [[ -n "${BRAIN_AGENT_BIN:-}" ]]; then
    if [[ "$BRAIN_AGENT_BIN" == /* ]] && brain_cli_file_valid "$BRAIN_AGENT_BIN"; then
      candidate="$BRAIN_AGENT_BIN"
      BRAIN_RESOLVED_KIND="explicit override"
    else
      BRAIN_RESOLUTION_ERROR="BRAIN_AGENT_BIN is not a readable regular file: $BRAIN_AGENT_BIN"
      return 1
    fi
  else
    candidate="$(brain_find_installed_cli 2>/dev/null || true)"
    if [[ -n "$candidate" ]] && brain_cli_supports_run "$node_bin" "$candidate"; then
      BRAIN_RESOLVED_KIND="installed runtime"
    else
      candidate="$(brain_find_path_cli 2>/dev/null || true)"
      if [[ -n "$candidate" ]] && brain_cli_supports_run "$node_bin" "$candidate"; then
        BRAIN_RESOLVED_KIND="PATH compatibility fallback"
      else
        BRAIN_RESOLUTION_ERROR="no verified Brain CLI with the supported run contract found"
        return 1
      fi
    fi
  fi

  BRAIN_RESOLVED_CLI="$candidate"
  BRAIN_RESOLVED_NODE="$node_bin"
  return 0
}

brain_resolution_summary() {
  printf 'kind=%s\nnode=%s\ncli=%s\n' \
    "$BRAIN_RESOLVED_KIND" "$BRAIN_RESOLVED_NODE" "$BRAIN_RESOLVED_CLI"
}
