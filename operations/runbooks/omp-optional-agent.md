# Oh My Pi Optional Agent Surface

**Status:** Installed as optional standalone CLI  
**Command:** `omp`  
**Installed package:** `@oh-my-pi/pi-coding-agent`  
**Version verified:** `omp/15.6.0`  
**Install date:** 2026-05-30  

## Purpose

`omp` is installed as a separate terminal AI coding surface, similar in role to Cursor, Kiro, Antigravity, Claude Code, Codex, or Gemini CLI.

It is not part of the Brain platform architecture and does not replace any canonical Brain service.

## Hard Boundaries

- `omp` must not replace the AI Model Selector at `localhost:4890`.
- `omp` must not become the central provider/model router.
- `omp` must not replace Brain skills or the shared skill profile system.
- `omp` must not replace shared memory in `~/.brain/memory/`.
- `omp` must not replace `brain/ai/policy/routing.md`.
- `omp` must not migrate Brain or Mind memory into its own memory backend.
- `omp` must not become the default `Auto` runtime in launchers without a separate architecture decision.

## Allowed Use

Use `omp` for isolated manual experiments with a different coding-agent harness:

- LSP/DAP-aware coding experiments.
- Hashline/editing workflow evaluation.
- Structured subagent workflow comparison.
- RPC/SDK evaluation for future Brain Core or Obsidian control surfaces.
- Benchmarking against Claude Code, Codex, Gemini, Cursor, Kiro, and Antigravity.

## Configuration Position

`omp` may read existing project/user config formats such as `.claude`, `.codex`, and `.gemini` when its own discovery system supports that.

Do not copy or migrate Brain canonical configuration into `~/.omp` unless a future runbook explicitly requires it.

If `omp` needs local settings, keep them tool-local and document them here. Do not make `~/.omp` the source of truth for Brain behavior.

## Installed Entry Points

```bash
omp --version
command -v omp
ls -la ~/.local/bin/omp
```

Expected:

```text
omp/15.6.0
/Users/Office/.bun/bin/omp
~/.local/bin/omp -> /Users/Office/.bun/bin/omp
```

The registered stable entrypoint is `~/.local/bin/omp`, which points to the Bun global install at `/Users/Office/.bun/bin/omp`. Some shells may resolve `/Users/Office/.bun/bin/omp` first depending on PATH order; that is acceptable as long as the `~/.local/bin/omp` symlink exists for shared AI/IDE consumers.

## Runtime Prerequisite

`omp` requires Bun `>= 1.3.14`.

Verified:

```bash
bun --version
```

Expected:

```text
1.3.14
```

## Installation Record

Installed with:

```bash
bun install -g @oh-my-pi/pi-coding-agent
install-cli --name omp --path /Users/Office/.bun/bin/omp --description "Oh My Pi optional standalone terminal AI coding agent; separate IDE/agent surface, not Brain router or memory source"
```

Bun blocked several ML-related postinstall scripts during install. Leave them blocked unless a specific `omp` feature requires them and the package scripts have been reviewed.

## Verification

```bash
omp --version
verify-cli-access omp
node tools/scripts/sync-ai-skills.mjs --dry-run
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

The skill sync check is required by the universal capability installation policy even though `omp` itself is a CLI and no Brain skill was added.

## Future Evaluation Criteria

Before promoting any `omp` feature into Brain:

1. Identify the specific feature, not the whole harness.
2. Confirm it does not duplicate AI Model Selector, shared memory, or skill routing.
3. Write an implementation proposal under `operations/runbooks/` or `docs/system/`.
4. Record any accepted architecture decision in `operations/decision-log.md`.
