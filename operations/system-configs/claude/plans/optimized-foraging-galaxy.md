# Plan: Viral Flow Phase 5 — Community & Polish

## Context

Viral Flow (github.com/stevewesthoek/viralflow) is a complete content strategy engine at v0.1.0. Phase 4 built the brain integration (the `/viral-flow` skill, `/video` orchestrator STRATEGY layer). Phase 5 takes it from a local dev tool to a published, community-ready npm package.

Key confirmed decisions:
- **CLI**: Build a real working CLI (currently a stub that only prints help)
- **Platform adapters**: Build YouTube + TikTok built-in upload adapters
- **Browser UI**: Defer to Phase 6; when built, it integrates into the existing ProBot dashboard (brain repo at `projects/probot/src/bot/dashboard.ts`), NOT a new standalone dashboard

---

## Sub-phases and Execution Order

```
P5.1  Code Quality Fixes          (prerequisites — unblock everything else)
P5.2  Package Publication Prep    (package.json, .env.example, .npmignore, docs)
P5.3  Real CLI                    (viral-flow discover / script / post / analyze)
P5.4  YouTube + TikTok Adapters   (concrete PostingOrchestrator adapters)
P5.5  Additional Discovery Sources (Twitter/X + TikTok trends)
P5.6  Performance Optimization    (caching, batch speed)
P5.7  v0.4.0 Release             (docs, release notes, npm publish, brain sync)
```

P5.1 and P5.2 must complete first. P5.3–P5.6 can run in parallel after that. P5.7 is the final gate.

---

## P5.1: Code Quality Fixes

**Repo:** `/Users/Office/Repos/stevewesthoek/viralflow`

### Fix 1: Remove Math.random() placeholders — `src/brain/learning.ts` lines ~209–210
- **Problem:** `prefers_longform: Math.random() > 0.5` and `prefers_shortform: Math.random() > 0.5` are non-deterministic in production
- **Fix:** Add `analyzeFormatPreference()` helper that inspects recorded performance data: if avg view_duration for longform > shortform → `prefers_longform = true`. If no data yet → `null` (unknown, not a random guess).

### Fix 2: Replace hardcoded heuristics — `src/analyze/index.ts`
- **Problem:** `best_engagement_time: 'evening'` and `average_view_duration: '45%'` are static strings
- **Fix:** Compute `best_engagement_time` by grouping recorded performance by post timestamp hour → find peak engagement hour. Compute `average_view_duration` as mean of all `view_duration` values. Fall back to `null` if no data.

### Fix 3: Inaccurate ABOUT.md claims
- **Problem:** Says "Zero dependencies (core)" — package has 4 runtime deps (axios, dotenv, joi, winston)
- **Fix:** Update to: "Minimal dependencies: axios (HTTP), dotenv (env config), joi (validation), winston (logging). Zero cloud service dependencies — runs fully local."

---

## P5.2: Package Publication Prep

**Repo:** `/Users/Office/Repos/stevewesthoek/viralflow`

### 2a. Add `files` field to package.json
```json
"files": ["dist", "README.md", "ABOUT.md", "ARCHITECTURE.md", "LICENSE"]
```

### 2b. Add `exports` map to package.json
```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "require": "./dist/index.js",
    "types": "./dist/index.d.ts"
  }
}
```

### 2c. Create `.npmignore`
Exclude: `src/`, `tests/`, `coverage/`, `.github/`, `*.test.ts`, `IMPLEMENTATION_PLAN.md`, `LAUNCH.md`, `CONTRIBUTORS.md`, `COMMUNITY.md`.

### 2d. Create `.env.example`
Document all required env vars:
- `YOUTUBE_API_KEY` — discovery (falls back to mock if unset)
- `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` — discovery (falls back to mock if unset)
- `YOUTUBE_OAUTH_CLIENT_ID`, `YOUTUBE_OAUTH_CLIENT_SECRET`, `YOUTUBE_OAUTH_REDIRECT_URI` — posting adapter
- `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` — posting adapter
- `TWITTER_BEARER_TOKEN` — Twitter discovery source (Phase 5.5)
- `TIKTOK_RESEARCH_CLIENT_KEY` — TikTok trends source (Phase 5.5)
- `VIRAL_FLOW_CACHE_TTL_MINUTES` — optional, defaults to 60

### 2e. Create missing `docs/` files
Currently referenced in README/ABOUT but absent:
- `docs/API.md` — complete public API reference
- `docs/EXAMPLES.md` — 5 real-world scenarios with code
- `docs/CONTRIBUTING.md` — how to add discovery sources, platform adapters

### 2f. Bump version to 0.4.0 in package.json
Skips 0.2.x and 0.3.x to align with documented roadmap (ABOUT.md states "v0.4.0 Community Release").

