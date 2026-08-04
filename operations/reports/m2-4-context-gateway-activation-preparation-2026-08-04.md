# M2.4 Context Gateway Activation Preparation — 2026-08-04

> Historical preparation record. Superseded by the approved activation evidence
> in `m2-4-context-gateway-activation-2026-08-04.md`.

**Status:** activation-prepared; actual activation blocked on explicit Steve Westhoek approval  
**Canonical integration target:** Brain `main`  
**Evidence branch:** `codex/mind-m7-m2-unblock`  
**Provider source:** `6f95613376b52e5b43cb532856a670deeccf7212`
**Mind source observed:** `06de527423e05d4208cdcf485be92a2d1028c46d`

## Prepared state

- Added a source- and digest-pinned `mind-context-for-brain` provider admission.
- Added a tracked project-scoped Codex discovery candidate with
  `enabled=false` and `required=false`.
- Added an owner-local, no-network, credential-free stdio server.
- Fixed the Mind root and allowed scopes in admission-owned environment.
- Enforced the exact three-tool allowlist inside the provider.
- Added an owner-only Steve approval-file gate bound to the provider revision,
  exact Mind commit, and complete allowed-scope list for non-preparation startup.
- Added a separate expiring, bound preparation approval gate; its one-time
  evidence file was removed immediately after the final preparation process.
- Documented trigger, disable, rollback, post-disable verification, and manual
  unavailable-service fallback.

## Live preparation-only evidence

The provider was launched as a short-lived stdio process against a clean local
clone of exact Mind commit `06de5274...`. It used a 30-minute preparation-only
approval, which was removed after the run. It was not installed in Codex or
Claude and no activation approval was created.

| Check | Observed result |
|---|---|
| Server identity | `mind-context` `1.0.0` |
| Provider revision | `6f95613376b52e5b43cb532856a670deeccf7212` |
| Activation state | `preparation-only` |
| Health | healthy |
| Source HEAD / expected | both `06de527423e05d4208cdcf485be92a2d1028c46d` |
| Bounded corpus | 552 Markdown sources / 30,793,901 bytes across 9 fixed scopes |
| Corpus SHA-256 | `915122ab9172559977d80198367b9cf5a0c26442da532fd7f888d8244a0d1137` |
| Indexing | `read-through-no-persistent-index` |
| Working changes in preparation clone | 0 |
| Tools | health, resolve, explain only |
| Mutation probe | rejected with `tool_not_admitted` |
| Mutation path exposed | false |
| Network | none |
| Credentials inspected/relayed | false / false |

Observed resolve readback returned a cited Mind source with its real SHA-256
hash and provenance binding provider revision, Mind HEAD, corpus digest,
indexing mode, and request timestamp. State was explicitly
`deployed=not-installed`, `observed=live-readback`, and
`verified=runtime-verified`; this short-lived preparation process is not
claimed as a client deployment or activated production.

## Freshness behavior

Tests prove that committed allowed Markdown bytes produce real source and corpus
hashes, while any tracked or untracked in-scope working change blocks retrieval
with `source_worktree_not_clean`. A HEAD mismatch rejects retrieval with
`source_revision_mismatch`.

The canonical Mind worktree currently has one tracked admitted-scope change,
`wiki/log.md`. Brain did not alter it. Therefore an activation pointed at the
canonical Mind root will correctly remain unhealthy until Steve resolves that
Mind-owned state or approves a different exact commit; the clean preparation
clone proves behavior at the admitted HEAD without reading dirty bytes.

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
- discovery does not read out-of-scope Markdown and fails closed at the admitted
  corpus, source-file, request, and response byte limits;
- raw unterminated stdio input is rejected while accumulating, before it can
  exceed the request cap;
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
