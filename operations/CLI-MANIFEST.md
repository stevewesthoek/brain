# CLI Manifest — Canonical Tool Inventory

**Last Updated:** 2026-06-03
**Scope:** All CLIs available to Claude Code, Codex, and Gemini CLI  
**Purpose:** Single source of truth for CLI availability across all AI agents

This document lists every CLI tool installed on this machine, its location, access method, and which AI agents can use it. All AIs should have access to all CLIs listed here.

---

## ⚡ QUICK START: Installing a New CLI

**Don't install CLIs manually.** Use the automated installation script:

```bash
# Install a CLI and automatically update everything
install-cli --name "command-name" --path "/path/to/binary" --description "optional description"
```

This automatically:
1. ✅ Creates symlink to `~/.local/bin/`
2. ✅ Updates this manifest
3. ✅ Syncs to all AI agents
4. ✅ Verifies access in Claude Code

**To verify a CLI is accessible:**
```bash
verify-cli-access "command-name"   # Check one CLI
verify-cli-access                  # Check all critical CLIs
```

**Example:**
```bash
# Install notebooklm
install-cli --name notebooklm --path /usr/local/bin/notebooklm

# Verify it worked
verify-cli-access notebooklm
```

See: `tools/scripts/install-cli.sh` and `tools/scripts/verify-cli-access.sh`

---

---

## Quick Access

- **For Claude Code:** Use Bash tool directly (`bash command-name`)
- **For Codex:** Use Computer Use or shell access (verify with `which command-name`)
- **For Gemini CLI:** Use shell execution via context-mode

All CLIs in this manifest are symlinked to `~/.local/bin/` or exist in Homebrew/pipx paths and are available via `$PATH`.

---

## Master CLI Registry

### System & Core Tools

| CLI | Location | Installation | Type | Notes |
|-----|----------|--------------|------|-------|
| `git` | `/usr/bin/git` | system | vcs | Git version control |
| `curl` | `/usr/bin/curl` | system | http | HTTP client |
| `jq` | `/usr/bin/jq` | system | json | JSON processor |
| `python3` | `/opt/homebrew/bin/python3` | Homebrew | runtime | Python runtime |
| `node` | `/opt/homebrew/bin/node` | Homebrew | runtime | Node.js runtime (v24.12.0) |
| `npm` | `/opt/homebrew/bin/npm` | Homebrew | runtime | Node package manager |
| `npx` | `/opt/homebrew/bin/npx` | Homebrew | runtime | Node package executor |
| `bun` | `/Users/Office/.bun/bin/bun` | Homebrew | runtime | Bun JS runtime |
| `brew` | `/opt/homebrew/bin/brew` | Homebrew | pkg-manager | Homebrew package manager |
| `pipx` | `/opt/homebrew/bin/pipx` | Homebrew | pkg-manager | Python virtual environment CLI installer |
| `uv` | `/opt/homebrew/bin/uv` | Homebrew | pkg-manager | Fast Python package manager |

### Cloud & Infrastructure

