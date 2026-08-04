# Mind Context Provider Activation

**State:** active-local; activation and disable/restore verification passed
**Owner:** Brain runtime  
**Canonical integration branch:** `main`  
**Provider source lock:** `51e9091c7374e0642f4fe076b895c184152dd516`
**Mind source lock:** `08b2d1a7a4f7bc4b447350ee32be7b6da5e26b8e`

## Boundary

The provider is a project-scoped stdio adapter over the existing Context
Gateway core. It fixes the Mind root and allowed scopes at process launch and
exposes exactly three read-only tools:

- `mind_context_health`
- `mind_context_resolve`
- `mind_context_explain`

It exposes no write, apply, index, refresh, shell, arbitrary-path, credential,
network, or mutation tool. Retrieval text remains untrusted data.

```text
Codex project registration (active-local)
  -> fixed Node entrypoint at admitted Brain revision
  -> fixed Mind root + fixed nine-scope allowlist
  -> read-through Markdown discovery and SHA-256 hashing
  -> bounded context pack with citations and provenance

Unavailable provider
  -> typed unavailable result
  -> manual targeted reads through canonical Mind entrypoints
  -> no automatic alternate provider and no scope broadening
```

## Authentication and secrets

The transport is owner-local stdio, launched without a shell or network. Its
authentication mode is `none` because it has no remote listener and no
downstream authenticated service. The OS user boundary owns the process and
Mind root. The provider reads no credential file, accepts no credential or raw
secret argument, performs no relay, and excludes environment-, credential-,
secret-, and backup-marked paths.

Activation authorization is a separate control, not a provider credential.
Outside preparation mode, startup requires an owner-only regular JSON file at
`/Users/Office/.brain/approvals/mind-context-read-only.json` containing:

```json
{
  "approved": true,
  "approvedBy": "Steve Westhoek",
  "approvedAt": "<ISO-8601 timestamp>",
  "approvalId": "<unique approval id>",
  "scope": "mind-context-read-only",
  "providerRevision": "51e9091c7374e0642f4fe076b895c184152dd516",
  "mindCommit": "08b2d1a7a4f7bc4b447350ee32be7b6da5e26b8e",
  "allowedScopes": ["faith", "knowledge", "organizations", "people", "projects", "resources", "system", "tasks", "wiki"]
}
```

The file must be mode `0600`. Its timestamp and ID must be valid, and its
provider revision, Mind commit, and complete sorted scope list must match the
candidate exactly. Brain created it only after Steve explicitly approved
activation, and keeps it outside repositories with owner-only permissions.

Preparation is separately approval-gated. A preparation approval uses scope
`mind-context-preparation`, binds the same provider revision, Mind commit, and
scope list, and adds an `expiresAt` no more than one hour in the future. Remove
that owner-only file immediately after the bounded preparation process. Setting
`MIND_CONTEXT_PREPARATION_MODE=1` without it fails closed.

## Freshness and indexing

The provider has no persistent index or watcher. Every health or retrieval call
re-reads the fixed allowed corpus, hashes the actual source bytes with SHA-256,
and returns `sourceHead`, `expectedMindHead`, `corpusSha256`, `indexedAt`, and
`indexingMode=read-through-no-persistent-index`. A changed file changes its
source hash and corpus digest on the next call. A changed Mind HEAD fails closed
with `source_revision_mismatch` until Brain reviews and repins the expected
commit. Tracked in-scope working-tree changes are reported, not hidden.
Tracked or untracked changes in admitted scopes make health unhealthy and make
resolve/explain fail with `source_worktree_not_clean`; retrieval never mixes a
commit-bound approval with uncommitted bytes.
Discovery reads only admitted scopes and enforces 2,000-source, 2 MiB-per-file,
and 64 MiB-corpus caps before retrieval; stdio requests and responses are also
bounded by the admission's 64 KiB and 512 KiB limits.

## Activation trigger

Activation requires all of the following:

1. The provider/admission/evidence commit is integrated into canonical Brain
   `main`, and all admitted artifact digests validate.
2. The disabled tracked Codex candidate is regenerated for the actual canonical
   Brain runtime root; both the source export and the rendered runtime artifacts
   must match their admitted digests.
3. Steve Westhoek explicitly approves `mind-context-read-only` activation and
   the approval file above is created owner-only with that exact approval.
   The canonical Mind worktree must also be clean in all admitted scopes.
4. In a separate activation commit, set the admission to `active-local`,
   generate the project-scoped client config with `enabled=true`, and do not add
   any tool or scope.
5. Restart/reconnect the selected client and capture initialize, tools/list,
   health, resolve, explain, mutation rejection, and source-drift evidence.
6. Only after those live checks pass may Mind update its three authorized agent
   entrypoints.

Steve Westhoek supplied the explicit activation approval on 2026-08-04. Brain
recorded it as `M2.4-activation-2026-08-04-08b2d1a7-51e9091c` after the
authorized Mind entrypoint closure and completed
enabled-client, live-readback, unavailable-service, mutation-rejection, and
disable/restore checks. See
`operations/reports/m2-4-context-gateway-activation-2026-08-04.md`.

## Disable and rollback

Immediate disable:

1. Set the project registration `enabled=false` or remove the generated project
   registration.
2. Set `MIND_CONTEXT_CORE_DISABLED=1` for any diagnostic process and terminate
   the client-launched stdio child by reconnecting the client.
3. Set the admission to `paused` if the disable will persist.
4. Remove the owner-only activation approval file; preserve activation and
   disable receipts.

Rollback the activation commit only; keep the provider source, candidate
admission history, tests, and evidence. Do not alter Mind content and do not
replace the Gateway with a broader provider.

Post-disable verification:

- client discovery shows no enabled `mind-context` server;
- `tools/list` contains no Gateway tools;
- attempted Gateway retrieval is unavailable, never successful or ambiguous;
- the documented fallback is manual targeted retrieval through Mind's canonical
  startup files;
- no background provider, watcher, index, listener, or mutation process remains.
