# Open Design Optional Visual Design Surface

**Status:** Installed outside Brain as an optional bridge surface  
**Repository:** `https://github.com/nexu-io/open-design`  
**Installed location:** `/Users/Office/Repos/nexu-io/open-design`  
**Command:** `open-design`  
**Version verified:** `open-design/0.8.1`  
**Brain integration type:** External IDE-like visual workbench  
**Date:** 2026-05-31

## Purpose

Open Design may be used as a local visual environment for design iteration, prototypes, previews, and exports.

It sits beside Brain in the same category as Cursor, Kiro, Antigravity, Oh My Pi, Claude Code, Codex, and Gemini: useful as an operating surface, but not canonical architecture.

## Confirmed Repository Capabilities

The upstream repository describes Open Design as a local-first visual design app/workbench with sandboxed preview/export flows and support for many coding agents and CLIs, including Claude Code, Codex, Cursor, Antigravity, and others. It also documents a stdio MCP server and an internal agent path scanner.

Use these capabilities as a bridge into the existing Brain design workflow, not as a replacement for it.

Source: https://github.com/nexu-io/open-design

## Hard Boundaries

- Do not vendor Open Design into `brain`.
- Do not install Open Design under `brain/ai/skills/`.
- Do not copy Brain skills into Open Design as a new source of truth.
- Do not migrate Brain memory or Mind knowledge into Open Design.
- Do not replace the AI Model Selector at `localhost:4890`.
- Do not replace `/design`, `/web-design`, `/design-review`, or any other Brain design skill.
- Do not replace `brain/ai/policy/routing.md`.
- Use the registered `open-design` wrapper.
- Do not use `od` directly unless it is explicitly validated as Open Design. On macOS, `/usr/bin/od` already exists and is the system octal-dump utility, not Open Design.
- Do not configure Open Design MCP access to secrets, credentials, browser profiles, or private runtime state without a separate review.

## Canonical Ownership

| Concern | Owner |
|---------|-------|
| Design orchestration | Brain `/design` |
| Web implementation spec | Brain `/web-design` |
| Visual QA | Brain `/design-review` and `/impeccable` |
| Model/provider routing | AI Model Selector (`localhost:4890`, `ai-select`) |
| Shared memory | `~/.brain/memory/` |
| Personal/business knowledge | Mind repo |
| Visual dashboard/workbench | Open Design, if installed |

## Bridge Pattern

When the user asks for visual design iteration:

1. Start from the target project, not from Brain internals.
2. Read or create the canonical project artifacts:
   - `PRODUCT.md`
   - `DESIGN.md`
   - `brand-spec.md`
   - design spec or audit markdown
3. Use `/design` to decide the workflow and quality gates.
4. Use Open Design only for visual exploration, previews, prototypes, exports, or side-by-side comparison.
5. Write accepted decisions back to the target project's canonical markdown artifacts.
6. Keep final implementation and review in the existing Brain skill flow.

## AI Model Selector Hook

External adapters, scripts, or MCP flows must express task intent to the selector instead of hardcoding a provider:

```bash
ai-select --task design_visual_workbench
TOKENS=12000 ai-select --task design_spec_generation
TOKENS=6000 ai-select --task design_review
```

Recommended task semantics:

| Task type | Capability | Use |
|-----------|------------|-----|
| `design_visual_workbench` | `text/medium` | Interactive visual ideation, prompt expansion, prototype commentary |
| `design_spec_generation` | `text/medium` | Generate or revise implementation-ready design specs |
| `design_review` | `text/review` | Critique visual output, compare against `DESIGN.md`, find quality gaps |

These task types were registered locally in `~/.config/video-orchestrator/ai-task-types.json` on 2026-05-31. On another machine, register them before using the bridge. Do not bypass the selector.

## CLI / Agent Auto-Detection

Before driving agents from Open Design or from the Brain bridge, detect only installed commands:

```bash
for cmd in open-design claude codex gemini omp cursor code; do
  command -v "$cmd" >/dev/null 2>&1 && printf "%s\n" "$cmd"
done

if command -v od >/dev/null 2>&1 && [ "$(command -v od)" != "/usr/bin/od" ]; then
  od --help 2>&1 | grep -qi "open design" && printf "%s\n" "od"
fi
```

Role mapping:

| Command | Role |
|---------|------|
| `open-design` or validated `od` | Open Design visual workbench command, if installed |
| `claude` | Main long-context design/coding orchestrator |
| `codex` | Isolated critique, code review, alternate implementation pass |
| `gemini` | Large-context preprocessing and reference compression |
| `omp` | Optional standalone coding-agent experiment |
| `cursor`, `code` | Human-facing IDE entrypoints |

Agents should receive compact prompts pointing at the canonical project files. Do not copy the full Brain skill tree into any external tool.

## Installation Record

Installed outside Brain:

```bash
mkdir -p /Users/Office/Repos/nexu-io
git clone https://github.com/nexu-io/open-design /Users/Office/Repos/nexu-io/open-design
cd /Users/Office/Repos/nexu-io/open-design
PATH=/Users/Office/.nvm/versions/node/v24.12.0/bin:$PATH pnpm install
PATH=/Users/Office/.nvm/versions/node/v24.12.0/bin:$PATH pnpm --filter @open-design/daemon build
```

Registered through the Brain wrapper:

```bash
open-design --version
install-cli --name open-design --path /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/bin/open-design --description "Open Design optional external visual design workbench wrapper; separate IDE-like surface, not Brain router or memory source"
verify-cli-access open-design
```

The wrapper lives at:

```text
brain/operations/system-configs/bin/open-design
```

It pins Node 24 via `/Users/Office/.nvm/versions/node/v24.12.0/bin/node` and delegates lifecycle commands to upstream `pnpm tools-dev`.

## Universal Sync Check

After registration, run from Brain:

```bash
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

## Operating Rules

- Use Open Design when a visual dashboard materially improves design iteration.
- Skip it for straightforward specs, copy changes, simple audits, or terminal-only implementation.
- Treat Open Design output as draft design material until `/design-review` or `/impeccable` validates it.
- If Open Design and Brain disagree, Brain's canonical artifacts and routing policy win.
