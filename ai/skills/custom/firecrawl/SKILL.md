---
name: firecrawl
description: "Default tool for ALL web data tasks — searching the internet, scraping URLs to clean markdown, crawling entire websites. Replaces /browse and WebFetch for research. AI-agnostic: works with Claude Code, Codex, and Gemini Flash. Use whenever you need to fetch web content, search the web, or research online."
---

# /firecrawl — Local On-Demand Web Scraping API

**Default web research tool for Claude Code, Codex, and Gemini.** Local Docker-based Firecrawl with auto-startup and auto-shutdown lifecycle management. All requests routed through wrapper at `brain/tools/firecrawl/firecrawl-wrapper.sh`.

- **Token efficiency**: 75–90% reduction vs raw HTML (returns clean markdown)
- **AI-agnostic**: Works with Claude Code, Codex, Gemini Flash, and IDE plugins (single source of truth)
- **Auto-infrastructure**: Auto-starts OrbStack and Docker containers on first use; idles down after 15-minute timeout
- **Database auto-recovery**: Always checks if database is running; starts if needed (no manual intervention required)
- **Replaces**: `/browse` (QA tool, retired), `WebFetch` (token-heavy HTML), ad-hoc web searching
- **Safe defaults**: Hard caps on crawl depth and pages; domain-scoped crawling
- **Auditable**: All requests logged to `brain/tools/firecrawl/logs/firecrawl.log`
- **Background daemon**: Idle-daemon monitors activity and auto-shuts down containers after 15 minutes

---

## When to Use This Skill

**Use Firecrawl for:**
- Web search + content extraction (research, competitive analysis)
- Scraping any URL to clean markdown (not HTML)
- Batch crawling an entire site (returns all pages as markdown)
- Finding structured data on pages (prices, specs, reviews)
- Research tasks where you need full page content

**Do NOT use Firecrawl for:**
- Interactive browser testing (clicking buttons, filling forms, taking QA screenshots) — use manual testing or a dedicated QA tool
- High-frequency automated scraping (rate limited)
- Sites with aggressive anti-bot measures (no Fire-engine in self-hosted)

---

## Wrapper Usage

All Firecrawl requests go through the wrapper at `brain/tools/firecrawl/firecrawl-wrapper.sh`:

```bash
# Manual usage
brain/tools/firecrawl/firecrawl-wrapper.sh scrape <url> [timeout]
brain/tools/firecrawl/firecrawl-wrapper.sh crawl <url> [pages] [depth] [timeout] [--deep]
brain/tools/firecrawl/firecrawl-wrapper.sh map <url> [timeout]

# Check health
brain/tools/firecrawl/firecrawl-wrapper.sh health

# View logs
brain/tools/firecrawl/firecrawl-wrapper.sh logs
```

### Wrapper Features

- **Parameter validation**: Enforces hard caps (max 50 pages, 3 depth, 120s timeout)
- **Health checks**: Verifies Firecrawl is responding before requests
- **Comprehensive logging**: Every request logged with URL, mode, parameters, and result
- **Safe defaults**: 25 pages, 2 depth, 60s timeout unless overridden
- **Deep mode**: `--deep` flag allows up to 100 pages and 3 depth for approved research
- **Error handling**: Clear messages if Firecrawl is unavailable or requests fail

### Logs

All requests logged to: `brain/tools/firecrawl/logs/firecrawl.log`

Format: `[timestamp] REQUEST | URL: ... | MODE: ... | MAX_PAGES: ... | STATUS: ...`

Example:
```
[2026-04-15 08:49:37] REQUEST | URL: https://platform.claude.com | MODE: scrape | MAX_PAGES: 25 | MAX_DEPTH: 2 | TIMEOUT: 60 | PROXY: none | STATUS: success
```

## Local Endpoint

**Localhost:** `http://localhost:3051`  
**Do NOT use directly** — always route through wrapper at `brain/tools/firecrawl/firecrawl-wrapper.sh` for safety, logging, and lifecycle management

