# CLI Installation Guide — Automated Workflow for All AIs

**For Claude Code, Codex, and Gemini CLI**

When any AI needs to install or manage a CLI tool, this is the **only** workflow that matters.

---

## The Workflow (3 commands)

### 1. Install a New CLI
```bash
install-cli --name "command-name" --path "/path/to/binary" --description "what it does"
```

**What happens automatically:**
- ✅ Creates symlink to `~/.local/bin/command-name`
- ✅ Updates `operations/CLI-MANIFEST.md`
- ✅ Runs `sync-ai-skills.mjs` to sync to all AIs
- ✅ Verifies access in Claude Code

**Example:**
```bash
install-cli --name my-tool --path /usr/local/bin/my-tool --description "My awesome tool"
install-cli --name notebooklm --path /usr/local/bin/notebooklm
```

### 2. Verify a CLI Works in All AIs
```bash
verify-cli-access "command-name"
```

**What it checks:**
- Is the CLI in the manifest?
- Is it in PATH for Claude Code?
- Is the symlink correct?
- Can the binary be executed?

**Example:**
```bash
verify-cli-access notebooklm
# Output:
# ✓ In manifest
# ✓ Claude Code (Bash): ✓
# Symlink: /Users/Office/.local/bin/notebooklm -> /path/to/notebooklm
```

### 3. Check All CLIs
```bash
verify-cli-access
# No argument checks all critical CLIs
```

---

## Where AIs Discover This

