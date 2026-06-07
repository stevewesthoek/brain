# BuildFlow Runtime Stabilization Plan

## Context

BuildFlow exposes 5 GPT-facing Custom Actions over Cloudflare. Intermittent gateway timeouts occur because long-running requests reach the platform deadline (~30s) before returning a structured response. The goal is: every action fails fast with structured JSON before the gateway times out, and the status payload gains diagnostic signals for memory/request leak detection.

**Current state (already implemented and correct — do not re-implement):**
- `deadline.ts` — central `withGptActionDeadline` helper, all 5 deadlines correct (4/8/8/10/12s)
- AbortController propagation via `signal?: AbortSignal` in transport
- All 5 route files import and use `withGptActionDeadline`
- `needsNarrowerScope` guardrail in read-context
- Focused-read byte bounds: maxBytesPerFile ≤ 4000, before ≤ 40, after ≤ 60, maxMatches ≤ 10
- GPT instructions have "Hard action budget per response: 3 BuildFlow actions. Prefer 1–2"
- Verifier script covers schema rules, instructions, docs alignment, and deadline source layer

**Gaps to fill (this task):**
1. Active request counter + memory snapshot in `/api/actions/status` payload
2. `suggestedNextAction` not reliably present in timeout envelope across all routes
3. Verifier does not check action count / focused modes / timeout language alignment
4. Docs wording on "stop with exact next prompt" missing from instructions
5. Instructions and docs need one targeted update for the new diagnostics endpoint field

---

## Implementation Plan

### 1. Request counter + memory diagnostics in status payload

**File:** `apps/web/src/app/api/actions/status/route.ts`

Add a module-level atomic counter that increments on every request and decrements on completion. Append a compact `diagnostics.runtime` block to the status response payload:

```ts
// module-level — resets on hot-reload in dev, fine for diagnostics
let activeRequests = 0

export async function GET(request) {
  activeRequests++
  try {
    // ... existing handler ...
    payload.runtime = {
      activeRequests,
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1_048_576),
      rss: Math.round(process.memoryUsage().rss / 1_048_576)
    }
    return NextResponse.json(payload, ...)
  } finally {
    activeRequests--
  }
}
```

Keep it minimal — only add `runtime` to the status payload when `include` is not filtering it out or always include it as a lightweight field. No new route, no separate endpoint.

---

### 2. Ensure `suggestedNextAction` in deadline params for all routes

**Already present on:** status, read-context, apply-file-change, commit-changes, run-command.

Currently all 5 routes pass `suggestedNextAction` to `withGptActionDeadline`. No change needed here. Verify by grepping.

---

### 3. Tighten focused-read byte bounds in read-context route

Current `maxBytesPerFile` clamp: `boundedInt(body.maxBytesPerFile, 4000, 1000, 4000)`.

Tighten the default slightly: keep max at 4000 but drop the default from 4000 to 3000 to reduce typical payload size:
```ts
const maxBytesPerFile = boundedInt(body.maxBytesPerFile, 3000, 1000, 4000)
```

This is a conservative change — reduces default read size while keeping the ceiling for explicit requests.

**File:** `apps/web/src/app/api/actions/read-context/route.ts`

---

### 4. Update `docs/CUSTOM_GPT_INSTRUCTIONS.md`

Add "stop with exact next prompt" language to the stop conditions section (currently missing). The verifier already checks for "Hard action budget per response: 3 BuildFlow actions" — keep it. Add one line to stop conditions:

> When stopping, provide the exact next prompt the user should send, not a vague directive.

This makes instructions satisfy the task's "stop with exact next action" requirement.

**File:** `docs/CUSTOM_GPT_INSTRUCTIONS.md`

---

### 5. Update verifier with 3 new checks

**File:** `scripts/verify-custom-gpt-actions.mjs`

Add `ensureActionBudgetAndTimeoutLanguage()` function that checks:
1. Instructions contain "Prefer 1-2" (action count preference)
2. Instructions contain "exact next" (stop with exact next prompt)
3. Instructions contain "fail fast" or "deadline" language in fast-fail section
4. `deadline.ts` has `suggestedNextAction` in `DeadlineParams` type definition

Add `ensureFocusedModeGuardrails()` function that checks:
1. `read-context/route.ts` uses `boundedInt` for `maxBytesPerFile`
2. `read-context/route.ts` contains `needsNarrowerScope` call
3. Focused-read route max is bounded (check `MAX_RESPONSE_BYTES = 24_000` in focused-read.ts)

Wire both into `main()`.

---

### 6. Update openapi.chatgpt.json descriptions

Add timeout language to operation summaries in `docs/openapi.chatgpt.json`:
- `readBuildFlowContext.description`: mention "8s deadline"
- `runBuildFlowCommand.description`: mention "12s deadline, fails fast"
- `getBuildFlowStatus.description`: mention "4s deadline"

These are description fields only, no schema shape change.

**File:** `docs/openapi.chatgpt.json`

---

## Files to Change

| File | Change |
|------|--------|
| `apps/web/src/app/api/actions/status/route.ts` | Add module-level request counter + `runtime` field in payload |
| `apps/web/src/app/api/actions/read-context/route.ts` | Tighten `maxBytesPerFile` default from 4000 → 3000 |
| `docs/CUSTOM_GPT_INSTRUCTIONS.md` | Add "exact next prompt" stop condition language |
| `docs/openapi.chatgpt.json` | Add deadline mentions to summaries/descriptions |
| `scripts/verify-custom-gpt-actions.mjs` | Add action budget, timeout language, and focused-mode checks |

---

## Validation

```bash
# Static verifier (no server needed)
pnpm run verify:gpt-actions

# Type checks
pnpm --dir apps/web type-check
pnpm --dir packages/cli type-check

# Validate docs schema
node -e "JSON.parse(require('fs').readFileSync('docs/openapi.chatgpt.json','utf8')); console.log('ok')"
```

Then commit `fix: fail fast before GPT action timeouts` and push to origin main.
