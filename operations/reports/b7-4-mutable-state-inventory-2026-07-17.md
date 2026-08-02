# B7.4 Mutable State Inventory

**Date:** 2026-07-17
**Mode:** repository-only

## Result

Cataloged the current tracked-source, packaged-binary, mutable-state, generated-cache, runtime-state, and secrets-adjacent surfaces without moving or deleting anything.

## Summary

- tracked source: `projects/brain-core/src`
- packaged binary: `operations/system-configs/codex/computer-use`
- mutable local state: `operations/system-configs/codex/memories_1.sqlite`, `operations/system-configs/codex/app-server-control/app-server.log`, `operations/system-configs/codex/app-server-control/app-server-startup.lock`
- generated cache: `projects/brain-core/dist`, `operations/system-configs/codex/browser`, `runtime/local/graphify`, `runtime/local/mind-steward`
- runtime state: `operations/system-configs/codex/attachments`, `operations/system-configs/cursor/projects/empty-window/terminals`
- secrets-adjacent: `tools/firecrawl/logs/firecrawl.log`

## Recommended disposition

- keep source tracked
- keep binaries installed but unedited
- keep mutable state and runtime output outside source control
- keep caches ignored and regenerable
- treat logs as sensitive runtime surfaces

