#!/bin/sh
set -eu

case "${1:-}" in
  --handshake|--execute) ;;
  *) echo 'invalid BrainNode runner mode' >&2; exit 2 ;;
esac

node_bin=''
if command -v node >/dev/null 2>&1; then
  node_bin=$(command -v node)
else
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node /usr/bin/node; do
    if [ -x "$candidate" ]; then node_bin="$candidate"; break; fi
  done
fi
[ -n "$node_bin" ] || { echo 'Node runtime unavailable' >&2; exit 127; }

secret_path="$HOME/.local/brain/node/auth.secret"
runner_path="$HOME/.local/brain/node/brain-node-runner.mjs"
[ -r "$secret_path" ] || { echo 'BrainNode auth secret unavailable' >&2; exit 78; }
[ -r "$runner_path" ] || { echo 'BrainNode runner unavailable' >&2; exit 78; }

BRAIN_NODE_AUTH_SECRET=$(/bin/cat "$secret_path") \
  exec "$node_bin" "$runner_path" "$@"
