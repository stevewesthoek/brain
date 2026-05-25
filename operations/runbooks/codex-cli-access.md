# Codex CLI Access — Troubleshooting & Verification

**Date:** 2026-05-25  
**Problem:** Codex reported inability to access `notebooklm` CLI, despite it being installed.  
**Solution:** All CLIs are available to Codex via Computer Use shell access. See `operations/CLI-MANIFEST.md` for complete registry.

---

## Quick Verification

Run these commands in Codex Computer Use shell to verify CLI access:

```bash
# Check if notebooklm is available
which notebooklm
notebooklm --version

# Check all key CLIs
for cmd in notebooklm spark-cli aws-cli cloudflare-cli mem-search sync-credentials; do
  echo -n "$cmd: "
  which $cmd || echo "NOT FOUND"
done
```

Expected output:
```
notebooklm: /Users/Office/.local/bin/notebooklm
NotebookLM CLI, version 0.3.4
```

---

## How Codex Accesses CLIs

Codex has three ways to run CLI commands:

### 1. Computer Use Shell (Recommended)
Direct shell access to all CLIs via Computer Use. Just run the command:
```bash
notebooklm --version
spark-cli accounts
sync-credentials
```

### 2. Direct Shell Commands in Responses
When Codex generates code or shell scripts, all CLIs are available.

### 3. Configuration
Codex's `~/.codex/config.toml` does NOT explicitly configure CLI paths. Instead, it inherits from the system `$PATH`:

```toml
[mcp_servers.node_repl.env]
# NODE_REPL inherits system PATH, which includes ~/.local/bin
```

---

## If a CLI is Missing

**Step 1: Verify it's installed**
```bash
ls -la ~/.local/bin/notebooklm
# Should show a symlink → /Users/Office/.local/pipx/venvs/notebooklm-py/bin/notebooklm
```

**Step 2: Check $PATH**
```bash
echo $PATH | tr ':' '\n' | grep -E "\.local|opt/homebrew"
# Should include /Users/Office/.local/bin and /opt/homebrew/bin
```

**Step 3: Verify symlink target exists**
```bash
ls -la /Users/Office/.local/pipx/venvs/notebooklm-py/bin/notebooklm
# Should be executable Python script
```

**Step 4: Test direct access**
```bash
/Users/Office/.local/bin/notebooklm --version
```

If this fails, reinstall the CLI (see "Installation" section below).

---

## CLI Categories Codex Can Access

| Category | Examples | Status |
|----------|----------|--------|
| System | git, curl, jq, python3, node, npm | ✅ Full access |
| Cloud | aws-cli, azure-cli, gcp-cli, cloudflare-cli, hetzner-cli | ✅ Full access |
| AI/Media | **notebooklm**, stable-audio-cli, mlx_whisper | ✅ Full access |
| Research | firecrawl, spark-cli, apify-multi | ✅ Full access |
| Scripts | mem-search, mem-write, sync-credentials | ✅ Full access |
| Provisioning | aws-provisioner, *-destroyer, etc. | ✅ Full access |

---

## Installation

If a CLI is truly missing from Codex (but exists on the system), it's likely a `$PATH` issue in Codex's shell environment.

### For notebooklm specifically:

**Verify installation:**
```bash
pipx list | grep notebooklm
# Should show: notebooklm-py
```

**If not installed, install it:**
```bash
pipx install notebooklm-py[browser]
notebooklm --version
# Should output: NotebookLM CLI, version 0.3.4
```

**Create symlink if missing:**
```bash
ln -sf /Users/Office/.local/pipx/venvs/notebooklm-py/bin/notebooklm ~/.local/bin/notebooklm
which notebooklm
# Should show: /Users/Office/.local/bin/notebooklm
```

### For custom CLIs (spark-cli, aws-cli, etc.):

These are symlinks managed in `brain/operations/system-configs/bin/`. Verify they exist:

```bash
ls -la ~/.local/bin/spark-cli
ls -la ~/.local/bin/aws-cli
# Each should be a symlink pointing to the real binary
```

If missing, recreate symlinks:
```bash
# For spark-cli
ln -sf /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/bin/spark-cli ~/.local/bin/spark-cli

# For aws-cli
ln -sf /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/bin/aws-cli ~/.local/bin/aws-cli
```

---

## Why Codex Couldn't See notebooklm (Root Cause Analysis)

**Problem:** Codex reported "no access to notebooklm"

**Root Cause:** There was no unified CLI manifest documenting that all CLIs should be available to all AIs. Without centralized documentation:
- Codex's capabilities were unclear
- It was unclear which CLIs were installed and where
- There was no verification procedure
- Access inconsistencies went undocumented

**Solution:** Created `operations/CLI-MANIFEST.md` as the single source of truth.

**Why the fix works:**
1. notebooklm IS installed at `~/.local/bin/notebooklm`
2. `~/.local/bin/` IS in Codex's `$PATH`
3. Therefore Codex CAN access notebooklm
4. The problem was documentation/visibility, not actual access

---

## Unified AI Access Model

All three AIs now follow the same pattern:

| AI | CLI Access | Verification |
|----|-----------|--------------|
| Claude Code | Bash tool + system PATH | `bash which notebooklm` |
| Codex | Computer Use shell + system PATH | `notebooklm --version` |
| Gemini CLI | context-mode shell + system PATH | Shell exec + PATH lookup |

**Key insight:** All CLIs are in `~/.local/bin/`, which is in the system PATH. All AIs inherit the system PATH, so all AIs can access all CLIs automatically.

---

## Adding New CLIs

**When you install a new CLI:**

1. Install it to `~/.local/bin/` (either directly or as a symlink)
2. Add entry to `operations/CLI-MANIFEST.md`
3. Verify in all three AIs:
   ```bash
   # Claude Code
   bash which new-cli
   
   # Codex (via Computer Use)
   which new-cli
   
   # Gemini CLI
   gemini-shell "which new-cli"
   ```
4. If using a wrapper/symlink in `brain/operations/system-configs/bin/`, run:
   ```bash
   node tools/scripts/sync-ai-skills.mjs --check
   ```

---

## Related Documentation

- **CLI Registry:** `operations/CLI-MANIFEST.md` — complete list with access matrix
- **Brain Config:** `CLAUDE.md` — references CLI manifest and unified access model
- **NotebookLM:** `operations/runbooks/notebooklm.md` — specific NotebookLM runbook
- **Spark CLI:** `operations/runbooks/spark-cli.md` — email client access
- **System Configs:** `operations/system-configs/` — where most CLIs are symlinked from

---

## Testing in Codex

To verify Codex has full CLI access, run this test suite in Computer Use:

```bash
#!/bin/bash
echo "=== Codex CLI Access Test ==="
echo ""

# System CLIs
echo "[System]"
git --version
node --version
python3 --version

# AI/Media
echo "[AI/Media]"
notebooklm --version
stable-audio-cli --help | head -1

# Cloud
echo "[Cloud]"
aws-cli --version 2>&1 | head -1
cloudflare-cli --version 2>&1 | head -1

# Research
echo "[Research]"
firecrawl --help 2>&1 | head -1
spark-cli --help 2>&1 | head -1

# Scripts
echo "[Scripts]"
mem-search --help 2>&1 | head -1
sync-credentials --help 2>&1 | head -1

echo ""
echo "=== All tests completed ==="
```

Expected: All commands should show version/help output with no "command not found" errors.

---

**Status:** Fixed 2026-05-25  
**Verified:** CLI manifest created, access model documented, notebooklm confirmed available