| CLI | Location | Symlink Target | Type | Access | Notes |
|-----|----------|----------------|------|--------|-------|
| `aws-cli` | `~/.local/bin/aws-cli` | `brain/operations/system-configs/bin/aws-cli` | cloud | Bash | AWS CLI wrapper |
| `azure-cli` | `~/.local/bin/azure-cli` | `/opt/homebrew/bin/az` | cloud | Bash | Azure CLI |
| `gcp-cli` | `~/.local/bin/gcp-cli` | `brain/operations/system-configs/bin/gcp-cli` | cloud | Bash | Google Cloud CLI wrapper |
| `cloudflare-cli` | `~/.local/bin/cloudflare-cli` | `brain/operations/system-configs/bin/cloudflare-cli` | cloud | Bash | Cloudflare API wrapper |
| `hetzner-cli` | `~/.local/bin/hetzner-cli` | `brain/operations/system-configs/bin/hetzner-cli` | cloud | Bash | Hetzner Cloud API wrapper |
| `tailscale-cli` | `~/.local/bin/tailscale-cli` | `brain/operations/system-configs/bin/tailscale-cli` | cloud | Bash | Tailscale VPN CLI wrapper |
| `gh` | `/opt/homebrew/bin/gh` | — | cloud | Bash | GitHub CLI |
| `supabase-cli` | `~/.local/bin/supabase-cli` | `/opt/homebrew/bin/supabase` | cloud | Bash | Supabase CLI |
| `dokploy-cli` | `~/.local/bin/dokploy-cli` | `/Users/Office/.nvm/versions/node/v24.12.0/bin/dokploy` | cloud | Bash | Dokploy deployment CLI |
| `dokploy-mcp` | `~/.local/bin/dokploy-mcp` | `/Users/Office/.nvm/versions/node/v24.12.0/bin/dokploy-mcp` | cloud | Bash | Dokploy MCP server |
| `n8n-cli` | `~/.local/bin/n8n-cli` | `/Users/Office/.nvm/versions/node/v24.12.0/bin/n8n` | automation | Bash | n8n workflow automation CLI |

### Provisioning & Destruction (Infrastructure-as-Code)

| CLI | Location | Symlink Target | Purpose |
|-----|----------|----------------|---------|
| `aws-provisioner` | `~/.local/bin/aws-provisioner` | `brain/operations/system-configs/bin/aws-provisioner` | Create AWS resources |
| `aws-destroyer` | `~/.local/bin/aws-destroyer` | `brain/operations/system-configs/bin/aws-destroyer` | Tear down AWS resources |
| `azure-apps-provisioner` | `~/.local/bin/azure-apps-provisioner` | `brain/operations/system-configs/bin/azure-apps-provisioner` | Create Azure app resources |
| `azure-apps-destroyer` | `~/.local/bin/azure-apps-destroyer` | `brain/operations/system-configs/bin/azure-apps-destroyer` | Tear down Azure app resources |
| `azure-data-provisioner` | `~/.local/bin/azure-data-provisioner` | `brain/operations/system-configs/bin/azure-data-provisioner` | Create Azure data resources |
| `azure-data-destroyer` | `~/.local/bin/azure-data-destroyer` | `brain/operations/system-configs/bin/azure-data-destroyer` | Tear down Azure data resources |
| `cloudflare-jpvbootcamp-provisioner` | `~/.local/bin/cloudflare-jpvbootcamp-provisioner` | `brain/operations/system-configs/bin/cloudflare-jpvbootcamp-provisioner` | Create JPV Bootcamp CF resources |
| `cloudflare-jpvbootcamp-destroyer` | `~/.local/bin/cloudflare-jpvbootcamp-destroyer` | `brain/operations/system-configs/bin/cloudflare-jpvbootcamp-destroyer` | Tear down JPV Bootcamp CF resources |
| `cloudflare-prochat-provisioner` | `~/.local/bin/cloudflare-prochat-provisioner` | `brain/operations/system-configs/bin/cloudflare-prochat-provisioner` | Create ProChat CF resources |
| `cloudflare-prochat-destroyer` | `~/.local/bin/cloudflare-prochat-destroyer` | `brain/operations/system-configs/bin/cloudflare-prochat-destroyer` | Tear down ProChat CF resources |
| `gws-provisioner` | `~/.local/bin/gws-provisioner` | `brain/operations/system-configs/bin/gws-provisioner` | Create Google Workspace resources |
| `gws-destroyer` | `~/.local/bin/gws-destroyer` | `brain/operations/system-configs/bin/gws-destroyer` | Tear down Google Workspace resources |

### AI & Media Tools

