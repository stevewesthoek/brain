---
type: capture
source: chatgpt
title: "Brain Bridge OpenAPI rule"
para_type: resource
confidence: 0.95
signal_quality: 0.95
created: 2026-04-16
status: ready-for-review
---

# Brain Bridge OpenAPI rule

## Summary
This note provides critical OpenAPI specifications for Brain Bridge ChatGPT Custom GPT Actions, stating that OpenAPI 3.0 static schemas are rejected. It mandates using OpenAPI 3.1.0 or 3.1.1, ensuring specific schema structures, and requiring `operationId` for all actions to prevent common errors.

## Key Points
- Old OpenAPI 3.0 static schema format is rejected for Brain Bridge ChatGPT Actions.
- Future OpenAPI specs must use version 3.1.0 or 3.1.1.
- The `components.schemas` section must be an object (even if empty).
- Every POST action or method must include an `operationId`.
- Only safe action paths should be exposed unless explicitly requested.

## Raw Content
For Brain Bridge ChatGPT Custom GPT Actions, never provide or use the old OpenAPI 3.0 static schema format. ChatGPT Actions currently rejected it with these errors: components.schemas subsection is not an object; each POST action missing operationId; openapi must be 3.1.0 or 3.1.1. Future Brain Bridge OpenAPI specs must use OpenAPI 3.1.0 or 3.1.1, include components.schemas as an object (even if empty), include operationId for every action method, and expose only safe action paths unless explicitly requested.

---
*Captured 2026-04-16 · 95% confidence · 95% signal · resource*