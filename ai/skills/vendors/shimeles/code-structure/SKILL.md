---
name: code-structure
description: Service layer architecture guide. Activates when duplicated operational logic is detected across 2+ domain flows. Teaches when to extract shared mechanics into services vs when to keep logic in actions. Use during /code improve workflows when cross-flow duplication is found.
---

# Code Structure — Service Layer Extraction

This skill activates during `/code improve` workflows when the analysis detects duplicated operational logic across multiple callers.

**Activation condition:** 2+ actions/flows duplicate the same operational logic (API calls, email sends, file operations, etc.)

**Do NOT activate when:** Logic is used by only one caller, or the duplication is trivial (< 5 lines).

---

## Core Pattern

```
Actions (Orchestration Layer)
  ├── Own: business rules, auth, state transitions, error classification
  ├── Call: service functions for reusable mechanics
  └── Never: duplicate operational logic across actions

Services (Shared Mechanics Layer)
  ├── Own: reusable operations, provider interactions, retries
  ├── Return: structured results (not thrown errors)
  └── Never: auth checks, business rules, state transitions
```

---

## Decision Flowchart

1. Is this logic used by 2+ callers? → No → Keep in action. Stop.
2. Is it operational mechanics (not business rules)? → No → Keep in action. Stop.
3. Does extracting it reduce total code? → No → Keep in action. Stop.
4. Extract into a service function.

---

## Migration Checklist

1. Write the logic inline in the action first (prove it works)
2. Observe repetition across a second caller
3. Extract the shared mechanics into a service function
4. Replace one caller with the service call, verify
5. Replace remaining callers, verify each
6. Delete the inline duplicates

---

## Anti-Patterns

| Anti-Pattern | Problem |
|-------------|---------|
| **God service** | One service does everything — split by capability |
| **Leaky service** | Service does auth or business rules — push back to action |
| **Inconsistent API** | Service sometimes throws, sometimes returns — pick one |
| **Over-abstraction** | Service wraps a single function call — just call the original |

---

## Key Principle

Write in action first. Extract only when repetition is observed. Never extract preemptively.
