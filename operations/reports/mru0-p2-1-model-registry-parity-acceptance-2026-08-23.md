# MRU0-P2.1 Model Registry Parity Acceptance

**Packet:** MRU0-P2.1 — Canonical Model Registry Contract and Parity Validator

**Date:** 2026-08-23

**Status:** Accepted for the parity-only foundation packet

## Scope

This packet adds the canonical registry contract, an initial registry imported
from the existing selector sources, a bounded parity validator, and focused
parity tests.

The registry is explicitly `parity-only`. Runtime selection continues to read
the existing provider and Bedrock configuration sources. No provider calls,
access probes, execution, or infrastructure mutation were performed.

## Evidence

| Check | Result |
|---|---|
| Registry JSON parse | PASS |
| Schema JSON parse | PASS |
| Registry semantic/parity validator | PASS |
| Provider parity | PASS — 4 providers |
| Model parity | PASS — 16 provider/model bindings |
| Duplicate registry IDs | PASS |
| Private Mind policy preservation | PASS — Claude Bedrock/Sonnet, fail-closed |
| Runtime integration guard | PASS — `core.py` and `selector_service.py` do not read the new registry |
| Focused registry tests | PASS — 3/3 |
| Existing selector regression tests | PASS — 44/44 |
| Local text policy validation | PASS |
| `git diff --check` | PASS |

The optional Python `jsonschema` package was not installed. No provider or
runtime calls were used as a substitute; the repository validator performed
the required structural and source-parity checks.

## Safety confirmation

- No providers were added or removed.
- No existing selector source was modified.
- No selector behavior was changed.
- No Claude, Codex, Workbench, or Mind authority was changed.
- No model was made newly selectable by runtime integration.
- The current Opus upgrade-candidate flags remain represented as compatibility
  metadata; registry lifecycle state does not enable them.
