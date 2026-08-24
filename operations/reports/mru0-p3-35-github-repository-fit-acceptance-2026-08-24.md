# MRU0-P3.35 GitHub Repository Relevance and Fit Acceptance

**Date:** 2026-08-24
**Status:** ACCEPTED — bounded advisory fit intelligence

## Capability now operational

When the operator runs the existing daily review with `--enrich-github-metadata`, each GitHub repository evidence item receives a deterministic fit assessment using:

- the existing repository identity and public metadata evidence;
- the canonical Brain capability manifest as a comparison projection;
- field-level provenance, freshness, confidence, and uncertainty.

The assessment is visible through the existing unified review projection, briefing/workflow state, and human-readable review workflow. No separate GitHub review system or storage layer was added.

## Advisory behavior

The assessment reports apparent purpose, principal capabilities, technology, maintenance signals, possible overlap, possible gaps, integration considerations, licensing, unknowns, and one of the bounded advisory dispositions:

- `investigate_further`
- `potentially_useful`
- `likely_overlap`
- `likely_low_value`
- `insufficient_evidence`

Every disposition includes reasoning, confidence, uncertainty, alternatives, and `advisory_only: true`. Term overlap is explicitly not treated as confirmed equivalence.

## Representative validation results

- Public metadata fixture with context/gateway terms: `likely_overlap` with possible overlap and explicit uncertainty.
- Public metadata fixture with unrelated video terms: `potentially_useful` with a possible, not established, gap.
- Unavailable/private/rate-limited metadata: `insufficient_evidence` with preserved uncertainty.
- Stale metadata: `insufficient_evidence` with stale-evidence warning.
- Missing canonical capability projection: `insufficient_evidence`; no comparison is invented.
- Live public metadata samples `octocat/hello-world` and `nodejs/node`: metadata `available`, freshness `fresh`, disposition `potentially_useful`, confidence `0.55`; uncertainty remained visible.
- Determinism and safety tests: PASS.

## Validation

- Mind Steward regression suite, including GitHub evidence, metadata, fit, and daily-review tests: 74/74 PASS.
- Documentation consistency validation: PASS.
- `git diff --check`: PASS.
- No cloning, execution, installation, credentials, adoption, automatic task creation, roadmap mutation, Mind write, or Brain canonical write: PASS by contract and tests.
- Brain Core and Brain Console are untouched by this packet.
- Documentation consistency and `git diff --check`: required before commit.

## Limitations

- The capability comparison is limited to the current canonical Brain capability projection.
- Absence of a term match does not prove a gap or lack of overlap.
- README/documentation content and pull-request activity remain unknown in the bounded metadata adapter.
- Deeper repository inspection requires a separate authorization and review packet.
