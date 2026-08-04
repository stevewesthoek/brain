# M2.4 Context Gateway Activation — 2026-08-04

**Status:** pass — active-local activation and disable/restore verified
**Canonical Brain branch:** `main`
**Provider source:** `51e9091c7374e0642f4fe076b895c184152dd516`
**Mind source:** `d64e8bd1fd3666758ce140b1c1d8fb147fb39e1f`
**Approval:** `M2.4-activation-2026-08-04-d64e8bd1-51e9091c`

## Outcome

Steve Westhoek explicitly approved activation on 2026-08-04. Brain retained the
Mind-owned `wiki/log.md` audit history in commit `d64e8bd1...`, repinned the
provider to that exact clean Mind HEAD, and activated the project-scoped Codex
registration. The active approval file is outside repositories, owner-only
mode `0600`, and bound to the exact provider revision, Mind commit, and sorted
nine-scope allowlist.

The provider remains an owner-local, shell-free, no-network stdio process. It
has no remote authentication dependency or credential relay. Its separate
activation authorization is not a provider credential and exposes no secret
value to callers.

## Client discovery and deployed identity

`codex mcp get mind-context` from the canonical Brain worktree reported:

- `enabled: true`;
- stdio command `/opt/homebrew/Cellar/node/25.9.0_1/bin/node`;
- fixed Brain provider entrypoint and working directory;
- masked environment bindings;
- 10-second startup and 30-second tool timeouts.

The real child process returned MCP protocol `2025-06-18`, server name
`mind-context`, provider version `1.0.0`, activation state
`active-local-approved`, and exactly these three read-only tools:

- `mind_context_health`
- `mind_context_resolve`
- `mind_context_explain`

An attempted `write_file` call was rejected with `tool_not_admitted`, and
health reported `mutationPathExposed=false`.

## Live health, scope, privacy, and freshness

| Check | Observed result |
|---|---|
| Health | healthy |
| Provider revision | `51e9091c7374e0642f4fe076b895c184152dd516` |
| Source HEAD / expected | both `d64e8bd1fd3666758ce140b1c1d8fb147fb39e1f` |
| In-scope working changes | 0 |
| Bounded corpus | 552 Markdown sources / 30,809,685 bytes |
| Corpus SHA-256 | `50766f88c6b03d171b749c56d61ac27ae22829c67cda71c7adfbfd480e308637` |
| Indexing | `read-through-no-persistent-index` |
| Persistent index or watcher | none |
| Caller root/scope override | false / false |
| Fixture-only | false |

The allowed scopes are exactly `faith`, `knowledge`, `organizations`,
`people`, `projects`, `resources`, `system`, `tasks`, and `wiki`. Discovery
excludes `.obsidian`, archives, history, runtime/generated/dependency paths,
and secret-marked paths before retrieval. Callers cannot supply a root, scope,
credential, external-call, or mutation-like argument.

Live resolve returned three citations with real source SHA-256 values and
provenance binding the provider revision, Mind HEAD, corpus digest, read-through
indexing mode, and request timestamp. Its state was
`repository=implemented`, `deployed=active-local`,
`observed=live-readback`, and `verified=runtime-verified`.

Live explain returned 3 of 552 ranked records with
`rankingTruncated=true`. The provider regression suite now proves the same
bounded behavior on a 602-source fixture, keeping the response below the
admitted 512 KiB protocol limit.

## Unavailable service and manual fallback

With `MIND_CONTEXT_CORE_DISABLED=1`, the real provider process reported
`healthy=false` and `coreAvailable=false`; resolve returned
`code=core_unavailable`. The fallback remained
`mode=manual-targeted-read` and `automaticFallback=false`. No alternate
provider, broader scope, background indexing, network call, or mutation was
attempted.

## Disable, rollback, and restore proof

Brain temporarily changed only the ignored project registration to
`enabled=false` and `required=false`. `codex mcp get mind-context` then reported
`mind-context (disabled)`, and no provider child remained. Brain then
temporarily withheld the approval file: direct startup exited `1` before MCP
initialization because the required approval path was absent.

The approval file was restored with mode `0600`, the active registration was
regenerated from the admitted registry, its generated-content check passed,
and final client discovery again reported `enabled: true`. Persistent disable
uses the same sequence plus admission state `paused`; rollback removes only the
active registration and approval, preserving provider source, tests, and
evidence.

## Validation

- `npm --prefix projects/mind-context test` — 71 passed, 0 failed.
- `npm --prefix projects/mind-context run check` — passed.
- provider admission source/runtime verification — 1 source verified, 1
  runtime verified, 0 incomplete.
- active project-registration generation and `--check` — passed.
- MCP initialize, tools/list, health, resolve, explain, unavailable, mutation
  rejection, disabled discovery, approval-withheld startup, and active restore
  — passed.

## Mind handoff

Brain's activation gates are satisfied. Mind may update only its authorized
agent entrypoints to prefer the Gateway when healthy and use canonical manual
targeted reads when it is unavailable. The Gateway is retrieval-only; Mind
content mutation remains outside the provider boundary.
