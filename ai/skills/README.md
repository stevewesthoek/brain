# Shared Skills

This is the canonical home for shared skills that should work across tools.

## Keep here

- reusable business/domain skills
- reusable workflow skills
- skills that OpenClaw, Codex, or other IDE tools should all be able to use

## Do not keep here

- tool-internal bundled skills
- machine-local config or caches
- vendor-managed runtime state

## Rule

If a skill is conceptually shared, store it here once and expose it elsewhere with symlinks or tool config.
