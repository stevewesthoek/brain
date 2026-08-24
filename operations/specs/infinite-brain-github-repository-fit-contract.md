# Infinite Brain GitHub Repository Relevance and Fit Contract

**Status:** MRU0-P3.37 bounded advisory intelligence quality refinement
**Scope:** deterministic, explainable comparison of existing GitHub evidence with the canonical Brain capability projection

## Purpose

P3.35 adds an advisory fit assessment to the existing GitHub repository evidence. It helps a human reviewer understand apparent purpose, technology, maintenance signals, possible overlap, possible gaps, and integration uncertainty. It is not an adoption or roadmap decision.

## Inputs and authority

The assessment consumes:

- the existing GitHub identity and optional metadata evidence;
- the existing `operations/specs/infinite-brain-capabilities.json` capability manifest as a derived comparison projection;
- provenance, freshness, confidence, and uncertainty already attached to the evidence.

The manifest remains canonical capability evidence. The fit assessment is derived and rebuildable. It does not create an inventory, database, authority layer, or duplicate decision system.

## Advisory output

The output includes:

- apparent purpose, principal capabilities, technology, and maintenance signals;
- confirmed repository identity matches and possible term overlap;
- possible gaps, explicitly distinguished from established gaps;
- likely integration surface, dependencies, operational complexity, security/privacy, and licensing considerations;
- evidence references, freshness, confidence, and unknowns;
- an advisory disposition: `investigate_further`, `potentially_useful`, `likely_overlap`, `likely_low_value`, or `insufficient_evidence`.

Every disposition includes reasoning, confidence, uncertainty, and alternatives. Term overlap is not treated as proof of equivalent capability. Missing capability evidence keeps the disposition at `insufficient_evidence`.

## Quality gates

The assessment records positive evidence, negative evidence, and missing evidence separately. A substantive description plus at least one corroborating public signal is required before a repository can receive `potentially_useful`; a small project is not penalized when corroborating signals exist. Recognized low-signal control descriptions with no corroborating signals may receive `likely_low_value`; other sparse evidence receives `investigate_further` or `insufficient_evidence`.

When enrichment succeeds, identity-stage uncertainty is retained in provenance history but is not repeated as current uncertainty. Current uncertainty describes only what remains unknown or why the current assessment is limited.

## Safety and authority boundary

The assessment is read-only and human-reviewable. It does not clone, execute, install, modify, adopt, recommend adoption as a decision, create tasks, update the roadmap, write Mind, or write Brain canonical state. Mind review remains required for meaning, priority, and strategic relevance; Brain supplies bounded operational evidence only.
