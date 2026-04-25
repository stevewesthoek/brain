# FireCrawl IDE Integration Guide

FireCrawl CLI is now available across all IDEs: **Kiro**, **Cursor**, and **anti-gravity**.

## Quick Start

In any IDE plugin (Claude Code, Codex, Gemini), use:

```bash
/Users/Office/.local/bin/firecrawl <command> <args>
```

When the IDE asks to trust the command, select **"Base"** to allow all firecrawl variations.

## Commands

```bash
# Check health
/Users/Office/.local/bin/firecrawl health

# Scrape a single URL
/Users/Office/.local/bin/firecrawl scrape https://example.com

# Crawl an entire site (25 pages, depth 2)
/Users/Office/.local/bin/firecrawl crawl https://example.com

# Custom crawl parameters
/Users/Office/.local/bin/firecrawl crawl https://example.com 10 2 60

# Deep crawl (up to 100 pages)
/Users/Office/.local/bin/firecrawl crawl https://example.com --deep

# Map site structure
/Users/Office/.local/bin/firecrawl map https://example.com

# View logs
/Users/Office/.local/bin/firecrawl logs
```

## Per-IDE Configuration

### Kiro

✅ **TESTED AND WORKING**

- FireCrawl found: `/Users/Office/.local/bin/firecrawl`
- Trust setting: Select "Base" when prompted (`/Users/Office/.local/bin/firecrawl *`)
- Plugins that can use it: Claude Code plugin, Codex plugin, Gemini plugin

### Cursor

Use identical absolute path: `/Users/Office/.local/bin/firecrawl`

When the Claude Code / Codex / Gemini plugin prompts to trust, select **"Base"**.

### anti-gravity

Use identical absolute path: `/Users/Office/.local/bin/firecrawl`

When the Claude Code / Codex / Gemini plugin prompts to trust, select **"Base"**.

## Technical Details

### Symlink Setup

```bash
~/.local/bin/firecrawl → ~/Repos/stevewesthoek/brain/tools/firecrawl/firecrawl-wrapper.sh
```

### Wrapper Behavior

- Auto-starts Firecrawl Docker container on first use
- Auto-shuts down after 15 minutes of inactivity
- All requests logged to: `~/Repos/stevewesthoek/brain/tools/firecrawl/logs/firecrawl.log`
- Endpoint: `http://localhost:3055`

### Environment

Your shell PATH includes `~/.local/bin`:
```
export PATH="$HOME/.local/bin:$PATH"
```

This is set in `~/.zshrc`, so all IDEs inherit it.

## Helper Scripts (Alternative)

If absolute path doesn't work, try these alternatives (in priority order):

1. **firecrawl-bridge** — Sets up environment properly
   ```bash
   /Users/Office/.local/bin/firecrawl-bridge health
   ```

2. **firecrawl-invoke** — Node.js wrapper
   ```bash
   /Users/Office/.local/bin/firecrawl-invoke health
   ```

3. **firecrawl.js** — Node.js subprocess wrapper
   ```bash
   /Users/Office/.local/bin/firecrawl.js health
   ```

## Troubleshooting

**Issue: IDE says "command not found"**

Solution: Use absolute path `/Users/Office/.local/bin/firecrawl` instead of just `firecrawl`

**Issue: "Permission denied"**

Solution: Verify symlink is executable:
```bash
ls -la ~/.local/bin/firecrawl
# Should show: lrwxr-xr-x ... firecrawl -> .../firecrawl-wrapper.sh
```

**Issue: "Cannot reach localhost:3055"**

Solution: Start Firecrawl manually:
```bash
cd ~/Repos/stevewesthoek/brain/tools/firecrawl
docker-compose up -d
```

**Issue: IDE still can't find firecrawl after trying absolute path**

1. Try `/Users/Office/.local/bin/firecrawl-bridge` instead
2. Check IDE plugin subprocess isolation settings
3. Restart the IDE to reload environment

## Cost Notes

- Using firecrawl in IDE plugins counts toward your token budget (same as CLI usage)
- Firecrawl requests use the wrapper script logs: `~/Repos/stevewesthoek/brain/tools/firecrawl/logs/firecrawl.log`
- No MCP servers involved — direct CLI invocation keeps context overhead minimal

## See Also

- Main firecrawl skill: `~/Repos/stevewesthoek/brain/ai/skills/active/firecrawl/SKILL.md`
- Wrapper reference: `/Users/Office/Repos/stevewesthoek/brain/tools/firecrawl/firecrawl-wrapper.sh`
