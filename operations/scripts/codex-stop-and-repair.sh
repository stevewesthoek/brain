#!/usr/bin/env bash
set -euo pipefail

###############################################################################
# Stop the local Codex runtime surface and run the controlled Codex repair.
#
# LEGACY EXCEPTIONAL RECOVERY ONLY. The runtime-profile manager, account
# switching, onboarding, and credential-health workflows never invoke this
# script. It stops
# ChatGPT/Codex, Computer Use (including its lock-screen guardian), Codex-owned helper processes, Codex-related
# browser extension hosts, and user-owned SSH clients used for remote work.
# ChatGPTHelper and ssh-agent are deliberately excluded.
#
# Usage:
#   bash operations/scripts/codex-stop-and-repair.sh
#   bash operations/scripts/codex-stop-and-repair.sh --dry-run
#   bash operations/scripts/codex-stop-and-repair.sh --force
#
# --force is an escalation for processes that did not exit after TERM. It is
# never used implicitly. The normal path uses only graceful shutdown signals.
###############################################################################

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_REPO="${BRAIN_REPO:-$(cd -- "$SCRIPT_DIR/../.." && pwd)}"
CODEX_HOME_DIR="${CODEX_HOME:-${HOME:?HOME must be set}/.codex}"
MANAGER="$BRAIN_REPO/operations/scripts/codex-home-managed-root.sh"
OWNER="$(id -un)"
WAIT_SECONDS="${CODEX_SHUTDOWN_WAIT_SECONDS:-10}"
DRY_RUN=0
FORCE=0

say() {
  printf '%s\n' "$*" >&2
}

die() {
  say "NOT OK: $*"
  exit 1
}

usage() {
  say "Usage: $0 [--dry-run] [--force]"
  say "  --dry-run  list affected processes without stopping or repairing"
  say "  --force    send KILL only after graceful shutdown fails"
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --force) FORCE=1 ;;
    -h|--help) usage; exit 0 ;;
    *) usage; die "unknown option: $1" ;;
  esac
  shift
done

[ -x "$MANAGER" ] || die "Codex managed-root script is missing or not executable: $MANAGER"

ancestor_is_codex_runtime() {
  local pid="$$"
  local command_line parent

  while [ "$pid" -gt 1 ] 2>/dev/null; do
    command_line="$(ps -p "$pid" -o command= 2>/dev/null || true)"
    case "$command_line" in
      /Applications/ChatGPT.app/*|/Applications/Codex.app/*|*/codex-code-mode-host*|*/codex\ *|*/codex)
        return 0
        ;;
    esac
    parent="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ' || true)"
    [[ "$parent" =~ ^[0-9]+$ ]] || break
    [ "$parent" != "$pid" ] || break
    pid="$parent"
  done
  return 1
}

run_ownership_preflight() {
  BRAIN_REPO="$BRAIN_REPO" CODEX_HOME="$CODEX_HOME_DIR" \
    bash "$MANAGER" ownership-preflight
}

