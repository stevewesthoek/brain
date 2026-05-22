# Multi-Agent Orchestration Standard

**Version:** 1.0  
**Date:** 2026-06-08  
**Owner:** Steve Westhoek

---

## When to Parallelize

### ✅ Good candidates for parallelization

- Code review of independent modules
- Analysis of separate data sources
- Running different test suites
- Refactoring different components
- Generating variations of a design

### ❌ Do NOT parallelize

- Dependent tasks (A must complete before B)
- Tasks that modify shared state
- Complex reasoning requiring context
- Tasks that are single-threaded by nature

---

## Decision Tree

1. **Can this work be decomposed into N independent subtasks?**
   - Yes → Continue
   - No → Do NOT parallelize

2. **Is N ≥ 2?**
   - Yes → Continue
   - No → Do NOT parallelize

3. **Does each subtask take >30 seconds?**
   - Yes → Parallelization likely saves money
   - No → Serial may be faster due to overhead

4. **Estimated cost saving >20%?**
   - Yes → Parallelize
   - No → Keep serial

---

## Cost-Benefit Analysis

**Example: Code review of 3 modules**

Serial:
- Module A: Sonnet 10 min = $0.30
- Module B: Sonnet 10 min = $0.30
- Module C: Sonnet 10 min = $0.30
- **Total: 30 min, $0.90**

Parallel:
- Coordinator: Sonnet 2 min = $0.06
- Module A: Haiku 10 min = $0.02
- Module B: Haiku 10 min = $0.02
- Module C: Haiku 10 min = $0.02
- **Total: 10 min (parallel) + 2 min (coordinator) = ~12 min wall-clock, $0.12**

**Savings: 86% cost reduction, 60% time reduction**

---

## Limitations

- Cannot parallelize work with dependencies
- Merging conflicting results requires human review
- Coordinator overhead only justified for large tasks
- Network/IO bottlenecks may negate parallelism benefits
- Not suitable for tasks requiring single global context
