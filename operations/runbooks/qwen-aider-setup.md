# Qwen + Aider Setup — Retired Reference

**Status:** Retired
**Retired:** 2026-08-12

The local Qwen/Aider coding path is no longer part of the Brain operating model.

Current policy:

- the `tools/scripts/qwen` launcher is removed;
- the unexported Qwen-Aider custom skill is removed;
- MTPLX and Ollama text providers are removed from canonical Model Selector truth;
- no Brain-managed always-on local text model is started for coding or Graphify;
- Bedrock-backed Claude is the primary managed text surface;
- Codex CLI is the secondary managed text surface;
- local model caches/apps are not deleted by this repository-maintenance tranche; host cleanup remains a separately approved step.

Do not reinstall MTPLX, recreate the `qwen` launcher, or configure Aider against the retired localhost MTPLX endpoint from this document.

For current routing and Graphify behavior, use:

- `operations/system-configs/model-selector/config/ai-providers.json`
- `projects/brain-core/docs/ai-model-selector-architecture.md`
- `operations/specs/graphify-standard.md`
- `operations/runbooks/graphify-nightly.md`

Historical details remain available in Git history and dated reports.
