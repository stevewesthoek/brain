# Pause timing system (use everywhere)

## Pause types (standard library)
• P0 (micro): 200–300ms (commas, soft separation)
• P1 (short): 500ms (end of a short sentence)
• P2 (breath): 900–1100ms (after a key phrase)
• P3 (slow): 1600–2000ms (after a reflection line)
• P4 (drift): 3000–4500ms (end of a reflection loop)
• P5 (sleep): 7000–12000ms (loop section, long silence)

In SSML terms you’ll implement these with <break time="...ms"/>.

---

## Pacing curve over 30 minutes (what changes when)

### Segment A — 0:00–2:30 (Parasympathetic entry)

Goal: downshift fast without sounding weird.

Rules
• 1x P2 every 2–3 sentences
• 1x P3 every ~45 seconds
• No P4 yet (too early, feels broken)

Cadence template (repeat)
• sentence (P1)
• sentence (P1)
• key line (P2)
• reassurance line (P3)

---

### Segment B — 2:30–20:00 (Narrative + micro-reflections)

Goal: taper cognitive load gradually.

Split this into 6 cycles (~2:45 each):
2:00 narrative + 0:45 reflection

Narrative part (per cycle)
• End of most sentences: P1
• Every “scene change” (new image): P2
• Max 1x P3 per minute

Reflection part (per cycle)
Use the fixed 4-line reflection pattern:
1. Observation (P2)
2. Meaning (P2)
3. Personal connection (“you…”) (P3)
4. Permission to rest (“You can rest.”) (P4)

So each reflection loop ends with a P4 (3–4.5s).

---

### Segment C — 20:00–25:00 (Integration block)

Goal: no new story, just meaning. This is where sleep onset often starts.

Rules
• Sentences shorter
• More silence
• After every core truth: P3
• After every “You are safe / You can rest”: P4
• Add 1–2 P5 pauses near the end (first long drifts)

Pattern
• truth line (P3)
• truth line (P3)
• safety line (P4)
• (optional) P5 once per 2 minutes

---

### Segment E — 25:00–30:00 (Sleep loop waves)

Goal: predictable repetition + long gaps.

Do 3 waves of the same 6–8 phrases.

Wave 1 (25:00–26:40)
• After each phrase: P3 (1.6–2.0s)
• After every 3 phrases: P4 (3–4.5s)

Wave 2 (26:40–28:20)
• After each phrase: P4
• After every 2 phrases: P5 (7–9s)

Wave 3 (28:20–30:00)
• After each phrase: P5 (9–12s)
• No new lines
• Let silence do the work

---

## Exact “minute-by-minute” pause budget (simple numbers)

0–2:30
• P2: ~8 times
• P3: ~3 times
• P4/P5: 0

2:30–20:00 (6 cycles)

Per cycle:
• Narrative: ~12×P1, 4×P2, 1×P3
• Reflection: 2×P2, 1×P3, 1×P4

Totals across 6 cycles:
• P1: ~72
• P2: ~36
• P3: ~12
• P4: ~6

20:00–25:00
• P3: ~12–18
• P4: ~6–10
• P5: 2–3

25:00–30:00
• Wave1: ~8×P3 + 2×P4
• Wave2: ~6×P4 + 3×P5
• Wave3: ~6×P5