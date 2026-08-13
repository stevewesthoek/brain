# Agent Mode Progress

## Current goal

Close the 2026-08-12 configuration/local-AI maintenance tranche in the repository only: retire Brain-managed always-on local text inference, align Graphify with the accepted bounded semantic model, make private Mind classification Bedrock-only and fail-closed, and establish safe Git/runtime workstation configuration ownership without mutating live `/Users/Office` HOME configuration.

**Infinite Brain roadmap is closed and is not the active workstream.** Do not revive B8.1 authorization/materialization from the superseded hand-off.

## Current state — 2026-08-13

- Source: `brain-next`
- Branch: `maintenance/config-local-ai-20260812`
- HEAD: `d698161c1f2edc9a74b0f3031eb943ed3004d695` (`fix(brain-core): sync package lock bin entries`)
- Worktree: intentionally dirty with one maintenance batch; no commit has been created yet.
- Live Office/MacBook configuration: unchanged by this tranche.
- Host migration policy: plan-only; `liveMutationAuthorized=false`.

## Maintenance changes now present

### Local text inference retirement

- Removed canonical Model Selector providers `ollama-m4pro`, `ollama-m1`, and `mtplx-m4pro`.
- Bedrock-backed Claude is the primary Brain-managed text surface; Codex CLI is secondary.
- Removed the retired `tools/scripts/qwen` launcher and the obsolete MTPLX/Qwen-Aider custom skills.
- Deleted tracked `operations/system-configs/launchagents/com.office.mtplx.plist` so Brain no longer declares an always-on MTPLX service.
- Retired Mind project decomposition remains a fail-closed compatibility no-op and does not regain mutation authority.

### Graphify alignment

- Structural Graphify generation is frozen.
- `tools/scripts/graphify-nightly.sh` is now a fail-closed compatibility stub.
- Scheduler Graphify behavior is the bounded semantic event gate only.
- No default local or external model runner is configured and no local model server is auto-started.
- Codebase Memory MCP is the preferred structural navigation layer when fresh; exact current source remains authoritative.
- Mind is not approved for Graphify semantic ingestion.

### Private Mind classification

- Mind capture classification is pinned to provider `claude-bedrock` and model `us.anthropic.claude-sonnet-4-6`.
- Selector calls mark the task private/sensitive, allow only that provider/model, and set no fallback.
- Bedrock CLI requests use a unique temporary JSON request file with mode `0600` so private Mind text is not exposed in process arguments.
- Temporary request files/directories are removed on success, failure, and timeout.
- Selector/provider/model drift fails closed before Converse execution.

### Workstation configuration ownership

- Canonical ownership modes are `SYMLINK`, `GENERATED-COPY`, `INCLUDE`, and `LOCAL-ONLY`.
- Mutable Claude/Cursor/Gemini/Kiro/Codex runtime roots must remain physical local directories.
- Codex `config.toml` is a physical mode-`0600` generated copy while the short physical `~/.codex` runtime root preserves Remote SSH socket compatibility.
- Git and SSH root configs migrate toward physical `INCLUDE` roots.
- Office/MacBook SSH policy is Thunderbolt-first with fixed Tailscale fallback; DHCP Wi-Fi/LAN addresses are noncanonical.
- OpenSSH first-value-wins ordering is handled by placing each conditional `Match` override before its fallback `Host` block.
- Canonical aliases: `MacBook`, `macbook`, `office`.

## Latest Codex work reviewed

Codex completed only the two former hard gates without touching live configuration:

1. Reordered and completed `operations/system-configs/ssh/config` so MacBook and Office Thunderbolt `Match` overrides precede their Tailscale fallback `Host` blocks.
2. Deleted `operations/system-configs/launchagents/com.office.mtplx.plist`.

Codex reported both policy validators and `git diff --check` green after those changes. Its earlier maintenance validation also reported Model Selector 36/36, Graphify 24/24, Scheduler 5/5, retired decomposer 2/2, focused Mind classifier 11/11, local-text-policy tests 4/4, and secret/egress/syntax/JSON checks green. The full Mind suite remained 64/66 because `node_modules/.bin/tsx` is missing locally; dependencies were not installed or symlinked.

## Additional Workbench review/fix — 2026-08-13

Workbench found a malformed final assertion block in `operations/scripts/tests/codex-home-managed-root.test.sh` that the prior shell-syntax summary had not caught. The damaged multiline `grep` assertions were repaired to fixed-string checks without changing test intent.

Independent validation after that repair:

- `npm run test:codex-managed-root` — pass; 23 checks.
- `npm run validate:workstation-config` — pass.
- `npm run validate:local-text-policy` — pass.
- `npm run validate:diff-check` — pass.

## Security review — 2026-08-13

- Broad high-risk scanning produced reviewed false positives from historical documentation, negative secret-leak assertions, Unix-socket fixture code, existing selector HTTP calls, and the intentionally bounded Mind Bedrock `execFile` path.
- `forbidden_secret_material` scanning is green across all present changed files after excluding only `projects/brain-core/src/tests/routes.test.ts`; that file's scanner hits are pre-existing negative assertions such as `TOKEN=` / `SECRET=` / `PASSWORD=` checks.
- Exact diff verification shows this maintenance changes `routes.test.ts` only at the model-route assertion near line 330, not at any scanner-reported secret-test line.

## Remaining repository closeout

Final scoped diff/status inspection is clean and no unrelated path entered the batch.

The remaining repository action is a single maintenance commit with no push. Workbench cannot perform that commit because its source write policy rejects staging at least `operations/system-configs/launchagents/com.office.mtplx.plist` with `PATH_NOT_ALLOWED`; the blocked staging attempt was atomic and staged nothing.

Use Codex or another explicitly authorized local Git executor to:

1. verify branch `maintenance/config-local-ai-20260812` and HEAD `d698161c1f2edc9a74b0f3031eb943ed3004d695` before staging;
2. rerun `npm run test:codex-managed-root`, `npm run validate:workstation-config`, `npm run validate:local-text-policy`, and `npm run validate:diff-check`;
3. inspect `git status --short` and the scoped diff;
4. stage only the existing maintenance dirty set, including this hand-off and the Workbench test repair;
5. commit once with a maintenance-scoped message;
6. do not push and do not mutate live `/Users/Office` configuration.

## Separate future host migration — not authorized by this repository closeout

Live Office/MacBook migration remains a distinct, receipt-backed execution pass. Do not perform it implicitly.

When explicitly authorized, follow `operations/runbooks/workstation-config-ownership.md` gates in order:

1. read-only baseline, including `ssh -G MacBook`, `ssh -G macbook`, and `ssh -G office`;
2. application quiescence for the specific runtime root being migrated;
3. lossless local snapshot and rollback receipt without exposing secrets;
4. atomic root conversion with only declared narrow links/generated copies/includes;
5. continuity tests for sessions/auth/settings plus Office↔MacBook SSH and Codex Remote SSH behavior;
6. rollback immediately on any continuity failure; accept only after all checks pass.

Only after accepted host migration may old repo-side runtime residue or local model caches/apps be reviewed for cleanup, and that cleanup is another explicit step.
