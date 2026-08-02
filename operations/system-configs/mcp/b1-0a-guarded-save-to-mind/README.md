# B1.0a Guarded Save-to-Mind MCP

**Status:** disabled compatibility source. Retained for historical evidence and
tests; not approved as the canonical Brain bridge or an active mutation path.

The Brain-native replacement is the admitted, provider-owned Workbench MCP
bridge described in `../MCP-PROVIDER-ADMISSION-STANDARD.md` and
`../workbench/README.md`. Do not re-enable this server without a new Brain
architecture decision and fresh conformance evidence.

**Scope:** Codex-only, confirmation-required operations for the single n8n
workflow `FwP5INe9qoo1OwGC`.

## Registered tools

- `b1_0a_guarded_save_to_mind_update`
- `b1_0a_guarded_save_to_mind_rollback`

Both tools accept only their exact confirmation literal. They do not accept a
workflow ID, repository path, environment override, activation/schedule change,
webhook change, credential, setting, tag, sharing value, or node change from a
caller.

The server uses fixed `shell: false` invocations only. Before either operation,
it validates the exact approved rollback artifact and runs the controlled
topology validator. It returns bounded result metadata and never returns raw
wrapper output, workflow JSON, credential values, or credential sources.

## Credential boundary

No credential value or credential source is stored in this configuration or
passed as a tool argument. At execution time only, the existing Workbench n8n
credential abstraction must inject the wrapper's runtime configuration into the
MCP server process. If it is unavailable, the wrapper fails closed before a
network write.

## Registration

The historical Codex block remains in
`operations/system-configs/codex/config.toml` with `enabled = false`. Its source
is not deleted. Workbench now owns the authenticated execution boundary while
Brain owns admission and exact B1.0a scope.

## Validation

```bash
node --test tools/mcp/b1-0a-guarded-save-to-mind.test.mjs
```

This test suite never invokes n8n, the wrapper, credentials, or Mind. It uses
an injected process runner and checks confirmation, fixed argv, `shell: false`,
exact-scope rejection, topology/hash gates, bounded output, and rollback
availability before update.
