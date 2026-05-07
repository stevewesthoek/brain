# Plan: Memory Phase 2 — Automatic Invisible Memory Injection

## Context

Phase 1 built the memory infrastructure (IDs, mem-search script, progressive disclosure). But it isn't automatic — you have to explicitly run `mem-search` or ask Claude to use it. The user wants zero mental overhead: just talk naturally, and relevant memory surfaces automatically.

**Goal:** When you say "what did we decide about caching?" or "remind me what settings we use for firecrawl" — Claude should automatically detect this needs memory lookup, search, and inject the answer into context. No commands, no hooks to remember, no `mem-search` invocations. Invisible.

---

## Three Changes

### 1. Enhance inject-handoff.sh — Keyword-triggered memory injection on session start

**Current:** Inject-handoff reads `.ai/current.md` on fresh sessions and prepends goal/status/next steps.

**Enhanced:** ALSO extract keywords from the user's FIRST prompt and run `mem-search <keywords>` to find matching memory entries. Inject their index matches into the prompt context — on top of the existing handoff brief.

**How it works:**
- Extract 1-3 meaningful keywords from the prompt text (skip stop words)
- Run `mem-search <keywords>` — gets ~5-10 lines of index output
- If relevant entries found: prepend a compact `--- Memory context ---` block above the handoff brief
- Only on fresh sessions (same guard as existing: transcript < 4 lines)
- Max 5 memory entries shown inline; if more than 5 matches, show IDs only

This covers "remind me what we decided about X" at the START of a session.

**File:** `brain/operations/system-configs/claude/hooks/inject-handoff.sh`

---

### 2. New hook: `memory-recall-hook.sh` — Mid-session natural language memory trigger

**What:** A new `UserPromptSubmit` hook that fires on EVERY prompt (not just session start). Detects recall-intent phrases and injects relevant memory into the current prompt.

**Trigger phrases detected (regex):**
```
- what did we (decide|say|agree|discuss|use)
- remind me|do you remember|do we have
- previously|last time|we used to|we always
- what was the|what is our|what are our
- why did we|how did we
```

**Algorithm:**
1. Check prompt for trigger phrases
2. If matched: extract noun keywords (skip verbs/pronouns/articles)
3. Run `mem-search <keywords>` — get compact index
4. If matches found: append a `--- Memory recall ---` block to the prompt
5. Claude then sees the memory results and answers from them
6. If no trigger + no matches: pass through unchanged (zero cost)

**Cost:** Only runs when trigger detected. grep for trigger pattern costs ~0ms. mem-search itself only runs on matches — worst case 50ms. Pass-through is nearly instant.

**File:** `brain/operations/system-configs/claude/hooks/memory-recall-hook.sh` (new)

Register in `settings.json` under `UserPromptSubmit` hooks, after existing hooks.

---

### 3. Document in CLAUDE.md + Codex/Gemini guidance

Claude needs to understand it will receive memory context injected into prompts automatically, and should use it naturally. Codex and Gemini need equivalent guidance since they don't have hooks but will receive the same context when Claude orchestrates them.

Add to `~/.claude/CLAUDE.md` Memory IDs section:
> Memory is injected automatically on session start and on recall-intent prompts. When you see `--- Memory context ---` or `--- Memory recall ---` blocks prepended to a prompt, read and use them. You do not need to call mem-search manually — the hook system handles detection and injection.

Add to `AGENTS.md` and `GEMINI.md` sessions lifecycle:
> When receiving context blocks prefixed with `--- Memory context ---` or `--- Memory recall ---`, treat them as authoritative memory from previous sessions. Use them naturally in your response without mentioning the mechanism.

---

## What Stays Unchanged

- `auto-handoff.sh` — no changes
- `settings.json` (except adding one new hook entry)
- `.ai/current.md` schema — no changes
- `mem-search.sh` — no changes (hooks call it internally)
- All existing hook behavior — unchanged, new hook is additive

---

## Trigger Design (Detailed)

```bash
TRIGGER_PATTERN="(what did we|remind me|do you remember|do we have|previously|last time|we used to|we always|what was the|what is our|what are our|why did we|how did we|what settings|what config|what decision|what approach)"
```

Keyword extraction (from prompt after trigger match):
- Remove trigger phrase words
- Remove stop words: "the a an in on at to for of and or but is are was were"  
- Take first 3 remaining words as search terms
- Join with space for single mem-search call

Output cap: max 5 index lines to keep token cost minimal (~100-200 tokens max injection).

---

## Files Modified

| File | Change |
|------|--------|
| `brain/operations/system-configs/claude/hooks/inject-handoff.sh` | Add keyword extraction + memory search block at session start |
| `brain/operations/system-configs/claude/hooks/memory-recall-hook.sh` | CREATE — mid-session trigger hook |
| `brain/operations/system-configs/claude/settings.json` | Register new hook under UserPromptSubmit |
| `/Users/Office/.claude/CLAUDE.md` | Explain auto-injection mechanism |
| `brain/operations/system-configs/codex/AGENTS.md` | Add note: honor injected memory blocks |
| `brain/operations/system-configs/gemini/GEMINI.md` | Add note: honor injected memory blocks |
| `brain/operations/decision-log.md` | Append Phase 2 decision entry |

---

## Verification

```bash
# Test 1: Hook trigger detection (no session needed)
echo '{"prompt":"what did we decide about firecrawl?","transcript_path":"/tmp/test.jsonl"}' \
  | bash brain/operations/system-configs/claude/hooks/memory-recall-hook.sh
# Expected: output JSON with "--- Memory recall ---" block injected into prompt

# Test 2: No trigger — passthrough
echo '{"prompt":"write a hello world function","transcript_path":"/tmp/test.jsonl"}' \
  | bash brain/operations/system-configs/claude/hooks/memory-recall-hook.sh
# Expected: output JSON unchanged (exact passthrough)

# Test 3: Session start injection
# Create test transcript with 1 line, then run inject-handoff.sh
# Expected: "--- Memory context ---" block + existing handoff brief

# Test 4: Cost check — zero trigger cost
# Run 20 non-trigger prompts through the hook and verify <1ms per prompt
time for i in {1..20}; do
  echo '{"prompt":"can you help me refactor this function?"}' | \
    bash memory-recall-hook.sh > /dev/null
done
```

---

## Behavior Summary (End State)

| You say | What happens |
|---------|--------------|
| "what did we decide about routing?" | Hook detects recall intent → searches memory → injects matches → Claude answers from memory |
| "remind me about the firecrawl setup" | Hook detects trigger → searches "firecrawl setup" → injects mem-project-001 summary → Claude explains |
| "write me a hello world function" | Hook finds no trigger → zero cost passthrough |
| Session start after break | inject-handoff extracts topic keywords from first prompt → searches memory → injects relevant entries + .ai/current.md brief |
| "what settings do we use for docker?" | Hook detects "what settings" → searches "docker" → injects relevant ref memories → Claude answers |
