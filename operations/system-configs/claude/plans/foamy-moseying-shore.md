# Plan: Self-Hosted Firecrawl on Dokploy — Full Brain Integration

## Context

User needs a token-efficient, AI-agnostic, self-hosted web scraping and search API to replace the current `/browse` skill (gstack vendor, QA-focused) and ad-hoc `WebFetch` usage. Firecrawl is an open-source web data API that scrapes pages to clean markdown (75–90% token savings vs raw HTML), supports search + batch crawl, and has MCP but user explicitly does NOT want MCP wiring.

Goal: Firecrawl becomes the ONLY standard tool for all web data tasks across Claude Code, Codex, and Gemini. `/browse` is retired.

---

## Key Facts from Exploration

### Infrastructure
- **Dokploy server**: 4 vCPU, **15 GiB RAM**, Azure Spain Central, Tailscale `100.83.38.48`, SSH `ssh dokploy`
- **Supabase server**: 2 vCPU, 7.8 GiB RAM (already near capacity with full Supabase stack)
- **Cloudflare Dokploy tunnel**: `dc7bb87e-...` (truncated in infra.md — get full ID via provisioner CLI during execution)
- **Cloudflare CLI**: `~/.local/bin/cloudflare-prochat-provisioner`
- **Dokploy CLI**: `~/.local/bin/dokploy-cli`
- **Supabase Postgres**: `100.71.31.88:5433` via Tailscale

### Firecrawl Stack (from docker-compose.yaml + SELF_HOST.md)
- **5 services**: `api` (4 CPU, 8 GB), `playwright-service` (2 CPU, 4 GB), `redis`, `rabbitmq`, `nuq-postgres`
- **Pre-built images** at `ghcr.io/firecrawl/*` — use these, never build from source on Dokploy
- **Only port exposed**: 3002 (api). Everything else is internal bridge network.
- **Supabase integration**: NOT usable in self-hosted; `USE_DB_AUTHENTICATION=false` is the correct setting
- **Database note**: `nuq-postgres` is a **custom-build container** with pre-applied Firecrawl schema. Using an external Postgres (e.g. on Supabase server) would require running those migrations manually AND the Supabase server is already near RAM capacity. Decision: use `nuq-postgres` container with a persistent Docker volume — this IS a standalone isolated database.
- **No API key required** when `USE_DB_AUTHENTICATION=false`
- **BULL_AUTH_KEY** must be set (non-default) for admin UI security

### Skills
- **`/browse`**: gstack vendor skill, QA/dogfooding browser (not search). Retirable: delete `ai/skills/active/browse`
- **`/autoresearch`**: optimization loop, no web search step — no changes needed
- **Custom skill format**: simple frontmatter + markdown sections (see autoresearch as template)
- **Skill retirement**: delete symlink from `active/`; no "deprecated" frontmatter mechanism

### Memory / Docs to update
- `operations/infrastructure/infra.md` — canonical server/domain registry
- `operations/runbooks/` — create `firecrawl.md`
- `operations/decision-log.md` — append entry
- `operations/system-configs/claude/CLAUDE.md` — update skills list
- `ai/policy/routing.md` — add Firecrawl routing rule + skill sequence

---

## Proposed Subdomain

`firecrawl.prochat.tools` → Dokploy tunnel → Traefik → api:3002

---

## Resource Constraints

Dokploy has 15 GiB RAM. Current workloads (many apps) consume ~8–10 GiB estimated. Must reduce Firecrawl's mem_limits from defaults to fit safely:
- `api`: reduce from 8 GB → **5 GB** (still ample for low-concurrency personal use)
- `playwright-service`: reduce from 4 GB → **2 GB**
- Total Firecrawl footprint: ~7–8 GB including redis/rabbitmq/postgres
- This leaves ~7 GB for existing workloads + OS overhead

