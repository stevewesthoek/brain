# 00 — Inbox (Capture & Stream)

## Purpose
Raw captures from ChatGPT, shortcuts, or manual saves. All text lands here first, gets **PARA-classified** and **signal-scored** by Gemini.

## How it works

```
Raw text arrives
       ↓
[Gemini analyzes]
       ↓
    ├─→ high-value/    (confidence > 0.8 AND signal > 0.7)
    ├─→ review-queue/  (0.5 < confidence/signal < 0.8)
    └─→ junk/          (anything below 0.5)
```

## Three Streams

### 🟢 high-value/
**What:** Clear captures with strong signal and actionable potential.

**Characteristics:**
- Confidence: > 0.80
- Signal quality: > 0.70
- Specific, actionable, or decision-relevant
- Connected to known business/project area

**Lifecycle:**
- Auto-promoted to **01-brainstorm/** (you don't manage this manually)
- Happens nightly or weekly
- You just see it appear downstream

**You do:** Nothing. Ignore this folder. The automation handles it.

### 🟡 review-queue/
**What:** Borderline cases that might have value but need human judgment.

**Characteristics:**
- Confidence: 0.50–0.80
- Signal quality: 0.40–0.70
- Interesting but unclear if actionable
- Might duplicate existing knowledge

**Lifecycle:**
- Sits here until you review
- Weekly audit: 5-min scan, decide promote/trash
- Auto-archives if not reviewed in 7 days
- Optional: batch sends you "Review queue has 3 items" digest

**You do:** Weekly 5-minute review (or skip entirely). Manually promote good ones to brainstorm, delete rest.

### 🔴 junk/
**What:** Low-confidence, low-signal content. Noise.

**Characteristics:**
- Confidence: < 0.50
- Signal quality: < 0.40
- Generic wisdom, motivation, duplicates
- Unactionable or too vague

**Lifecycle:**
- Automatically invisible in your daily view
- Auto-deletes after 30 days (still in git history)
- Pattern detection: if 5+ similar junk items appear, sends digest: "Notice a pattern? 5 items about productivity tips. Worth exploring?"

**You do:** Nothing. Forget this folder exists.

---

## Frontmatter Format

Every note in inbox has:

```yaml
---
type: capture
source: chatgpt|shortcut|manual
para_type: project|area|resource|inbox
confidence: 0.0–1.0          # Classification certainty
signal_quality: 0.0–1.0      # Actionable value score
stream: high-value|review-queue|junk
routed_at: YYYY-MM-DD
tags: [list]
---
```

---

## Files

- `high-value/` — Auto-promoted captures (automation territory)
- `review-queue/` — Needs your decision
- `junk/` — Auto-archived, invisible

---

## References

- **Next layer:** [[01-brainstorm|01-Brainstorm]]
- **Dashboard:** [[home|Command Center]]
- **Process:** For how Gemini scores these, see the automation docs
