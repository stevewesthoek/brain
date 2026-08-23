# Infinite Brain Session Continuity Policy

**Status:** MRU0-P2.5.0-A contract and authority definition
**Version:** 1.0.0
**Scope:** provider-neutral session continuity semantics only
**Runtime status:** no reader, writer, adapter, migration, or automatic resume is authorized by this document

## Purpose

The LLM session is temporary. Brain state is persistent.

Session continuity allows a bounded task to be continued across replaceable environment adapters without copying the full conversation or making any environment the source of truth.

The continuity layer stores compact task state and references to canonical evidence. It does not become a second knowledge store.

The schema for this contract is:

`operations/specs/context-learning/session-continuity.v1.schema.json`

## Authority model

### Brain owns

Brain owns:

- session continuity semantics;
- state relationships;
- references to canonical Brain and Mind knowledge;
- freshness and conflict semantics;
- continuity validation rules;
- the distinction between context, session, knowledge, and execution.

Brain does not own the private conversation history of another environment.

### Environment adapters own

Environment adapters may maintain their own local lifecycle state:

- Claude adapter: Claude session lifecycle and local Claude runtime behavior;
- Codex adapter: Codex session lifecycle and local Codex runtime behavior;
- Workbench adapter: MCP/runtime execution state within its admitted authority boundary;
- future adapters: their own environment lifecycle and transport details.

Environment adapters are replaceable consumers and projections. They never become the canonical source of Brain session truth.

### Canonical knowledge remains external to the session record

Brain and Mind canonical sources remain authoritative for their respective domains. A session record may reference those sources, but must not copy their contents into continuity state.

## Continuity record

The provider-neutral record contains five logical areas.

### Identity

Identity binds the record to:

- schema version;
- session and initiative identifiers;
- repository, worktree, and branch;
- base revision and Brain revision;
- creation and update timestamps;
- environment history.

`session_id` identifies continuity state, not a chat transcript, model invocation, or provider session.

### Objective

Objective records:

- the goal;
- active initiative;
- current packet;
- bounded scope;
- completion state.

Completion state describes task progress. It does not authorize execution or imply acceptance.

### State

State records concise references for:

- completed work;
- pending work;
- blockers;
- decisions;
- assumptions;
- rejected paths.

Each item should be a compact summary with references to the authoritative source where one exists.

### Artifacts

Artifacts reference:

- changed files;
- commits;
- validation results;
- reports;
- acceptance evidence.

Artifact references must remain concise and source-addressable. The record does not embed complete diffs, logs, reports, or transcripts.

### Handoff

Handoff records:

- previous environment;
- current environment;
- optional next environment;
- continuation point;
- exact next action;
- mandatory confirmation requirement.

The next environment is a recommendation, not an authority assignment.

## What must not be stored

Session continuity records must not contain:

- full conversation transcripts;
- model names;
- provider names;
- reasoning labels;
- provider-specific settings;
- credentials, tokens, secrets, cookies, private keys, or raw environment values;
- execution permissions or approval grants;
- copied Brain or Mind knowledge;
- complete tool logs;
- unsupported private application database exports.

The record stores pointers, summaries, relationships, and evidence references—not duplicated truth.

## Context, session, knowledge, and execution boundaries

These concepts are distinct:

| Concept | Question | Authority |
|---|---|---|
| Context | What does Brain or Mind know that is relevant now? | Context Broker and canonical sources |
| Session | What task is currently happening, and where did it stop? | Session continuity record |
| Knowledge | Where is durable information stored? | Canonical Brain/Mind sources and approved evidence records |
| Execution | What actions are allowed? | User authorization, repository policy, and environment/tool boundaries |

A session record may describe an execution boundary or pending confirmation, but it cannot create or broaden that authority.

## Freshness and conflict rules

Continuity state is valid only in relation to its source and repository revisions.

Consumers must treat a record as requiring review when:

- the repository or worktree differs from the recorded identity;
- the recorded source revision is stale or unavailable;
- referenced files or reports no longer exist;
- validation evidence predates relevant changes;
- another session explicitly supersedes it;
- conflicting session state is detected;
- confidence is unknown.

Conflicts must be surfaced. They must not be silently resolved by choosing the newest text or the most recent environment.

## Resume protocol

The future operation “Continue where the previous agent stopped” must follow this order:

1. Locate candidate session state.
2. Verify repository, worktree, branch, and source identity.
3. Verify freshness and detect supersession or conflicts.
4. Load only the context referenced by the session.
5. Present the objective, completed work, pending work, blockers, decisions, changed files, validation evidence, and exact next action.
6. Require confirmation before any mutation, execution, provider call, credential access, or external side effect.
7. Record the resulting continuation state through a separately authorized mechanism.

No automatic takeover is permitted by this contract.

## Relationship to existing systems

### `.ai/current.md`

`.ai/current.md` remains the disposable short-term handoff projection generated by the existing handoff workflow. It is not replaced and is not promoted to canonical knowledge by this packet.

### `.ai/handoffs/`

`.ai/handoffs/` remains an optional milestone archive for important handoffs. It is not a complete session ledger.

### Decision logs

`.ai/decision-log.md` and `operations/decision-log.md` remain authoritative for their existing decision domains. Session decisions reference them; session continuity does not replace or rewrite them.

### Roadmaps and implementation plans

Roadmaps and implementation plans remain authoritative for initiative and packet status. A session may record the current packet and point to those documents, but cannot change roadmap status merely by recording progress.

### Reports and acceptance evidence

Reports and acceptance documents remain the evidence authority for validation and acceptance. A session stores references to them and may summarize their result.

### Git history and worktree state

Git remains authoritative for commits, revisions, branch identity, and the current diff. Session state may record observed Git references, but it cannot replace verification against the current repository.

### Context Broker

The Context Broker supplies bounded, cited Brain/Mind context. Session continuity supplies task state and continuation pointers. The broker does not own session progress, and session records do not become context authority.

## Sparsity and retention

The continuity layer must remain sparse:

- store summaries instead of transcripts;
- store references instead of copied knowledge;
- store relationships instead of repeated prose;
- preserve only decision-relevant validation evidence;
- allow disposable projections to be rebuilt;
- keep canonical knowledge in its existing authority source.

Session continuity is ephemeral orchestration state unless a separate policy explicitly promotes a particular decision, report, or operational lesson into a canonical source.

## Future implementation phases

This packet authorizes no implementation. Future work would require separate bounded authorization:

1. **Contract validation:** validate fixtures against the schema without reading or writing live session state.
2. **Read-only inventory:** compare `.ai/current.md`, archived handoffs, Git state, reports, decisions, and runtime evidence.
3. **Resume validator:** detect stale, conflicting, or mismatched session records.
4. **Compatibility projections:** project existing handoffs into the contract without replacing current files.
5. **Environment conformance:** add bounded Claude, Codex, Workbench, and future-adapter projections.
6. **Optional activation:** enable automatic resume discovery only after explicit approval, rollback planning, and acceptance evidence.

## Acceptance boundary

MRU0-P2.5.0-A is complete when:

- one provider-neutral session model exists;
- authority ownership is explicit;
- context, session, knowledge, and execution are separate;
- the record stores references rather than duplicated Brain/Mind truth;
- provider/model-specific details are excluded;
- Claude → Codex → Workbench continuation is conceptually supported;
- stale and conflicting state is not silently accepted;
- confirmation is required before mutation;
- no runtime behavior, client configuration, automatic resume, or session migration is introduced.
