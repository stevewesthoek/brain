# MRU0-P2.3 Lifecycle and Admission Enforcement Acceptance

**Packet:** MRU0-P2.3 — Lifecycle and Admission Enforcement

**Date:** 2026-08-23

**Status:** Accepted with legacy compatibility preserved

## Scope

The selector now distinguishes model lifecycle evidence from availability and
discovery metadata. Legacy configuration remains the candidate source, while
the registry lifecycle gates known provider/model identities. The registry is
not a replacement candidate source and no provider or model was added.

## Lifecycle behavior

| Registry lifecycle | Selector eligibility |
|---|---|
| `discovered` | No |
| `evaluated` | No |
| `admitted` | Yes, when legacy `enabled` is true and access is available |
| `preferred` | Yes, when legacy `enabled` is true and access is available |
| `deprecated` | No |
| `retired` | No |

The legacy `enabled` flag remains a prerequisite. `upgrade_candidate` is
evaluation or migration metadata only; `enabled: false` cannot be promoted by
access, health, or upgrade-candidate status. The health matrix uses the same
admission decision and does not advertise evaluated models as selectable.

## Compatibility boundary

- `ai-providers.json` and `ai-bedrock-models.json` remain runtime candidate
  sources.
- Existing enabled models remain selectable when the registry is unavailable
  during the compatibility rollout.
- A known model with registry lifecycle data is selectable only when its state
  is `admitted` or `preferred`.
- An unavailable registry never promotes a disabled upgrade candidate.
- Legacy configuration is not removed, rewritten, or replaced.

The committed registry already records current selectable models as admitted
and `claude-bedrock/claude-opus-4-7` as evaluated. No registry model or
provider inventory change was needed.

## Safety boundaries

- Private Mind remains Claude Bedrock-only with the approved Sonnet entry and
  `fallback_policy=none`.
- No provider expansion or model expansion occurred.
- No Claude interactive, Codex interactive, Workbench, adapter, credential,
  execution, or remediation authority changed.
- No AWS, Claude, Codex, or external provider calls were made by validation.

## Evidence

| Check | Result |
|---|---|
| Lifecycle focused tests | PASS — 3/3 |
| Upgrade-candidate regression tests | PASS — 2/2 |
| Registry shadow tests | PASS — 5/5 |
| Full selector regression suite | PASS — 52/52 |
| Registry validator | PASS — 4 providers, 16 models |
| Registry validator tests | PASS — 3/3 |
| Local text safety policy | PASS |
| TypeScript baseline | Preserved from MRU0-P1 — PASS |
| `git diff --check` | PASS |

## Remaining boundary

This packet does not switch runtime candidate authority to the registry. A
future packet must separately authorize registry-backed candidate projection,
strict unavailable-registry behavior, and any lifecycle transition tooling.