1. **Root README.md** — ⚡ Quick Reference section at top (you're reading it)
2. **CLI-MANIFEST.md** — Quick Start section (line 1-50)
3. **CLAUDE.md** — CLI Manifest section (refs this workflow)
4. **This file** — Full procedural guide

---

## For Each AI Agent

### Claude Code
- Can invoke: `bash install-cli --name cmd --path /path`
- Can invoke: `bash verify-cli-access cmd`
- Can read manifest: `operations/CLI-MANIFEST.md`
- **Discovery:** When in brain repo, read root README.md first

### Codex
- Can invoke (Computer Use): `install-cli --name cmd --path /path`
- Can invoke (Computer Use): `verify-cli-access cmd`
- Can read manifest: `operations/CLI-MANIFEST.md`
- **Discovery:** When in brain repo context, check README.md Quick Reference

### Gemini CLI
- Can invoke (context-mode shell): `install-cli --name cmd --path /path`
- Can invoke (context-mode shell): `verify-cli-access cmd`
- Can read manifest: `operations/CLI-MANIFEST.md`
- **Discovery:** When brain context is loaded, read README.md Quick Reference

---

## Common Scenarios

### Scenario 1: User says "I installed XYZ, make it available to all AIs"

1. Ask: What's the full path to XYZ?
   ```bash
   which XYZ
   # Returns: /path/to/XYZ
   ```

2. Install it:
   ```bash
   install-cli --name XYZ --path /path/to/XYZ --description "what it does"
   ```

3. Verify:
   ```bash
   verify-cli-access XYZ
   ```

4. Commit:
   ```bash
   git add -A && git commit -m "Infrastructure: Add CLI XYZ to manifest"
   ```

### Scenario 2: Codex says "I can't access CLI XYZ"

1. Check if it's in the manifest:
   ```bash
   verify-cli-access XYZ
   ```

2. If "✗ Not in manifest", install it:
   ```bash
   install-cli --name XYZ --path $(which XYZ)
   ```

3. If already in manifest, run in Codex (Computer Use):
   ```bash
   which XYZ
   ```
   
   Should return the path. If not, see Troubleshooting.

### Scenario 3: Claude Code needs to install a new CLI during a task

Example: During video production work, user needs `ffmpeg`:

```bash
# Find where it's installed
which ffmpeg
# /opt/homebrew/bin/ffmpeg

# Install it for all AIs
install-cli --name ffmpeg --path /opt/homebrew/bin/ffmpeg --description "Video/audio encoder"

# Verify it worked
verify-cli-access ffmpeg

# Include in the task commit
git add -A && git commit -m "Add ffmpeg CLI + update manifest"
```

---

## Troubleshooting

### "verify-cli-access says CLI is not in manifest"

**Cause:** The CLI hasn't been registered yet.

**Fix:**
```bash
install-cli --name cli-name --path $(which cli-name) --description "what it does"
```

### "CLI works in Claude Code but Codex can't find it"

**Cause:** Usually PATH differences or shell configuration.

**Debug (in Codex Computer Use):**
```bash
echo $PATH
which cli-name
ls -la ~/.local/bin/cli-name
```

**Fix:** Run `verify-cli-access cli-name` from main system. If it shows ✓ everywhere, Codex has access — it may be a shell config issue.

### "install-cli says target doesn't exist"

**Cause:** Wrong path provided.

**Debug:**
```bash
which command-name
file /path/to/command-name
ls -la /path/to/command-name
```

**Fix:** Use the correct path from `which`.

### "install-cli says target is not executable"

**Cause:** Symlink points to something that's not executable.

**Debug:**
```bash
file /path/to/target
chmod +x /path/to/target
```

**Fix:** Ensure target is executable, then re-run install-cli.

---

## Technical Details

### What install-cli Does

1. **Validate input:**
   - Check --name and --path are provided
   - Check target file exists
   - Check target is executable

2. **Create symlink:**
   - To: `~/.local/bin/{name}`
   - From: {path}
   - Removes old symlink if it exists
   - Verifies it works

3. **Update manifest:**
   - Adds entry to `operations/CLI-MANIFEST.md`
   - Notes in manifest if updating existing entry

4. **Sync to AIs:**
   - Runs `node tools/scripts/sync-ai-skills.mjs`
   - Checks if sync succeeded

5. **Verify access:**
   - Tests if CLI can be found in PATH
   - Tries `--version`, `--help`, `-h` flags
   - Reports success or errors

### What verify-cli-access Does

1. **If CLI name provided:**
   - Searches `operations/CLI-MANIFEST.md` for entry
   - Tests if CLI works from PATH
   - Shows symlink target
   - Guides manual verification for other AIs

2. **If no CLI name (all CLIs):**
   - Tests critical CLIs: git, node, python3, notebooklm, spark-cli, etc.
   - Shows pass/fail count
   - Recommends next steps

### How PATH Works

All CLIs symlink to `~/.local/bin/`, which is in system `$PATH`:

```bash
echo $PATH
# Output includes: /Users/Office/.local/bin
```

All three AIs inherit system PATH:
- Claude Code: Bash tool reads system PATH ✅
- Codex: Computer Use shell reads system PATH ✅
- Gemini CLI: context-mode shell reads system PATH ✅

Therefore: If a CLI is symlinked to `~/.local/bin/`, all AIs can access it.

---

## Key Rules

1. **One entry point for installation:** Use `install-cli`, never manual steps
2. **Manifest is source of truth:** If CLI is installed, it's in `operations/CLI-MANIFEST.md`
3. **All AIs see same CLIs:** Via system `$PATH` + symlinks to `~/.local/bin/`
4. **Verification is automated:** Run `verify-cli-access` before claiming success
5. **No AIs have special access:** All three access the same symlinks in `~/.local/bin/`

---

## Next Steps

- **Read:** `operations/CLI-MANIFEST.md` — Complete registry
- **Read:** `operations/AI-CONFIG-INDEX.md` — Central config directory
- **Troubleshoot:** `operations/runbooks/codex-cli-access.md` — Codex-specific guide
- **Browse:** `tools/scripts/install-cli.sh` and `tools/scripts/verify-cli-access.sh` — Implementation

---

**Summary:** 
- Install: `install-cli --name cmd --path /path --description "desc"`
- Verify: `verify-cli-access cmd`
- Commit: `git add -A && git commit`
- Done. No manual steps. No remembering procedures.

**Created:** 2026-05-25  
**For:** Claude Code, Codex, Gemini CLI