### 2g. Register credentials in brain credential system
- Create `~/.config/viralflow/.env` (mode 600, gitignored) with actual API keys
- Add entry to `brain/operations/accounts/credentials-index.md`

---

## P5.3: Real CLI

**Repo:** `/Users/Office/Repos/stevewesthoek/viralflow`
**File:** `src/cli.ts` (full rewrite from stub)

### Commands to implement:
```bash
viral-flow discover [--keywords "AI automation"] [--icp "B2B founders"] [--limit 5]
viral-flow angles <topic> [--format youtube|tiktok|linkedin] [--count 15]
viral-flow hooks <topic> [--angle "..."] [--count 3]
viral-flow script <topic> [--angle "..."] [--hook "..."] [--format longform|shortform]
viral-flow analyze [--channel <id>] [--days 30]
viral-flow post <video-path> --platform youtube|tiktok [--title "..."] [--schedule "ISO date"]
viral-flow accounts list
viral-flow accounts add --platform youtube --name "My Channel"
```

### Implementation rules:
- Use Node.js built-in `process.argv` parsing — no external CLI framework (keep deps minimal)
- Each command maps directly to existing module functions (`discover()`, `generateAngles()`, etc.)
- Output: clean formatted text to stdout (same format AI skill presents to users)
- Errors: stderr with exit code 1
- `--json` flag on all commands for machine-readable / n8n-compatible output

### New test file: `tests/cli.test.ts`
Test each command's argument parsing and output format using `child_process.spawn`.

---

## P5.4: YouTube + TikTok Posting Adapters

**Repo:** `/Users/Office/Repos/stevewesthoek/viralflow`

### New files:
- `src/posting/adapters/youtube.ts` — `YouTubeAdapter implements PlatformAdapter`
- `src/posting/adapters/tiktok.ts` — `TikTokAdapter implements PlatformAdapter`
- `src/posting/adapters/index.ts` — exports both
- Update `src/posting/index.ts` — auto-register adapters when env keys present

### YouTube adapter:
- OAuth2 using `YOUTUBE_OAUTH_CLIENT_ID` / `YOUTUBE_OAUTH_CLIENT_SECRET`
- `upload()` → YouTube Data API v3 `videos.insert` with resumable upload
- `schedule()` → sets `status.publishAt` on the video resource
- `getStatus()` → polls `videos.list` for processing status
- Token refresh handling (store refresh token in AccountManager credentials field)

### TikTok adapter:
- OAuth2 using `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`
- `upload()` → TikTok Content Posting API v2 (`/v2/post/publish/video/init/` → `/v2/post/publish/video/upload/`)
- Map platform strategy to TikTok `privacy_level`
- Note in adapter: TikTok API requires verified developer account; document clearly

### New test files:
- `tests/adapters/youtube.test.ts` — mock googleapis HTTP client, test upload + schedule + status
- `tests/adapters/tiktok.test.ts` — mock fetch, test upload init + chunk + status poll

---

## P5.5: Additional Discovery Sources

**Repo:** `/Users/Office/Repos/stevewesthoek/viralflow`

### `src/discover/twitter.ts` — TwitterSource
- `TwitterSource implements DiscoverySource`
- Twitter API v2 `GET /2/tweets/search/recent` with keyword queries + `min_retweets` filter
- Env: `TWITTER_BEARER_TOKEN` — falls back to mock if unset
- Trend score: normalized from retweet_count + like_count (0-100)

### `src/discover/tiktok-trends.ts` — TikTokTrendsSource
- `TikTokTrendsSource implements DiscoverySource`
- TikTok Research API `/v2/research/hashtag/query/` for trending hashtags
- Env: `TIKTOK_RESEARCH_CLIENT_KEY` (separate from posting — TikTok Research API requires its own app)
- Trend score: from hashtag video_count growth over 7 days

### Update `src/discover/index.ts`
Auto-register both sources when their env keys are present (same pattern as YouTube and Reddit).

---

## P5.6: Performance Optimization

**Repo:** `/Users/Office/Repos/stevewesthoek/viralflow`

### 6a. Discovery caching — `src/discover/index.ts`
- Cache layer in `discover()`: check `~/.viral-flow/cache/discover-{hash}.json` before API calls
- Cache key: hash of `{ keywords, icp_filter, sources }`
- TTL: 1 hour (configurable via `VIRAL_FLOW_CACHE_TTL_MINUTES`)
- Return cached results with `cached: true` flag on cache hit

### 6b. Batch script parallelism — `src/script/index.ts`
- Add `buildScripts(topics: Topic[]): Promise<Script[]>` alongside existing `buildScript()`
- Run up to 3 concurrent generations using `Promise.all` with chunking (chunk size 3)

