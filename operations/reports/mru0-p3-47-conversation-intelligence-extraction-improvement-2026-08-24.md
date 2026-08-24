# MRU0-P3.47 Conversation Intelligence Extraction Improvement

## Outcome

The bounded extractor now expands explicit structured signals into the existing review categories and attaches producer-supplied context. It still rejects raw transcript-shaped input, secret-like content, unsupported categories, conflicting repository context, and unsafe privacy classifications.

## Improvement

Supported signals include decisions, architecture, lessons, tradeoffs, validated solutions, changed behavior/files, recurring problems, unresolved questions, and future actions. Scalar and list values are bounded to the existing 100-candidate batch and 1,000-character statement limits. No transcript parsing, provider call, automatic discovery, promotion, or authority change was added.

## Privacy

Candidate classifications are fail-closed to `public`, `technical`, or `internal`. Restricted, personal, secret, credential-like, unrelated, and raw transcript content remains excluded before persistence. The evidence envelope remains restricted and human-review-only.

## Limitation

This is structured-input normalization, not autonomous transcript extraction. It improves coverage when an upstream review step supplies explicit signals; it does not establish discovery readiness.
