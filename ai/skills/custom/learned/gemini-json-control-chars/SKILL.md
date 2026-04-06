---
name: gemini-json-control-chars
description: When JSON.parse fails on Gemini API responses with "Invalid control character" — Gemini embeds literal newlines inside JSON string values that must be sanitized before parsing.
---

# Gemini JSON: Literal Control Characters in String Values

## The insight
Gemini Flash (and likely other Gemini models) generates JSON responses where multi-line string values (like `note_content`) contain **literal newline characters** (0x0A) rather than the escaped `\n` sequence. This is technically invalid JSON — control characters inside string values must be escaped. `JSON.parse()` throws at the first unescaped newline, typically deep inside a long field.

The text *looks* correct in previews and logs because most renderers display literal newlines as newlines. The bug is invisible until you try to parse it.

## When this applies
- `JSON.parse()` throws `Invalid control character at line 1 column N`
- The Gemini response text starts with `{` and looks like valid JSON
- The failure position (column N) is inside a long string field, not at a structural boundary
- Gemini was asked to produce JSON with a field containing formatted text or markdown

## The approach
Don't trust that Gemini's JSON output is spec-compliant. Always sanitize before parsing. The sanitizer must only escape control characters *inside string values* — replacing them globally would corrupt the JSON structure (structural whitespace between tokens is valid and must stay).

## The fix
Use a char-by-char sanitizer that tracks whether the parser is inside a string:

```javascript
function sanitizeJsonString(str) {
  let result = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escaped) { result += c; escaped = false; }
    else if (c === '\\' && inString) { result += c; escaped = true; }
    else if (c === '"') { result += c; inString = !inString; }
    else if (inString && c === '\n') { result += '\\n'; }
    else if (inString && c === '\r') { result += '\\r'; }
    else if (inString && c === '\t') { result += '\\t'; }
    else if (inString && c.charCodeAt(0) < 32) {
      result += '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
    }
    else { result += c; }
  }
  return result;
}

const cleanJson = sanitizeJsonString(stripped);
const parsed = JSON.parse(cleanJson);
```

Live implementation: `tools/n8n-brain-inbox.json`, "Build Note" Code node.

## Gotchas
- Stripping markdown code fences (```` ```json ```` ) must happen *before* sanitizing
- The error column number points to the first literal newline — usually well into a `note_content` or `summary` field
- This affects any Gemini model asked to generate JSON containing formatted text. Treat it as a permanent assumption, not a one-off.

## Context
Repo: brain  
Discovered: 2026-04-06  
Area: tools/n8n-brain-inbox.json — Build Note Code node
