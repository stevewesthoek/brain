# MRU0-P3.43 Conversation Intelligence Future Capability Recommendations

**Date:** 2026-08-24
**Decision type:** evidence-backed recommendations only; no expansion implemented

## A. Automatic session discovery

**Recommendation: defer.** Local session roots are populated, but this validation did not show that discovery is needed to make a human decision. Automatic discovery would widen privacy, retention, watermark, and secret-redaction obligations before extraction quality is measured.

## B. Historical conversation processing

**Recommendation: defer.** The sample used selected real identities without broad ingestion and completed the review-state workflow successfully. There is no evidence yet that processing all historical sessions would produce more useful accepted candidates than manual selection, or that the added privacy and storage burden would change decisions.

## C. Better extraction models

**Recommendation: do not authorize yet.** The current run did not test model recall or precision because candidate statements were explicitly structured. First collect operator-rated results from a bounded set of selected artifacts. A model should be considered only with an approved private-provider boundary, redaction, reproducible evaluation set, and review-only output.

## D. More advanced memory integration

**Recommendation: defer.** Four human states worked and no promotion occurred. There is no evidence that automatic memory creation, candidate ranking, or new storage authority is required. Existing separately approved promotion remains the correct next boundary.

## Next justified step

Repeat selected-session validation over a small operator-rated sample, recording accepted/rejected/deferred/archive reasons, missed candidates, noise, and time-to-review. Keep automatic discovery, historical scanning, semantic model extraction, transcript databases, and automatic promotion unauthorized until that evidence exists.

