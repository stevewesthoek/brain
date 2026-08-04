# M2.4 Context Gateway Activation Preparation — 2026-08-04

**Status:** activation-prepared; actual activation blocked on explicit Steve Westhoek approval  
**Canonical integration target:** Brain `main`  
**Evidence branch:** `codex/mind-m7-m2-unblock`  
**Provider source:** `753a2257bc65a2e16bf9847d244690813a4bd1cb`  
**Mind source observed:** `06de527423e05d4208cdcf485be92a2d1028c46d`

## Prepared state

- Added a source- and digest-pinned `mind-context-for-brain` provider admission.
- Added a tracked project-scoped Codex discovery candidate with
  `enabled=false` and `required=false`.
- Added an owner-local, no-network, credential-free stdio server.
- Fixed the Mind root and allowed scopes in admission-owned environment.
- Enforced the exact three-tool allowlist inside the provider.
- Added an owner-only, revision-bound Steve approval-file gate for any
  non-preparation startup.
- Documented trigger, disable, rollback, post-disable verification, and manual
  unavailable-service fallback.

## Live preparation-only evidence

The provider was launched directly as a short-lived stdio process with
`MIND_CONTEXT_PREPARATION_MODE=1`. It was not installed in Codex or Claude and
did not create an approval file.

| Check | Observed result |
|---|---|
| Server identity | `mind-context` `1.0.0` |
| Provider revision | `753a2257bc65a2e16bf9847d244690813a4bd1cb` |
| Activation state | `preparation-only` |
| Health | healthy |
| Source HEAD / expected | both `06de527423e05d4208cdcf485be92a2d1028c46d` |
| Bounded corpus | 552 Markdown sources across 9 fixed scopes |
| Corpus SHA-256 | `50766f88c6b03d171b749c56d61ac27ae22829c67cda71c7adfbfd480e308637` |
| Indexing | `read-through-no-persistent-index` |
| Tracked in-scope working changes reported | 1 |
| Tools | health, resolve, explain only |
| Mutation probe | rejected with `tool_not_admitted` |
| Mutation path exposed | false |
| Network | none |
| Credentials inspected/relayed | false / false |

Observed resolve readback returned three cited Mind sources with real SHA-256
hashes and provenance binding provider revision, Mind HEAD, corpus digest,
indexing mode, and request timestamp. State was explicitly
`deployed=preparation-only`, `observed=live-readback`, and
`verified=runtime-verified`; this is not claimed as activated production.

## Freshness behavior

Tests prove that changing an allowed Markdown file changes both its source hash
and the corpus digest on the next request. The live health response reported the
current Mind HEAD and did not hide the existing tracked in-scope change. A HEAD
mismatch rejects retrieval with `source_revision_mismatch`.

## Unavailable and fallback behavior

With `MIND_CONTEXT_CORE_DISABLED=1`, the same stdio provider reported
`healthy=false`, `coreAvailable=false`; resolve returned
`status=unavailable`, `code=core_unavailable`. The fallback remained
`manual-targeted-read`, `automaticFallback=false`. No alternate provider,
network call, broader scope, or mutation was attempted.

## Privacy and no-mutation proof

Provider tests and live tool discovery prove:

- callers cannot supply or override root, scopes, credentials, external calls,
  or mutation-like fields;
- `.obsidian`, archives, history, runtime/generated/dependency directories, and
  secret-marked paths are excluded;
- the provider exposes no write-capable tool or nested suboperation;
- an unknown write tool is rejected before dispatch;
- retrieved instructions remain untrusted data.

## Remaining activation gate

Actual activation has not occurred. The tracked client candidate is disabled,
the admission is `candidate`, no owner-only approval file exists, and no client
registration was installed. M2.4 remains blocked until:

1. this evidence is integrated into canonical Brain `main`;
2. Steve Westhoek explicitly approves `mind-context-read-only` activation;
3. Brain performs the separately recorded activation steps and captures
   enabled-client health/readback plus post-disable verification.

Mind must not edit its entrypoints before those gates pass.
