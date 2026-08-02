# codebase-memory-mcp MCP Provider

**Status:** candidate (B8.2A — pending rollout authorization)
**Admission ID:** `codebase-memory-mcp-brain`
**Version:** 0.9.0
**Upstream:** https://github.com/DeusData/codebase-memory-mcp
**Upstream commit:** b637e3330c96cfe452da623db068c241aaa3ec01

---

## What it does

Single static binary MCP server. Indexes source repositories into per-repo SQLite
databases. Provides Cypher-style graph queries, semantic search, call-graph traces,
and code snippet retrieval — all from the local cache; no source transmitted
externally.

Key tools (snake_case names as exposed over MCP wire protocol):
`index_repository`, `search_code`, `query_graph`, `trace_path`,
`get_code_snippet`, `get_graph_schema`, `get_architecture`, `search_graph`,
`list_projects`, `delete_project`, `index_status`, `detect_changes`, `manage_adr`,
`ingest_traces`.

---

## Binary location (Brain-centralized — do NOT use the upstream installer)

```
~/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp
~/.local/bin/codebase-memory-mcp   ← stable symlink
```

SHA-256 (darwin-arm64 binary):
`d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`

SHA-256 (darwin-arm64 archive from GitHub Releases v0.9.0):
`faa02f0404230c451a9812230394481948f80183801fa5bf67044b41c2f25ed4`

---

## Key constraints

- **No upstream install command.** Never run `codebase-memory-mcp install`. It
  edits Claude Code, Codex, Cursor, Gemini, and other client configs. Brain owns
  all client registration.
- **No update command.** Never run `codebase-memory-mcp update`. Pin is
  b637e33/v0.9.0. Upgrades require a new Brain admission.
- **No UI mode.** `--ui=true` starts an HTTP server. Keep `--ui=false` (default
  for MCP stdio use). Do not set in Brain-managed configs.
- **No persistence flag.** `--persistence false` (default) keeps indexes in the
  isolated cache. Never use `--persistence true` — it writes `.codebase-memory/`
  into the source repository.
- **Isolated caches per repo.** Use `CBM_CACHE_DIR` to route each repo to its
  own cache directory under `~/Library/Caches/brain/codebase-memory-mcp/<repo>`.
- **auto_watch must be disabled via config, not env.** The default is
  `auto_watch=true`. The `CBM_AUTO_WATCH` environment variable is **not read by
  the binary**. The only supported mechanism is:
  ```bash
  CBM_CACHE_DIR=<path> codebase-memory-mcp config set auto_watch false
  ```
  This writes to `_config.db` in the cache dir. Run once per cache directory
  before first use. With `auto_watch=false`, the filesystem watcher thread still
  starts but takes no action on file changes (no background re-indexing).
- **Network policy: loopback-only stdio, one bounded update check.** The MCP
  stdio channel is loopback-only. The binary also makes one best-effort HTTPS
  GET to `api.github.com/repos/DeusData/codebase-memory-mcp/releases/latest`
  at startup for update detection. This call is non-blocking (~500ms total
  startup), non-fatal, and **cannot be disabled** by any known environment
  variable. Nomic-embed-code token embeddings are bundled; no runtime model
  download occurs.

---

## Isolated cache paths (Brain-standard)

```
~/Library/Caches/brain/codebase-memory-mcp/brain/
~/Library/Caches/brain/codebase-memory-mcp/workbench-private/
~/Library/Caches/brain/codebase-memory-mcp/prochat/
```

Each path contains one or more `<project-name>.db` files plus `_config.db` for
per-cache settings. No files are written inside source repositories.

---

## Authentication

None required. The server reads local files only. No credentials, no tokens.
Admission uses `authentication.mode = "none"`. No credential environment
variable is set or expected — the admission schema conditionally omits all
credential fields when `mode = "none"`.

---

## Network policy

The MCP stdio channel is loopback-only. The binary additionally makes one
best-effort HTTPS GET to
`api.github.com/repos/DeusData/codebase-memory-mcp/releases/latest` at
startup. This call is:
- Non-blocking (does not delay MCP initialization)
- Non-fatal (failure is silently ignored)
- Undisableable (no known env var suppresses it; strings scan confirmed no such flag)

This is the only external network access the binary performs. No data from
indexed source is transmitted. The Brain admission documents this as a
`networkNote` on the transport block.

---

## Client configuration generation

Generate project-scoped configs from the admission registry:

```bash
node tools/generate-mcp-project-registration.mjs \
  --admission codebase-memory-mcp-brain \
  --provider-root /Users/Office/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0 \
  --node $(which node)
```
No `--credential-file` required — `authentication.mode = "none"` admissions are credential-free.

See `codex-config.template.toml` and `claude-code-config.template.json` in this
folder for ready-to-merge templates.

---

## Rollback / removal

```bash
# Remove symlink
rm ~/.local/bin/codebase-memory-mcp

# Remove versioned binary (rollback state: none was previously installed)
rm -rf ~/.local/lib/brain/providers/codebase-memory-mcp/

# Remove caches
rm -rf ~/Library/Caches/brain/codebase-memory-mcp/

# Remove any client configs that referenced this server (if rolled out)
# See codex-config.template.toml and claude-code-config.template.json

# Remove admission from registry:
# Delete the codebase-memory-mcp-brain entry in operations/specs/mcp-provider-admissions.json
# Change status to "revoked" rather than deleting to preserve evidence
```

---

## Verification commands

```bash
# Confirm binary
~/.local/bin/codebase-memory-mcp --version
shasum -a 256 ~/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp
# expected: d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6

# Confirm no repo-local state
[ -d "$REPO/.codebase-memory" ] && echo "VIOLATION" || echo "CLEAN"

# Validate admission registry
node tools/validate-mcp-provider-admissions.mjs
```

---

## SBOM summary (from upstream sbom.json, v0.9.0)

| Component | Version | License |
|-----------|---------|---------|
| sqlite3 | 3.51.3 | blessing (public domain) |
| yyjson | 0.12.0 | MIT |
| mimalloc | 3.3.2 | MIT |
| xxhash | 0.8.3 | BSD-2-Clause |
| tre | 0.8.0 | BSD-2-Clause |
| tree-sitter | 0.24.4 | MIT |
| lz4 | 1.10.0 | BSD-2-Clause |
| zstd | 1.5.7 | BSD-3-Clause |
| simplecpp | 1.x | 0BSD |
| nomic-embed-code token embeddings | 1.0 | Apache-2.0 (bundled int8 derived) |
| tree-sitter-grammars (159 grammars) | aggregate | predominantly MIT; some Apache-2.0, CC0-1.0, ISC, Unlicense |

Full license texts ship inside the release archive as `THIRD_PARTY_NOTICES.md`.
The outer npm package itself is MIT.
