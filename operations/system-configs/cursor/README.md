# Cursor configs (curated)

This folder is symlinked from `~/.cursor`.

We ignore everything by default to avoid committing volatile state.
If we ever want to version specific Cursor settings, we will explicitly unignore those files.

## AI context pointer

Cursor agents should use the lightweight pointer:

```text
AGENTS.md
```

That file points to the canonical cross-IDE context contract:

```text
../ide-context.md
```

The rule is intentionally small:

```text
brain = AI operating system
mind = Steve's personal memory
current workspace = implementation target
```

Do not duplicate the full brain/mind context inside Cursor-specific config. Keep the canonical explanation in `operations/system-configs/ide-context.md` and the long-form rationale in `operations/runbooks/ai-context-propagation.md`.