The wrapper automatically:
- Starts Docker Compose on first request
- Handles all API calls with parameter validation
- Logs all requests for audit trail
- Shuts down after 15 minutes of inactivity

---

## Usage Examples

### All AI Engines (Claude Code, Codex, Gemini)

Use the wrapper script consistently across all engines:

```bash
# Scrape a single URL
brain/tools/firecrawl/firecrawl-wrapper.sh scrape https://example.com

# Crawl a site (25 pages, depth 2 by default)
brain/tools/firecrawl/firecrawl-wrapper.sh crawl https://example.com

# Crawl with custom limits
brain/tools/firecrawl/firecrawl-wrapper.sh crawl https://example.com 10 2 60

# Deep crawl for approved research
brain/tools/firecrawl/firecrawl-wrapper.sh crawl https://example.com --deep

# Check if Firecrawl is running
brain/tools/firecrawl/firecrawl-wrapper.sh health

# View request logs
brain/tools/firecrawl/firecrawl-wrapper.sh logs
```

### Response Format

All API responses are JSON with consistent structure:

```json
{
  "success": true,
  "data": {
    "markdown": "# Page heading\n\nContent here...",
    "url": "https://example.com/page",
    "status": 200
  }
}
```

**Key field:** `markdown` — use this for content, ignore other fields

---

## Integration with Research Workflow

**Standard research flow:**

1. **Claude Code** initiates: "Research X and compile findings"
2. **Claude** calls Firecrawl search via bash: `curl /v1/search`
3. **Gemini Flash** (optional) preprocesses markdown output (75–80% token reduction on large fetches)
4. **Claude** synthesizes findings into markdown summary
5. **Optional:** `/autoresearch` loop optimizes the research step

