# Firecrawl Quick Start

**Status:** ✅ Ready to use (deployed to `https://firecrawl.prochat.tools`)

---

## One-Minute Overview

Firecrawl is your new default tool for **all web research, searching, and scraping**. It returns clean markdown (not bloated HTML), integrates with Gemini Flash for preprocessing, and works seamlessly with Claude Code, Codex, and Gemini.

**Replaces:**
- ❌ `/browse` (QA tool, retired)
- ❌ `WebFetch` (token-heavy raw HTML)
- ✅ Everything web-related → `/firecrawl`

---

## Using Firecrawl in Claude Code

**Endpoint:** `http://100.83.38.48:3002` (Tailscale private network)

### Search + Get Full Content

```bash
curl -X POST http://100.83.38.48:3002/v1/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "best React design systems 2026",
    "limit": 3,
    "scrape": true
  }' | jq '.[0].markdown'
```

**Output:** Clean markdown from the first search result.

### Scrape a Single Page

```bash
curl -X POST http://100.83.38.48:3002/v1/scrape \
  -H 'Content-Type: application/json' \
  -d '{
    "url": "https://example.com/article",
    "formats": ["markdown"]
  }' | jq '.data.markdown'
```

**Output:** Full page as markdown.

### Crawl Entire Website (Async)

```bash
# Start crawl
curl -X POST http://100.83.38.48:3002/v1/crawl \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://example.com", "scrapeOptions": {"formats": ["markdown"]}}' \
  | jq '.id'

# Check status (replace CRAWL_ID)
curl http://100.83.38.48:3002/v1/crawl/CRAWL_ID \
  -H 'Content-Type: application/json' -d '{}' | jq '.status'
```

---

## Using Firecrawl in Codex

Add this to your project's `AGENTS.md`:

```markdown
## Web Research

Use Firecrawl (self-hosted) for all web search and scraping:

**API:** `https://firecrawl.prochat.tools`  
**Auth:** None required  
**Endpoints:**
- `POST /v1/search` — web search, returns markdown content
- `POST /v1/scrape` — single URL to markdown
- `POST /v1/crawl` — async batch crawl

**Example:**
```bash
curl -X POST https://firecrawl.prochat.tools/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "your topic", "limit": 5, "scrape": true}' \
  | jq '.[].markdown'
```
```

---

## Using Firecrawl with Gemini Flash (Token Saver)

For large research tasks, preprocess results with Gemini Flash (free) before passing to Claude:

```bash
# 1. Search with Firecrawl
results=$(curl -s -X POST http://100.83.38.48:3002/v1/search \
  -H 'Content-Type: application/json' \
  -d '{"query": "competitive analysis SaaS pricing", "limit": 10, "scrape": true}')