### 6c. Brain write buffering — `src/brain/persistence.ts`
- Current: reads/writes entire brain JSON on every `learn()` call
- Add dirty-flag pattern: buffer writes, flush every 30s or on `process.exit`
- Prevents excessive disk I/O during batch production runs (10+ videos/session)

---

## P5.7: v0.4.0 Release

### 7a. Full test suite
```bash
cd /Users/Office/Repos/stevewesthoek/viralflow && npm test
```
Must pass: 0 failures. Update test count in README badge.

### 7b. Build and validate npm tarball
```bash
npm run build && npm pack --dry-run
```
Verify tarball contains only: `dist/`, README, ABOUT, ARCHITECTURE, LICENSE. Verify `viral-flow` CLI works.

### 7c. Create `CHANGELOG.md`
Document all v0.4.0 changes: real CLI, YouTube/TikTok adapters, Twitter/TikTok discovery, caching, bug fixes.

### 7d. npm publish
```bash
npm publish --access public
```
Verify badge resolves at `https://www.npmjs.com/package/viralflow`.

### 7e. Update brain files
- `brain/ai/skills/custom/viral-flow/SKILL.md` — update to v0.4.0, npm URL, Phase 6 ProBot note
- `brain/operations/runbooks/viral-flow-video-orchestrator-integration.md` — check off Phase 5, add Phase 6 stub
- `brain/CLAUDE.md` — add npm install path + credential convention for viralflow

### 7f. Run brain skill sync
```bash
cd /Users/Office/Repos/stevewesthoek/brain
node tools/scripts/sync-ai-skills.mjs --check
```

### 7g. GitHub release
```bash
cd /Users/Office/Repos/stevewesthoek/viralflow
git tag v0.4.0 && git push origin v0.4.0
```
Create GitHub release with CHANGELOG content as body.

---

## Files Touched

### viralflow repo
| File | Action |
|------|--------|
| `src/brain/learning.ts` | Fix Math.random() → real inference |
| `src/analyze/index.ts` | Fix hardcoded heuristics → computed |
| `src/cli.ts` | Full rewrite — 8 real commands |
| `src/posting/adapters/youtube.ts` | New |
| `src/posting/adapters/tiktok.ts` | New |
| `src/posting/adapters/index.ts` | New |
| `src/posting/index.ts` | Auto-register adapters |
| `src/discover/twitter.ts` | New |
| `src/discover/tiktok-trends.ts` | New |
| `src/discover/index.ts` | Caching + register new sources |
| `src/script/index.ts` | Add `buildScripts()` batch |
| `src/brain/persistence.ts` | Dirty-flag write buffering |
| `package.json` | files, exports, v0.4.0 |
| `.env.example` | New |
| `.npmignore` | New |
| `ABOUT.md` | Fix "Zero dependencies" claim |
| `CHANGELOG.md` | New |
| `docs/API.md` | New |
| `docs/EXAMPLES.md` | New |
| `docs/CONTRIBUTING.md` | New |
| `tests/cli.test.ts` | New |
| `tests/adapters/youtube.test.ts` | New |
| `tests/adapters/tiktok.test.ts` | New |

### brain repo
| File | Action |
|------|--------|
| `ai/skills/custom/viral-flow/SKILL.md` | v0.4.0 ref, npm URL, Phase 6 ProBot note |
| `operations/runbooks/viral-flow-video-orchestrator-integration.md` | Check off Phase 5, add Phase 6 stub |
| `CLAUDE.md` | npm install path + credential convention |
| `operations/accounts/credentials-index.md` | Add viralflow entry |
| `~/.config/viralflow/.env` | Create (mode 600, gitignored) |

---

## Verification Checklist

- [ ] `npm test` — all tests pass, 0 failures
- [ ] `npm pack --dry-run` — tarball has only dist + docs, no src/tests
- [ ] `./dist/cli.js discover --keywords "AI"` — returns topics (real or mock)
- [ ] YouTube adapter unit test passes with mocked googleapis
- [ ] TikTok adapter unit test passes with mocked fetch
- [ ] `npm publish --access public` — package live at npmjs.com/package/viralflow
- [ ] `brain node tools/scripts/sync-ai-skills.mjs --check` — SYNC CHECK PASSED
- [ ] `/viral-flow` skill in Claude Code routes correctly after update

---

## Phase 6 Note (Deferred — Do Not Build in Phase 5)

Browser UI integration = **ProBot dashboard tab only**. The ProBot dashboard lives at `brain/projects/probot/src/bot/dashboard.ts`. Phase 6 adds a "Viral Flow" panel there (recent topics, hook performance, brain insights). **Do NOT create a standalone dashboard.** One unified dashboard.
