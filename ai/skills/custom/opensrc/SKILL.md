---
name: opensrc
description: Fetch dependency source code to give AI agents deeper implementation context. Use when debugging library behavior, understanding internal patterns, or verifying how a dependency actually works versus what docs claim.
---

# opensrc — Dependency Source Reader

Fetch and read the actual source code of any npm/PyPI/crates.io dependency. When you need to understand how a library works internally — not just its API surface — use this tool.

**Natural language triggers:**
- "how does X work internally"
- "read the source of Y"
- "fetch source for Z"
- "look at the implementation of"
- "debug why this library behaves like"
- "what does this dependency actually do"
- "show me the source code of"

---

## Commands

### Fetch and get path to source

```bash
opensrc path <package-name>
```

Returns an absolute path to the cached source. Use this path with `rg`, `cat`, `find`, or any file reading tool.

### Example usage in agent workflow

```bash
# Get path to zod source
SOURCE_PATH=$(opensrc path zod)

# Search for specific implementation
rg "ZodString" "$SOURCE_PATH/src/"

# Read a specific file
cat "$SOURCE_PATH/src/types.ts"
```

### List cached sources

```bash
opensrc list
```

### Remove a cached source

```bash
opensrc remove <package-name>
```

---

## How it works

1. Resolves the package from its registry (npm, PyPI, crates.io)
2. Detects the correct version from your lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock)
3. Shallow-clones the source at the matching git tag
4. Caches globally at `~/.opensrc/`
5. Returns the filesystem path for immediate use

---

## When to use

- Debugging unexpected library behavior (the docs say X but it does Y)
- Understanding internal patterns before wrapping or extending a library
- Verifying security-sensitive behavior (auth, crypto, validation)
- Learning architecture patterns from well-maintained open source

## When NOT to use

- Simple API usage questions (read the docs first)
- Libraries with no public source (proprietary, closed-source)
- When the answer is in the library's README or changelog
