# Graphify Quick Reference

**Last updated:** 2026-08-12
**Status:** Live bounded semantic mode; structural Graphify frozen

## What Graphify Is Now

Graphify is an optional, non-authoritative semantic synthesis layer for a small allowlisted set of Brain architecture documents.

It is **not** the default structural code-navigation system.

Use:

- **Codebase Memory MCP** for bounded structural navigation when fresh;
- **exact current source** as authority;
- **Graphify semantic output** only as an optional contextual projection.

## What Is Frozen

Do not run broad Graphify repository extraction, phased nightly graph generation, or automatic model-backed full scans.

`tools/scripts/graphify-nightly.sh` is a fail-closed compatibility stub and exits non-zero by design.

## Canonical Entrypoint

```text
tools/graphify-semantic-event.mjs
```

The daily Brain Scheduler does not execute this entry. The registry retains
Graphify as a policy-blocked, event-driven boundary. No model runner is
configured by default.

## Explicit event-gate mode (not the daily scheduler)

```bash
node tools/graphify-semantic-event.mjs --mode=manual --scope=brain-architecture-docs --changed-file=docs/system/graphify-context-standard.md
```

Expected behavior:

- code-only changes: no runner invocation;
- unapproved document changes: no runner invocation;
- approved semantic-document changes: mark stale;
- no explicit runner: state/receipt update only;
- explicit runner: bounded semantic regeneration under profile caps.

## Manual Mode

Manual mode requires an approved scope and at least one changed file:

```bash
node tools/graphify-semantic-event.mjs \
  --mode=manual \
  --scope=brain-architecture-docs \
  --changed-file=docs/system/graphify-context-standard.md
```

Add an explicit `--runner=/absolute/path/to/approved-bounded-runner` only when semantic model execution is intentionally desired.

## Disable

```bash
GRAPHIFY_SEMANTIC_DISABLED=1 node tools/graphify-semantic-event.mjs --mode=manual --scope=brain-architecture-docs --changed-file=docs/system/graphify-context-standard.md
```

The disabled path is fail-closed.

## Hard Rules

- No default Ollama, MTPLX, Qwen, or other local text model.
- No automatic local model startup.
- No broad `/Users/Office/Repos` scanning.
- No Mind semantic ingestion.
- No Graphify-authorized writes.
- No final claim from Graphify output without exact-source verification.

## Files That Define Truth

```text
operations/specs/graphify-operational-profile.json
operations/specs/graphify-transition-governance.json
operations/specs/graphify-standard.md
docs/system/graphify-context-standard.md
tools/graphify-semantic-event.mjs
tools/lib/b8-5-graphify-semantic.mjs
```

## Structural Question Workflow

```text
structural question
  -> fresh CBM navigation when available
  -> exact source read
  -> edit/final claim only from exact source

CBM stale/unavailable/unknown
  -> bounded exact-source search/read
```

## Semantic Question Workflow

Use existing Graphify semantic output only when it materially helps interpret architecture context. Treat it as stale-prone and non-authoritative. If regeneration is needed, trigger the bounded event gate explicitly rather than reviving the retired phased workflow.
