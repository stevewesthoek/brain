# Host Activation Closeout — 2026-08-14

## Executive status

The Office/MacBook configuration migration is active and the live topology no
longer requires whole-directory IDE symlinks. Office's read-only planner reports
all five managed application roots as physical directories and
`migrationRequired: false`. SSH uses exactly two Office routes: Thunderbolt
(`office-repos-tb`) and Tailscale (`office-repos-ts`). The obsolete Office LAN
route is retired.

This is not authorization to delete the final rollback set. The activation run
`20260814T155610Z-26638` stopped at receipt state `8 OFFICE_CONNECTIVITY_PASS` on
Office and `6 MACBOOK_CONFIG_ACTIVE` on MacBook; later repairs restored the
two-route Codex SSH behavior, but Phase 9 application acceptance and Phase 10
receipt closure were not appended to that run. The final rollback set and the
pre-activation dirty Brain archive therefore remain retained under the runbook.

## Durable ownership model

| Surface | Durable ownership | Local ownership |
|---|---|---|
| `.claude`, `.cursor`, `.gemini`, `.kiro` | Narrow declared links/copies from Brain | Sessions, auth, caches, databases, plugins, and app state remain inside real runtime roots |
| `.codex` | Narrow links plus a physical mode-`0600` generated `config.toml` | Sessions, auth, SQLite state, plugins, caches, sockets, and app-derived TOML additions remain local |
| Git | Brain config included from a physical user root | Credentials and unrelated user settings remain local |
| SSH | Brain config included from a physical mode-`0600` user root | Private keys and known-host state remain local |

Codex generation renders the current home directory and enforces the managed
TOML subset. The complete `[desktop]` tree, including nested `[desktop.*]`
tables, is deliberately a restore default with app-local runtime authority;
additional app-derived keys/sections are also permitted. Guarded repair carries
forward the existing desktop tree, marketplace, and model-availability tables
and preserves the complete prior physical config in its timestamped backup.
This keeps normal application upgrades from producing false drift without
claiming that every UI preference is continuously Git-enforced.

## Restore and reinstall contract

1. Clone Brain at the accepted commit into `~/Repos/stevewesthoek/brain`.
2. Install the applications and complete their normal account/authentication
   flows. Secrets and session databases are intentionally absent from Git.
3. Run the read-only workstation planner and validators.
4. Use the guarded runtime-root/config tooling only after creating a verified
   owner-only backup and closing the owning application.
5. Re-establish the two SSH routes and accept fresh direct and alias checks.
6. Validate sessions, skills, MCPs, plugins, and representative applications
   before pruning any rollback material.

Application reinstall/upgrade resilience comes from keeping runtime roots real
and local while Git owns only intentional non-secret configuration. A CLI or app
may still change its configuration contract; such a change must be reviewed and
validated before updating the managed baseline.

## Managed AI closeout

- Brain-managed MTPLX/Ollama always-on text routes are retired.
- Active text routing is Bedrock-primary and Codex-secondary, bounded to those
  providers through the AI Model Selector.
- Private Mind classification is pinned to
  `claude-bedrock/us.anthropic.claude-sonnet-4-6`, with `private=true`,
  `sensitive=true`, and `fallback_policy=none`.
- Private Bedrock request content is stored only in unique owner-only temporary
  JSON and never in process arguments; cleanup occurs on success, failure, and
  timeout.
- Video Analyzer and active TypeScript consumers use provider-aware managed
  execution rather than an Ollama-style `/chat/completions` assumption.
- Graphify structural execution remains retired; semantic synthesis is bounded,
  event-driven, non-authoritative, and has no default local model.

## Verification evidence

Runnable repository checks used for this closeout include:

- AI Model Selector policy tests;
- Codex managed-root migration/repair/upgrade tests;
- workstation ownership and local-text policy validators;
- Video Analyzer privacy, cleanup, response-shape, and collision tests;
- compiled Mind Steward classifier privacy tests;
- Graphify and scheduler suites;
- retired decomposer tests;
- host-activation fixture suite;
- shell, Python, JSON, secret-pattern, and Git whitespace checks;
- focused NodeNext TypeScript compilation and emit using the existing workspace
  TypeScript runtime, including the `.mjs` command/provider runtime modules and
  both active callers, plus five dependency-free managed-provider behavioral
  tests covering success, nonzero exit, TERM-to-KILL timeout, output limits,
  argv privacy, mode-`0600` files, cleanup, and failure propagation;
- read-only workstation migration planner.

The package-local Brain Core and full Mind builds remain dependency-blocked by
absent project `node_modules`; no dependency was installed, copied, or linked.
The two full Mind CLI tests requiring
`projects/mind-steward/node_modules/.bin/tsx` remain dependency-blocked by the
intentional absence of package dependencies. All other compiled Mind tests are
runnable.

## Retention and cleanup

Must retain:

- Office final receipt/rollback set:
  `/Users/Office/.brain-host-activation/20260814T155610Z-26638`;
- MacBook final receipt/rollback set:
  `/Users/Steve/.brain-host-activation/20260814T155610Z-26638`;
- Office pre-activation dirty Brain archive:
  `/Users/Office/Repos/stevewesthoek/brain-host-activation-archives/20260814T155610Z-26638/brain-before-activation`;
- the active dirty Video Orchestrator worktree and all Mind working-tree changes.

The final rollback set may be pruned only after it survives one normal reboot
and one representative application update, or 14 days, whichever is later, and
after the remaining manual application acceptance checks are recorded. The old
dirty canonical Brain archive additionally requires a diff/untracked salvage
audit and recoverable bundle/archive before deletion.

Older failed/partial activation-run directories may be removed separately only
after their state is verified as superseded by the independently verified final
rollback set and an exact deletion manifest is recorded. Cleanup must never
touch the final run, the dirty Brain archive, active Video Orchestrator work, or
Mind dirt.

## Git publication and branch cleanup

Publication and cleanup results are recorded here only after the corresponding
non-force Git operations and final clean-status checks complete. Active feature
work is not maintenance and must not be merged or deleted as part of this
closeout.
