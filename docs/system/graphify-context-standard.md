# Graphify Context Standard

**Status:** Active bounded semantic projection under accepted B8.5 policy
**Last updated:** 2026-08-12
**Scope:** Brain repo, terminal LLMs, IDE assistants, agent runners, and CLI workflows

## Purpose

Graphify is a non-authoritative semantic projection. It is not Brain's structural-navigation default.

Accepted roles:

1. **Codebase Memory MCP** — bounded structural navigation when fresh.
2. **Exact current source** — authority before edits, security/policy decisions, runtime/provider claims, or final factual claims.
3. **Graphify** — optional bounded semantic synthesis for approved Brain architecture documents only.

## Standard Retrieval Rule

```text
Structural architecture/symbol/route/caller/blast-radius question
  -> use fresh Codebase Memory MCP navigation when available
  -> identify likely files/symbols/relationships
  -> read exact current source
  -> patch or claim authority only after exact-source verification

CBM stale/unavailable/unknown
  -> bounded exact-source search/read

Known file or known symbol
  -> direct exact-source read
```

Graphify may narrow semantic context but never replaces exact-source authority.

## Semantic Graphify Contract

The only supported semantic entrypoint is:

```text
tools/graphify-semantic-event.mjs
```

Current boundaries are defined by `operations/specs/graphify-operational-profile.json`:

- Brain-only explicit semantic-document allowlist;
- no Mind semantic ingestion;
- code-only changes do not invoke a runner;
- unapproved changes do not invoke a runner;
- relevant approved document changes mark freshness stale;
- no default model runner;
- no automatic local model startup;
- repository mutation forbidden;
- generated output non-authoritative.

The typed scheduler registry retains Graphify as a policy-blocked,
event-driven entry; the daily 03:00 scheduler does not execute it. Use the
semantic event gate only through an explicitly admitted manual/event-driven
procedure. When no explicit runner is supplied, the gate records
freshness/receipts only.

## Legacy Structural Graphify

Structural Graphify generation is frozen. `tools/scripts/graphify-nightly.sh` is retained only as a fail-closed compatibility stub and must not be used for broad scans or graph regeneration.

Historical `graphify-out/` and `.graphify-out/` artifacts are stale-prone compatibility artifacts. They may be retained for integrity/history but are not current architecture truth.

## Consumer Contract

Any terminal LLM, IDE assistant, model selector consumer, or agent runner should:

1. use fresh CBM for structural navigation when useful;
2. read exact current source before edits or final claims;
3. fall back to bounded repository search/read when CBM is stale/unavailable/unknown;
4. treat Graphify and other generated projections as hints only;
5. never authorize writes, security decisions, runtime claims, or roadmap changes from Graphify output alone.

## Model Policy

Graphify has no default local or external text model. Brain does not own an always-on Ollama, MTPLX, Qwen, or equivalent local text service for Graphify.

If semantic regeneration is intentionally needed, a bounded runner must be supplied explicitly and remain within the operational profile caps.

## Disable and Safety

Use the configured kill switch:

```text
GRAPHIFY_SEMANTIC_DISABLED=1
```

Disabled execution is fail-closed and does not invoke a model runner.

The accepted structural/semantic split is intentionally simple:

```text
CBM = structural navigation
exact source = authority
Graphify = optional semantic projection
```
