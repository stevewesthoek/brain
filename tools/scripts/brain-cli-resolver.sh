#!/usr/bin/env bash
# Shared, bounded Brain CLI discovery for repository launchers.
#
# Resolution order is deliberate:
#   1. explicit BRAIN_AGENT_BIN
#   2. active installed Brain runtime package
#   3. Brain source checkout (built CLI, with safe local build if needed)
#   4. executable brain-agent compatibility fallback from PATH
#
# The resolver always returns a JavaScript entrypoint plus a compatible Node
# executable. It never executes a PATH binary directly and never installs
# dependencies or changes production state.

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
    # An installation record exists but does not point to a verified package.
    # Do not silently select an older/rollback release from the same directory.
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

brain_source_core_root() {
  local source_root="${BRAIN_AGENT_SOURCE_ROOT:-${BRAIN_REPOSITORY_ROOT:-}}"
  [[ -n "$source_root" ]] || return 1
  source_root="$(cd "$source_root" 2>/dev/null && pwd -P)" || return 1
  if [[ -f "$source_root/projects/brain-core/package.json" ]]; then
    printf '%s\n' "$source_root/projects/brain-core"
    return 0
  fi
  if [[ -f "$source_root/package.json" && ( -d "$source_root/dist" || -x "$source_root/node_modules/.bin/tsc" ) ]]; then
    printf '%s\n' "$source_root"
    return 0
  fi
  return 1
}

brain_find_source_cli() {
  local core_root cli_path npm_bin
  core_root="$(brain_source_core_root 2>/dev/null || true)"
  [[ -n "$core_root" ]] || return 1
  cli_path="$core_root/dist/bin/brain-agent.js"
  if ! brain_cli_file_valid "$cli_path" && [[ "${BRAIN_AGENT_AUTO_BUILD:-1}" != "0" ]]; then
    [[ -x "$core_root/node_modules/.bin/tsc" ]] || return 1
    npm_bin="${BRAIN_NPM_BIN:-$(command -v npm 2>/dev/null || true)}"
    [[ -n "$npm_bin" && -x "$npm_bin" ]] || return 1
    echo "Brain CLI is missing from the source checkout; running the local build." >&2
    (cd "$core_root" && "$npm_bin" run build) >&2 || return 1
  fi
  brain_cli_file_valid "$cli_path" || return 1
  printf '%s\n' "$cli_path"
}

brain_find_path_cli() {
  local candidate
  candidate="$(command -v brain-agent 2>/dev/null || true)"
  [[ -n "$candidate" && "$candidate" == /* && -f "$candidate" && -x "$candidate" ]] || return 1
  printf '%s\n' "$candidate"
}

brain_resolve_cli() {
  local candidate node_bin
  BRAIN_RESOLVED_CLI=""
  BRAIN_RESOLVED_NODE=""
  BRAIN_RESOLVED_KIND=""
  BRAIN_RESOLUTION_ERROR=""

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
    if [[ -n "$candidate" ]]; then
      BRAIN_RESOLVED_KIND="installed runtime"
    else
      candidate="$(brain_find_source_cli || true)"
      if [[ -n "$candidate" ]]; then
        BRAIN_RESOLVED_KIND="Brain source checkout"
      else
        candidate="$(brain_find_path_cli 2>/dev/null || true)"
        if [[ -n "$candidate" ]]; then
          BRAIN_RESOLVED_KIND="PATH compatibility fallback"
        else
          BRAIN_RESOLUTION_ERROR="no verified Brain CLI found (checked explicit override, installed runtime, source checkout, and PATH)"
          return 1
        fi
      fi
    fi
  fi

  node_bin="$(brain_find_node 2>/dev/null || true)"
  if [[ -z "$node_bin" ]]; then
    BRAIN_RESOLUTION_ERROR="no compatible Node.js runtime found (Brain requires Node >=22.5.0)"
    return 1
  fi
  BRAIN_RESOLVED_CLI="$candidate"
  BRAIN_RESOLVED_NODE="$node_bin"
  return 0
}

brain_resolution_summary() {
  printf 'kind=%s\nnode=%s\ncli=%s\n' \
    "$BRAIN_RESOLVED_KIND" "$BRAIN_RESOLVED_NODE" "$BRAIN_RESOLVED_CLI"
}