| CLI | Location | Symlink Target | Type | Installation | Notes |
|-----|----------|----------------|------|--------------|-------|
| `notebooklm` | `~/.local/bin/notebooklm` | `/Users/Office/.local/pipx/venvs/notebooklm-py/bin/notebooklm` | research | pipx | **CRITICAL: NotebookLM CLI (v0.3.4)** — Codex must have access to this |
| `stable-audio-cli` | `~/.local/bin/stable-audio-cli` | `brain/operations/system-configs/bin/stable-audio-cli` | media | Bash wrapper | Audio generation CLI |
| `stable-audio-warmup` | `~/.local/bin/stable-audio-warmup` | `brain/operations/system-configs/bin/stable-audio-warmup` | media | Bash wrapper | Audio model warmup |
| `mlx_whisper` | `~/.local/bin/mlx_whisper` | `/Users/Office/.local/pipx/venvs/mlx-whisper/bin/mlx_whisper` | media | pipx | Speech-to-text via MLX |

### Content & Research Tools

| CLI | Location | Symlink Target | Type | Notes |
|-----|----------|----------------|------|-------|
| `firecrawl` | `~/.local/bin/firecrawl` | `brain/tools/firecrawl/firecrawl-wrapper.sh` | research | Web scraping wrapper |
| `firecrawl-status` | `~/.local/bin/firecrawl-status` | `brain/tools/firecrawl/firecrawl-status.sh` | research | Firecrawl health check |
| `spark-cli` | `~/.local/bin/spark-cli` | `brain/operations/system-configs/bin/spark-cli` | email | Spark email client CLI |
| `apify-multi` | `~/.local/bin/apify-multi` | `brain/ai/skills/custom/apify/apify-multi-cli-wrapper.sh` | research | Multi-account Apify wrapper |

### System Utilities & Scripts

| CLI | Location | Symlink Target | Type | Purpose |
|-----|----------|----------------|------|---------|
| **`install-cli`** | `~/.local/bin/install-cli` | `brain/tools/scripts/install-cli.sh` | **management** | **Install new CLI + auto-update manifest + sync AIs** |
| **`verify-cli-access`** | `~/.local/bin/verify-cli-access` | `brain/tools/scripts/verify-cli-access.sh` | **management** | **Verify CLI access across all AIs** |
| `sync-credentials` | `~/.local/bin/sync-credentials` | `brain/tools/scripts/sync-credentials.sh` | system | Scan for `.env` files and sync credentials |
| `mem-search` | `~/.local/bin/mem-search` | `brain/tools/scripts/mem-search.sh` | memory | Search memory by keyword/ID |
| `mem-write` | `~/.local/bin/mem-write` | `brain/tools/scripts/mem-write.sh` | memory | Create/update memory entries |
| `mem-facts` | `~/.local/bin/mem-facts` | `brain/tools/scripts/mem-facts.sh` | memory | Manage structured facts |
| `brain-compress` | `~/.local/bin/brain-compress` | `brain/tools/scripts/brain-compress.mjs` | context | Explicit reversible compression for large JSON, logs, and text; stores originals under `~/.brain/cache/compression/` |
| `brain-learn-failures` | `~/.local/bin/brain-learn-failures` | `brain/tools/scripts/brain-learn-failures.mjs` | learning | Dry-run failure-pattern reports from Claude/Codex/Gemini session logs; never edits agent config |
| `n8n-api` | `~/.local/bin/n8n-api` | `brain/tools/n8n-api.sh` | automation | n8n API wrapper |
| `jump` | `~/.local/bin/jump` | `brain/tools/scripts/jump.sh` | navigation | Jump to project directories |
| `orchestrate` | `~/.local/bin/orchestrate` | `brain/tools/scripts/orchestrate.sh` | orchestration | Orchestration tool |
| `ledger-query` | `~/.local/bin/ledger-query` | `brain/tools/scripts/ledger-query.sh` | finance | Query ledger data |
| `ledger-write` | `~/.local/bin/ledger-write` | `brain/tools/scripts/ledger-write.sh` | finance | Write ledger transactions |
| `ledger-report` | `~/.local/bin/ledger-report` | `brain/tools/scripts/ledger-report.sh` | finance | Generate ledger reports |
| `ledger-replay` | `~/.local/bin/ledger-replay` | `brain/tools/scripts/ledger-replay.sh` | finance | Replay ledger history |

