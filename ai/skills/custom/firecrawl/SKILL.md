---
name: firecrawl
description: "Default tool for ALL web data tasks — searching the internet, scraping URLs to clean markdown, crawling entire websites. Replaces /browse and WebFetch for research. AI-agnostic: works with Claude Code, Codex, and Gemini Flash. Use whenever you need to fetch web content, search the web, or research online."
---

# /firecrawl — Local On-Demand Web Scraping API

**Default web research tool for Claude Code, Codex, and Gemini.** Local Docker-based Firecrawl with auto-lifecycle management (starts on-demand, idles down after 15 minutes). All requests routed through wrapper at `~/tools/firecrawl/firecrawl-wrapper.sh`.

- **Token efficiency**: 75–90% reduction vs raw HTML (returns clean markdown)
- **AI-agnostic**: Works with Claude Code, Codex, Gemini Flash (single source of truth)
- **Auto-managed**: Starts on first request, shuts down after 15-minute idle timeout
- **Replaces**: `/browse` (QA tool, retired), `WebFetch` (token-heavy HTML), ad-hoc web searching
- **Safe defaults**: Hard caps on crawl depth and pages; domain-scoped crawling
- **Auditable**: All requests logged to `~/tools/firecrawl/logs/firecrawl.log`
- **Managed wrapper**: Validates parameters, enforces caps, handles timeouts, manages lifecycle

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

All Firecrawl requests go through the wrapper at `~/tools/firecrawl/firecrawl-wrapper.sh`:

```bash
# Manual usage
~/tools/firecrawl/firecrawl-wrapper.sh scrape <url> [timeout]
~/tools/firecrawl/firecrawl-wrapper.sh crawl <url> [pages] [depth] [timeout] [--deep]
~/tools/firecrawl/firecrawl-wrapper.sh map <url> [timeout]

# Check health
~/tools/firecrawl/firecrawl-wrapper.sh health

# View logs
~/tools/firecrawl/firecrawl-wrapper.sh logs
```

### Wrapper Features

- **Parameter validation**: Enforces hard caps (max 50 pages, 3 depth, 120s timeout)
- **Health checks**: Verifies Firecrawl is responding before requests
- **Comprehensive logging**: Every request logged with URL, mode, parameters, and result
- **Safe defaults**: 25 pages, 2 depth, 60s timeout unless overridden
- **Deep mode**: `--deep` flag allows up to 100 pages and 3 depth for approved research
- **Error handling**: Clear messages if Firecrawl is unavailable or requests fail

### Logs

All requests logged to: `~/tools/firecrawl/logs/firecrawl.log`

Format: `[timestamp] REQUEST | URL: ... | MODE: ... | MAX_PAGES: ... | STATUS: ...`

Example:
```
[2026-04-15 08:49:37] REQUEST | URL: https://platform.claude.com | MODE: scrape | MAX_PAGES: 25 | MAX_DEPTH: 2 | TIMEOUT: 60 | PROXY: none | STATUS: success
```

## Local Endpoint

**Localhost:** `http://localhost:3051`  
**Do NOT use directly** — always route through wrapper at `~/tools/firecrawl/firecrawl-wrapper.sh` for safety, logging, and lifecycle management

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
~/tools/firecrawl/firecrawl-wrapper.sh scrape https://example.com

# Crawl a site (25 pages, depth 2 by default)
~/tools/firecrawl/firecrawl-wrapper.sh crawl https://example.com

# Crawl with custom limits
~/tools/firecrawl/firecrawl-wrapper.sh crawl https://example.com 10 2 60

# Deep crawl for approved research
~/tools/firecrawl/firecrawl-wrapper.sh crawl https://example.com --deep

# Check if Firecrawl is running
~/tools/firecrawl/firecrawl-wrapper.sh health

# View request logs
~/tools/firecrawl/firecrawl-wrapper.sh logs
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

**Automatic startup:** Wrapper detects first request and starts Docker Compose if not running

**Automatic shutdown:** After 15 minutes of inactivity, Firecrawl stops automatically to free resources

**Manual control:**
```bash
# Start Firecrawl manually
cd ~/tools/firecrawl && docker-compose up -d

# Stop Firecrawl manually
cd ~/tools/firecrawl && docker-compose down

# Check current status
~/tools/firecrawl/firecrawl-wrapper.sh health
```

---

## Configuration

Configured via `~/tools/firecrawl/docker-compose.yml`:

**Key env vars:**
- `USE_DB_AUTHENTICATION=false` — no auth needed
- `CRAWL_CONCURRENT_REQUESTS=5` — single-user limit
- `BLOCK_MEDIA=true` — skip images/video for speed
- `LOGGING_LEVEL=warn` — minimal logs

**Persistent storage:** PostgreSQL database in Docker volume `firecrawl_pgdata` (survives container restarts)

**Wrapper config:** `~/tools/firecrawl/firecrawl-wrapper.sh`
- Hard caps: 50 pages, 3 depth, 120s timeout
- Safe defaults: 25 pages, 2 depth, 60s timeout
- Idle timeout: 15 minutes before auto-shutdown
- Logging: `~/tools/firecrawl/logs/firecrawl.log`

---

## Do's and Don'ts

### ✅ Do

- Use Firecrawl for all web search and content extraction
- Request markdown format only (compact, AI-friendly)
- Preprocess large results with Gemini Flash before passing to Claude
- Cache results if doing duplicate research (don't re-fetch the same URL)
- Check `"success": true` in response before using data

### ❌ Don't

- Use raw HTML output (verbose, token-heavy)
- Make 50+ parallel requests (rate limited)
- Repeatedly scrape the same URL (cache it)
- Use for interactive browser testing (form fills, clicks)
- Bypass markdown processing (raw JSON is messy)

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
