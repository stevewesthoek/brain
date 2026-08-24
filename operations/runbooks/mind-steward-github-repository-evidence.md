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

## Current behavior

The default adapter recognizes the URL and records identity only. Remote metadata is not fetched automatically. Enrichment is available only through the explicit flag above, so activity, maintenance, licensing, dependency, and documentation fields may remain unknown. That is an explicit uncertainty state, not a positive or negative recommendation.

## Safety boundary

This workflow does not clone, install, execute, modify, adopt, or promote repository code. It does not use credentials, write Mind, or write Brain canonical state. A repository identity or public metadata result is evidence and requires human review.

Invalid URLs, unavailable metadata, and duplicate repository identities fail closed. Do not treat a repository mention as authorization to inspect, install, or merge it.
