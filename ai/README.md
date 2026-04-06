# AI

Shared AI-facing material for multiple tools.

## Structure

- `agents/` — reusable agent definitions and constraints
- `prompts/` — reusable prompt libraries
- `publishing/` — channel-specific publishing systems and operating workflows
- `skills/` — canonical shared skills

## Rule

- keep shared AI logic here
- keep this tree organized by function, not by tool
- use lowercase kebab-case names for new files and folders

If it only exists for one tool’s internal behavior, keep it with that tool under `operations/system-configs/`.

Shared skills live in `ai/skills/` and are available to every agent; do not duplicate them elsewhere.
