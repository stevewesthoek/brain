# Mind `.obsidian` Churn Review

**Date:** 2026-05-18

## Changed paths

- `.obsidian/community-plugins.json`
- `.obsidian/bookmarks.json`
- `.obsidian/plugins/custom-sort/`
- `.obsidian/plugins/ghostty-terminal/`
- `.obsidian/plugins/obsidian-icon-folder/`

## Classification

- `community-plugins.json`: tracked config file change, likely user-facing plugin enablement drift
- `bookmarks.json`: tracked/metadata-like vault state, likely user-specific
- plugin directories: plugin files, likely installed Obsidian plugin state

## Risk

High. Vault config and plugin state are easy to overstage and may be environment-specific.

## Recommended next action

Do not commit in this pass unless a user explicitly approves the exact `.obsidian` paths.

## Suggested future commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git diff -- .obsidian/community-plugins.json
git diff -- .obsidian/bookmarks.json
git diff --stat -- .obsidian
git add -- .obsidian/community-plugins.json
git add -- .obsidian/bookmarks.json
```

## Rollback

```bash
git restore --staged -- .obsidian
git restore -- .obsidian
```
