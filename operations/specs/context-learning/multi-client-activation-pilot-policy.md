# Infinite Brain Multi-Client Activation Pilot Policy

**Status:** MRU0-P3.4 bounded read-only activation
**Clients:** Claude Code, Codex, Workbench
**Runtime boundary:** shared entry consumption only; no client configuration, provider calls, execution, mutation, automatic resume, or takeover

## Shared path

All three clients consume one entry projection:

`Client → Universal Brain Entry → Context Broker navigation → canonical Brain/Mind sources`

The entry ID, contract version, Brain revision, authority boundaries, freshness, conflicts, and progressive retrieval semantics are shared. Client profiles remain adapters and do not create memory or authority systems.

## Per-client activation

Each client receives bounded identity, authority, navigation, operating state, session continuity availability, freshness, and conflict state. A client-specific failure blocks that client without selecting a winner or changing another client's state.

## Continuity boundary

Claude-to-Codex, Codex-to-Workbench, and Workbench-to-Claude/Codex continuation are represented by references and confirmation requirements. Sessions are not automatically merged, resumed, closed, or overwritten. Conflicts remain visible and fail closed.

## Safety and rollback

The pilot keeps execution and mutation authority false, automatic resume/takeover false, and provider calls/writes at zero. Disable by rerunning with `enabled=false` and restoring each client's prior context path. No client configuration reversal is required.
