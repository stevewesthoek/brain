---
name: firecrawl
description: Default tool for ALL web data tasks — searching the internet, scraping URLs to clean markdown, crawling entire websites. Replaces /browse and WebFetch for research. AI-agnostic: works with Claude Code, Codex, and Gemini Flash. Use whenever you need to fetch web content, search the web, or research online.
---

# /firecrawl — Self-Hosted Web Data API

**Default web research tool.** Self-hosted Firecrawl API at `https://firecrawl.prochat.tools` for token-efficient, structured web scraping and search.

- **Token efficiency**: 75–90% reduction vs raw HTML (returns clean markdown)
- **AI-agnostic**: Works with Claude Code, Codex, Gemini Flash
- **Replaces**: `/browse` (QA tool, retired), `WebFetch` (token-heavy HTML), ad-hoc web searching
- **No auth required**: Self-hosted with authentication disabled
- **Uses**: Playwright for JS-heavy sites, auto-handles redirects and anti-bot measures

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

## API Endpoints

**Base URL:** `https://firecrawl.prochat.tools`  
**Auth:** None (self-hosted, `USE_DB_AUTHENTICATION=false`)

### Search the Web

```bash
curl -X POST https://firecrawl.prochat.tools/v1/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "your search query",
    "limit": 5,
    "scrape": true
  }'
```

**Response:**
```json
[
  {
    "url": "https://...",
    "title": "...",
    "description": "...",
    "markdown": "# Full page content as markdown"
  },
  ...
]
```

**Key field:** `markdown` — use this for content, ignore `rawHtml` or `html`

### Scrape a Single URL

```bash
curl -X POST https://firecrawl.prochat.tools/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com/page",
    "formats": ["markdown"]
  }'
```

**Response:**
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

### Crawl an Entire Site (Async)

```bash
# Start crawl
curl -X POST https://firecrawl.prochat.tools/v1/crawl \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com",
    "scrapeOptions": {"formats": ["markdown"]}
  }'

# Response:
# {
#   "id": "crawl-12345",
#   "url": "https://example.com"
# }

# Check status (poll)
curl https://firecrawl.prochat.tools/v1/crawl/crawl-12345 \
  -H 'Content-Type: application/json' \
  -d '{}'

# Response (while running):
# {
#   "status": "running",
#   "completed": 3,
#   "total": 15,
#   "data": [{"markdown": "..."}, ...]
# }

# Response (when done):
# {
#   "status": "completed",
#   "completed": 15,
#   "total": 15,
#   "data": [...]
# }
```

---

## Usage Examples

### Claude Code (Direct HTTP)

```bash
# Search
result=$(curl -s -X POST https://firecrawl.prochat.tools/v1/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "best React design systems 2026",
    "limit": 3,
    "scrape": true
  }')

# Extract markdown from first result
echo "$result" | jq -r '.[0].markdown'
```

### Codex (Reference in AGENTS.md)

Add to your project's `AGENTS.md`:

```markdown
## Web Research

Use Firecrawl for all web search and scraping:
- **Base URL:** `https://firecrawl.prochat.tools`
- **No auth required**
- **Endpoints:**
  - `POST /v1/search` — web search + scrape top results
  - `POST /v1/scrape` — single URL to markdown
  - `POST /v1/crawl` — async site crawl

Example:
\`\`\`bash
curl -X POST https://firecrawl.prochat.tools/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "...", "limit": 5, "scrape": true}' | jq '.[].markdown'
\`\`\`
```

### Gemini Flash (Preprocess Large Results)

```bash
# Fetch search results
results=$(curl -s -X POST https://firecrawl.prochat.tools/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "topic", "limit": 10, "scrape": true}')

# Pass to Gemini Flash for preprocessing/summarization
gemini-review.sh "Summarize these research findings into 5 key insights: $(echo "$results" | jq -r '.[].markdown' | head -c 50000)"
```

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

## Admin & Monitoring

**Admin Queue UI:** `https://firecrawl.prochat.tools/admin/<BULL_AUTH_KEY>/queues`  
(Replace `<BULL_AUTH_KEY>` with the actual key from Dokploy env vars)

- Useful for: monitoring crawl jobs, inspecting failed requests, checking queue depth
- Does NOT require auth to view (endpoint is internal)

**Health check:**

```bash
curl -s https://firecrawl.prochat.tools/health || echo "Firecrawl is down"
```

---

## Configuration & Deployment

Deployed on Dokploy at `firecrawl.prochat.tools`.

**Key env vars:**
- `USE_DB_AUTHENTICATION=false` — no auth needed
- `CRAWL_CONCURRENT_REQUESTS=5` — single-user limit
- `BLOCK_MEDIA=true` — skip images/video for speed
- `LOGGING_LEVEL=warn` — minimal logs

**Persistent storage:** PostgreSQL database in Docker volume `firecrawl_pgdata`

**Rollback:** If Firecrawl service fails, restart via Dokploy dashboard or:
```bash
ssh dokploy 'docker compose -f /path/to/firecrawl/docker-compose.yml restart'
```

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

- **Live:** `https://firecrawl.prochat.tools` (deployed to Dokploy 2026-04-10)
- **Database:** PostgreSQL in Docker volume (persistent)
- **Replaced:** `/browse` skill, WebFetch (for research)
- **Maintained by:** Claude Code, Codex, Gemini Flash research workflows
