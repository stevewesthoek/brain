#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
resolver="$repo_root/tools/scripts/brain-cli-resolver.sh"
repos_script="$repo_root/tools/scripts/repos.sh"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/brain-repos-test.XXXXXX")"
trap 'rm -rf "$tmp_root"' EXIT

fake_node="$tmp_root/node"
cat > "$fake_node" <<'EOF'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then
  echo v26.8.2
  exit 0
fi
exit 0
EOF
chmod +x "$fake_node"

make_installed() {
  local base="$1" release="$1/releases/brain-runtime-package:sha256:test"
  mkdir -p "$release/core/dist/bin"
  : > "$release/core/dist/bin/brain-agent.js"
  cat > "$release/manifest.json" <<'EOF'
{"schemaVersion":"brain-runtime-package-v1","packageId":"brain-runtime-package:sha256:test"}
EOF
  cat > "$base/install.json" <<EOF
{"schemaVersion":"brain-local-install-v1","packageId":"brain-runtime-package:sha256:test","releaseRoot":"$release"}
EOF
}

resolve() {
  env \
    BRAIN_NODE_BIN="$fake_node" \
    BRAIN_AGENT_INSTALL_ROOT="$1" \
    BRAIN_AGENT_SOURCE_ROOT="${2:-$tmp_root/no-source}" \
    BRAIN_AGENT_AUTO_BUILD="${3:-0}" \
    BRAIN_NPM_BIN="${5:-}" \
    PATH="${4:-/usr/bin:/bin}" \
    bash -c 'source "$1"; brain_resolve_cli || exit 1; brain_resolution_summary' _ "$resolver"
}

assert_contains() {
  local haystack="$1" needle="$2"
  [[ "$haystack" == *"$needle"* ]] || { echo "expected '$needle' in:\n$haystack" >&2; exit 1; }
}

# A: a PATH CLI works when no canonical installed/source candidate exists.
path_bin="$tmp_root/path-bin"
mkdir -p "$path_bin"
cat > "$path_bin/brain-agent" <<'EOF'
#!/usr/bin/env node
EOF
chmod +x "$path_bin/brain-agent"
out="$(resolve "$tmp_root/no-installed" "$tmp_root/no-source" 0 "$path_bin:/usr/bin:/bin")"
assert_contains "$out" 'kind=PATH compatibility fallback'

# B/J: canonical installed runtime wins over a stale/wrong PATH CLI.
installed="$tmp_root/installed"
make_installed "$installed"
out="$(resolve "$installed" "$tmp_root/no-source" 0 "$path_bin:/usr/bin:/bin")"
assert_contains "$out" 'kind=installed runtime'
installed_real="$(cd "$installed" && pwd -P)"
assert_contains "$out" "$installed_real/releases/brain-runtime-package:sha256:test/core/dist/bin/brain-agent.js"

# C: a built development CLI works without global linking.
source_core="$tmp_root/source-core"
mkdir -p "$source_core/dist/bin"
: > "$source_core/dist/bin/brain-agent.js"
touch "$source_core/package.json"
out="$(resolve "$tmp_root/no-installed" "$source_core" 0 "/usr/bin:/bin")"
assert_contains "$out" 'kind=Brain source checkout'

# D: missing source dist is repaired by a local build only.
build_core="$tmp_root/build-core"
mkdir -p "$build_core/node_modules/.bin"
touch "$build_core/package.json" "$build_core/node_modules/.bin/tsc"
chmod +x "$build_core/node_modules/.bin/tsc"
fake_npm="$tmp_root/npm"
cat > "$fake_npm" <<'EOF'
#!/usr/bin/env bash
set -e
[[ "${1:-}" == "run" && "${2:-}" == "build" ]]
mkdir -p dist/bin
: > dist/bin/brain-agent.js
EOF
chmod +x "$fake_npm"
out="$(resolve "$tmp_root/no-installed" "$build_core" 1 "/usr/bin:/bin" "$fake_npm")"
assert_contains "$out" 'kind=Brain source checkout'
[[ -f "$build_core/dist/bin/brain-agent.js" ]]

# E: fail closed when every resolution path is absent.
if resolve "$tmp_root/no-installed" "$tmp_root/no-source" 0 "/usr/bin:/bin" >/dev/null 2>&1; then
  echo 'expected resolver failure with no candidates' >&2
  exit 1
fi

# F/G/H/I: selected paths with spaces are preserved and model arguments stay bounded.
selected="$tmp_root/selected repo with spaces"
mkdir -p "$selected"
selected_pwd="$(cd "$selected" && pwd)"
for model in auto minimax-m2.5 glm-5 opus-4.6; do
  out="$(cd "$selected" && BRAIN_NODE_BIN="$fake_node" BRAIN_AGENT_INSTALL_ROOT="$installed" \
    REPOS_LAUNCH_DRY_RUN=1 bash "$repos_script" --launch-brain-test "$model")"
  assert_contains "$out" "cwd=$selected_pwd"
  assert_contains "$out" 'kind=installed runtime'
  if [[ "$model" == auto ]]; then
    assert_contains "$out" 'args=run'
  else
    assert_contains "$out" "args=run --model $model"
  fi
done

# Explicit override remains available for managed callers.
override="$tmp_root/override.js"
: > "$override"
out="$(BRAIN_AGENT_BIN="$override" BRAIN_NODE_BIN="$fake_node" BRAIN_AGENT_INSTALL_ROOT="$tmp_root/no-installed" \
  PATH="/usr/bin:/bin" bash -c 'source "$1"; brain_resolve_cli || exit 1; brain_resolution_summary' _ "$resolver")"
assert_contains "$out" 'kind=explicit override'

echo 'PASS repos Brain CLI resolution: 12 scenarios'
