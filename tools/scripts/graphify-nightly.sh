#!/usr/bin/env bash
set -euo pipefail

REPO_ROOTS="${GRAPHIFY_REPO_ROOTS:-/Users/Office/Repos}"
REPO_TIMEOUT_SECONDS="${GRAPHIFY_REPO_TIMEOUT_SECONDS:-1800}"
GRAPHIFY_BIN="${GRAPHIFY_BIN:-graphify}"
GRAPHIFY_BACKEND="${GRAPHIFY_BACKEND:-openai}"

# GRAPHIFY_MODEL remains a manual override. When it is not set, each phase chooses
# the smallest useful model for that phase.
GRAPHIFY_MODEL="${GRAPHIFY_MODEL:-}"
GRAPHIFY_FAST_MODEL="${GRAPHIFY_FAST_MODEL:-Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed}"
GRAPHIFY_DOCS_FAST_MODEL="${GRAPHIFY_DOCS_FAST_MODEL:-$GRAPHIFY_FAST_MODEL}"
GRAPHIFY_REFINED_MODEL="${GRAPHIFY_REFINED_MODEL:-Youssofal/Qwen3.6-27B-MTPLX-Optimized-Speed}"
GRAPHIFY_DEEP_MODEL="${GRAPHIFY_DEEP_MODEL:-$GRAPHIFY_REFINED_MODEL}"

OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://127.0.0.1:8000/v1}"
OPENAI_API_KEY="${OPENAI_API_KEY:-sk-proj-mtplx-local}"
GRAPHIFY_OLLAMA_NUM_CTX="${GRAPHIFY_OLLAMA_NUM_CTX:-8192}"
GRAPHIFY_OLLAMA_KEEP_ALIVE="${GRAPHIFY_OLLAMA_KEEP_ALIVE:-30}"
GRAPHIFY_MAX_CONCURRENCY="${GRAPHIFY_MAX_CONCURRENCY:-1}"
GRAPHIFY_API_TIMEOUT="${GRAPHIFY_API_TIMEOUT:-900}"
GRAPHIFY_AST_WORKERS="${GRAPHIFY_AST_WORKERS:-12}"
GRAPHIFY_VIZ_NODE_LIMIT="${GRAPHIFY_VIZ_NODE_LIMIT:-30000}"
# Keep graph.json complete for LLM/retrieval use, but keep Phase 1 graph.html human-readable.
GRAPHIFY_PHASE1_VIZ_NODE_LIMIT="${GRAPHIFY_PHASE1_VIZ_NODE_LIMIT:-2500}"

# Canonical Office nightly phase order for all repositories. The cutoff decides how far a session gets:
# Phase 1 code baseline; Phase 2 README overlay; Phase 3 limited docs overlay;
# Phase 4 focused high-signal docs refinement; Phase 5 community naming/readability;
# Phase 6 bounded final validation.
GRAPHIFY_PHASES="${GRAPHIFY_PHASES:-1 2 3 4 5 6}"
GRAPHIFY_FAST_TOKEN_BUDGET="${GRAPHIFY_FAST_TOKEN_BUDGET:-2500}"
GRAPHIFY_DOCS_README_TOKEN_BUDGET="${GRAPHIFY_DOCS_README_TOKEN_BUDGET:-${GRAPHIFY_PHASE2_TOKEN_BUDGET:-1000}}"
GRAPHIFY_DOCS_LIMITED_TOKEN_BUDGET="${GRAPHIFY_DOCS_LIMITED_TOKEN_BUDGET:-1200}"
GRAPHIFY_MEDIA_TOKEN_BUDGET="${GRAPHIFY_MEDIA_TOKEN_BUDGET:-2000}"
GRAPHIFY_DEEP_TOKEN_BUDGET="${GRAPHIFY_DEEP_TOKEN_BUDGET:-3000}"
GRAPHIFY_MIN_NODE_RETENTION_PERCENT="${GRAPHIFY_MIN_NODE_RETENTION_PERCENT:-80}"
SCHEDULER_CUTOFF_HOUR="${SCHEDULER_CUTOFF_HOUR:-7}"

timestamp() {
  TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z'
}

log() {
  printf '[%s] %s\n' "$(timestamp)" "$*"
}

