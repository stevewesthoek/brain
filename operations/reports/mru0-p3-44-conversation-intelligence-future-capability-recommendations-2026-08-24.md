# MRU0-P3.44 Conversation Intelligence Future Capability Recommendations

**Date:** 2026-08-24
**Decision type:** evidence-backed recommendations only; no expansion implemented

## A. Controlled session discovery

**Recommendation: do not build yet.** The window shows 75% useful-or-highly-useful operator ratings, but candidates were manually selected. There is not enough evidence that discovery would improve recall rather than increase noise and privacy exposure. Continue explicit selection.

## B. Historical session ingestion

**Recommendation: defer.** The sample produced value without scanning history. No measured decision was blocked by lack of historical coverage. Preserve provider-owned session stores and require a separately curated reference set before reconsidering.

## C. Improved extraction intelligence

**Recommendation: defer model extraction; improve evaluation instrumentation first.** Two items lacked context and one was unnecessary, but the sample does not distinguish extraction failure from candidate-authoring judgment. First collect a larger operator-rated set with explicit expected candidates and missed-item review.

## D. Deeper memory integration

**Recommendation: defer.** Human review worked and correctly separated accepted, rejected, deferred, and archived evidence. No evidence shows that automatic memory creation or promotion would improve outcomes. Keep promotion separately approved.

## Next justified step

Run another bounded selected-session window with an independent expected-candidate checklist and per-item operator ratings. Do not authorize controlled discovery or historical ingestion until the evaluation measures recall and noise on more than a handful of artifacts and demonstrates that the added coverage changes human decisions.

