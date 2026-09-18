# Brain `repos` automatic launch fix evidence — 2026-09-18

## Status

Complete for the bounded launcher/usability goal. The prior production runtime
and StateStore were not changed.

Starting repository HEAD was `f2f8bf36 ops(mac): clear stale Moonlock Genieo
state`. The worktree was reconciled with the expected protected unrelated
changes already present in:

- `operations/accounts/credentials-index.md`
- `tools/firecrawl/logs/firecrawl.log`
- `operations/specs/mindcontrol-product-roadmap.md`
- `operations/specs/nevermind-release-pipeline-roadmap.md`

Those paths were not edited, staged, or committed.

## Root cause and fix

`tools/scripts/repos.sh` previously required `command -v brain-agent` after the
repository picker. The supported Brain installation has a verified
`brain-agent.js` inside its active runtime package, but that JavaScript CLI is
not globally linked onto `PATH`. Selecting a repository therefore failed before
Brain could start.

The new `tools/scripts/brain-cli-resolver.sh` is used by `repos.sh` and resolves
the CLI in this order:

1. absolute `BRAIN_AGENT_BIN` override;
2. the active installed runtime described by `install.json`, with its runtime
   manifest and package identity checked;
3. the Brain source checkout's built CLI, with a local `npm run build` only
   when the checkout has its local TypeScript dependency and the CLI is absent;
4. an executable `brain-agent` on `PATH` as compatibility fallback.

The installed runtime is preferred over a stale PATH binary. The selected
repository remains the child process working directory, including paths with
spaces. Brain is invoked as a Node JavaScript entrypoint, preserving the
existing `brain-agent run` and `--model` semantics.

Resolution fails closed with a bounded diagnostic when no CLI or compatible
Node runtime is available. The resolver does not install packages, use sudo,
probe providers, or mutate production state.

## Validation

The focused shell matrix covers the requested A–J behavior:

- PATH CLI fallback when no canonical candidate exists;
- installed runtime selection when `brain-agent` is absent from PATH;
- development built CLI without global linking;
- safe local auto-build when development `dist` is missing;
- fail-closed absence;
- repository paths containing spaces;
- Auto and explicit model argument preservation;
- a CLI location independent of the selected repository;
- stale/wrong PATH precedence behind the verified installed runtime;
- explicit managed override support.

Commands and results:

```text
bash tools/scripts/repos-brain-cli-resolution.test.sh
PASS repos Brain CLI resolution: 10 scenarios

bash tools/scripts/agent-mode-k1-3-runtime-surfaces.test.sh
agent-mode-k1-3-runtime-surfaces: PASS

bash -n tools/scripts/brain-cli-resolver.sh tools/scripts/repos.sh tools/scripts/repos-brain-cli-resolution.test.sh
PASS

git diff --check
PASS
```

The test matrix uses isolated temporary fixtures and makes no network calls.
The auto-build case uses a fake local npm executable and does not install
dependencies.

## Office host validation

At validation time, `command -v brain-agent` returned no PATH entry. With the
real supported Office runtime, including a restricted `PATH=/usr/bin:/bin`,
the diagnostic resolver selected:

```text
kind=installed runtime
node=/opt/homebrew/bin/node
cli=/Users/Office/Library/Application Support/Brain/agent-mode-rc6/releases/brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe/core/dist/bin/brain-agent.js
```

The resolved production CLI accepted `--help`, confirming the expected Brain
CLI identity without starting a task. Dry-run launches from the Brain checkout
preserved the selected working directory and produced `run` for Auto and
`run --model minimax-m2.5` for the explicit model case.

## Production safety

No launchd descriptor, release package, signing identity, StateStore, budget,
task, run, attempt, runtime, model, provider, network, or repository state was
changed. No production stop/start, promotion, rollback, or deployment was
performed. The existing installed runtime remains the selected canonical
production/local CLI source.

## Documentation and next action

The launcher behavior and diagnostic command are documented in
`operations/runbooks/agent-mode-runtime-surfaces.md`. Existing direct
`brain-agent` use remains unchanged. The next action is ordinary user smoke
validation: run `repos`, choose Auto and a repository, and confirm Brain opens
in that selected repository. No further foundation work is required for this
bug fix.