# Return PID<TAB>reason. Do not print full command lines: SSH arguments can
# contain host details, and process arguments are not needed for this gate.
target_processes() {
  local ps_file="${CODEX_SHUTDOWN_TEST_PS_FILE:-}"
  if [ -n "$ps_file" ]; then
    cat "$ps_file"
  else
    ps -axo pid=,ppid=,user=,command=
  fi | awk -v owner="$OWNER" '
    function reason(cmd, lower) {
      lower = tolower(cmd)
      if (cmd ~ /^\/Applications\/ChatGPT\.app\//) return "ChatGPT application"
      if (cmd ~ /^\/Applications\/Codex\.app\//) return "Codex application"
      if (cmd ~ /\/Codex Computer Use\.app\// || cmd ~ /SkyComputerUse(Client|Service)/ || lower ~ /cualockscreenguardian/) return "Computer Use"
      if (cmd ~ /\/codex-code-mode-host([[:space:]]|$)/) return "Codex code-mode host"
      if (cmd ~ /\/cua_node\/bin\/node_repl([[:space:]]|$)/) return "Codex node_repl"
      if (lower ~ /chatgpt for chrome chrome-extension:\/\//) return "Codex browser extension host"
      if (cmd ~ /^\/[^[:space:]]*\/(ssh|autossh)([[:space:]]|$)/) return "user-owned SSH session"
      if (lower ~ /(^|[[:space:]\/])codex([[:space:]]|$)/ && lower ~ /(^|[[:space:]])app-server([[:space:]]|$)/) return "Codex app-server"
      return ""
    }
    $1 ~ /^[0-9]+$/ && $3 == owner {
      command = substr($0, index($0, $4))
      why = reason(command)
      if (why != "") print $1 "\t" why
    }
  '
}

# A PID can be reused between the discovery snapshot and a signal. Reclassify
# it immediately before signaling so a recycled PID cannot receive a signal
# intended for a Codex-owned process.
is_current_target() {
  local expected_pid="$1" expected_reason="$2" pid reason
  while IFS=$'\t' read -r pid reason; do
    [ -n "$pid" ] || continue
    if [ "$pid" = "$expected_pid" ] && [ "$reason" = "$expected_reason" ]; then
      return 0
    fi
  done < <(target_processes)
  return 1
}

print_targets() {
  local pid reason count=0
  while IFS=$'\t' read -r pid reason; do
    [ -n "$pid" ] || continue
    say "AFFECTED: PID $pid — $reason"
    count=$((count + 1))
  done < <(target_processes)
  printf '%s\n' "$count"
}

request_desktop_quit() {
  # AppleScript's "quit" is the normal app shutdown path. A missing app is
  # expected and intentionally ignored.
  if command -v osascript >/dev/null 2>&1; then
    osascript -e 'tell application "ChatGPT" to quit' >/dev/null 2>&1 || true
    osascript -e 'tell application "Codex" to quit' >/dev/null 2>&1 || true
  fi
}

term_targets() {
  local pid reason
  while IFS=$'\t' read -r pid reason; do
    [ -n "$pid" ] || continue
    if ! is_current_target "$pid" "$reason"; then
      say "SKIP: PID $pid changed or exited before TERM — $reason"
      continue
    fi
    if [ "$DRY_RUN" -eq 1 ]; then
      say "DRY RUN: would request TERM for PID $pid — $reason"
    elif kill -TERM "$pid" 2>/dev/null; then
      say "STOP: requested graceful exit for PID $pid — $reason"
    else
      # A process can exit between the snapshot and kill. Re-check before
      # treating that race as a failure.
      kill -0 "$pid" 2>/dev/null || continue
      say "WARN: could not request graceful exit for PID $pid — $reason"
    fi
  done < <(target_processes)
}

wait_for_targets() {
  local attempt remaining
  for attempt in $(seq 1 "$WAIT_SECONDS"); do
    remaining="$(target_processes)"
    [ -z "$remaining" ] && return 0
    [ "$DRY_RUN" -eq 1 ] && return 1
    sleep 1
  done
  return 1
}

force_targets() {
  local pid reason
  while IFS=$'\t' read -r pid reason; do
    [ -n "$pid" ] || continue
    if ! is_current_target "$pid" "$reason"; then
      say "SKIP: PID $pid changed or exited before KILL — $reason"
      continue
    fi
    if kill -KILL "$pid" 2>/dev/null; then
      say "FORCE: sent KILL to PID $pid — $reason"
    else
      kill -0 "$pid" 2>/dev/null || continue
      say "WARN: could not send KILL to PID $pid — $reason"
    fi
  done < <(target_processes)
}

run_preflight() {
  BRAIN_REPO="$BRAIN_REPO" CODEX_HOME="$CODEX_HOME_DIR" \
    bash "$MANAGER" preflight
}

if [ "$DRY_RUN" -eq 1 ]; then
  target_count="$(print_targets)"
  if [ "$target_count" -eq 0 ]; then
    say "OK: no affected Codex application, helper, or user-owned SSH process is running."
  else
    say "NOT OK: $target_count affected process(es) would be stopped."
    exit 1
  fi
  exit 0
fi

if ancestor_is_codex_runtime; then
  die "refusing live shutdown from inside a Codex/ChatGPT process tree; run this script from an external terminal"
fi

# Check ownership before stopping anything. In particular, the shared native
# ~/.codex root is intentionally refused by the managed-root manager. A
# failed ownership check must not first create application downtime.
run_ownership_preflight || die "configuration ownership preflight failed; no processes were stopped"

request_desktop_quit
term_targets

if ! wait_for_targets; then
  if [ "$FORCE" -eq 1 ]; then
    say "WARN: graceful shutdown did not finish within ${WAIT_SECONDS}s; escalating only to the listed affected processes."
    force_targets
    sleep 1
  else
    say "NOT OK: affected processes remain after ${WAIT_SECONDS}s of graceful shutdown."
    say "Review the affected PIDs above, then rerun with --force only if you accept terminating those exact processes."
    exit 1
  fi
fi

remaining="$(target_processes)"
[ -z "$remaining" ] || {
  say "NOT OK: one or more affected processes are still running:"
  while IFS=$'\t' read -r pid reason; do
    [ -n "$pid" ] && say "  PID $pid — $reason"
  done <<< "$remaining"
  exit 1
}
say "OK: affected Codex applications, helpers, browser extension hosts, and user-owned SSH sessions are stopped."

run_preflight || die "controlled Codex repair is not approved; no repair was run"

say "REPAIR: running the controlled Codex managed-root repair."
BRAIN_REPO="$BRAIN_REPO" CODEX_HOME="$CODEX_HOME_DIR" \
  bash "$MANAGER" repair

say "VERIFY: checking the repaired Codex managed root."
BRAIN_REPO="$BRAIN_REPO" CODEX_HOME="$CODEX_HOME_DIR" \
  bash "$MANAGER" check >/dev/null

remaining="$(target_processes)"
[ -z "$remaining" ] || die "an affected process restarted during repair"

say "OK: Codex shutdown, controlled repair, and post-repair verification completed."
