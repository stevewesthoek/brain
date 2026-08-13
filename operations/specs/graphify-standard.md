# Graphify Operating Standard

**Status:** Active bounded semantic synthesis; structural Graphify frozen
**Effective:** 2026-08-11
**Authority:** `operations/specs/graphify-operational-profile.json` and `operations/specs/graphify-transition-governance.json`

## Purpose

Graphify is a non-authoritative semantic projection layer for a small, explicit Brain documentation corpus. It is not Brain's structural navigation system and it must not become an always-on local-LLM workload.

Canonical retrieval roles:

1. **Codebase Memory MCP** — bounded structural navigation when fresh.
2. **Exact current source** — authority before edits, policy/security decisions, runtime/provider claims, or final factual claims.
3. **Graphify** — optional bounded semantic synthesis for approved Brain architecture documents only.

## Structural Graphify

Structural Graphify generation is frozen. Do not run broad repository extraction, phased code graph generation, nightly full scans, or automatic structural updates.

The legacy path `tools/scripts/graphify-nightly.sh` is retained only as a fail-closed compatibility stub and exits non-zero. It must not contain a default model, MTPLX/Ollama startup logic, or repository-wide scan behavior.

Any future structural reactivation requires a separate explicit owner decision and must not displace CBM or exact-source authority.

## Semantic Graphify

The only supported semantic entrypoint is:

```text
tools/graphify-semantic-event.mjs
```

The Office Nightly Scheduler invokes it as an event gate:

```text
tools/scripts/office-nightly-scheduler.sh
  -> node tools/graphify-semantic-event.mjs --mode=scheduler
```

When `GRAPHIFY_SEMANTIC_RUNNER` is supplied explicitly, the scheduler may pass that bounded runner to the event gate. Without an explicit runner, the event gate records freshness/receipts but does not invoke a model.

Manual regeneration requires:

- `--mode=manual`;
- an approved `--scope`;
- at least one `--changed-file`;
- an explicitly supplied bounded `--runner` when semantic model execution is desired.

## Scope

The canonical corpus is the explicit allowlist in `operations/specs/graphify-operational-profile.json`.

Current boundaries:

- repository: Brain only;
- Mind semantic scope: not approved;
- code-only changes: do not invoke a runner;
- unapproved document changes: do not invoke a runner;
- relevant approved document changes: mark semantic freshness stale;
- repository mutation: forbidden;
- generated output: non-authoritative;
- exact source remains authoritative.

## Resource and Model Policy

Graphify has no default local or external text-model runtime.

Brain does not own an always-on Ollama, MTPLX, Qwen, or other local text-LLM service for Graphify. Semantic generation is expected to be infrequent and operator-controlled. A future runner must be explicit, bounded by the operational profile, and independently admitted.

Current caps are defined in `operations/specs/graphify-operational-profile.json`, including maximum documents, bytes, estimated tokens, runtime, and output size.

## Scheduler Contract

The Office Nightly Scheduler is the single recurring Graphify scheduler surface. It may execute only the semantic event gate described above.

The scheduler must never:

- call `tools/scripts/graphify-nightly.sh` as a structural runner;
- start Ollama, MTPLX, Qwen, or another local text model;
- scan every repository under `/Users/Office/Repos`;
- ingest Mind;
- configure a default model runner;
- authorize writes from Graphify output.

## Disable and Rollback

Set the configured disable environment variable:

```text
GRAPHIFY_SEMANTIC_DISABLED=1
```

A disabled semantic event remains fail-closed: it may record state/receipt information but does not invoke a runner.

The structural legacy runner is already frozen and fail-closed, so rollback does not require restarting a local inference service.

## Consumption Rule

Treat Graphify output as a stale-prone semantic hint only. Before any edit or final factual claim, verify against exact current source.

See `docs/system/graphify-context-standard.md` and `operations/runbooks/graphify-nightly.md` for operational usage.
