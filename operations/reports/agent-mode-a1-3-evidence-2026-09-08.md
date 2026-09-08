# Agent Mode A1.3 evidence — 2026-09-08

## Result

**A1.3 provider-neutral launcher migration: PASS.** The repository picker and
session picker no longer present or launch the retired Qwen local coding
surface, and they no longer force Claude Code's `haiku` model. Claude launch
paths source the configured Claude environment and defer model choice to the
configured runtime default; Codex remains a separate subscription-backed
surface.

## Validation

- `bash -n tools/scripts/repos.sh tools/scripts/sessions.sh` — pass.
- Bounded source scan — no Qwen, Haiku, generic provider ID, or `--model`
  assumptions remain in either launcher.
- Existing Brain Core, model-selector, registry, and policy suites remain
  green after the migration.

No session was resumed, process was launched, host state was changed, or
provider was contacted.
