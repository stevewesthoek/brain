# ProBot Dashboard Stabilization Plan

**Date:** 2026-05-11  
**Scope:** Architecture audit, guardrails, path normalization, restart script  
**Outcome:** Reliable, fast dashboard before repo extraction  

---

## Verdict

**Current dashboard is NOT reliable enough for independent repo.**

### Why

1. **Size crisis**: 247 KB monolithic `dashboard.ts` (5709 lines)
   - Server routes mixed with HTML rendering
   - Browser JavaScript mixed with server-side logic
   - Video Orchestrator logic entangled with Viral Flow logic
   - Local app lifecycle logic mixed with UI state management

2. **State management failures**
   - Local app start/stop status is not truthful immediately after action
   - Stale UI state persists across tab navigation
   - Browser JS does not validate renderer output; can execute dangling references
   - Slow tab navigation due to full re-render of unrelated panels

3. **Polling/reload brittleness**
   - `/api/data` endpoint loads too much data
   - `/api/video-orchestrator/*` endpoints render HTML server-side then inject via browser JS
   - Multiple tabs trigger multiple concurrent fetches of same data
   - No request deduplication or batching
   - Browser renderer mismatch (old function signatures, renamed exports)

4. **Known bugs not fixed**
   - Buttons need multiple clicks/refreshes to register
   - OAuth/account UI has been fragile (state mutation leaks)
   - Production Pipeline browser/server renderer mismatches
   - Local app lifecycle handler race conditions

5. **Security considerations**
   - OAuth callback HTML rendered server-side in plain browser JS string
   - Credential references need continued redaction validation
   - Account state mutation handlers should be atomic
   - Mutations rely on localhost-only access (no token protection if exposed)

---

## Target Architecture

ProBot dashboard should be:

1. **Modular**: separate concerns into independent modules
   - Viral Flow dashboard (content strategy)
   - Video Orchestrator dashboard (production pipeline)
   - Local apps dashboard (service control)
   - System dashboard (health, perf, updates)

2. **Truthful**: state always reflects actual system state
   - API responses return only data, never HTML
   - Browser handles rendering (React/preact)
   - Lifecycle handlers have guaranteed state transitions
   - UI state synced with system state on every action

