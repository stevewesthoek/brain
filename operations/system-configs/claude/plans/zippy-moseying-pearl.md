# BuildFlow — Comprehensive Refactor & Improvement Plan

## Context

BuildFlow is a ChatGPT Custom GPT ↔ local filesystem bridge. The web app (Next.js, port 3054) exposes a ChatGPT-compatible Actions API, which proxies through a relay server to a local CLI agent (port 3052). The custom GPT is the user's primary interface — all operation feedback must be highly verbose and real-time, landing in the ChatGPT chat window.

This plan addresses: code quality, reliability, security hardening, response verbosity for ChatGPT, and modularisation — without breaking the ChatGPT integration.

---

## Priority-Ranked Issues & Fixes

### P0 — Logic bugs (break things today)

**1. `apply-file-change` dead branch / dryRun response returns 502**
- File: `apps/web/src/app/api/actions/apply-file-change/route.ts`
- Lines 37–43: The `dryRun` early-return at L21 already handles the dry-run case, making L37-39 unreachable. But the `verified !== true` check at L40+ then fires on all responses — including dryRun responses (which legitimately have `verified: false`). This causes 502 on every dryRun/preflight call.
- Fix: Move the `verified !== true` guard to only apply when `!body.dryRun && !body.preflight`.

**2. Duplicate `unwrapActionError` with silent type-lie**
- Files: `lib/actions/source-guard.ts` (returns `NextResponse`) vs `lib/actions/gpt.ts` (returns `{ error, status }`)
- 4 routes (`append-file`, `patch-file`, `write-file`, `create-artifact`) import from `source-guard.ts` but cast the return as `{ error, status }` — silently producing `undefined` for both properties at runtime.
- Fix: Delete `source-guard.ts::unwrapActionError` and consolidate all routes to use `gpt.ts::unwrapActionError`. Update imports.

### P1 — Security issues

**3. WebSocket bridge-client bypasses HTTP write guards**
- File: `packages/cli/src/bridge-client.ts`
- The WebSocket path skips: `CONFIRMATION_REQUIRED_GLOBS`, `BLOCKED_CONTENT_PATTERNS`, per-write byte limits, `confirmationToken` requirement.
- Fix: Extract the validation core from `safe-access.ts::validateWriteTarget` into a standalone `validateWritePayload(params)` function, then call it from both `server.ts` and `bridge-client.ts`.

**4. Bridge default dev tokens enabled in production**
- File: `packages/bridge/src/token-store.ts`
- `dev-token-1`, `dev-token-2`, `local-device` are seeded when `RELAY_ENABLE_DEFAULT_TOKENS !== 'false'`. These are well-known tokens.
- Fix: Change default to disabled (`RELAY_ENABLE_DEFAULT_TOKENS` defaults to `'false'`). Add startup log warning when admin auth is also unset.

**5. Bridge device registration has no rate limiting or auth**
- File: `packages/bridge/src/server.ts` — `POST /api/register`
- Any network-reachable caller can register unlimited devices. No rate limit, no pre-shared secret required.
- Fix: Add a simple in-memory rate limiter (5 registrations per IP per minute). Optionally require a `RELAY_REGISTER_TOKEN` env var.

**6. Prisma client logs queries in production**
- File: `apps/web/src/lib/db.ts`
- `log: ['query']` fires in all environments.
- Fix: `log: process.env.NODE_ENV !== 'production' ? ['query'] : []`

### P2 — ChatGPT verbosity / feedback (user's primary request)

**7. Half the action routes return no `activity` object**
- Routes missing activity: `list-sources`, `get-active-sources`, `set-active-sources`, `list-files`, `read`, `read-files`, `search`, `search-and-read`, `append-file`, `patch-file`, `write-file`, `create-artifact`, `create-plan`
- These are the routes ChatGPT calls most often. Without the `activity` field, ChatGPT cannot narrate what happened.
- Fix: All action routes should call `makeActivity(...)` and append the activity to the response. For pure proxy routes, build a simple activity summarising the operation: `{ phase: 'completed', actionLabel: 'Read file', userMessage: 'Read ..., result: ...' }`.

**8. `status` route builds inline activity without `makeActivity`**
- File: `apps/web/src/app/api/actions/status/route.ts`
- Activity is built inline and is missing `safeInputSummary`, `provenFacts`, `nextActions`, `whatHappened`, `whatRemains`.
- Fix: Use `makeActivity(...)` from `gpt.ts`.