### Developer Tools

| CLI | Location | Type | Installation | Notes |
|-----|----------|------|--------------|-------|
| `rg` | Codex vendor path | search | Homebrew | Ripgrep (fast search) — Codex-specific |
| `fzf` | `/opt/homebrew/bin/fzf` | fuzzy-finder | Homebrew | Fuzzy finder |
| `context-mode` | `/Users/Office/.local/share/uv/tools/context-mode/bin/context-mode` | research | uv | Context-mode knowledge indexing |
| `graphify` | `~/.local/bin/graphify` | research | uv | Codebase knowledge graph generator |
| `ai-select` | `~/.local/bin/ai-select` | ai-routing | custom | AI model selector CLI |
| `uvicorn` | `~/.local/bin/uvicorn` | runtime | pipx | ASGI web server |
| `fastapi` | `~/.local/bin/fastapi` | framework | pipx | FastAPI CLI |
| `omp` | `~/.local/bin/omp` | ai-agent | Bun global | Oh My Pi optional standalone terminal AI coding agent; separate IDE/agent surface only, not a replacement for AI Model Selector, Brain skills, shared memory, or routing policy |
| `open-design` | `~/.local/bin/open-design` | design-workbench | source wrapper | Open Design optional external visual design workbench; wrapper points to `/Users/Office/Repos/nexu-io/open-design` and uses Node 24; separate IDE-like surface only, not Brain router, memory, or skill source |

### Backup & Archive Tools

| CLI | Location | Type | Notes |
|-----|----------|------|-------|
| `arq` | `~/.local/bin/arq` | backup | Arq backup client symlink to `/Applications/Arq.app` |

### AI-Specific Tools

| CLI | Location | Access | AI Agents | Notes |
|-----|----------|--------|-----------|-------|
| `codex` | Custom binary | Desktop app | — | Codex AI interface (separate from CLI) |
| `claude` | `~/.local/bin/claude` | Symlink to versioned binary | Claude Code | Claude Code CLI (v2.1.150) |

---

## AI Access Matrix

### Claude Code
**Shell Access:** Full via Bash tool  
**Available CLIs:** All CLIs listed in this manifest  
**Recommended Entry:** `bash command-name [args]`

| CLI Category | Access | Verified |
|--------------|--------|----------|
| System tools | ✅ | Yes |
| Cloud CLI | ✅ | Yes |
| notebooklm | ✅ | Yes |
| AI/Media | ✅ | Yes |
| Research | ✅ | Yes |
| Scripts | ✅ | Yes |

### Codex
**Shell Access:** Computer Use mode  
**Available CLIs:** All CLIs listed in this manifest (including `notebooklm`)  
**Recommended Entry:** Direct shell commands via Computer Use  
**Verification:** Run `which notebooklm` to confirm access

| CLI Category | Access | Status |
|--------------|--------|--------|
| System tools | ✅ | Yes |
| Cloud CLI | ✅ | Yes |
| **notebooklm** | ✅ | **MUST VERIFY** |
| AI/Media | ✅ | Yes |
| Research | ✅ | Yes |
| Scripts | ✅ | Yes |

### Gemini CLI
**Shell Access:** Via context-mode shell execution  
**Available CLIs:** All CLIs listed in this manifest  
**Recommended Entry:** `gemini-shell command-name [args]`

| CLI Category | Access | Status |
|--------------|--------|--------|
| System tools | ✅ | Yes |
| Cloud CLI | ✅ | Yes |
| notebooklm | ✅ | Yes |
| AI/Media | ✅ | Yes |
| Research | ✅ | Yes |
| Scripts | ✅ | Yes |

---

## Verification Commands

Use these commands to verify CLI availability in each environment:

```bash
# Verify all CLIs are in PATH
echo "=== Checking CLI availability ===" && \
for cmd in git curl jq python3 node npm bun notebooklm aws-cli cloudflare-cli spark-cli firecrawl mem-search sync-credentials; do
  if command -v "$cmd" &> /dev/null; then
    echo "✅ $cmd"
  else
    echo "❌ $cmd NOT FOUND"
  fi
done

# Show full path to a CLI
which notebooklm
which spark-cli
which sync-credentials

# List all available CLIs
ls -la ~/.local/bin/ | grep "^l" | awk '{print $NF}'
```

### For Codex specifically:
```bash
# Verify Codex can access notebooklm
notebooklm --version

# Verify Codex can access other key CLIs
spark-cli --help
aws-cli --help
```

---

## Installation Reference

### How each tool was installed:

**Homebrew packages:**
- `python3`, `node`, `npm`, `bun`, `brew`, `pipx`, `uv`, `fzf`, `git`, `curl`, `jq`, `gh`, `supabase`

**pipx packages (Python):**
- `notebooklm-py` → `notebooklm` command
- `mlx-whisper` → `mlx_whisper` command
- `fastapi`, `uvicorn`

**npm packages:**
- `n8n`, `dokploy`, `dokploy-mcp`, `context-mode`, `graphifyy`

**Custom symlinks (brain/operations/system-configs/bin/):**
- Cloud CLI wrappers: `aws-cli`, `azure-cli`, `gcp-cli`, `cloudflare-cli`, `hetzner-cli`, `tailscale-cli`
- Provisioning scripts: `*-provisioner`, `*-destroyer`
- Media tools: `stable-audio-cli`, `stable-audio-warmup`
- Email: `spark-cli`

**Brain tool scripts (brain/tools/scripts/):**
- Memory/context: `mem-search`, `mem-write`, `mem-facts`, `brain-compress`, `brain-learn-failures`
- Infrastructure: `sync-credentials`, `n8n-api`, `jump`, `orchestrate`
- Finance: `ledger-*` commands

---

## Maintenance & Updates

- **Last verified:** 2026-05-25
- **Update procedure:** When new CLIs are installed, add entry to this manifest
- **Sync script:** `sync-ai-skills.mjs` (in `brain/tools/scripts/`) distributes CLI changes to all AI consumers
- **Breaking changes:** Update this manifest + run `sync-ai-skills.mjs` + verify in all three AI agents

---

## Key Rules

1. **Single Source of Truth:** This manifest is the canonical list. All three AIs must have access to all CLIs here.
2. **Symlink Convention:** All CLIs are symlinked to `~/.local/bin/` for unified `$PATH` access.
3. **No Shadowing:** Avoid duplicate CLI names across different installation methods.
4. **Documentation:** Each CLI should have a corresponding runbook in `brain/operations/runbooks/` if non-trivial.
5. **Verification:** After installing a new CLI, add it here and verify via all three AI agents.

---

## Related Documentation

- **Runbooks:** `brain/operations/runbooks/` directory
- **NotebookLM:** See `brain/operations/runbooks/notebooklm.md`
- **Spark CLI:** See `brain/operations/runbooks/spark-cli.md`
- **Cloud CLIs:** See corresponding runbooks in `brain/operations/runbooks/`
- **Model routing:** `brain/ai/policy/routing.md`
- **AI configuration:** `brain/operations/system-configs/*/config*`

---

## Critical Issue Fixed

**Problem:** Codex claimed to not have access to `notebooklm` CLI, but it should have full access.

**Root Cause:** No centralized CLI manifest existed to define uniform access across all AIs.

**Solution:** This manifest now serves as the single source of truth. All CLIs are available to all AIs via:
- Claude Code: Bash tool directly
- Codex: Computer Use shell access
- Gemini CLI: context-mode shell execution

**Verification:**
```bash
# Codex should be able to run this:
notebooklm --version
notebooklm auth check --test

# If not, check symlink:
ls -la ~/.local/bin/notebooklm
which notebooklm
```

---

**Generated:** 2026-05-25  
**Maintainer:** Steve Westhoek  
**Last Reviewed:** 2026-05-25
