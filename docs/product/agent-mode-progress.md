# Agent Mode Progress

## Authoritative maintenance handoff — 2026-08-14

The configuration/local-AI and two-host activation tranche is maintenance only.
Infinite Brain remains closed; do not reopen roadmap or feature work from this
handoff.

## Implemented state

- Office and MacBook canonical Brain checkouts contain the same activation line.
- Office application runtime roots are physical, machine-local directories;
  intentional narrow configuration entries are Git-managed.
- Codex keeps a physical `~/.codex` runtime root. Durable entries are symlinked;
  `config.toml` is an owner-only generated copy with the current account home
  rendered locally.
- Codex auth, sessions, thread index, databases, plugins, caches, and Computer
  Use bundles remain local-only.
- Office connectivity has exactly two repository routes: Thunderbolt preferred
  (`office-repos-tb`) and Tailscale fallback (`office-repos-ts`). The obsolete
  Office LAN route was removed from Git and MacBook Codex connection state.
- Brain-managed MTPLX/Ollama always-on text routes are retired. Bedrock is the
  primary managed text route and Codex CLI the secondary route.
- Private Mind classification is pinned to `claude-bedrock` and
  `us.anthropic.claude-sonnet-4-6`, with private/sensitive flags and no fallback.
- The private Mind request uses a unique mode-`0600` temporary request file;
  capture text is not present in process arguments and cleanup runs in `finally`.
- The active video analyzer uses Bedrock-primary/Codex-secondary routing and no
  local OpenAI-compatible text endpoint.
- Structural Graphify execution is retired. The bounded semantic event gate has
  no default model.
- The retired Mind decomposer remains a fail-closed compatibility stub.
- Mind's unrelated `.obsidian/**` and `kanban.md` working changes were preserved.
- The dirty Video Orchestrator feature worktree was preserved and is not part of
  this maintenance closeout.

## Activation evidence and remaining retention gate

The final activation run ID is `20260814T155610Z-26638`.

- Office receipt state is `8 OFFICE_CONNECTIVITY_PASS`.
- MacBook receipt state is `6 MACBOOK_CONFIG_ACTIVE`.
- The original MacBook application acceptance recorded Codex/Remote SSH as
  failed or declined.
- A later bounded follow-up repaired Codex Remote SSH to the two-route model and
  verified both SSH aliases, but it did not rewrite the original receipt as a
  fabricated phase-10 PASS.

Operational behavior is working, but the formal rollback-retention gate is not
closed. Retain the final Office and MacBook receipt directories and the old dirty
canonical Brain archive until:

1. manual Codex/Remote SSH acceptance is explicitly recorded;
2. matching final receipt closure is documented honestly;
3. the setup survives one normal reboot plus a representative application
   update, or 14 days elapse after formal acceptance, whichever is later; and
4. the active dirty Video Orchestrator worktree no longer depends on archive Git
   metadata.

Failed pre-mutation and rolled-back run copies are not part of this final
rollback set and may be removed after their exact paths and sizes are recorded.

## Restore model

Git restores intentional, reproducible, non-secret configuration. A rebuilt Mac
still requires normal sign-in or an encrypted external backup for SSH private
keys, AWS credentials, application auth, Codex/Claude sessions, local databases,
and other `LOCAL-ONLY` state. Those items must never be reconstructed from Git.

Use:

- `operations/runbooks/workstation-config-ownership.md`
- `operations/runbooks/codex-managed-runtime-root.md`
- `operations/runbooks/host-activation.md`
- `operations/scripts/brain-configs-link.sh`
- `operations/scripts/codex-home-managed-root.sh`

Application upgrades may change local generated/runtime state. Never replace a
whole runtime root with a symlink and never copy app-build hashes, marketplace
timestamps, caches, auth, or sessions into Git. Promote only reviewed durable
settings into the portable baseline.

## Resume rule

Before any further backup or worktree deletion, inspect current Git status,
receipt state, active worktrees, and the closeout report. Do not delete the final
rollback set or the Video Orchestrator worktree merely to reclaim space.
