---
name: code-structure
description: Analyze and report project code structure — file tree, dependency graph, module boundaries, and entry points. Use when onboarding to a codebase, planning refactors, or understanding how components connect.
---

# code-structure — Codebase Structure Analyzer

Analyze a project's code structure and report its architecture: file tree, module boundaries, entry points, dependency graph, and key patterns.

**Natural language triggers:**
- "show me the code structure"
- "what's the architecture of this project"
- "map the codebase"
- "how is this project organized"
- "what are the entry points"
- "show module boundaries"
- "dependency graph"

---

## Algorithm

1. **Identify project root and type**
   - Detect language/framework from package.json, Cargo.toml, pyproject.toml, go.mod, etc.
   - Identify monorepo vs single-package

2. **Map file tree**
   - Show directory structure at depth 3 (configurable)
   - Highlight: entry points, config files, test directories, build outputs

3. **Identify module boundaries**
   - Find export boundaries (index.ts, __init__.py, mod.rs, etc.)
   - Map public API surface per module
   - Detect circular dependencies

4. **Trace dependency graph**
   - Internal: which modules import which
   - External: key third-party dependencies and their role
   - Identify god modules (high fan-in/fan-out)

5. **Report patterns**
   - Architecture style (layered, hexagonal, MVC, etc.)
   - Naming conventions
   - Test organization (colocated vs separate)
   - Configuration approach

---

## Output format

```
## Project: {name}
Type: {language/framework}
Root: {path}

## Entry points
- {file}: {purpose}

## Module boundaries
- {module}: {responsibility} ({N} exports, {M} internal files)

## Dependency graph (simplified)
{module} → {module} → {module}

## Key patterns
- Architecture: {style}
- Tests: {approach}
- Config: {approach}

## Concerns
- {any circular deps, god modules, or structural issues}
```

---

## Rules

1. **Read-only.** Never modify code. This is an analysis tool.
2. **Depth-limited.** Don't enumerate every file. Focus on structure, not content.
3. **Highlight anomalies.** Circular deps, orphan files, oversized modules.
4. **Respect .gitignore.** Skip node_modules, dist, build, .git, etc.
5. **Be concise.** The goal is a mental model, not a file listing.

---

## Integration

- Works with any language/framework
- Pairs with `/graphify` for interactive visualization
- Useful before `/code improve` or `/plan-eng-review` to understand scope
- Can feed findings into `/review` for targeted structural review