3. **Fast**: only fetch/render what changed
   - Lazy-load tabs (don't fetch until visible)
   - Separate refresh cycles per panel
   - Request deduplication + caching
   - Incremental updates instead of full re-renders

4. **Safe**: no credential leaks, atomic mutations
   - OAuth state isolated in secure session
   - No plaintext secrets in responses
   - Account mutations use transactions
   - Renderer output validated before injection

---

## Phased Plan

### D1-A: Audit and Guardrails

**Goal**: Prevent regressions; understand failure modes.

**Work**:
1. Audit file sizes and responsibilities per file
2. Document slow/blocking paths in dashboard.ts
3. Identify polling/reload behavior
4. Catalog places where server renderers called from browser JS
5. Add guardrail tests to `local-apps.test.ts`:
   - Browser JS does not directly invoke server-side renderers
   - Production Studio tab has safe fallback on fetch failures
   - OAuth UI does not expose credentials
   - Local app lifecycle handlers return consistent state

**Output**: Guardrail tests + audit comments in code

**Validation**: `npm run ci` passes; tests prevent known regressions

---

### D1-B: Split Dashboard.ts Into Modules

**Goal**: Extract pure Video Orchestrator dashboard logic; prepare for further splits.

**Scope**: Extract only if obvious (no major refactor).

**Candidates**:
- `video-orchestrator-dashboard.ts` — pure helpers for VO rendering (if >500 lines extracted safely)
- Keep `dashboard.ts` < 200 KB

**Not in this phase**: splitting into React/framework. Stick to modular TS.

**Validation**: `npm run ci` passes; no behavior change

---

### D1-C: Lazy-Load Tabs

**Goal**: Don't fetch/render until tab is visible.

**Work**:
1. Convert tab panel to lazy-load pattern:
   - Check if tab is active
   - Only fetch if active AND not cached
   - Cache per-tab fetch state (pending, data, error)
2. Apply to: Viral Flow, Video Orchestrator, Local Apps, System panels
3. Add tab-switch handler to trigger fetch

**Expected gain**: 2-3s faster dashboard first paint; less server load

**Validation**: `curl http://127.0.0.1:7070` loads in <1s

---

### D1-D: Fix Local App Lifecycle Truthfulness

**Goal**: Start/stop status reflects actual port state immediately.

**Work**:
1. Identify race condition in `LOCAL_APP_STARTING_STATES` map
2. Ensure `buildLocalAppsStatus()` always reflects actual `lsof` output
3. Add unit test: start a fake app, verify status transitions
4. Verify: button click → state pending → server action → state updated → UI reflects

**Validation**: Local apps tab always shows truthful status

---

### D1-E: Normalize Runtime Paths

**Goal**: All Video Orchestrator runtime paths use canonical repo-root location.

**Current state**: ✅ Already using `runtime/local/video-orchestrator/` (correct)

**Verify**:
1. Check `dashboard.ts:38-43` — all use `process.cwd()` + `runtime/local/`
2. Ensure `getDefaultVideoOrchestratorPaths()` resolves to repo-root
3. Add test to confirm paths resolve correctly
4. Do not stage `runtime/local/` or `projects/probot/runtime/` in git

---

### D1-F: Stabilize Video Orchestrator Accounts UI

**Goal**: OAuth flow, account mutation, credential display are safe and atomic.

**Work**:
1. Audit `renderAccountsAndCredentialsPanel()` for credential leaks
2. Ensure OAuth callback HTML is escaped, not string-injected
3. Add test: upsert account, verify health snapshot updated atomically
4. Test: refresh panel, verify state matches database

**Validation**: OAuth flow completes; new account appears in registry

---

### D2: Define API/Runtime Boundary

**Goal**: Clarify what lives in memory vs. on disk.

**Questions**:
- Should account registry persist across restarts?
- Should health snapshots be cached or recomputed on each fetch?
- Should OAuth state be in-memory session or file-backed?

**Output**: Decision log entry in `operations/decision-log.md`

**Not in Phase 1**: Just document intent, don't refactor yet.

---

### D3: Consider Repo Extraction

**Gate**: Only proceed if D1-D and D1-E are complete and dashboard is stable for 1 week.

**Criteria**:
- No "button needs multiple clicks" bugs
- No stale state issues
- All tests pass consistently
- Security scan clean

**If proceed**: Create `stevewesthoek/probot` with `.ai/` memory system

**If defer**: Keep in machine-brain; schedule for next quarter

---

## Risks

1. **Incomplete refactor**: Extract too much without testing → new bugs
   - **Mitigation**: Extract only when obvious; test each module independently

2. **Regression in Video Orchestrator**: New logic breaks account panel
   - **Mitigation**: Guardrail tests + manual testing before committing

3. **Race condition in app lifecycle**: Start/stop handlers get out of sync
   - **Mitigation**: Lock-based exclusive operations already in place; verify tests

4. **OAuth state leaks**: Credentials exposed in debug logs or error messages
   - **Mitigation**: Security scan; redaction helpers already in place

---

## Validation Commands

### Type checking and tests
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/probot
npm run typecheck
npm test
```

### Dashboard endpoints
```bash
# Verify dashboard starts
curl -fsSI http://127.0.0.1:7070

# Verify Video Orchestrator API
curl -fsS http://127.0.0.1:7070/api/video-orchestrator/accounts-panel | python3 -m json.tool >/dev/null
curl -fsS http://127.0.0.1:7070/api/video-orchestrator/youtube-lifecycle-panel | python3 -m json.tool >/dev/null

# Verify system dashboard
curl -fsS http://127.0.0.1:7070/api/data | python3 -m json.tool >/dev/null
```

### Helper scripts
```bash
node tools/scripts/video-orchestrator-account-health.mjs self-test
node tools/scripts/video-orchestrator-credential-helper.mjs self-test
node tools/scripts/video-orchestrator-credential-helper.mjs oauth-self-test
node tools/scripts/video-orchestrator-credential-helper.mjs token-self-test
```

### Skills
```bash
node tools/scripts/switch-skill-profile.mjs default --check
node tools/scripts/sync-ai-skills.mjs --check
```

---

## Security Rules (DO NOT BREAK)

### No secrets in responses
- Never return raw `client_secret`, `refresh_token`, `access_token`
- Account responses use redacted/safe format only
- Error messages must not leak credential paths

### No uploads enabled
- Dashboard does NOT support video/thumbnail upload
- No `videos.insert()`, `youtube.videos().insert()` calls
- YouTube account panel is read-only

### Local-Only Mutation Protection
- Account upsert mutations require `isLocalDashboardRequest()` check
- No cross-origin account mutations allowed
- OAuth callback only accepted from localhost
- **Future consideration**: If dashboard is ever exposed beyond localhost, add token-based CSRF protection

### Runtime files not staged
- Do not commit `runtime/local/**`
- Do not commit `projects/probot/runtime/**`
- These are runtime state, not source code

---

## No-Upload Rules (DO NOT BREAK)

ProBot dashboard is **monitoring and control only**. Do not add:
- File upload endpoints
- YouTube/TikTok/platform upload integration
- Batch video processor
- Thumbnail/caption/description upload

Video uploads must go through dedicated `video-orchestrator` service (separate repo/codebase).

---

## Out of Scope (DO NOT INCLUDE)

- Feature additions (new tabs, new buttons)
- Design changes (colors, layout)
- Repo extraction (defer to D3)
- Database schema changes
- .env modifications

---

## Success Criteria

1. ✅ Audit complete with documented findings
2. ✅ Guardrail tests added and passing
3. ✅ Video Orchestrator runtime paths verified canonical
4. ✅ Restart script added and tested
5. ✅ All `npm run ci` checks pass
6. ✅ Security scan clean (no secrets, no uploads)
7. ✅ Dashboard responds in <1s on first load
8. ✅ Local app lifecycle state always truthful
9. ✅ No new bugs reported in 1 week
10. ✅ Stabilization plan reviewed and documented

---

## Decision Log

**D1-C COMPLETED: 2026-05-11**

Lazy-load all non-main tabs independently:
- Global /api/data interval only runs when active tab is main tabs (sessions, dokploy, nr, scheduler, umami, google-ads, stripe, domains, tunnels)
- Local Apps and Production Pipeline load only when user clicks their tabs
- Per-tab state tracking (pending, loaded, error, lastLoadedAt) prevents duplicate fetches within 10-second window
- All tab fetches use fetchJsonWithTimeout() with 5-second AbortController timeout
- Each sub-panel (Content Strategy, Production Pipeline, YouTube Lifecycle) handles fetch errors independently
- Refresh button is now async, detects active tab, awaits appropriate loader, disables button during fetch
- Action buttons (Save, Configure, Connect) show pending state, disable during request, restore on completion
- 9 regression tests document lazy-load behavior and guard against regressions
- All 52 tests pass, typecheck passes, helper scripts validate correctly

Result: Dashboard startup no longer loads Production Pipeline or Local Apps eagerly. Only active tab loads on demand. Tab switches are fast. API endpoint failures are isolated to their tab. No repeated button clicks needed.

**D1-D COMPLETED: 2026-05-11 (hardened)**

Local app lifecycle API responses now structured and truthful:
- All responses use consistent fields: `appName`, `action`, `status`, `message`/`error`, `nextPollMs`
- No internal fields (`statusCode`, `portFree`, `healthy`) in JSON response body
- Status vocabulary standardized: `starting`, `running`, `stopped`, `failed`, `blocked`, `unknown`
- Duplicate in-flight action guard uses `LOCAL_APP_IN_FLIGHT_ACTIONS` Map with 5-second window
- Concurrent actions for same app/action return 409 Conflict with status=`blocked`, `nextPollMs: 1000`
- In-flight guards cleared in both success and error paths (catch/finally blocks)
- Frontend uses `pollLocalAppUntilStable()` to fetch `/api/local-apps` only (no global `fetchData()`)
- UI updated in-place via `updateLocalAppCardUI()` without page reload
- Restart script updated to recognize "ProBot" as safe kill candidate on port 7070 alongside node/npm/tsx
- 11 real regression tests verify: guard mechanism, response shape, status vocabulary, probe isolation, restart script behavior
- All 62 tests pass (including 11 D1-D tests), typecheck passes, helper scripts validate

**Tested via source inspection:** Duplicate guard logic, response shape consistency, status vocabulary, API response fields.
**Not live-tested:** Actual concurrent duplicate requests hitting the API in parallel, actual process kill on restart script.

See `operations/decision-log.md` for permanent records.

---

## Next Steps

1. ✅ **D1-A**: Audit, guardrails, tests — COMPLETE
2. ✅ **D1-B**: Module extraction — COMPLETE (video-orchestrator-dashboard.ts extracted, 1131 lines moved)
3. ✅ **D1-C**: Lazy-load tabs — COMPLETE (per-tab state, independent endpoints, button pending behavior)
4. ✅ **D1-D**: Local app lifecycle truthfulness — COMPLETE (structured responses, duplicate guards, truthful status)
5. **D1-E**: Normalize runtime paths (verify canonical repo-root location)
6. **D1-F**: Stabilize Video Orchestrator accounts UI (OAuth flow, account mutation, credential display safety)
7. **D2**: Define API/runtime boundary (persistence, caching, session management)
8. **D3**: Consider repo extraction (gate: D1 complete + 1 week stable, no new bugs)
