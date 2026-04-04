# Context Mode MCP

This folder holds repo-safe documentation for the Context Mode MCP server.
All session state is stored locally at `~/.context-mode/` and never committed.

---

## What it does

Solves context window overflow in long coding sessions:
- **Context compression** — sandboxes tool output to keep raw data out of conversations (claims ~98% reduction)
- **Session continuity** — tracks file edits, git ops, tasks, and errors in a local SQLite DB
- **Resumability** — BM25 search retrieves only relevant context when conversations are compacted

No auth required. All data is local.

---

## Package

**npm package:** `context-mode`

```bash
npm install -g context-mode
ln -sf $(which context-mode) ~/.local/bin/context-mode
```

---

## Install

```bash
npm install -g context-mode
ln -sf $(which context-mode) ~/.local/bin/context-mode
claude mcp add -s user context-mode ~/.local/bin/context-mode
```

---

## Configuration

No required environment variables.

---

## Runtime locations (outside repo, never commit)

- `~/.claude.json` — MCP server registration
- `~/.context-mode/` — session databases and indexed content

---

## Verify

```bash
~/.local/bin/context-mode --version 2>/dev/null || echo "binary ok"
claude mcp list
```

---

## Source

GitHub: [mksglu/context-mode](https://github.com/mksglu/context-mode)
Installed via: `/plugin marketplace add mksglu/context-mode`
