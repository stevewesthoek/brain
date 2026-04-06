---
name: n8n-http-json-expressions
description: When an n8n HTTP Request node fails with "JSON parameter needs to be valid JSON" despite the body looking correct — the fix is to pre-build the body upstream.
---

# n8n HTTP Request: JSON Body with Expressions

## The insight
n8n validates the `jsonBody` field as raw JSON *before* resolving `{{ }}` expressions. So a body like `{"text": "{{ $json.title }}"}` fails validation because `{{ $json.title }}` is not valid JSON. The expressions never get a chance to run. This is a pre-execution validation step, not a runtime error.

## When this applies
- HTTP Request node with `specifyBody: "json"` and a `jsonBody` containing `{{ }}` expressions
- Error: `NodeOperationError: JSON parameter needs to be valid JSON`
- The body looks syntactically correct but contains n8n expression tokens

## The approach
Never embed n8n expressions inside `jsonBody`. Instead, build the complete JSON string upstream in a Code node using JavaScript's `JSON.stringify()`, store the result as a field, then reference that field in the HTTP node as a plain string variable.

## The fix
1. Add a Code node before the HTTP Request node
2. In the Code node, build the full request body:
   ```javascript
   const body = JSON.stringify({ text: $input.first().json.title });
   return [{ json: { ...($input.first().json), requestBody: body } }];
   ```
3. In the HTTP Request node:
   - `specifyBody`: `string`
   - `contentType`: `raw`
   - `rawContentType`: `application/json`
   - `body`: `={{ $json.requestBody }}`
4. Add a `Content-Type: application/json` header explicitly

## Gotchas
- `specifyBody: "string"` with `contentType: "json"` does NOT send raw JSON — it wraps the string as a form field key. Must use `contentType: "raw"`.
- The credential-based auth (e.g. Google PaLM API) still works with raw body — no conflict.
- Live workflow: `tools/n8n-brain-inbox.json`, node "Build Gemini Body" → "Gemini Flash — Classify"

## Context
Repo: brain  
Discovered: 2026-04-06  
Area: tools/n8n-brain-inbox.json — Gemini Flash HTTP Request node
