# MTPLX + Qwen Integration — Retired Reference

**Status:** Retired
**Retired:** 2026-08-12
**Reason:** Brain no longer admits an always-on local text inference service for Graphify, coding, or general text routing.

## Current Policy

MTPLX/Qwen is not an active Brain runtime surface.

- `ollama-m4pro`, `ollama-m1`, and `mtplx-m4pro` are removed from the canonical Model Selector provider registry.
- The `qwen` launcher and custom MTPLX/Qwen-Aider skills are removed.
- Graphify structural generation is frozen; Codebase Memory MCP is the structural navigation layer and exact source remains authority.
- Graphify semantic synthesis is bounded, event-driven, Brain-only, non-authoritative, and has no default model runner.
- Bedrock-backed Claude is the primary managed text surface; Codex CLI is secondary.
- Private Mind classification is pinned to the approved Bedrock-only path and fails closed on provider/model drift.

The historical implementation used a local MTPLX service, Qwen model weights, and a LaunchAgent. Do not recreate that architecture from this runbook.

## Historical Record

For historical implementation details, use Git history, the dated dry-run report `operations/runbooks/mtplx-dry-run-2026-06-23.md`, and the decision log. Those records describe the retired system and are not current operational instructions.

## Current References

- `operations/specs/graphify-standard.md`
- `operations/runbooks/graphify-nightly.md`
- `docs/system/graphify-context-standard.md`
- `operations/system-configs/model-selector/config/ai-providers.json`
- `operations/runbooks/workstation-config-ownership.md`
