# Long-Term Memory

Use this file for durable ProBot memory only when the fact does not already have a better canonical home.

## Skills

- All OpenClaw skills live in `brain/runtime/openclaw/active-skills/` — organized by domain (e.g. `x/`, `google/`)
- OpenClaw loads them via `extraDirs` in `openclaw.json` — pointing directly at those Brain paths
- `workspace/skills/` must stay empty — never place skills there, never create symlinks there
- To add a new skill: create the skill folder + SKILL.md in the Brain under the appropriate domain, then add its parent dir to `extraDirs` in `openclaw.json` if not already present

## Memory rules

- If a fact belongs in `personal/`, `organisations/`, `projects/`, `ai/`, or `operations/`, update it there instead of copying it here.
- Keep this file short and curated.
- Use `memory/YYYY-MM-DD.md` for daily/session memory and move stable facts out when they become canonical.

## Repo rules

- `runtime/openclaw/` is the OpenClaw workspace, not the source of truth for Steve’s profile or business docs.
- Shared cross-tool skills belong in `ai/skills/`.
- Tool-native internal skills stay with their tool configs.
- Runtime noise should not displace canonical documents.
