# Graphify Executable Update Guide

**Status:** Current B8.5 compatibility guide

Graphify no longer has a Brain-managed MTPLX/Ollama execution dependency. Structural generation is frozen, and semantic generation is bounded, event-driven, and explicit-runner only.

## Supported Surface

Canonical entrypoint:

```text
tools/graphify-semantic-event.mjs
```

The scheduler registry retains Graphify as a policy-blocked/event-driven boundary; the daily Brain Scheduler does not execute it. Manual semantic evaluation requires an approved scope and changed files. A model runner is optional and must be supplied explicitly when semantic regeneration is intentionally desired.

## Package Script Compatibility

Legacy script IDs remain stable:

```bash
npm run graphify:brain
npm run graphify:mind
npm run graphify:brain:callflow
npm run graphify:mind:callflow
```

Behavior:

- `graphify:brain` runs the bounded Brain semantic event gate.
- `graphify:mind` exits fail-closed because Mind Graphify is not approved.
- both callflow scripts exit fail-closed because structural Graphify remains frozen.

Do not change these IDs merely to rename the policy transition; callers may depend on the stable contract.

## Updating Graphify Dependencies

If the upstream Graphify executable/library is updated in the future:

1. do not re-enable broad structural extraction as part of the upgrade;
2. do not add an MTPLX/Ollama/default local model dependency;
3. verify `operations/specs/graphify-operational-profile.json` and transition governance first;
4. run the B8.5 Graphify test suite;
5. verify code-only changes do not invoke a semantic runner;
6. verify Mind remains unapproved;
7. verify semantic runner invocation remains explicit-only;
8. verify generated output remains non-authoritative and cannot mutate Brain/Mind.

## Fail-Closed Legacy Entrypoints

`tools/scripts/graphify-nightly.sh` is intentionally retained as a compatibility stub and exits with code 78. It must not start MTPLX/Ollama, scan all repositories, or run structural generation.

The compatibility handlers for Mind and callflow package scripts also exit with code 78.

## Validation

Run the Graphify governance tests referenced by the repository validation workflow, including:

```text
tools/lib/b8-5-graphify-semantic.test.mjs
tools/validate-graphify-operational-profile.test.mjs
tools/validate-graphify-operational-profiles.test.mjs
operations/tests/graphify-hook-watch-disabled.test.mjs
tools/run-contained-mind-graphify.test.mjs
```

The canonical validator output should report:

```text
mode=event-driven-semantic-only structural=frozen mind=unapproved
```

## Historical Instructions

Old instructions mentioning MTPLX, Qwen 3.6, Ollama, localhost model endpoints, or broad `graphify extract`/`cluster-only` workflows are historical. Use Git history and dated reports if those details are needed for archaeology; do not reactivate them operationally.