**Avoid:** Chaining multiple searches without Gemini preprocessing — token usage explodes. Use Gemini Flash freely (it's free) to compact before handing to Claude.

---

## Technical Notes

### Response Format

- Always request `"formats": ["markdown"]` — markdown is compact and AI-friendly
- Ignore `rawHtml` and `html` fields — they're verbose
- Firecrawl cleans content: removes ads, tracking, nav junk; preserves structure

### Concurrency & Rate Limits

- Self-hosted instance limited to **5 concurrent requests** (reduced from default 10 for Dokploy resource constraints)
- No hard rate limits on search frequency (single-user deployment)
- Crawl operations are async — poll via `GET /v1/crawl/:id` for status

### Headers

- `Content-Type: application/json` required for all POST requests
- No Authorization header needed (self-hosted, `USE_DB_AUTHENTICATION=false`)

### Error Handling

```json
{
  "success": false,
  "error": "Failed to fetch URL"
}
```

Check `"success": true` before proceeding. If false, log the error and retry with a different URL or approach.

---

## Lifecycle Management

**Automatic startup:** 
- Wrapper checks OrbStack status and starts if needed
- Detects if Docker containers are down and auto-starts them
- Waits for Firecrawl API to respond (up to 60s)
- No manual intervention required

**Automatic shutdown:** 
- Background idle-daemon monitors activity
- After 15 minutes of no requests, automatically stops containers
- Runs as launchd service: `com.office.firecrawl-idle-daemon`

**Manual control:**
```bash
# Check status (all services)
firecrawl-status

# Start Firecrawl (auto-starts everything if needed)
firecrawl health

# Stop Firecrawl manually
cd brain/tools/firecrawl && docker-compose down

# Restart idle daemon
launchctl restart com.office.firecrawl-idle-daemon

# View daemon logs
tail -f brain/tools/firecrawl/logs/daemon-stdout.log
```

**Daemon management:**
- Installed as: `~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist`
- Auto-loads on Mac startup
- To disable: `launchctl unload ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist`
- To enable: `launchctl load ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist`

---

## Configuration

Configured via `brain/tools/firecrawl/docker-compose.yml`:

**Key env vars:**
- `USE_DB_AUTHENTICATION=false` — no auth needed
- `CRAWL_CONCURRENT_REQUESTS=5` — single-user limit
- `BLOCK_MEDIA=true` — skip images/video for speed
- `LOGGING_LEVEL=warn` — minimal logs

**Persistent storage:** PostgreSQL database in Docker volume `firecrawl_pgdata` (survives container restarts)

**Wrapper config:** `brain/tools/firecrawl/firecrawl-wrapper.sh`
- Hard caps: 50 pages, 3 depth, 120s timeout
- Safe defaults: 25 pages, 2 depth, 60s timeout
- Idle timeout: 15 minutes before auto-shutdown
- Logging: `brain/tools/firecrawl/logs/firecrawl.log`

---

## Troubleshooting

**Issue: "Firecrawl is not responding" error**

This is now **impossible** — the wrapper auto-starts everything. But if you still see this:
- Check OrbStack: `orb status` (start if needed: `orb start`)
- Check Docker: `docker ps` (verify Docker daemon is running)
- Check daemon: `launchctl list com.office.firecrawl-idle-daemon`
- View logs: `firecrawl logs` or `firecrawl-status`

**Issue: Daemon not running**

```bash
# Check if daemon is loaded
launchctl list | grep firecrawl-idle-daemon

# Reload daemon
launchctl unload ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist
launchctl load ~/Library/LaunchAgents/com.office.firecrawl-idle-daemon.plist

# Check daemon logs
tail -f brain/tools/firecrawl/logs/daemon-stdout.log
```

**Issue: Containers not shutting down after 15 minutes**

- Daemon may not be running (see above)
- Manual shutdown: `cd brain/tools/firecrawl && docker compose down`
- Restart daemon: `launchctl restart com.office.firecrawl-idle-daemon`

**Issue: OrbStack not starting**

```bash
# Try CLI start
orb start

# If that fails, try manual start
open -a OrbStack

# Check status
orb status
```

## Do's and Don'ts

### ✅ Do

- Use Firecrawl for all web search and content extraction
- Request markdown format only (compact, AI-friendly)
- Preprocess large results with Gemini Flash before passing to Claude
- Cache results if doing duplicate research (don't re-fetch the same URL)
- Check `"success": true` in response before using data
- Let the wrapper auto-manage startup/shutdown (hands-off operation)

### ❌ Don't

- Use raw HTML output (verbose, token-heavy)
- Make 50+ parallel requests (rate limited)
- Repeatedly scrape the same URL (cache it)
- Use for interactive browser testing (form fills, clicks)
- Bypass markdown processing (raw JSON is messy)
- Manually manage containers unnecessarily (let auto-daemon handle it)

---

## Comparison with Other Tools

| Tool | Purpose | Token Cost | Auth | Still Use? |
|------|---------|-----------|------|-----------|
| **Firecrawl** | Web search + scrape | ~2k tokens (markdown) | None | ✅ YES — default |
| **WebFetch** | Ad-hoc HTML fetch | ~8k tokens (raw HTML) | None | ❌ NO — use Firecrawl |
| `/browse` | QA testing, UI clicks | High (session overhead) | None | ❌ NO — retired |
| **Gemini Flash** | Preprocess large inputs | Free | Yes | ✅ YES — for large results |
| **Codex** | Code review | Paid | Yes | ✅ YES — for code-specific review |

---

## Status

- **Live:** `http://localhost:3051` (local Docker Compose)
- **Database:** PostgreSQL in Docker volume (persistent)
- **Lifecycle:** Auto-starts on first request, auto-stops after 15-minute idle
- **AI-agnostic:** Single skill source readable by Claude Code, Codex, Gemini Flash
- **Replaced:** VPS-backed Firecrawl (removed from Dokploy), `/browse` skill, WebFetch (for research)