**9. `search` and `search-and-read` return bare `{ error }` on failure**
- Files: `actions/search/route.ts`, `actions/search-and-read/route.ts`
- ChatGPT receives a raw `{ error: '...' }` with no `code`, `message`, `activity` context.
- Fix: Wrap errors in `buildActionErrorEnvelope` and return a structured error with activity context.

### P3 — Code duplication / abstraction

**10. `getSafeActionHttpStatus` copy-pasted across 2 files**
- Files: `apply-file-change/route.ts` and `write-artifact/route.ts`
- Fix: Extract to `lib/actions/http-status.ts` and import.

**11. Verified-write boilerplate repeated in 4 routes**
- Pattern in `append-file`, `patch-file`, `write-file`, `create-artifact`: auth → validate sourceId → execute → check verified → respond.
- Fix: Extract `handleVerifiedWrite(request, agentEndpoint)` helper in `lib/actions/write-handler.ts`.

**12. Raw-proxy boilerplate repeated in 4 routes**
- Pattern in `list-files`, `read-files`, `set-active-sources`, `get-active-sources`: auth → parse body → execute → respond.
- Fix: Extract `handleProxyAction(request, agentEndpoint)` helper in `lib/actions/proxy-handler.ts`.

**13. `create-artifact` vs `write-artifact` — same operation, two inconsistent implementations**
- `write-artifact` has preflight + policy guards. `create-artifact` has none. Both are publicly exposed.
- Fix: Deprecate `create-artifact` by making it delegate to the same `dispatchBuildFlowArtifact` path as `write-artifact`.

**14. `writeError` and `structuredWriteError` are identical in CLI server**
- File: `packages/cli/src/server.ts`
- Fix: Delete one, update all call sites to use the other.

### P4 — Reliability / correctness

**15. Silent error swallowing in multi-source read**
- File: `packages/cli/src/server.ts` — `/api/read` and `/api/read-files` multi-source loop
- Empty `catch {}` loses all error context (permission denied, IO error, not found all look the same).
- Fix: Catch and include `{ path, error: String(err) }` in the per-file result array.

**16. `index-state.ts` writes to disk on every source state change**
- File: `packages/cli/src/index-state.ts`
- During indexing, `upsertIndexState` fires per-source on every status change, writing the full JSON file each time. During bulk reindex of 10+ sources, this is O(N) disk writes.
- Fix: Debounce writes with a 500ms timer; flush immediately only on shutdown.

**17. Fuse.js search runs unbounded when sourceIds filter is set**
- File: `packages/cli/src/search.ts`
- When `sourceIds` is specified, search runs with no `limit` before slicing. On large corpora this loads all results into memory.
- Fix: Apply `limit * 3` as a preliminary cap, then filter and slice to `limit`.

**18. `vault.ts::listFolder` catch clause re-throws with no value**
- File: `packages/cli/src/vault.ts`
- `catch (err) { throw err }` adds nothing. Remove the entire try/catch.

**19. Proxy readiness check only verifies bridge, not web**
- File: `packages/proxy/src/server.ts`
- `/ready` returns 200 if bridge is up, even if web app process died.
- Fix: Check both child process exit codes and add a `/health` ping to the web app before returning 200.

**20. Hardcoded version string in CLI health endpoint**
- File: `packages/cli/src/server.ts` (line 232)
- `version: '1.2.13-beta'` is hardcoded instead of reading from package.json.
- Fix: Read from `package.json` at startup.

### P5 — Documentation gaps

**21. No inline documentation for `gpt.ts` functions**
- `makeActivity`, `dispatchBuildFlowArtifact`, `dispatchBuildFlowFileChange`, `classifyBlockedWrite` are complex but undocumented.
- Fix: Add single-line comments for each exported function explaining its purpose and key side effects.

**22. CONTRIBUTING.md does not explain how to add a new action route**
- Fix: Add a "How to add a new action" section with the auth → validate → execute → respond template and the activity requirement.

---

## Implementation Order

Execute in batches to keep the ChatGPT integration unbroken at all times:

**Batch 1 — Logic bugs (no breaking changes):**
- Fix #1 (apply-file-change dryRun 502)
- Fix #2 (unwrapActionError consolidation)
- Fix #6 (Prisma production logging)
- Fix #14 (CLI dead function removal)
- Fix #18 (vault.ts pointless catch)

