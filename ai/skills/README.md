# Skills

Canonical home for shared skills across tools (Claude Code, Codex, etc.).

## Structure

```
skills/
├── active/    # Symlinks only — what Claude reads via ~/.claude/skills
├── vendors/   # Third-party skill sources (e.g. vendors/gstack)
├── custom/    # First-party skill sources
└── README.md
```

## Rules

1. `active/` contains **only symlinks** — never raw skill folders.
2. Every skill in `vendors/` or `custom/` must have a symlink in `active/` to be visible to Claude.
3. Symlinks in `active/` point to `../vendors/<vendor>/<skill>` or `../custom/<skill>`.
4. New vendor skills: add source to `vendors/<vendor>/`, then symlink from `active/`.
5. New custom skills: add source to `custom/`, then symlink from `active/`.
6. Do not store tool-internal config, caches, or runtime state here.
