---
name: greploop
description: Iterative review-fix-review loop. Runs /review, feeds findings to the coding agent as fix instructions, re-runs /review, and loops until clean or max iterations reached. Use when code needs autonomous quality improvement without manual bridging between review and fix.
---

# GrepLoop — Iterative Verification Loop

You are an autonomous quality loop. When invoked, you iterate between reviewing code and fixing issues until the code is clean or the maximum iteration count is reached.

**Natural language triggers:**
- "fix all review issues"
- "loop until clean"
- "auto-fix review findings"
- "iterative review"
- "greploop"
- "review and fix automatically"
- "keep fixing until it passes"

---

## Algorithm

```
iteration = 0
max_iterations = 3

while iteration < max_iterations:
  iteration += 1

  # Step A: Run review
  findings = run /review on current diff or specified files

  # Step B: Check for clean
  if findings.length == 0:
    report "Clean after {iteration} iteration(s)."
    stop

  # Step C: Fix findings
  for each finding in findings:
    apply fix using /code fix workflow
    (fix the specific issue described, nothing else)

  # Step D: Verify fixes compile
  run typecheck / lint / test as appropriate
  if compilation fails:
    fix compilation errors before next review iteration

# Step E: Max iterations reached
if findings still remain after max_iterations:
  report remaining findings to user
  escalate: "GrepLoop completed {max_iterations} iterations. {N} issues remain. Manual review recommended."
```

---

## Rules

1. **Scope discipline.** Fix only what the review identified. Do not refactor surrounding code. Do not add features. Do not clean up unrelated issues.
2. **One finding, one fix.** Address each finding individually. Do not batch unrelated fixes into one edit.
3. **Verify after fixing.** After each iteration of fixes, confirm the code still compiles and tests pass before running the next review.
4. **Escalate, don't loop forever.** After 3 iterations, stop and report. Infinite loops waste tokens and indicate a deeper design problem.
5. **Preserve existing patterns.** When fixing, follow the conventions already in the codebase. Do not introduce new patterns to fix old ones.

---

## Integration

- **Input:** Current git diff, or specific file paths, or "all staged changes"
- **Review tool:** `/review` (the existing pre-landing PR review skill)
- **Fix tool:** Direct code editing (the executing agent's native capability)
- **Verification:** `npm run typecheck`, `npm test`, `npm run lint` — whatever the repo uses
- **Output:** Either "Clean after N iterations" or "N issues remain after max iterations"

---

## When NOT to use GrepLoop

- Single obvious fix (just fix it directly)
- Architecture-level issues that review flags (those need /code improve, not iterative fixes)
- Non-code reviews (design reviews, copy reviews)
- When the review findings contradict each other (escalate to human)

---

## Cost Routing

GrepLoop should run at the same model tier as the current session. Do not escalate models within the loop. If the fixes require deeper reasoning than the current tier can provide, exit the loop and recommend model escalation to the user.
