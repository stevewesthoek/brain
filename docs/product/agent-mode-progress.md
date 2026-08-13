# Agent Mode Progress

## Current goal

Finish Host Activation blocker remediation for the closed Brain + Mind workstation project. This is closeout maintenance only: preserve the completed configuration/local-AI tranche, integrate the remaining release ancestry, establish verified Office/MacBook prerequisites, and prepare the repository-side Mind Context repin.

**Infinite Brain remains closed.** Do not start a new roadmap or broaden this work into feature development.

## Current state — 2026-08-13

- Completed maintenance source: `maintenance/config-local-ai-20260812` at `40a879a2e4f75405059b8edc381a1fd96bae05a8`.
- Integration worktree: `/Users/Office/Repos/stevewesthoek/brain-host-activation`.
- Integration branch: `maintenance/host-activation-integration-20260813`.
- Ancestry-preserving merge baseline: `726b4f054f6bf1e7a503adaf4e27995441610d44`.
- Final integration HEAD: the clean closeout commit containing this handoff; use `git rev-parse HEAD` in this worktree as the authoritative hash.
- Canonical Office checkout `/Users/Office/Repos/stevewesthoek/brain`: unchanged and still intentionally dirty on `release/brain-stabilization-v1`.
- Mind checkout: unchanged by this task. Its committed HEAD advanced concurrently to `c3dcefdd808501a7ead7ffc4671eb5ef3822c268`, adding only `inbox/failed/2026-08-13-quick-capture.md` outside the admitted provider scopes; its working changes remain only `.obsidian/**` and `kanban.md`.
- Live Office/MacBook runtime-root migration: not performed.

## Completed repository maintenance

Commit `40a879a2e4f75405059b8edc381a1fd96bae05a8` completed the 2026-08-12/13 maintenance tranche:

- retired Brain-managed MTPLX/Ollama always-on local text routes and obsolete Qwen/MTPLX launcher material;
- made Bedrock-backed Claude primary and Codex secondary for managed text routing;
- kept private Mind classification pinned to `claude-bedrock` / `us.anthropic.claude-sonnet-4-6`, private and sensitive, with no fallback;
- moved private Bedrock requests into unique mode-`0600` temporary JSON files removed in `finally`;
- retired structural Graphify execution while preserving the bounded semantic event gate;
- retained the retired Mind decomposer as a fail-closed compatibility stub;
- established runtime-safe workstation ownership policy and tooling;
- hardened the physical Codex runtime root/generated-copy design;
- added Thunderbolt-first, fixed-Tailscale-fallback SSH repository policy;
- deleted the Brain-managed MTPLX LaunchAgent declaration;
- repaired and passed the 23-check Codex managed-root regression suite.

## Host Activation integration

The integration branch preserves release ancestry through a normal merge. Release-only B8.1 evidence and implementation files were retained where unique; add/add conflicts were resolved in favor of the newer maintenance/P8 versions already present on the maintenance line.

Portable current canonical configuration was reconciled without copying application runtime state:

- Claude keeps intentional model selection `opus`.
- Codex keeps current supported model, ChatGPT application/node-repl integration, Computer Use support, required plugins, notification, trusted executable paths, and portable preferences.
- Generated marketplace refresh timestamps, temporary marketplace state, caches, and ephemeral project history were not imported.
- The credentials index receives only the non-secret Workbench transport location metadata.
- The ProChat media-storage provisioning/verification tooling is retained as reproducible repository infrastructure.

## Brain–Mind bridge preparation

Repository templates, project registration, admission truth, tests, and activation documentation now prepare for:

- current Mind HEAD `c3dcefdd808501a7ead7ffc4671eb5ef3822c268`;
- provider source under `/Users/Office/Repos/stevewesthoek/brain`, never `brain-next`;
- read-only `health`, `resolve`, and `explain` tools only;
- no mutation path and no automatic fallback.

The live owner-only approval and live Claude/Codex MCP registrations remain on their previous state. They must be repinned only after the integration candidate becomes canonical `/brain`; the provider is expected to fail closed until source, approval, and registrations agree.

## Remaining live gates

No live root migration is authorized by this handoff. A separately authorized Host Activation pass must still:

1. close Claude, Cursor, Gemini, Kiro, Codex/ChatGPT, Ghostty, and any other process using the roots being migrated;
2. preserve lossless owner-only snapshots and a rollback receipt;
3. replace the canonical `/brain` checkout only through the approved archival/cutover procedure;
4. migrate application runtime roots and Git/SSH ownership one bounded root at a time;
5. repin the live Mind approval and MCP client registrations only after canonical source cutover;
6. run fresh Save-to-Mind readback/acceptance without invoking a write webhook;
7. prove sessions, auth, settings, SSH, Remote SSH sockets, and bridge health before acceptance;
8. roll back immediately on any continuity failure.

Do not push the integration branch or perform any migration implicitly.
