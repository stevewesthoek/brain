# Mind `.obsidian` Exact Path Review

**Date:** 2026-05-18

## Paths reviewed

- `.obsidian/community-plugins.json` - tracked
- `.obsidian/bookmarks.json` - untracked
- `.obsidian/plugins/custom-sort/` - untracked
- `.obsidian/plugins/ghostty-terminal/` - untracked
- `.obsidian/plugins/obsidian-icon-folder/` - untracked

## Classification

- `.obsidian/community-plugins.json`: intentional vault configuration candidate, but still high risk because it changes enabled plugins
- `.obsidian/bookmarks.json`: user-private vault state, low-value for shared cleanup, likely ignore unless user explicitly wants it versioned
- `.obsidian/plugins/custom-sort/`: plugin installation state, likely intentional if the plugin is meant to stay installed
- `.obsidian/plugins/ghostty-terminal/`: plugin installation state, likely intentional if the plugin is meant to stay installed
- `.obsidian/plugins/obsidian-icon-folder/`: plugin installation state, likely intentional if the plugin is meant to stay installed

## Risk

High overall. Obsidian vault state mixes user-private preferences, plugin installation state, and potential cache-like files.

## Recommendation

- Do not auto-commit `.obsidian` paths in this pass.
- Ask the user to approve exact paths one by one if these should be preserved.
- If a future cleanup decides any path is accidental, restore that exact path only.

## Safe future commands

```bash
cd /Users/Office/Repos/stevewesthoek/mind
git diff -- .obsidian/community-plugins.json
git diff --stat -- .obsidian
git add -- .obsidian/community-plugins.json
git add -- .obsidian/bookmarks.json
git add -- .obsidian/plugins/custom-sort
git add -- .obsidian/plugins/ghostty-terminal
git add -- .obsidian/plugins/obsidian-icon-folder
```

## Restore/delete commands if approved later

```bash
git restore --staged -- .obsidian
git restore -- .obsidian
```

## Decision

- Commit: no
- Ignore: bookmarks file for now
- Restore: none in this pass
- Manual review: yes, for all `.obsidian` paths
