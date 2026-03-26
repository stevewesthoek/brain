# gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`

# Skills structure

Skills live in `brain/ai/skills/` with three directories:

- `active/` — symlinks only, what Claude reads (via `~/.claude/skills -> active/`)
- `vendors/` — third-party skill sources (e.g. `vendors/gstack/`)
- `custom/` — first-party skill sources

When installing a new skill:
1. Place the source in `vendors/<vendor>/` or `custom/`.
2. Create a symlink in `active/` pointing to the source (e.g. `ln -s ../vendors/gstack/foo active/foo`).
3. Never put raw skill folders directly in `active/`.
