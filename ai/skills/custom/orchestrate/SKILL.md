---
name: orchestrate
description: Coordinate parallel work across multiple agents. Activates when tasks can be parallelized independently.
---

# Orchestrate — Parallel Multi-Agent Coordination

Automatically coordinate work across multiple agents when tasks are independent and can run in parallel.

**Activation condition:** 2+ independent subtasks that can complete simultaneously

**Do NOT activate when:** Tasks have dependencies, sequential work required, or single-threaded logic

---

## Pattern Recognition

Recognize parallelizable work:

- **Code review:** Review different modules simultaneously
- **Analysis:** Analyze different data sources in parallel
- **Testing:** Run different test suites in parallel
- **Refactoring:** Refactor different components in parallel

---

## Usage

Trigger phrases (all activate `/orchestrate`):

- "Review these 3 modules in parallel"
- "Parallelize this work across agents"
- "Analyze these 5 data sources concurrently"
- "Run these tests in parallel"

---

## How It Works

1. User describes parallelizable work
2. Orchestrator decomposes into N independent tasks
3. Spawn N subagents (default 3, max configured by user)
4. Distribute tasks to agents
5. Monitor progress in real-time
6. Merge results when all complete
7. Report total cost savings vs sequential

---

## Integration

Sub-coordinates with:
- `/code` (when parallelizable improvements detected)
- `/review` (for parallel code review)
- `/graphify` (to identify independent modules)

---

## Key Rules

- Never parallelize dependent work
- Estimate savings before spawning agents
- Fail fast: if any agent fails, option to revert
- Always report cost comparison (parallel vs sequential)
- Max pool size: 5 agents (configurable)
