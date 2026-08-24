# Mind Steward GitHub Repository Evidence

GitHub repository URLs in supported Markdown or text files under `mind/inbox/new/` are recognized during the existing daily review ingestion pass.

Run the existing workflow:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs
```

The resulting review item is source-linked and includes the repository identity, provenance, uncertainty, and advisory questions. It continues through the same unified review and human decision workflow as every other evidence producer.

## Optional public metadata enrichment

To explicitly request bounded public GitHub metadata for the current review pass, run:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs --enrich-github-metadata
```

This performs unauthenticated read-only requests for repository metadata and the latest release. Every returned field includes provenance, retrieval time, freshness, confidence, and uncertainty. Rate limits, private/deleted repositories, unavailable endpoints, and timeouts remain visible as unknown/unavailable evidence. README and documentation signals are intentionally not fetched by this bounded adapter.

To include bounded README/documentation evidence in the same review pass, add:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs --enrich-github-documentation
```

This flag performs the metadata pass and then requests only the public README endpoint. It extracts bounded text signals for purpose, capabilities, target users, technology mentions, integrations, examples, and limitations. The README is treated as an untrusted documented claim, not verified implementation fact. Content is capped at 64 KiB; unavailable, stale, minimal, and truncated documentation remains uncertain.

To include bounded architecture signals from the same README, use:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs --enrich-github-architecture
```

This also performs metadata and README enrichment, then extracts only explicitly documented architecture, component, API/interface, deployment, environment, and operational sections. It does not follow arbitrary links, inspect source code, inspect dependencies, or verify the documented design.

## Relevance and fit assessment

The same explicit enrichment pass also attaches a deterministic advisory fit assessment. It compares repository evidence with the existing Brain capability manifest and displays apparent purpose, technology, maintenance signals, possible overlap, possible gaps, integration uncertainty, licensing, and unknowns in the existing review projection and workflow outputs.

The assessment is not a decision. `likely_overlap` means confirmed identity or possible term overlap as stated in the evidence; it does not establish equivalence. `potentially_useful` means no overlap was found in the supplied capability projection, not that a gap has been proven. Documentation and architecture evidence can improve purpose and integration-boundary triage but cannot establish compatibility. Missing or stale evidence produces conservative uncertainty.

## Current behavior

The default adapter recognizes the URL and records identity only. Remote metadata is not fetched automatically. Enrichment is available only through the explicit flag above, so activity, maintenance, licensing, dependency, and documentation fields may remain unknown. That is an explicit uncertainty state, not a positive or negative recommendation.

## Safety boundary

This workflow does not clone, install, execute, inspect source code, inspect dependencies, follow arbitrary documentation links, modify, adopt, create tasks, update the roadmap, or promote repository code. It does not use credentials, write Mind, or write Brain canonical state. A repository identity, public metadata result, documentation result, architecture result, or fit assessment is evidence and requires human review.

Invalid URLs, unavailable metadata, and duplicate repository identities fail closed. Do not treat a repository mention as authorization to inspect, install, or merge it.
