#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
repos_script="$repo_root/tools/scripts/repos.sh"
resolver="$repo_root/tools/scripts/brain-cli-resolver.sh"
tmp_root="$(mktemp -d "${TMPDIR:-/tmp}/repos-launcher-current-main.XXXXXX")"
trap 'rm -rf "$tmp_root"' EXIT

real_node="$(command -v node || true)"
[[ -n "$real_node" ]] || { echo 'node is required for launcher tests' >&2; exit 1; }

mkdir -p "$tmp_root/home/Repos/test-account/test-repo/.git" "$tmp_root/bin" "$tmp_root/bin-no-codex"
fixture_repository_root="$(cd "$tmp_root/home/Repos/test-account/test-repo" && pwd -P)"

cat > "$tmp_root/fake-brain.mjs" <<'EOF'
#!/usr/bin/env node
if (process.argv[2] === '--version') {
  console.log('v22.5.0');
} else {
  console.log(JSON.stringify({kind: 'fake-brain', args: process.argv.slice(2)}));
}
EOF
chmod +x "$tmp_root/fake-brain.mjs"

cat > "$tmp_root/bin/fzf" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAKE_FZF_CANCEL:-0}" == "1" ]]; then
  cat >/dev/null
  exit 0
fi
first=""
while IFS= read -r line; do
  [[ -n "$first" || -z "$line" ]] || first="$line"
done
[[ -n "$first" ]] && printf '%s\n' "$first"
EOF
chmod +x "$tmp_root/bin/fzf"
cp "$tmp_root/bin/fzf" "$tmp_root/bin-no-codex/fzf"

cat > "$tmp_root/bin/codex" <<'EOF'
#!/usr/bin/env bash
printf 'fake-codex\n'
EOF
chmod +x "$tmp_root/bin/codex"

menu="$(bash "$repos_script" --runtime-menu)"
for label in Auto 'MiniMax M2.5' 'GLM-5' 'Opus 4.6' Codex; do
  grep -Fqx -- "$label" <<<"$menu"
done
test "$(wc -l <<<"$menu" | tr -d ' ')" -eq 5

run_brain() {
  local model="$1"
  HOME="$tmp_root/home" \
    PATH="$tmp_root/bin:/opt/homebrew/bin:/usr/bin:/bin" \
    BRAIN_AGENT_BIN="$tmp_root/fake-brain.mjs" \
    BRAIN_NODE_BIN="$real_node" \
    bash "$repos_script" --model "$model"
}

for model in auto minimax-m2.5 glm-5 opus-4.6; do
  output="$(run_brain "$model")"
  grep -Fq '"kind":"fake-brain"' <<<"$output"
  if [[ "$model" == auto ]]; then
    grep -Fq "\"args\":[\"submit\",\"--model\",\"auto\",\"--repository-ref\",\"test-account/test-repo\",\"--repository-root\",\"$fixture_repository_root\"]" <<<"$output"
  else
    grep -Fq "\"args\":[\"submit\",\"--model\",\"$model\",\"--repository-ref\",\"test-account/test-repo\",\"--repository-root\",\"$fixture_repository_root\"]" <<<"$output"
  fi
  ! grep -Fq '"run"' <<<"$output"
done
dry_run_output="$(REPOS_LAUNCH_DRY_RUN=1 run_brain auto)"
grep -Fxq "args=submit --model auto --repository-ref test-account/test-repo --repository-root $fixture_repository_root" <<<"$dry_run_output"
! grep -Fq 'args=run' <<<"$dry_run_output"

codex_output="$(HOME="$tmp_root/home" PATH="$tmp_root/bin:/usr/bin:/bin" bash "$repos_script" --model codex)"
grep -Fxq 'fake-codex' <<<"$codex_output"

bare_output="$(HOME="$tmp_root/home" PATH="$tmp_root/bin:/usr/bin:/bin" \
  BRAIN_AGENT_BIN="$tmp_root/fake-brain.mjs" BRAIN_NODE_BIN="$real_node" \
  bash "$repos_script")"
grep -Fq '"args":["submit","--model","auto","--repository-ref","test-account/test-repo"' <<<"$bare_output"
! grep -Fq 'Usage: brain-agent' <<<"$bare_output"

cancel_output="$(HOME="$tmp_root/home" PATH="$tmp_root/bin:/usr/bin:/bin" \
  FAKE_FZF_CANCEL=1 bash "$repos_script" --model auto)"
test -z "$cancel_output"

if HOME="$tmp_root/home" PATH="$tmp_root/bin:/usr/bin:/bin" \
  BRAIN_AGENT_INSTALL_ROOT="$tmp_root/no-install" BRAIN_AGENT_SOURCE_ROOT="$tmp_root/no-source" \
  BRAIN_NODE_BIN="$real_node" bash -c 'cd "$1" && exec bash "$2" --launch-brain-test auto' _ \
  "$fixture_repository_root" "$repos_script" >"$tmp_root/missing-brain.out" 2>"$tmp_root/missing-brain.err"; then
  echo 'missing Brain executable should fail clearly' >&2
  exit 1
fi
grep -Fq 'Unable to launch Brain:' "$tmp_root/missing-brain.err"

if HOME="$tmp_root/home" PATH="$tmp_root/bin:/usr/bin:/bin" \
  BRAIN_AGENT_BIN="$tmp_root/fake-brain.mjs" BRAIN_NODE_BIN="$real_node" \
  bash "$repos_script" --launch-brain-test auto >"$tmp_root/outside-repo.out" 2>"$tmp_root/outside-repo.err"; then
  echo 'repository outside ~/Repos should not launch through Brain' >&2
  exit 1
fi
grep -Fq 'selected repository is outside' "$tmp_root/outside-repo.err"

if HOME="$tmp_root/home" PATH="$tmp_root/bin-no-codex:/usr/bin:/bin" \
  bash "$repos_script" --model codex >"$tmp_root/missing-codex.out" 2>"$tmp_root/missing-codex.err"; then
  echo 'missing Codex executable should fail clearly' >&2
  exit 1
fi
grep -Fq 'codex executable not found on PATH' "$tmp_root/missing-codex.err"

grep -Fq 'submit --model auto --repository-ref' "$repos_script"
! grep -Eiq '/Users/Office|/Users/Steve' "$repos_script" "$resolver"
bash -n "$repos_script" "$resolver"

echo 'repos-launcher: PASS'
