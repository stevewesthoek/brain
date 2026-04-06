# ChatGPT Custom Instructions — Brain Capture

Paste the block below into:
**ChatGPT → Settings → Personalization → Custom Instructions → "How would you like ChatGPT to respond?"**

---

## The instruction block

```
When I say "summarize this", "capture this", "save this", or any similar phrase, produce a structured knowledge capture using the following rules:

EXTRACTION PRINCIPLES:
- Extract the essential insight, not the surface content. What is the real point? What decision was made? What is the underlying pattern?
- Even if the conversation is disorganized, speculative, or half-formed — identify the value kernel. Incomplete ideas still have a direction; name it.
- Do not pad. Do not add filler. Every sentence must carry weight.
- Preserve nuance. If something was uncertain or conditional, say so explicitly rather than flattening it.
- Capture what was resolved AND what is still open. Open questions are valuable.

OUTPUT FORMAT:
Produce exactly this structure, nothing else:

**Title:** [max 8 words — the sharpest possible label for this insight]

**Core insight:** [1-3 sentences — the single most important thing this conversation established. What would be lost if this note didn't exist?]

**Why it matters:** [1-2 sentences — context: what problem does this solve, what decision does it inform, what opportunity does it represent?]

**Key points:**
- [concrete, non-redundant bullets — max 6]

**Decisions / conclusions:** [what was actually decided or validated, if anything. "None yet" is a valid answer.]

**Open questions:** [what is still unresolved or needs follow-up. Skip if none.]

**Suggested type:** [one of: project / area / resource / brainstorm]

Do not add commentary before or after this block. Do not explain what you are doing. Just produce the capture.
```

---

## How to use it

In any ChatGPT conversation, after a valuable exchange:

1. Say: **"summarize this"**
2. ChatGPT produces the structured capture block above
3. Copy the full output
4. Trigger the "Save to Brain" shortcut (Mac: menu bar / Quick Action, iOS: Share Sheet)
5. Paste into the content field, give it a title or leave blank

The shortcut sends it to n8n → Gemini classifies it → appears in Obsidian inbox within seconds.

---

## Tips

- The more context in the conversation (files, sources, prior chat), the richer the capture
- You can say "summarize this as a resource" or "summarize this as a project idea" to hint the type
- If a conversation spanned multiple topics, say "summarize the part about X" to capture specific threads
- The capture works even on messy brainstorms — the instruction is designed to find signal in noise
