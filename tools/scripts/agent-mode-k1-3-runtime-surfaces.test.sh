#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
repos_menu="$(bash "$repo_root/tools/scripts/repos.sh" --runtime-menu)"
sessions_menu="$(bash "$repo_root/tools/scripts/sessions.sh" --runtime-menu)"

for label in Auto Codex; do
  grep -Fqx -- "$label" <<<"$repos_menu"
done
test "$(wc -l <<<"$repos_menu" | tr -d ' ')" -eq 2
! grep -Eiq 'Brain /|Claude Code|local|provider' <<<"$repos_menu"
if grep -Eiq 'qwen|ollama|haiku|local.*model|deepseek harness' <<<"$repos_menu"; then
  echo "repos.sh exposes a retired/local model surface" >&2
  exit 1
fi

for label in Auto 'MiniMax M2.5' 'GLM-5' 'Opus 4.6' Codex; do
  grep -Fqx -- "$label" <<<"$sessions_menu"
done
test "$(wc -l <<<"$sessions_menu" | tr -d ' ')" -eq 5
! grep -Eiq 'Claude Code' <<<"$sessions_menu"
grep -Fq 'Brain ·' "$repo_root/tools/scripts/sessions.sh"
grep -Fq '/agent-console' "$repo_root/tools/scripts/sessions.sh"
grep -Fq 'availability' "$repo_root/tools/scripts/sessions.sh"
for action in inspect pause resume cancel kill; do
  grep -Fq "$action" "$repo_root/tools/scripts/sessions.sh"
done
grep -Fq 'tool=$(runtime_menu | fzf' "$repo_root/tools/scripts/repos.sh"
grep -Fq 'tool=$(runtime_menu | fzf' "$repo_root/tools/scripts/sessions.sh"
grep -Fq -- '--no-sort' "$repo_root/tools/scripts/repos.sh" "$repo_root/tools/scripts/sessions.sh"
grep -Fq -- '--choose-model' "$repo_root/tools/scripts/repos.sh" "$repo_root/tools/scripts/sessions.sh"
grep -Fq 'brain-agent submit' "$repo_root/tools/scripts/repos.sh"
test -z "$(BRAIN_CORE_URL=http://127.0.0.1:9 bash "$repo_root/tools/scripts/sessions.sh" --list-brain)"
! grep -Eiq 'qwen|ollama|haiku|local.*model|provider' "$repo_root/tools/scripts/sessions.sh"
! grep -Eiq '/Users/Office|/Users/Steve' "$repo_root/tools/scripts/repos.sh" "$repo_root/tools/scripts/sessions.sh" "$repo_root/tools/scripts/jump.sh"
grep -Fq 'Brain' "$repo_root/tools/scripts/jump.sh" && { echo 'jump.sh must remain model-neutral' >&2; exit 1; } || true
bash -n "$repo_root/tools/scripts/repos.sh" "$repo_root/tools/scripts/sessions.sh" "$repo_root/tools/scripts/jump.sh"
echo 'agent-mode-k1-3-runtime-surfaces: PASS'
