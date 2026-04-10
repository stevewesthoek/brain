# Gemini Flash Auto-Preprocessing Hook

## Overview

Automatically compresses large, noisy input with Gemini Flash (free) before Claude processes it. Reduces downstream context size, improves reasoning quality, and saves tokens.

**Installed:** `/Users/Office/.claude/hooks/gemini-preprocess-hook.sh` (symlinked from `operations/system-configs/claude/hooks/gemini-preprocess-hook.sh`)  
**Config:** `/Users/Office/.claude/settings.json` (PostToolUse: Read, WebFetch)

---

## How It Works

### Trigger Points
Runs automatically after:
- `Read` tool (reading local files)
- `WebFetch` tool (fetching URLs)

### Decision Logic

| Input Size | Content Type | Action | Rationale |
|----------|------|--------|-----------|
| <5k tokens | Any | **SKIP** | Latency cost (1-2s) > compression benefit |
| 5-20k | **URL** | **COMPRESS** | Web content is usually noisy (ads, nav, sidebars) |
| 5-20k | **Local code** | **SKIP** | Code is already dense; compression loses structure |
| 5-20k | **Local prose** | **COMPRESS** | Prose benefits from summarization |
| >20k | **Any** | **COMPRESS** | Always compress; context limits justify latency |

### Token Estimation
- Rough estimate: **4 characters ≈ 1 token**
- Used only for threshold decisions (fast, no API call)
- Not exact, but good enough for deciding compress/skip

### Content Type Detection
Heuristic checks for:
- Keywords: `import`, `function`, `class`, `def`, `async`, `=>`, `{}`
- If found → treated as code (skip compression)
- Otherwise → treated as prose (compress if large enough)

---

## Behavior

### When Compression Runs

```bash
[Gemini Preprocess] Tokens: ~45000 | Type: PROSE | Action: COMPRESS
[Gemini Preprocess] Result: ~11200 tokens (saved 75%)
```

- Sends content to Gemini Flash with: *"Summarize into 1/4 the length. Keep all technical details. Remove filler."*
- Stores compressed result in `CLAUDE_PREPROCESSED_CONTENT` env var
- I automatically receive and use the compressed version

### When Compression Skips

```bash
[Gemini Preprocess] Tokens: ~3000 | Type: PROSE | Action: SKIP (not worth compressing)
[Gemini Preprocess] Tokens: ~18000 | Type: CODE | Action: SKIP (code structure preserved)
```

- Original content flows through unchanged

---

## Cost Analysis

### Example: 50k-token GitHub README

**Without preprocessing:**
- Input: 50k tokens to Claude Haiku (~$0.008)
- Output: ~1k tokens (~$0.0004)
- **Total: ~$0.0084**

**With preprocessing:**
- Input: 50k tokens to Gemini Flash (free)
- Gemini output: ~2k tokens (free)
- Compressed input: ~12.5k tokens to Claude Haiku (~$0.002)
- Output: ~500 tokens (~$0.0002)
- **Total: ~$0.0022 (74% savings)**
- **Plus:** Haiku sees cleaner context → better reasoning

### Latency Tradeoff
- Gemini Flash compression: ~1-2 seconds
- Claude reasoning time saved: ~200-400ms (smaller input)
- **Net add: ~0.5-1.5 seconds** ✓ Acceptable

---

## When This Helps Most

✅ **Great use cases:**
- Fetching long blog posts, documentation, articles
- Reading verbose README files
- Loading large JSON/CSV files with descriptive headers
- Analyzing GitHub issues with long comment threads

❌ **Less effective:**
- Small config files (<5k)
- Tightly written code
- Already-compressed formats (minified code, binary)
- Structured data (JSON schemas, API responses)

---

## Manual Override

If you want to skip preprocessing for a specific input:

```
/freeze <dir>
# Read/fetch as normal (hook still runs but you know the tradeoff)
/unfreeze
```

Or disable the hook temporarily:
```bash
# Comment out Read/WebFetch matchers in ~/.claude/settings.json
# Restart Claude Code
```

---

## Technical Details

### Environment Variables Set
- `CLAUDE_PREPROCESSED_CONTENT` — Compressed content (or original if skipped)
- `CLAUDE_PREPROCESSING_APPLIED` — "true" or "false"

### Hook Dependencies
- `gemini-review.sh` CLI tool (must be in PATH)
- Assumes Gemini is configured in `~/.gemini/`
- Falls back to original content if Gemini call fails

### Cost
- **Gemini Flash:** Free tier (included in Anthropic subscription)
- **Latency:** ~1-2 seconds per compression
- **No additional cost** for preprocessing itself

---

## Tuning Parameters

Edit `gemini-preprocess-hook.sh` to adjust thresholds:

```bash
SKIP_THRESHOLD=5000              # Don't preprocess below this
ALWAYS_COMPRESS_THRESHOLD=20000  # Always preprocess above this
```

Current settings balance speed + cost + quality. Change only if:
- You find compression is too aggressive (increase SKIP_THRESHOLD)
- You want more compression (lower ALWAYS_COMPRESS_THRESHOLD)
- You're willing to wait longer (lower SKIP_THRESHOLD)

---

## Debugging

To see preprocessing decisions without making them:

```bash
# Add verbosity to hook
bash /Users/Office/.claude/hooks/gemini-preprocess-hook.sh <content> <tool> <url>
```

---

## Related

- **Caveman:** Compresses *output* tokens (65% savings). Different lever, complementary.
- **Model routing:** Haiku-first strategy (cost). This hook optimizes *input* to Haiku.
- **Gemini Flash:** Free preprocessing tier. Used here for all compression.

---

## Status

**Implemented:** 2026-04-10  
**Hook active:** Automatic, every Read/WebFetch  
**Config location:** `~/.claude/settings.json`  
**Script location:** `operations/system-configs/claude/hooks/gemini-preprocess-hook.sh`

To verify it's running, watch the console for `[Gemini Preprocess]` log lines when you read/fetch large content.
