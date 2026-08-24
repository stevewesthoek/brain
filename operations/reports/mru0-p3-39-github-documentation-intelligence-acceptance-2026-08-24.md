# MRU0-P3.39 GitHub Documentation Intelligence Acceptance

**Date:** 2026-08-24
**Status:** ACCEPTED — bounded README/documentation evidence

## Capability

The existing explicit GitHub review workflow can now request bounded public README evidence:

`GitHub URL → repository evidence → metadata enrichment → documentation evidence → fit assessment → human review`

The adapter extracts documented purpose, capabilities, target users, technology mentions, integration points, examples/use cases, and limitations. It preserves the README source, retrieval timestamp, freshness, confidence, uncertainty, and provenance for every signal.

## Validation cases

- Strong README: purpose and feature signals extracted with provenance.
- Minimal README: empty signals remain unknown; fit stays conservative.
- Unavailable/private/no README: unavailable status and field-level unknowns.
- Stale README: stale freshness and explicit uncertainty.
- Misleading README: text is preserved as documented claim; no verified capability is invented.
- Daily review integration: documentation enrichment remains explicit and appears in the existing evidence/fit workflow.

## Safety

Only the public README API endpoint is requested, with a 64 KiB bound. No cloning, source inspection, dependency inspection, execution, installation, arbitrary link following, adoption, task creation, roadmap mutation, Mind write, or Brain canonical write was introduced.

## Limitations

README text can be incomplete, promotional, stale, or inaccurate. Documentation does not establish architecture, dependency safety, integration compatibility, or adoption value. Those remain unknown and human review remains required.