**Batch 2 — Security hardening:**
- Fix #3 (bridge-client write validation)
- Fix #4 (bridge default dev tokens)
- Fix #5 (bridge registration rate limit)

**Batch 3 — ChatGPT verbosity (highest user impact):**
- Fix #7 (add activity to all missing routes)
- Fix #8 (status route uses makeActivity)
- Fix #9 (search/search-and-read error envelopes)

**Batch 4 — Abstraction / cleanup:**
- Fix #10 (extract getSafeActionHttpStatus)
- Fix #11 (extract handleVerifiedWrite)
- Fix #12 (extract handleProxyAction)
- Fix #13 (create-artifact delegates to write-artifact path)

**Batch 5 — Reliability:**
- Fix #15 (silent multi-source read errors)
- Fix #16 (index-state debounced writes)
- Fix #17 (Fuse.js bounded search)
- Fix #19 (proxy readiness check)
- Fix #20 (version from package.json)

**Batch 6 — Documentation:**
- Fix #21 (gpt.ts comments)
- Fix #22 (CONTRIBUTING.md action guide)

---

## Files to Modify

| File | Changes |
|---|---|
| `apps/web/src/app/api/actions/apply-file-change/route.ts` | Fix dryRun 502 logic bug |
| `apps/web/src/lib/actions/source-guard.ts` | Remove duplicate unwrapActionError |
| `apps/web/src/lib/actions/gpt.ts` | Ensure makeActivity is exported for reuse |
| `apps/web/src/app/api/actions/append-file/route.ts` | Fix import, add activity |
| `apps/web/src/app/api/actions/patch-file/route.ts` | Fix import, add activity |
| `apps/web/src/app/api/actions/write-file/route.ts` | Fix import, add activity |
| `apps/web/src/app/api/actions/create-artifact/route.ts` | Fix import, delegate to dispatchBuildFlowArtifact |
| `apps/web/src/app/api/actions/status/route.ts` | Use makeActivity, remove console.logs |
| `apps/web/src/app/api/actions/search/route.ts` | Use buildActionErrorEnvelope, add activity |
| `apps/web/src/app/api/actions/search-and-read/route.ts` | Use buildActionErrorEnvelope, add activity |
| `apps/web/src/app/api/actions/list-sources/route.ts` | Add activity |
| `apps/web/src/app/api/actions/read/route.ts` | Add activity |
| `apps/web/src/app/api/actions/read-files/route.ts` | Add activity |
| `apps/web/src/lib/db.ts` | Fix production query logging |
| `apps/web/src/lib/actions/http-status.ts` | New: extract getSafeActionHttpStatus |
| `apps/web/src/lib/actions/write-handler.ts` | New: extract handleVerifiedWrite |
| `apps/web/src/lib/actions/proxy-handler.ts` | New: extract handleProxyAction |
| `packages/cli/src/server.ts` | Remove structuredWriteError, fix hardcoded version |
| `packages/cli/src/search.ts` | Fuse.js bounded search |
| `packages/cli/src/index-state.ts` | Debounced writes |
| `packages/cli/src/vault.ts` | Remove pointless try/catch |
| `packages/bridge/src/token-store.ts` | Change default dev tokens to disabled |
| `packages/bridge/src/server.ts` | Add registration rate limit |
| `packages/proxy/src/server.ts` | Fix readiness check |
| `CONTRIBUTING.md` | Add action guide |

---

## Verification

After each batch:
1. `pnpm type-check` — must pass with zero errors
2. `curl https://buildflow.prochat.tools/api/openapi` — OpenAPI schema must return 3.1.0 valid JSON
3. `curl -X POST .../api/actions/status` — must include `activity` field
4. `curl -X POST .../api/actions/search` with invalid query — must return `buildActionErrorEnvelope` shape, not raw `{ error }`
5. `curl -X POST .../api/actions/apply-file-change` with `dryRun: true` — must return 200, not 502
6. ChatGPT Custom GPT test: call each action and verify verbose `activity.userMessage` appears in chat

---

## What Will NOT Change

- OpenAPI schema shape (ChatGPT compatibility preserved)
- All operationIds (ChatGPT's action bindings rely on these)
- Port assignments (3052, 3053, 3054)
- Auth model (bearerAuth for all actions)
- All agent API endpoint paths (`/api/read`, `/api/search`, etc.)