Also reduce concurrency for single-user deployment:
- `NUM_WORKERS_PER_QUEUE=4` (down from 8)
- `BROWSER_POOL_SIZE=3` (down from 5)
- `CRAWL_CONCURRENT_REQUESTS=5` (down from 10)
- `MAX_CONCURRENT_JOBS=3` (down from 5)

---

## Phases

### Phase 1 — Database (nuq-postgres container with persistent volume)
No external database needed. The `nuq-postgres` container is Firecrawl's own isolated database.
- Add a named Docker volume `firecrawl_pgdata` to the compose for data persistence
- Harden credentials: `POSTGRES_USER=firecrawl`, `POSTGRES_PASSWORD=<strong-random>`

### Phase 2 — Cloudflare DNS + Tunnel Route
1. Get full Dokploy tunnel ID via: `cloudflared tunnel list` (SSH to Dokploy) or via Cloudflare API
2. Add DNS CNAME: `~/.local/bin/cloudflare-prochat-provisioner dns upsert prochat.tools CNAME firecrawl <tunnel-id>.cfargotunnel.com --ttl 1 --proxied true`
3. Dokploy handles Traefik routing internally when domain is configured in the app

### Phase 3 — Docker Compose Configuration
Create `brain/operations/deploy/firecrawl/docker-compose.yml`:
- Use ghcr.io pre-built images (not local builds)
- Remove `build:` stanzas, use `image:` alternatives
- Add persistent volume for postgres
- Reduce mem_limits to safe levels
- Set all required env vars via Dokploy environment settings (not hardcoded)
- Single `networks.backend` bridge, only port 3002 exposed

Required `.env` variables to set in Dokploy:
```
PORT=3002
HOST=0.0.0.0
USE_DB_AUTHENTICATION=false
BULL_AUTH_KEY=<secure-random>
POSTGRES_USER=firecrawl
POSTGRES_PASSWORD=<secure-random>
POSTGRES_DB=firecrawl
NUM_WORKERS_PER_QUEUE=4
BROWSER_POOL_SIZE=3
CRAWL_CONCURRENT_REQUESTS=5
MAX_CONCURRENT_JOBS=3
BLOCK_MEDIA=true
ALLOW_LOCAL_WEBHOOKS=false
LOGGING_LEVEL=warn
```

Optional (add later):
```
SEARXNG_ENDPOINT=   # for free/private search backend
OPENAI_API_KEY=     # only if /extract JSON feature needed
```

### Phase 4 — Dokploy Deployment
1. Create project `Ops` (or add to existing `Ops` project) in Dokploy
2. Create Compose deployment named `firecrawl`
3. Paste docker-compose.yml content
4. Add all env vars
5. Set custom domain: `firecrawl.prochat.tools` → service `api`, port `3002`
6. Deploy and verify: `curl -X POST https://firecrawl.prochat.tools/v1/scrape -H 'Content-Type: application/json' -d '{"url":"https://example.com","formats":["markdown"]}'`
7. Verify admin UI: `https://firecrawl.prochat.tools/admin/<BULL_AUTH_KEY>/queues`

### Phase 5 — `/firecrawl` Skill Creation
Create `brain/ai/skills/custom/firecrawl/SKILL.md`:

**Frontmatter:**
```yaml
---
name: firecrawl
description: Default tool for ALL web data tasks — searching the internet, scraping URLs to markdown, crawling sites. Replaces /browse and WebFetch for research. AI-agnostic: works with Claude Code, Codex, Gemini. Use whenever you need to fetch web content, search the web, or research a topic online.
---
```

**Skill body covers:**
1. When to use (ALL web data — search, scrape, research, competitive analysis)
2. API reference: base URL `https://firecrawl.prochat.tools`
3. Core endpoints:
   - `POST /v1/search` — web search (returns results + full markdown content)
   - `POST /v1/scrape` — single URL to markdown
   - `POST /v1/crawl` — async crawl entire site
   - `GET /v1/crawl/:id` — check crawl status
