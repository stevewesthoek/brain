# .brain/ Directory Convention

Every instrumented repo may contain a `.brain/` directory at its root for local AI agent state.

## Contents

| File | Purpose | Committed |
|------|---------|-----------|
| `graph.json` | Cached codebase graph from graphify | No (.gitignore) |
| `project-state.json` | Machine-readable project status | Yes |
| `roadmap.md` | Human-readable roadmap | Yes |
| `implementation-plan.md` | Phase-by-phase task list | Yes |

## Rules

- `graph.json` is always gitignored (local cache, regenerated per-machine)
- `project-state.json`, `roadmap.md`, and `implementation-plan.md` are committed
- The `.brain/` directory is optional — repos work fine without it
- AI agents should check for `.brain/graph.json` at session start
