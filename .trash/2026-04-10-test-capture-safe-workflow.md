---
type: capture
source: test
title: "Test capture — safe workflow"
created: 2026-04-10T09:55:43Z
status: unprocessed
para_type: null
confidence: null
tags:
  - needs-review
---

# Test capture — safe workflow

## Raw Content
This is a test capture to verify the new save-first architecture. The workflow should save a raw unprocessed file to GitHub immediately, respond with 202, then classify it with Gemini and update the same file in place with status: processed.

---
*Captured 2026-04-10T09:55:43Z from test — awaiting Gemini classification*