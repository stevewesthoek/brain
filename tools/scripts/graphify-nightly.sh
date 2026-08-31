#!/usr/bin/env bash
set -euo pipefail

cat >&2 <<'EOF'
graphify-nightly is retired and intentionally fail-closed.

Canonical Graphify policy:
- GRAPHIFY_CONTAINED_EXECUTION remains a historical containment marker only; this compatibility path never executes structural Graphify.
- Structural Graphify generation is frozen; Codebase Memory MCP is the structural navigation layer.
- Exact current source remains authoritative.
- Semantic Graphify is Brain-only, bounded, event-driven, and non-authoritative.
- The only supported semantic entrypoint is tools/graphify-semantic-event.mjs.
- No default local or external model runner is configured or auto-started.

The daily Brain Scheduler does not invoke this retired stub. Manual semantic regeneration uses the supported event gate and requires an approved scope plus an explicitly supplied bounded runner.
EOF

exit 78
