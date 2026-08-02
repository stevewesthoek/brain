# B1.0a Guarded Operation Registration — 2026-07-14

**Status:** complete — guarded capability implementation and registration only.

## Scope

This change adds Codex-only MCP operations for the single approved workflow
`FwP5INe9qoo1OwGC`:

- `b1_0a_guarded_save_to_mind_update`
- `b1_0a_guarded_save_to_mind_rollback`

No tool was invoked against n8n. No credential, environment value, Mind file,
workflow, schedule, webhook, or external system was read or changed.

## Guard contract

The repository-owned server at
`tools/mcp/b1-0a-guarded-save-to-mind.mjs` enforces all of the following before
either operation can request a network write:

- an exact, operation-specific confirmation value;
- no caller-supplied keys besides confirmation;
- fixed workflow ID, candidate path, rollback path, and topology-manifest path;
- fixed `shell: false` child-process invocation and fixed argv;
- exact rollback-artifact SHA-256 and workflow-ID validation;
- controlled topology-plan validation before the wrapper call;
- local rollback-operation availability before an update can begin;
- one wrapper update invocation at most per tool call;
- bounded response metadata only, with no raw wrapper output.

The server inherits only the Workbench runtime credential abstraction at actual
execution time. It accepts no environment override and stores no credential
value or credential source in tracked configuration.

## Registration

`operations/system-configs/codex/config.toml` registers the local MCP server as
`b1_0a_guarded_save_to_mind`. `codex mcp list` recognizes it as enabled. The
central MCP registry and Codex instructions mark it Codex-only because its
confirmation and credential-abstraction boundary are specific to that runtime.

## Validation

```text
node --check tools/mcp/b1-0a-guarded-save-to-mind.mjs -> pass
node --test tools/mcp/b1-0a-guarded-save-to-mind.test.mjs -> 7 passed
node --test tools/n8n-save-to-mind-topology-plan.test.mjs \
  tools/n8n-save-to-mind-artifact-safety.test.mjs \
  tools/n8n-save-to-mind-freeze.test.mjs -> 25 passed
node operations/automations/n8n/validate-mind-inbox-paths.mjs -> pass
codex mcp list -> b1_0a_guarded_save_to_mind enabled
local MCP initialize/tools-list handshake -> pass; exactly two destructive tools
focused secret scan -> no findings
git diff --check -> pass
```

## B1.0a status

B1.0a remains incomplete. This task creates the guarded capability only; it
does not authorize or perform the subsequent live export, update, fixture, or
rollback verification lane. The implementation plan and capability-state model
were intentionally not promoted.