check_scheduler_cutoff() {
  local hour_lisbon
  hour_lisbon="$(TZ=Europe/Lisbon date +%H)"
  if (( 10#$hour_lisbon >= SCHEDULER_CUTOFF_HOUR )); then
    log "reached ${SCHEDULER_CUTOFF_HOUR}:00 cutoff, not starting new work"
    return 1
  fi
  return 0
}

discover_repos() {
  local root
  for root in $REPO_ROOTS; do
    if [[ -d "$root/.git" || -f "$root/.git" ]]; then
      printf '%s\n' "$root"
    elif [[ -d "$root" ]]; then
      find "$root" -maxdepth 5 -name .git -type d \
        -not -path '*/.claude/*' \
        -not -path '*/node_modules/*' \
        -not -path '*/graphify-out/*' \
        -not -path '*/.tmp/*' \
        -not -path '*/tmp/*' \
        -not -path '*/backup/*' \
        -not -path '*/backups/*' \
        2>/dev/null | sed 's#/.git$##'
    fi
  done | sort -u
}

append_media_exclusions() {
  local repo="$1"
  cat >> "$repo/.graphifyignore" <<'EOF'
*.pdf
**/*.pdf
*.png
**/*.png
*.jpg
**/*.jpg
*.jpeg
**/*.jpeg
*.webp
**/*.webp
*.gif
**/*.gif
*.svg
**/*.svg
*.docx
**/*.docx
*.xlsx
**/*.xlsx
*.pptx
**/*.pptx
*.mp3
**/*.mp3
*.mp4
**/*.mp4
*.mov
**/*.mov
*.wav
**/*.wav
EOF
}

write_graphifyignore_for_phase() {
  local repo="$1"
  local phase="$2"
  cat > "$repo/.graphifyignore" <<'EOF'
# Managed by Brain Graphify scheduler.
# Version control / dependencies
.git/
**/.git/
node_modules/
**/node_modules/

# Graphify generated output — never scan your own graph/report/html/cache
graphify-out/
.graphify-out/

# Scheduler safety: skip generated, temporary, archived, and nested-worktree noise.
.tmp/
**/.tmp/
tmp/
**/tmp/
logs/
**/logs/
runtime/
**/runtime/
archive/
**/archive/
archives/
**/archives/
backup/
**/backup/
backups/
**/backups/
vendor/
**/vendor/
vendors/
**/vendors/
*.log
**/*.log

# Local AI/runtime state
.ai/
.claude/
.local/
.gstack/
.pytest_cache/
__pycache__/
**/__pycache__/

# Build/test/generated output
.next/
dist/
build/
coverage/
*.tsbuildinfo
.DS_Store
**/.DS_Store

# Local tool caches
.wrangler/
**/.wrangler/
EOF

  case "$phase" in
    1)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 1: fast code graph only.
# Skip semantic-heavy docs, config manifests, workflows, generated metadata, papers, images, office files, media, and generated/vendor/runtime noise.
**/shell_snapshots/
**/shell-snapshots/
**/plugins/cache/
**/plugins/marketplaces/
**/vendor_imports/
**/vendor/
**/vendors/
**/.cache/
**/cache/
**/.next/
**/dist/
**/build/
**/coverage/
*.bundle.js
**/*.bundle.js
*.bundle.mjs
**/*.bundle.mjs
*.min.js
**/*.min.js
*.d.ts
**/*.d.ts
*.d.mts
**/*.d.mts
*.d.cts
**/*.d.cts
*.snap
**/*.snap
*.snapshot
**/*.snapshot
*.md
**/*.md
*.mdx
**/*.mdx
docs/
**/docs/
*.yml
**/*.yml
*.yaml
**/*.yaml
*.json
**/*.json
*.jsonc
**/*.jsonc
*.toml
**/*.toml
*.xml
**/*.xml
*.txt
**/*.txt
*.csv
**/*.csv
*.lock
**/*.lock
package-lock.json
**/package-lock.json
pnpm-lock.yaml
**/pnpm-lock.yaml
yarn.lock
**/yarn.lock
EOF
      append_media_exclusions "$repo"
      ;;
    2)
      append_media_exclusions "$repo"
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 2: README-style root Markdown only.
# This is the default docs refinement lane. It intentionally skips code so it refines the existing Phase 1 graph instead of re-scanning the repo.
*.py
**/*.py
*.ts
**/*.ts
*.tsx
**/*.tsx
*.js
**/*.js
*.jsx
**/*.jsx
*.mjs
**/*.mjs
*.cjs
**/*.cjs
*.sh
**/*.sh
*.sql
**/*.sql
*.php
**/*.php
*.go
**/*.go
*.rs
**/*.rs
*.java
**/*.java
*.rb
**/*.rb
*.swift
**/*.swift
*.kt
**/*.kt
*.kts
**/*.kts
*.css
**/*.css
*.scss
**/*.scss
*.html
**/*.html
*.vue
**/*.vue
*.svelte
**/*.svelte
*.yml
**/*.yml
*.yaml
**/*.yaml
*.json
**/*.json
*.jsonc
**/*.jsonc
*.toml
**/*.toml
*.xml
**/*.xml
*.txt
**/*.txt
*.csv
**/*.csv
*.lock
**/*.lock
docs/
**/docs/
*.md
**/*.md
*.mdx
**/*.mdx
!/README.md
!/README.mdx
!/README-*.md
!/README_*.md
!/readme.md
!/Readme.md
EOF
      ;;
    3)
      append_media_exclusions "$repo"
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 3: limited docs batch.
# Include root README-style files plus first-level docs/*.md only.
# Skip code/config so this stays a short overlay pass instead of re-scanning the repo.
*.py
**/*.py
*.ts
**/*.ts
*.tsx
**/*.tsx
*.js
**/*.js
*.jsx
**/*.jsx
*.mjs
**/*.mjs
*.cjs
**/*.cjs
*.sh
**/*.sh
*.sql
**/*.sql
*.php
**/*.php
*.go
**/*.go
*.rs
**/*.rs
*.java
**/*.java
*.rb
**/*.rb
*.swift
**/*.swift
*.kt
**/*.kt
*.kts
**/*.kts
*.css
**/*.css
*.scss
**/*.scss
*.html
**/*.html
*.vue
**/*.vue
*.svelte
**/*.svelte
*.yml
**/*.yml
*.yaml
**/*.yaml
*.json
**/*.json
*.jsonc
**/*.jsonc
*.toml
**/*.toml
*.xml
**/*.xml
*.txt
**/*.txt
*.csv
**/*.csv
*.lock
**/*.lock
*.md
**/*.md
*.mdx
**/*.mdx
!/README.md
!/README.mdx
!/README-*.md
!/README_*.md
!/readme.md
!/Readme.md
!/docs/
!/docs/*.md
!/docs/*.mdx
EOF
      ;;
    4)
      append_media_exclusions "$repo"
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 4: focused high-signal docs overlay.
# Include generic root/index, architecture, design, standard, runbook, spec, ADR, and decision-style docs only.
# Skip code/config/media so this remains an iterative overlay pass, not a repo-specific crawl.
*.py
**/*.py
*.ts
**/*.ts
*.tsx
**/*.tsx
*.js
**/*.js
*.jsx
**/*.jsx
*.mjs
**/*.mjs
*.cjs
**/*.cjs
*.sh
**/*.sh
*.sql
**/*.sql
*.php
**/*.php
*.go
**/*.go
*.rs
**/*.rs
*.java
**/*.java
*.rb
**/*.rb
*.swift
**/*.swift
*.kt
**/*.kt
*.kts
**/*.kts
*.css
**/*.css
*.scss
**/*.scss
*.html
**/*.html
*.vue
**/*.vue
*.svelte
**/*.svelte
*.yml
**/*.yml
*.yaml
**/*.yaml
*.json
**/*.json
*.jsonc
**/*.jsonc
*.toml
**/*.toml
*.xml
**/*.xml
*.txt
**/*.txt
*.csv
**/*.csv
*.lock
**/*.lock
*.md
**/*.md
*.mdx
**/*.mdx
!/README.md
!/README.mdx
!/README-*.md
!/README_*.md
!/docs/
!/docs/*architecture*.md
!/docs/*Architecture*.md
!/docs/*design*.md
!/docs/*Design*.md
!/docs/*standard*.md
!/docs/*Standard*.md
!/docs/*runbook*.md
!/docs/*Runbook*.md
!/docs/*spec*.md
!/docs/*Spec*.md
!/docs/*decision*.md
!/docs/*Decision*.md
!/docs/*adr*.md
!/docs/*ADR*.md
!/runbooks/
!/runbooks/*.md
!/specs/
!/specs/*.md
!/adr/
!/adr/*.md
!/ADRs/
!/ADRs/*.md
EOF
      ;;
    5)
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 5: community naming/readability only. Extraction is skipped for this phase.
EOF
      ;;
    6)
      append_media_exclusions "$repo"
      cat >> "$repo/.graphifyignore" <<'EOF'

# Phase 6: bounded deep refinement overlay.
# Include deeper docs/specs/runbooks/ADR markdown only. No code/config/media full crawl.
*.py
**/*.py
*.ts
**/*.ts
*.tsx
**/*.tsx
*.js
**/*.js
*.jsx
**/*.jsx
*.mjs
**/*.mjs
*.cjs
**/*.cjs
*.sh
**/*.sh
*.sql
**/*.sql
*.php
**/*.php
*.go
**/*.go
*.rs
**/*.rs
*.java
**/*.java
*.rb
**/*.rb
*.swift
**/*.swift
*.kt
**/*.kt
*.kts
**/*.kts
*.css
**/*.css
*.scss
**/*.scss
*.html
**/*.html
*.vue
**/*.vue
*.svelte
**/*.svelte
*.yml
**/*.yml
*.yaml
**/*.yaml
*.json
**/*.json
*.jsonc
**/*.jsonc
*.toml
**/*.toml
*.xml
**/*.xml
*.txt
**/*.txt
*.csv
**/*.csv
*.lock
**/*.lock
*.md
**/*.md
*.mdx
**/*.mdx
# Generic bounded deep docs: high-signal index, architecture, design, standard,
# runbook, spec, ADR, and decision documents only. Avoid recursive all-docs crawls.
!/README.md
!/README.mdx
!/README-*.md
!/README_*.md
!/docs/
!/docs/*architecture*.md
!/docs/*Architecture*.md
!/docs/*design*.md
!/docs/*Design*.md
!/docs/*standard*.md
!/docs/*Standard*.md
!/docs/*runbook*.md
!/docs/*Runbook*.md
!/docs/*spec*.md
!/docs/*Spec*.md
!/docs/*decision*.md
!/docs/*Decision*.md
!/docs/*adr*.md
!/docs/*ADR*.md
!**/runbooks/
!**/runbooks/*.md
!**/specs/
!**/specs/*.md
!**/adr/
!**/adr/*.md
!**/ADRs/
!**/ADRs/*.md
EOF
      ;;
    *)
      log "unknown phase=$phase repo=$repo"
      return 1
      ;;
  esac
}

phase_label() {
  case "$1" in
    1) printf 'phase1-code-baseline' ;;
    2) printf 'phase2-readme-overlay' ;;
    3) printf 'phase3-limited-docs-overlay' ;;
    4) printf 'phase4-focused-refinement' ;;
    5) printf 'phase5-community-labels' ;;
    6) printf 'phase6-final-validation' ;;
    *) printf 'phase%s' "$1" ;;
  esac
}

phase_token_budget() {
  case "$1" in
    1) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
    2) printf '%s' "$GRAPHIFY_DOCS_README_TOKEN_BUDGET" ;;
    3) printf '%s' "$GRAPHIFY_DOCS_LIMITED_TOKEN_BUDGET" ;;
    4) printf '%s' "$GRAPHIFY_MEDIA_TOKEN_BUDGET" ;;
    5) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
    6) printf '%s' "$GRAPHIFY_DEEP_TOKEN_BUDGET" ;;
    *) printf '%s' "$GRAPHIFY_FAST_TOKEN_BUDGET" ;;
  esac
}

model_available() {
  local model="$1"
  curl -sf "${OPENAI_BASE_URL%/v1}/health" >/dev/null 2>&1
}

phase_model_candidate() {
  if [[ -n "$GRAPHIFY_MODEL" ]]; then
    printf '%s' "$GRAPHIFY_MODEL"
    return 0
  fi
  case "$1" in
    1) printf '%s' "$GRAPHIFY_FAST_MODEL" ;;
    2) printf '%s' "$GRAPHIFY_DOCS_FAST_MODEL" ;;
    3) printf '%s' "$GRAPHIFY_DOCS_FAST_MODEL" ;;
    4) printf '%s' "$GRAPHIFY_REFINED_MODEL" ;;
    5) printf '%s' "$GRAPHIFY_REFINED_MODEL" ;;
    6) printf '%s' "$GRAPHIFY_DEEP_MODEL" ;;
    *) printf '%s' "$GRAPHIFY_FAST_MODEL" ;;
  esac
}

phase_model() {
  local phase="$1"
  local candidate
  candidate="$(phase_model_candidate "$phase")"

  if model_available "$candidate"; then
    printf '%s' "$candidate"
    return 0
  fi

  if [[ -n "$GRAPHIFY_MODEL" ]]; then
    return 1
  fi

  if model_available "$GRAPHIFY_REFINED_MODEL"; then
    printf '%s' "$GRAPHIFY_REFINED_MODEL"
    return 0
  fi

  return 1
}

graph_node_count() {
  local graph_path="$1"
  if [[ ! -f "$graph_path" ]]; then
    printf '0'
    return 0
  fi
  python3 - "$graph_path" <<'PY'
import json
import sys
try:
    with open(sys.argv[1], 'r', encoding='utf-8') as f:
        data = json.load(f)
    nodes = data.get('nodes', [])
    print(len(nodes) if isinstance(nodes, list) else 0)
except Exception:
    print(0)
PY
}

run_graphify() {
  local repo="$1"
  local model="$2"
  shift 2
  OPENAI_BASE_URL="$OPENAI_BASE_URL" \
  OPENAI_API_KEY="$OPENAI_API_KEY" \
  GRAPHIFY_OLLAMA_NUM_CTX="$GRAPHIFY_OLLAMA_NUM_CTX" \
  GRAPHIFY_OLLAMA_KEEP_ALIVE="$GRAPHIFY_OLLAMA_KEEP_ALIVE" \
  GRAPHIFY_VIZ_NODE_LIMIT="$GRAPHIFY_VIZ_NODE_LIMIT" \
  python3 - "$REPO_TIMEOUT_SECONDS" "$repo" "$@" <<'PY'
import os
import signal
import subprocess
import sys
import time

timeout = int(sys.argv[1])
repo = sys.argv[2]
cmd = sys.argv[3:]
try:
    os.nice(15)
except OSError:
    pass

process = subprocess.Popen(cmd, cwd=repo, start_new_session=True)
try:
    raise SystemExit(process.wait(timeout=timeout))
except subprocess.TimeoutExpired:
    print(
        f"[graphify scheduler] timeout after {timeout}s; terminating process group pid={process.pid}",
        file=sys.stderr,
        flush=True,
    )
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

    deadline = time.monotonic() + 10
    while process.poll() is None and time.monotonic() < deadline:
        time.sleep(0.2)

    if process.poll() is None:
        print(
            f"[graphify scheduler] process group did not exit after SIGTERM; sending SIGKILL pid={process.pid}",
            file=sys.stderr,
            flush=True,
        )
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass

    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        print(
            f"[graphify scheduler] warning: process pid={process.pid} still not reaped after SIGKILL",
            file=sys.stderr,
            flush=True,
        )
    raise SystemExit(124)
PY
}

prepare_phase_graph_state() {
  local repo="$1"
  local phase="$2"
  local label="$3"
  local graph_path="$repo/graphify-out/graph.json"
  local snapshot_dir="$repo/graphify-out/.scheduler/pre-${label}-outputs"
  local snapshot_path="$snapshot_dir/graph.json"

  if [[ "$phase" != "1" && ! -f "$graph_path" ]]; then
    log "$label requires existing Phase 1 graph repo=$repo file=graphify-out/graph.json"
    return 1
  fi

  rm -rf "$snapshot_dir"
  mkdir -p "$snapshot_dir"

  local previous_nodes=0
  if [[ -f "$graph_path" ]]; then
    cp "$graph_path" "$snapshot_path"
    [[ -f "$repo/graphify-out/graph.html" ]] && cp "$repo/graphify-out/graph.html" "$snapshot_dir/graph.html"
    [[ -f "$repo/graphify-out/GRAPH_REPORT.md" ]] && cp "$repo/graphify-out/GRAPH_REPORT.md" "$snapshot_dir/GRAPH_REPORT.md"
    [[ -f "$repo/graphify-out/.graphify_analysis.json" ]] && cp "$repo/graphify-out/.graphify_analysis.json" "$snapshot_dir/.graphify_analysis.json"
    previous_nodes="$(graph_node_count "$graph_path")"
  fi

  # Every phase snapshots existing outputs before risky work. Overlay phases merge
  # their temporary graph back into this snapshot; Phase 1 restores it on failure.
  printf '%s:%s\n' "$previous_nodes" "$snapshot_path"
}

restore_phase_graph_snapshot() {
  local repo="$1"
  local snapshot_path="$2"
  local snapshot_dir
  local output
  snapshot_dir="$(dirname "$snapshot_path")"

  # Restore the exact pre-phase output set. If an output did not exist before the
  # phase, remove any partial file created before a timeout or failure.
  for output in graph.json graph.html GRAPH_REPORT.md .graphify_analysis.json; do
    if [[ -f "$snapshot_dir/$output" ]]; then
      cp "$snapshot_dir/$output" "$repo/graphify-out/$output"
    else
      rm -f "$repo/graphify-out/$output"
    fi
  done
}

merge_phase_graph_overlay() {
  local repo="$1"
  local snapshot_path="$2"
  local overlay_path="$repo/graphify-out/graph.json"
  python3 - "$snapshot_path" "$overlay_path" <<'PY'
import json
import sys
from pathlib import Path

base_path = Path(sys.argv[1])
overlay_path = Path(sys.argv[2])
base = json.loads(base_path.read_text())
overlay = json.loads(overlay_path.read_text())

base_nodes = base.get("nodes", []) if isinstance(base.get("nodes", []), list) else []
overlay_nodes = overlay.get("nodes", []) if isinstance(overlay.get("nodes", []), list) else []
base_edges = base.get("links", base.get("edges", []))
overlay_edges = overlay.get("links", overlay.get("edges", []))
base_edges = base_edges if isinstance(base_edges, list) else []
overlay_edges = overlay_edges if isinstance(overlay_edges, list) else []

nodes = {str(n.get("id")): n for n in base_nodes if n.get("id") is not None}
for n in overlay_nodes:
    nid = n.get("id")
    if nid is not None:
        nodes[str(nid)] = n

seen_edges = set()
merged_edges = []
for e in base_edges + overlay_edges:
    if not isinstance(e, dict):
        continue
    s = e.get("source", e.get("from"))
    t = e.get("target", e.get("to"))
    rel = e.get("relation", e.get("type", ""))
    key = (str(s), str(t), str(rel))
    if key in seen_edges:
        continue
    seen_edges.add(key)
    merged_edges.append(e)

base["nodes"] = list(nodes.values())
if "links" in base:
    base["links"] = merged_edges
else:
    base["edges"] = merged_edges

overlay_path.write_text(json.dumps(base, ensure_ascii=False, indent=2))
print(f"merged phase overlay graph nodes={len(nodes)} edges={len(merged_edges)}")
PY
}

apply_readable_community_names() {
  local repo="$1"
  python3 - "$repo/graphify-out/graph.json" <<'PY'
import json, re, sys
from collections import Counter, defaultdict
from pathlib import Path
path = Path(sys.argv[1])
data = json.loads(path.read_text())
nodes = data.get('nodes', []) if isinstance(data.get('nodes', []), list) else []
stop = set('the and for with from this that into using file files code node nodes script function class component page app lib src index main init utils helper test tests community'.split())
def words(value):
    text = re.sub(r'[._/\\:-]+', ' ', str(value or ''))
    for word in re.findall(r'[A-Za-z][A-Za-z0-9]{2,}', text):
        lower = word.lower()
        if lower not in stop:
            yield lower
def title(counter):
    terms = [term for term, _ in counter.most_common(4)]
    return ' '.join(term.capitalize() for term in terms) if terms else 'General Graph Cluster'
by_community = defaultdict(list)
for node in nodes:
    cid = node.get('community')
    if cid is not None:
        by_community[str(cid)].append(node)
names = {}
for cid, group in by_community.items():
    weighted = Counter()
    for node in group:
        weight = max(1, min(int(node.get('degree') or node.get('_degree') or 1), 12))
        for term in words(node.get('source_file')):
            weighted[term] += weight * 2
        for term in words(node.get('label')):
            weighted[term] += weight
        for term in words(node.get('file_type')):
            weighted[term] += 1
    names[cid] = title(weighted)
for node in nodes:
    cid = node.get('community')
    if cid is not None:
        node['community_name'] = names.get(str(cid), f'Community {cid}')
data.setdefault('graph', {})['community_names'] = names
path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(f'applied deterministic community names communities={len(names)}')
PY
}

apply_readable_community_names_to_html() {
  local repo="$1"
  python3 - "$repo/graphify-out/graph.json" "$repo/graphify-out/graph.html" <<'PY'
import html
import json
import re
import sys
from pathlib import Path

graph_path = Path(sys.argv[1])
html_path = Path(sys.argv[2])
if not graph_path.exists() or not html_path.exists():
    print("skipped html community name injection missing graph/html")
    raise SystemExit(0)

data = json.loads(graph_path.read_text())
names = data.get("graph", {}).get("community_names", {})
if not isinstance(names, dict) or not names:
    print("skipped html community name injection no community_names")
    raise SystemExit(0)

text = html_path.read_text(errors="ignore")
for cid, name in sorted(names.items(), key=lambda item: len(str(item[0])), reverse=True):
    safe = html.escape(str(name))
    text = re.sub(rf"Community {re.escape(str(cid))}(?![0-9])", safe, text)
html_path.write_text(text)
print(f"injected community names into graph.html communities={len(names)}")
PY
}

generate_readable_graph_html() {
  local repo="$1"
  local node_limit="$2"
  python3 - "$repo" "$node_limit" <<'PY'
import collections
import html
import json
import sys
from pathlib import Path

repo = Path(sys.argv[1])
limit = int(sys.argv[2])
out_dir = repo / "graphify-out"
graph_path = out_dir / "graph.json"
html_path = out_dir / "graph.html"
report_path = out_dir / "GRAPH_REPORT.md"

data = json.loads(graph_path.read_text())
nodes = data.get("nodes", [])
edges = data.get("links", data.get("edges", []))

node_by_id = {str(n.get("id")): n for n in nodes if n.get("id") is not None}
degree = collections.Counter()
for e in edges:
    s = str(e.get("source", e.get("from", "")))
    t = str(e.get("target", e.get("to", "")))
    if s in node_by_id and t in node_by_id:
        degree[s] += 1
        degree[t] += 1

for n in nodes:
    nid = str(n.get("id"))
    n["_degree"] = int(n.get("degree", degree.get(nid, 0)) or 0)

communities = collections.defaultdict(list)
for n in nodes:
    communities[str(n.get("community", "unclustered"))].append(n)

community_rows = []
for cid, items in communities.items():
    top = sorted(items, key=lambda n: n.get("_degree", 0), reverse=True)[:8]
    files = collections.Counter(n.get("source_file", "") for n in items if n.get("source_file"))
    community_rows.append((
        len(items), cid,
        ", ".join(html.escape(str(n.get("label", n.get("id", "")))) for n in top[:5]),
        ", ".join(html.escape(f) for f, _ in files.most_common(3)),
    ))
community_rows.sort(reverse=True)

top_nodes = sorted(nodes, key=lambda n: n.get("_degree", 0), reverse=True)[:limit]
file_counts = collections.Counter(n.get("source_file", "") for n in nodes if n.get("source_file"))
kind_counts = collections.Counter(n.get("file_type", "unknown") for n in nodes)

# Human overview graph: aggregate the full machine graph by community so graph.html
# remains visual without rendering tens of thousands of symbol-level nodes.
top_community_ids = [cid for _, cid, _, _ in community_rows[:80]]
top_community_set = set(top_community_ids)
community_size = {cid: len(items) for cid, items in communities.items()}
community_edge_counts = collections.Counter()
for e in edges:
    s = str(e.get("source", e.get("from", "")))
    t = str(e.get("target", e.get("to", "")))
    sn = node_by_id.get(s)
    tn = node_by_id.get(t)
    if not sn or not tn:
        continue
    sc = str(sn.get("community", "unclustered"))
    tc = str(tn.get("community", "unclustered"))
    if sc == tc or sc not in top_community_set or tc not in top_community_set:
        continue
    community_edge_counts[tuple(sorted((sc, tc)))] += 1

width, height, cx, cy, radius = 1120, 760, 560, 380, 310
positions = {}
count = max(1, len(top_community_ids))
for i, cid in enumerate(top_community_ids):
    import math
    angle = (2 * math.pi * i / count) - math.pi / 2
    positions[cid] = (cx + radius * math.cos(angle), cy + radius * math.sin(angle))

max_size = max([community_size.get(cid, 1) for cid in top_community_ids] or [1])
max_edge = max(community_edge_counts.values() or [1])
svg_edges = []
for (a, b), weight in community_edge_counts.most_common(220):
    ax, ay = positions[a]
    bx, by = positions[b]
    stroke = 0.5 + 4.0 * (weight / max_edge)
    svg_edges.append(f"<line x1='{ax:.1f}' y1='{ay:.1f}' x2='{bx:.1f}' y2='{by:.1f}' stroke='#334155' stroke-width='{stroke:.2f}' opacity='0.42'><title>{html.escape(a)} ↔ {html.escape(b)}: {weight} edges</title></line>")
svg_nodes = []
for cid in top_community_ids:
    x, y = positions[cid]
    size = community_size.get(cid, 1)
    r = 8 + 26 * (size / max_size) ** 0.5
    label = f"C{cid} · {size}"
    svg_nodes.append(f"<g><circle cx='{x:.1f}' cy='{y:.1f}' r='{r:.1f}' fill='#38bdf8' opacity='0.82'><title>Community {html.escape(cid)} · {size} nodes</title></circle><text x='{x:.1f}' y='{y + r + 13:.1f}' text-anchor='middle' fill='#cbd5e1' font-size='11'>{html.escape(label)}</text></g>")
svg_graph = f"<svg viewBox='0 0 {width} {height}' role='img' aria-label='Community overview graph'>{''.join(svg_edges)}{''.join(svg_nodes)}</svg>"

summary = ""
if report_path.exists():
    for line in report_path.read_text(errors="ignore").splitlines()[:40]:
        summary += f"<div>{html.escape(line)}</div>"

css = """
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;margin:0;background:#10131a;color:#e8edf2}
main{max-width:1280px;margin:0 auto;padding:24px} h1,h2{margin:18px 0 10px} .card{background:#171b24;border:1px solid #2a3140;border-radius:10px;padding:16px;margin:12px 0}
table{width:100%;border-collapse:collapse;font-size:13px} th,td{border-bottom:1px solid #2a3140;padding:8px;text-align:left;vertical-align:top} th{color:#aab4c0} code{color:#aad1ff}.muted{color:#94a3b8}.pill{display:inline-block;padding:3px 8px;border:1px solid #384256;border-radius:999px;margin:2px;color:#cbd5e1} svg{width:100%;height:620px;background:#0b1020;border:1px solid #263044;border-radius:10px}
"""

def rows(items):
    return "\n".join(items)

html_doc = f"""<!doctype html><html><head><meta charset='utf-8'><title>Graphify readable index</title><style>{css}</style></head><body><main>
<h1>Graphify readable index</h1>
<div class='card'><b>Full machine graph preserved:</b> <code>graph.json</code><br><b>Readable HTML sample:</b> top {len(top_nodes)} nodes by degree from {len(nodes)} total nodes and {len(edges)} edges.</div>
<div class='card'><h2>Summary</h2>{summary}</div>
<div class='card'><h2>Community overview graph</h2><p class='muted'>Aggregated from the full graph.json: top {len(top_community_ids)} communities, up to 220 strongest cross-community links. The full symbol graph remains in graph.json for LLM use.</p>{svg_graph}</div>
<div class='card'><h2>Node types</h2>{''.join(f"<span class='pill'>{html.escape(str(k))}: {v}</span>" for k,v in kind_counts.most_common())}</div>
<div class='card'><h2>Largest communities</h2><table><tr><th>Size</th><th>Community</th><th>Representative nodes</th><th>Common files</th></tr>{rows(f"<tr><td>{size}</td><td>{html.escape(cid)}</td><td>{tops}</td><td>{files}</td></tr>" for size,cid,tops,files in community_rows[:200])}</table></div>
<div class='card'><h2>Top files</h2><table><tr><th>Nodes</th><th>File</th></tr>{rows(f"<tr><td>{count}</td><td>{html.escape(path)}</td></tr>" for path,count in file_counts.most_common(200))}</table></div>
<div class='card'><h2>Top connected nodes</h2><table><tr><th>Degree</th><th>Label</th><th>Type</th><th>Community</th><th>Source</th></tr>{rows(f"<tr><td>{n.get('_degree',0)}</td><td>{html.escape(str(n.get('label', n.get('id',''))))}</td><td>{html.escape(str(n.get('file_type','')))}</td><td>{html.escape(str(n.get('community','')))}</td><td>{html.escape(str(n.get('source_file','')))}</td></tr>" for n in top_nodes)}</table></div>
</main></body></html>"""
html_path.write_text(html_doc)
print(f"wrote readable fallback graph.html nodes={len(nodes)} edges={len(edges)} sampled={len(top_nodes)}")
PY
}

run_phase() {
  local repo="$1"
  local phase="$2"
  local label
  local token_budget
  local model
  label="$(phase_label "$phase")"
  token_budget="$(phase_token_budget "$phase")"
  model="$(phase_model "$phase")"

  mkdir -p "$repo/graphify-out/.scheduler"
  write_graphifyignore_for_phase "$repo" "$phase"

  local phase_state
  local previous_nodes
  local snapshot_path
  phase_state="$(prepare_phase_graph_state "$repo" "$phase" "$label")"
  previous_nodes="${phase_state%%:*}"
  snapshot_path="${phase_state#*:}"

  local -a extract_cmd=(
    "$GRAPHIFY_BIN" extract "$repo"
    "--backend=$GRAPHIFY_BACKEND"
    --token-budget "$token_budget"
    --max-concurrency "$GRAPHIFY_MAX_CONCURRENCY"
    --api-timeout "$GRAPHIFY_API_TIMEOUT"
  )

  if [[ "$phase" == "1" ]]; then
    extract_cmd+=(--max-workers "$GRAPHIFY_AST_WORKERS")
  else
    extract_cmd+=(--no-cluster --no-viz)
  fi

  if [[ "$phase" == "6" && "${GRAPHIFY_PHASE6_DEEP_MODE:-0}" == "1" ]]; then
    extract_cmd+=(--mode deep)
  fi

  local -a cluster_cmd=(
    "$GRAPHIFY_BIN" cluster-only "$repo"
    "--backend=$GRAPHIFY_BACKEND"
  )

  if [[ "$phase" == "1" || "$phase" == "2" || "$phase" == "3" || "$phase" == "4" ]]; then
    cluster_cmd+=(--no-label)
  fi

  local extract_log="$repo/graphify-out/.scheduler/${label}-extract.log"
  local cluster_log="$repo/graphify-out/.scheduler/${label}-cluster.log"

  if [[ "$phase" == "5" || ( "$phase" == "6" && "${GRAPHIFY_PHASE6_EXTRACT:-0}" != "1" ) ]]; then
    if [[ "$phase" == "6" ]]; then
      log "$label bounded validation/relabeling repo=$repo model=$model viz-limit=$GRAPHIFY_VIZ_NODE_LIMIT extraction=disabled"
    else
      log "$label community labeling repo=$repo model=$model viz-limit=$GRAPHIFY_VIZ_NODE_LIMIT"
    fi
    if ! run_graphify "$repo" "$model" "${cluster_cmd[@]}" > >(tee "$cluster_log") 2> >(tee -a "$cluster_log" >&2); then
      restore_phase_graph_snapshot "$repo" "$snapshot_path"
      return 1
    fi
    if grep -q "Refusing to overwrite" "$cluster_log"; then
      log "$label cluster produced unsafe graph overwrite warning repo=$repo"
      restore_phase_graph_snapshot "$repo" "$snapshot_path"
      return 1
    fi
    apply_readable_community_names "$repo" | tee -a "$cluster_log"
    apply_readable_community_names_to_html "$repo" | tee -a "$cluster_log"
    # Keep Graphify's interactive graph.html when cluster-only produced one. Only fall
    # back to the static readable index if graph.html is missing.
    if [[ ! -f "$repo/graphify-out/graph.html" ]]; then
      generate_readable_graph_html "$repo" "$GRAPHIFY_VIZ_NODE_LIMIT" | tee -a "$cluster_log"
    fi
    for required_output in graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/graph.html; do
      if [[ ! -f "$repo/$required_output" ]]; then
        log "$label missing required output repo=$repo file=$required_output"
        restore_phase_graph_snapshot "$repo" "$snapshot_path"
        return 1
      fi
    done
    printf '%s\n' "$phase" > "$repo/graphify-out/.scheduler/last-successful-phase"
    printf '%s\n' "$(timestamp)" > "$repo/graphify-out/.scheduler/last-successful-phase-at"
    return 0
  fi

  log "$label extract repo=$repo model=$model token-budget=$token_budget"
  if ! run_graphify "$repo" "$model" "${extract_cmd[@]}" > >(tee "$extract_log") 2> >(tee -a "$extract_log" >&2); then
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    if grep -q "\[graphify scheduler\] timeout after" "$extract_log"; then
      log "$label deferred after bounded timeout repo=$repo timeout=${REPO_TIMEOUT_SECONDS}s"
      return 124
    fi
    if grep -Eq "graph is empty — extraction produced no nodes|found 0 code, 0 docs, 0 papers, 0 images" "$extract_log"; then
      log "$label skipped empty repo=$repo reason=no-eligible-content"
      return 20
    fi
    return 1
  fi

  if grep -q "Refusing to overwrite" "$extract_log"; then
    log "$label extract produced unsafe graph overwrite warning repo=$repo"
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  if [[ "$phase" == "2" || "$phase" == "3" || "$phase" == "4" || "$phase" == "6" ]]; then
    log "$label merging docs overlay into existing graph repo=$repo"
    merge_phase_graph_overlay "$repo" "$snapshot_path" | tee -a "$extract_log"
  fi

  local cluster_viz_node_limit="$GRAPHIFY_VIZ_NODE_LIMIT"
  if [[ "$phase" == "1" ]]; then
    cluster_viz_node_limit="$GRAPHIFY_PHASE1_VIZ_NODE_LIMIT"
  fi

  log "$label cluster repo=$repo model=$model viz-limit=$cluster_viz_node_limit"
  if ! GRAPHIFY_VIZ_NODE_LIMIT="$cluster_viz_node_limit" run_graphify "$repo" "$model" "${cluster_cmd[@]}" > >(tee "$cluster_log") 2> >(tee -a "$cluster_log" >&2); then
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  if grep -q "Refusing to overwrite" "$cluster_log"; then
    log "$label cluster produced unsafe graph overwrite warning repo=$repo"
    restore_phase_graph_snapshot "$repo" "$snapshot_path"
    return 1
  fi

  if [[ ! -f "$repo/graphify-out/graph.html" ]] && grep -q "Skipped graph.html" "$cluster_log"; then
    log "$label generating readable fallback graph.html repo=$repo node-limit=$cluster_viz_node_limit"
    generate_readable_graph_html "$repo" "$cluster_viz_node_limit" | tee -a "$cluster_log"
  fi

  local required_output
  for required_output in graphify-out/graph.json graphify-out/GRAPH_REPORT.md graphify-out/graph.html; do
    if [[ ! -f "$repo/$required_output" ]]; then
      log "$label missing required output repo=$repo file=$required_output"
      restore_phase_graph_snapshot "$repo" "$snapshot_path"
      return 1
    fi
  done

  if (( previous_nodes > 0 )); then
    local new_nodes
    local min_nodes
    new_nodes="$(graph_node_count "$repo/graphify-out/graph.json")"
    min_nodes=$(( previous_nodes * GRAPHIFY_MIN_NODE_RETENTION_PERCENT / 100 ))
    if (( new_nodes < min_nodes )); then
      log "$label refused suspicious graph shrink repo=$repo previous_nodes=$previous_nodes new_nodes=$new_nodes min_nodes=$min_nodes"
      restore_phase_graph_snapshot "$repo" "$snapshot_path"
      return 1
    fi
  fi

  printf '%s\n' "$phase" > "$repo/graphify-out/.scheduler/last-successful-phase"
  printf '%s\n' "$(timestamp)" > "$repo/graphify-out/.scheduler/last-successful-phase-at"
}

log_outputs() {
  local repo="$1"
  local -a outputs=("graphify-out/graph.json" "graphify-out/graph.html" "graphify-out/GRAPH_REPORT.md")
  for out in "${outputs[@]}"; do
    if [[ -f "$repo/$out" ]]; then
      log "  [ok] $out"
    else
      log "  [missing] $out"
    fi
  done
}

if ! command -v "$GRAPHIFY_BIN" >/dev/null 2>&1; then
  log "graphify unavailable path=$GRAPHIFY_BIN"
  exit 1
fi

if [[ "$GRAPHIFY_BACKEND" != "openai" && "$GRAPHIFY_BACKEND" != "ollama" ]]; then
  log "refusing non-local backend=$GRAPHIFY_BACKEND — Graphify is local-only"
  exit 1
fi

if [[ "$GRAPHIFY_BACKEND" == "openai" ]]; then
  if ! curl -sf "${OPENAI_BASE_URL%/v1}/health" >/dev/null 2>&1; then
    log "MTPLX unavailable at $OPENAI_BASE_URL — start MTPLX or switch to ollama backend"
    exit 1
  fi
fi

model_summary="override=${GRAPHIFY_MODEL:-none} fast=$GRAPHIFY_FAST_MODEL docs=$GRAPHIFY_DOCS_FAST_MODEL refined=$GRAPHIFY_REFINED_MODEL deep=$GRAPHIFY_DEEP_MODEL"
log "graphify-nightly phased start backend=$GRAPHIFY_BACKEND models=[$model_summary] phases='$GRAPHIFY_PHASES' max-concurrency=$GRAPHIFY_MAX_CONCURRENCY api-timeout=$GRAPHIFY_API_TIMEOUT"

repos=0
phases_ok=0
skipped=0
empty=0
deferred=0
failed=0

discovered_repos=()
while IFS= read -r repo; do
  [[ -n "$repo" ]] || continue
  discovered_repos+=("$repo")
done < <(discover_repos)
repos="${#discovered_repos[@]}"

# Run phase-major, not repo-major: complete Phase 1 for every repo before any
# repo advances to Phase 2, then complete Phase 2 for every repo before Phase 3,
# and so on. This keeps all repos fresh at the highest-priority phase before
# spending time on deeper refinement.
for phase in $GRAPHIFY_PHASES; do
  for repo in "${discovered_repos[@]}"; do
    [[ -n "$repo" ]] || continue

    if ! check_scheduler_cutoff; then
      log "skipping remaining work phase=$(phase_label "$phase") reason=scheduler_cutoff"
      skipped=$((skipped + 1))
      break 2
    fi

    label="$(phase_label "$phase")"
    extract_log="$repo/graphify-out/.scheduler/${label}-extract.log"
    cluster_log="$repo/graphify-out/.scheduler/${label}-cluster.log"
    log "repo phase start path=$repo phase=$label graph-present=$([[ -f "$repo/graphify-out/graph.json" ]] && printf yes || printf no)"

    if run_phase "$repo" "$phase"; then
      phases_ok=$((phases_ok + 1))
      log "phase ok repo=$repo phase=$label"
      log_outputs "$repo"
    else
      phase_status=$?
      if [[ "$phase_status" -eq 124 ]] || grep -qs "\[graphify scheduler\] timeout after" "$extract_log" "$cluster_log"; then
        deferred=$((deferred + 1))
        log "phase deferred repo=$repo phase=$label reason=bounded-timeout timeout=${REPO_TIMEOUT_SECONDS}s — continuing with next repo at same phase"
      elif [[ "$phase_status" -eq 20 ]] || grep -Eqs "graph is empty — extraction produced no nodes|found 0 code, 0 docs, 0 papers, 0 images" "$extract_log"; then
        empty=$((empty + 1))
        log "phase skipped repo=$repo phase=$label reason=no-eligible-content — continuing with next repo at same phase"
      else
        failed=$((failed + 1))
        log "phase failed repo=$repo phase=$label status=$phase_status — continuing with next repo at same phase"
      fi
    fi
  done
done

log "graphify-nightly phased complete repos=$repos phases_ok=$phases_ok skipped=$skipped empty=$empty deferred=$deferred failed=$failed"

if (( failed > 0 )); then
  exit 1
fi

# Cutoff, empty repositories, and bounded timeouts are expected non-fatal outcomes.
exit 0
