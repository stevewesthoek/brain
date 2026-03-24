# Long-Term Memory

Use this file for durable ProBot memory only when the fact does not already have a better canonical home.

## Skills

- All OpenClaw skills live in the Brain — never in `workspace/skills/` (keep that empty)
- OpenClaw-specific skills: `brain/runtime/openclaw/active-skills/<domain>/` (x, google)
- Shared cross-tool skills: `brain/ai/skills/` (notebooklm, ui-ux-pro-max, web-design)
- Both loaded via `extraDirs` in `~/.openclaw/openclaw.json`
- To add a new skill: create folder + SKILL.md in the correct Brain path; add parent dir to `extraDirs` if not already present

## NotebookLM

- Correct package: `notebooklm-mcp-server` (npm) — NOT `notebooklm-mcp` (PyPI v2.x, wrong tool surface)
- ProBot bridge: `mcporter call notebooklm.<tool>` — not native OpenClaw MCP injection
- mcporter config: `~/.mcporter/mcporter.json` (system scope, outside Git)
- Auth: run `notebooklm-mcp-auth` once; saves to `~/.notebooklm-mcp/auth.json`
- Full bridge docs: `operations/system-configs/mcp/notebooklm/openclaw-mcporter.md`

## Memory rules

- If a fact belongs in `personal/`, `organisations/`, `projects/`, `ai/`, or `operations/`, update it there instead of copying it here.
- Keep this file short and curated.
- Use `memory/YYYY-MM-DD.md` for daily/session memory and move stable facts out when they become canonical.

## Repo rules

- `runtime/openclaw/` is the OpenClaw workspace, not the source of truth for Steve’s profile or business docs.
- Shared cross-tool skills belong in `ai/skills/`.
- Tool-native internal skills stay with their tool configs.
- Runtime noise should not displace canonical documents.