# 2. Preprocess with Gemini Flash (75–90% token reduction)
summary=$(gemini-review.sh "Extract 5 key pricing insights from these sources:

$(echo "$results" | jq -r '.[].markdown' | head -c 50000)")

# 3. Claude synthesizes summary into final output
echo "Research summary: $summary"
```

**Result:** 50k tokens of raw research → ~5k tokens of insights. 90% savings!

---

## Real-World Research Workflow

**Scenario:** Competitive analysis on 5 design system libraries

```bash
# Step 1: Search with Firecrawl
echo "🔍 Searching for design systems..."
results=$(curl -s -X POST http://100.83.38.48:3002/v1/search \
  -H 'Content-Type: application/json' \
  -d '{
    "query": "Linear Stripe Vercel design systems 2026",
    "limit": 5,
    "scrape": true
  }')

# Step 2: Extract markdown
markdown=$(echo "$results" | jq -r '.[].markdown' | head -c 100000)

# Step 3: Preprocess with Gemini (free, fast)
echo "🧠 Preprocessing with Gemini Flash..."
insights=$(gemini-review.sh "
Analyze these design system sources and extract:
1. Color palette approach
2. Typography rules
3. Component patterns
4. Documentation quality
5. Licensing

Sources:
$markdown
")

# Step 4: Claude synthesizes
echo "✅ Key insights:"
echo "$insights"
```

**Token cost:**
- Without Gemini: 100k tokens input (raw markdown) → expensive
- With Gemini: 5k tokens → Gemini (free) → 2k tokens → Claude → savings

---

## API Reference (Cheat Sheet)

| Endpoint | Method | Use | Response |
|----------|--------|-----|----------|
| `http://100.83.38.48:3002/v1/search` | POST | Web search | Array of results with `markdown` field |
| `http://100.83.38.48:3002/v1/scrape` | POST | Scrape URL | Object with `data.markdown` field |
| `http://100.83.38.48:3002/v1/crawl` | POST | Start async crawl | Object with `id` field |
| `http://100.83.38.48:3002/v1/crawl/:id` | GET | Check crawl status | Object with `status` and `data` fields |
| `http://100.83.38.48:3002/health` | GET | Health check | 200 OK if running |
| `http://100.83.38.48:3002/admin/<BULL_AUTH_KEY>/queues` | GET | Admin UI | Dashboard HTML |

**Common request:**
```json
{
  "url": "https://example.com",
  "formats": ["markdown"]
}
```

**Common response:**
```json
{
  "success": true,
  "data": {
    "markdown": "# Page Heading\n\nContent here...",
    "url": "https://example.com",
    "status": 200
  }
}
```

---

## Dos and Don'ts

### ✅ Do

- Use Firecrawl for all web research
- Request `"formats": ["markdown"]` only
- Preprocess large results with Gemini Flash
- Check `"success": true` before using data
- Cache results if researching the same topic twice

### ❌ Don't

- Use raw HTML (verbose, token-heavy)
- Make 50+ parallel requests
- Re-scrape the same URL repeatedly
- Use for interactive UI testing (form fills, clicks)
- Ignore error responses — handle them gracefully

---

## Troubleshooting

**Can't reach Firecrawl?**
- Verify Tailscale connectivity: `~/.local/bin/tailscale-cli ping dokploy`
- Check Dokploy containers: `ssh dokploy 'docker ps | grep firecrawl'`
- Test directly on server: `ssh dokploy 'curl http://localhost:3002/health'`

**API returns empty markdown?**
- Page might be JS-heavy (Firecrawl retries with Playwright)
- Try again; sometimes 2nd attempt works
- Check if page is behind a paywall or protection

**Admin queue UI 404?**
- Wrong `BULL_AUTH_KEY` in URL
- Check Dokploy environment settings for correct key
- Try: `curl -s https://firecrawl.prochat.tools/admin/health`

---

## Token Savings Example

**Task:** Research top 3 React design systems, compare features, extract pros/cons

### Without Firecrawl + Gemini

1. Search (WebFetch): 10k tokens
2. Scrape 3 URLs (WebFetch × 3): 30k tokens
3. Claude analyzes: 5k tokens
4. **Total: ~45k tokens** (45 input + 15 output avg)
5. **Cost:** ~$0.018 (at Claude pricing)

### With Firecrawl + Gemini

1. Firecrawl search (5 results, scrape=true): 15k tokens
2. Gemini Flash preprocess (free tier): 0 tokens
3. Claude synthesizes (from 2k token summary): 3k tokens
4. **Total: ~5k tokens** (3 input + 2 output avg)
5. **Cost:** ~$0.002
6. **Savings:** 89% tokens, 89% cost

---

## Integration with Existing Workflows

### /autoresearch

Firecrawl can power `/autoresearch` optimization loops:

```
Define optimization goal → research competitors with /firecrawl
→ extract metrics → apply changes → measure → iterate
```

### /design-system

When researching design systems for a new project:

```
/design-system → user picks design type
→ /firecrawl searches existing implementations
→ Gemini preprocesses
→ DESIGN.md generated
```

---

## What Happens Behind the Scenes

1. **Firecrawl API** receives your request
2. **Playwright microservice** loads the page (handles JS)
3. **Redis cache** stores results (faster on retry)
4. **RabbitMQ** queues async operations (crawls, batch jobs)
5. **PostgreSQL** stores metadata (job history, status)
6. **Returns clean markdown** (junk removed, structure preserved)

**You get:** Fast, clean, AI-friendly markdown. No HTML bloat.

---

## Status & Support

- **Service:** Live at `https://firecrawl.prochat.tools`
- **Database:** Persistent (PostgreSQL Docker volume)
- **Runbook:** `brain/operations/runbooks/firecrawl.md`
- **Skill docs:** `brain/ai/skills/custom/firecrawl/SKILL.md`
- **Issues:** Check runbook troubleshooting section

---

## Next Steps

1. **Now:** Use `/firecrawl` for your next research task
2. **Try:** Combine with `/gemini` (Flash preprocess) for large searches
3. **Optimize:** Cache results, reuse across multiple analyses
4. **Monitor:** Check memory on Dokploy if doing bulk scraping

---

**Happy researching! 🚀**
