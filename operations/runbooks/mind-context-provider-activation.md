# Mind Context Provider Activation

**State:** activation-prepared; candidate disabled  
**Owner:** Brain runtime  
**Canonical integration branch:** `main`  
**Provider source lock:** `753a2257bc65a2e16bf9847d244690813a4bd1cb`

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
Codex project registration (disabled candidate)
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
  "providerRevision": "753a2257bc65a2e16bf9847d244690813a4bd1cb"
}
```

The file must be mode `0600`. Brain must not create it until Steve explicitly
approves activation after reviewing the candidate evidence.

## Freshness and indexing

The provider has no persistent index or watcher. Every health or retrieval call
re-reads the fixed allowed corpus, hashes the actual source bytes with SHA-256,
and returns `sourceHead`, `expectedMindHead`, `corpusSha256`, `indexedAt`, and
`indexingMode=read-through-no-persistent-index`. A changed file changes its
source hash and corpus digest on the next call. A changed Mind HEAD fails closed
with `source_revision_mismatch` until Brain reviews and repins the expected
commit. Tracked in-scope working-tree changes are reported, not hidden.

## Activation trigger

Activation requires all of the following:

1. The provider/admission/evidence commit is integrated into canonical Brain
   `main`, and all admitted artifact digests validate.
2. The disabled tracked Codex candidate is regenerated for the actual canonical
   Brain root and checked against the admitted source export.
3. Steve Westhoek explicitly approves `mind-context-read-only` activation and
   the approval file above is created owner-only with that exact approval.
4. In a separate activation commit, set the admission to `active-local`,
   generate the project-scoped client config with `enabled=true`, and do not add
   any tool or scope.
5. Restart/reconnect the selected client and capture initialize, tools/list,
   health, resolve, explain, mutation rejection, and source-drift evidence.
6. Only after those live checks pass may Mind update its three authorized agent
   entrypoints.

The current user request authorizes preparation but is not recorded as the
explicit activation approval required by step 3.

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
