# MRU0-P3.45 Conversation Intelligence Friction Analysis

**Date:** 2026-08-24

## Observed friction

1. **Secondary constraints are missed.** The seven misses were mostly safety, validation, recovery, or integration-boundary details rather than headline decisions.
2. **Candidate statements can overreach.** Three unnecessary items turned a bounded observation into a broader conclusion such as “migration ready,” “unreviewed promotion shortcut,” or “release success.”
3. **Context is still incomplete.** Four of eight sessions required stale or partial-context interpretation; source identity alone does not restore the surrounding reasoning.
4. **Checklist authoring is laborious.** Independent expected-candidate lists make recall measurable, but preparing them requires human knowledge of the session outcome.
5. **Provider formats remain heterogeneous.** Claude and Codex local JSONL stores are available but not normalized for semantic parsing; Workbench remains explicit-reference-only.

## Useful friction

The review boundary made all misses and unnecessary candidates visible before any durable action. Human review could reject overreach, defer incomplete context, and retain useful architecture or authority evidence without modifying the source session.

## Safety result

No hidden scan, transcript storage, provider call, automatic promotion, memory creation, canonical write, or authority change occurred. The friction is therefore primarily recall/context quality, not safety failure.

