# MRU0-P2.2 Compatibility Projection and Dual-Read Shadow Acceptance

**Packet:** MRU0-P2.2 — Compatibility Projections and Dual-Read Shadowing

**Date:** 2026-08-23

**Status:** Accepted for shadow mode only

## Scope

The selector now loads the canonical model registry through a read-only shadow
path and compares it with the legacy provider and Bedrock model configuration.
Legacy configuration remains the only selection authority.

The shadow path does not call AWS, Claude, Codex, or any external provider. A
missing, invalid, or mismatching registry produces a visible report but cannot
reject valid legacy routing.

## Evidence

| Check | Result |
|---|---|
| Registry validator | PASS — 4 providers, 16 models |
| Registry parity tests | PASS — 3/3 |
| Shadow runtime tests | PASS — 5/5 |
| Full selector regression suite | PASS — 49/49 |
| Local text safety policy | PASS |
| Legacy/registry candidate comparison | PASS — matching providers and models |
| Shadow mismatch visibility | PASS |
| Selection equivalence with and without registry | PASS |
| Evaluated-only registry selectable view | PASS — Opus 4.7 excluded |
| Private Mind constraints | PASS — Claude Bedrock/Sonnet, fail-closed |
| `git diff --check` | PASS |

## Runtime boundary

- `core.py` reads the registry only through `registry_shadow.py`.
- `GET /registry/shadow` exposes the non-authoritative report.
- `_pick_model`, `_pick_bedrock_model`, `select_provider`, and selection
  outcomes are unchanged.
- The existing legacy `upgrade_candidate` behavior remains untouched until a
  separately authorized lifecycle-enforcement packet.
- No providers, models, credentials, adapters, or execution authority changed.
