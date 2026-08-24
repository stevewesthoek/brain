# Mind Steward GitHub Repository Evidence

GitHub repository URLs in supported Markdown or text files under `mind/inbox/new/` are recognized during the existing daily review ingestion pass.

Run the existing workflow:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs
```

The resulting review item is source-linked and includes the repository identity, provenance, uncertainty, and advisory questions. It continues through the same unified review and human decision workflow as every other evidence producer.

## Current behavior

The current adapter recognizes the URL and records identity only. Remote metadata is not fetched automatically, so activity, maintenance, licensing, dependency, and documentation fields may remain unknown. That is an explicit uncertainty state, not a positive or negative recommendation.

## Safety boundary

This workflow does not clone, install, execute, modify, adopt, or promote repository code. It does not call providers, write Mind, or write Brain canonical state. A repository identity is evidence and requires human review.

Invalid URLs, unavailable metadata, and duplicate repository identities fail closed. Do not treat a repository mention as authorization to inspect, install, or merge it.