4. No auth required (self-hosted with `USE_DB_AUTHENTICATION=false`)
5. Response format: returns `markdown` field, use that — ignore HTML/rawHtml
6. Claude Code usage: direct `curl` or `Bash` tool calls
7. Codex usage: add to AGENTS.md reference
8. Gemini usage: fetch via curl, preprocess markdown output
9. What NOT to use Firecrawl for (interactive UI testing, form submission)

### Phase 6 — Retire /browse
1. Remove symlink: `rm brain/ai/skills/active/browse`
2. Update CLAUDE.md skills list: remove `/browse`, add `/firecrawl`
3. Note: browse binary and vendor files remain in `vendors/gstack/browse/` (not deleted from source, just unregistered)

### Phase 7 — Routing Policy Update
Update `ai/policy/routing.md`:
- Add row to skill sequences table: `Web data / research | /firecrawl → Gemini Flash (preprocess if large)`
- Add note: Firecrawl is the default for all web fetch/search — never use raw WebFetch for research

### Phase 8 — Brain Documentation
1. **`operations/infrastructure/infra.md`**: add `firecrawl.prochat.tools` to Dokploy domain table; note Docker volume for data persistence
2. **`operations/runbooks/firecrawl.md`**: create runbook (API endpoints, verify health, restart steps, admin queue UI, rollback)
3. **`operations/decision-log.md`**: append decision entry (Firecrawl replaces /browse + WebFetch; rationale: token efficiency, structure, self-hosted, AI-agnostic)
4. Commit + push brain repo changes

---

## Files to Create

| File | Action |
|------|--------|
| `operations/deploy/firecrawl/docker-compose.yml` | Create — modified compose with ghcr.io images + volume + reduced limits |
| `ai/skills/custom/firecrawl/SKILL.md` | Create — full /firecrawl skill |
| `ai/skills/active/firecrawl` | Create — symlink to `../custom/firecrawl` |
| `operations/runbooks/firecrawl.md` | Create — operational runbook |

## Files to Modify

| File | Change |
|------|--------|
| `operations/infrastructure/infra.md` | Add firecrawl to Dokploy domain table |
| `operations/decision-log.md` | Append Firecrawl adoption entry |
| `operations/system-configs/claude/CLAUDE.md` | Replace `/browse` with `/firecrawl` in skills list |
| `ai/policy/routing.md` | Add Firecrawl web data routing rule + skill sequence row |

## Files to Delete

| File | Action |
|------|--------|
| `ai/skills/active/browse` | Remove symlink — retires /browse skill |

---

## Verification

1. `curl -X POST https://firecrawl.prochat.tools/v1/scrape -H 'Content-Type: application/json' -d '{"url":"https://example.com","formats":["markdown"]}' | jq .data.markdown` → returns clean markdown
2. `curl -X POST https://firecrawl.prochat.tools/v1/search -H 'Content-Type: application/json' -d '{"query":"firecrawl self hosted","limit":3}' | jq .[].markdown` → returns search results with content
3. `ls brain/ai/skills/active/firecrawl` → symlink resolves
4. `ls brain/ai/skills/active/browse` → file not found (retired)
5. Admin queue UI accessible at `https://firecrawl.prochat.tools/admin/<BULL_AUTH_KEY>/queues`
6. Docker containers all healthy: `ssh dokploy 'docker ps | grep firecrawl'`

---

## Known Risks / Mitigations

| Risk | Mitigation |
|------|-----------|
| Dokploy RAM too tight | Reduced mem_limits (api=5GB, playwright=2GB); monitor after deploy; can reduce workers further if needed |
| Tunnel ID truncated in infra.md | Retrieve via `ssh dokploy 'cloudflared tunnel list'` at execution time |
| nuq-postgres schema drift | Use ghcr.io/firecrawl/nuq-postgres:latest — schema is baked into image |
| No anti-bot (no Fire-engine) | Expected for self-hosted; sufficient for 99% of research targets |
| Port 3002 conflict on Dokploy | Dokploy Traefik routes by domain not port — no conflict |
