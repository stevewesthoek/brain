📄 LIBRARY MATURITY CHECKLIST

Version: v1.0
Date: 2026-03-01
Status: Active
Purpose: Gate pricing, bundle, translation, and SaaS decisions using numeric thresholds instead of intuition.

Canonical reference: `../operations/operations-spec.md`

⸻

## 0) How To Use

Review weekly on Monday.

For each gate:

- Mark `PASS` only if every threshold is met.
- Attach evidence (metric snapshot date + value).
- If one threshold fails, the full gate fails.

⸻

## 1) Pricing Gates

| Gate | Thresholds (all required) | Status | Evidence |
|---|---|---|---|
| Raise single price to $12 | `live_skus >= 40`; `repeat_buyer_rate_60d >= 20%`; `refund_rate_30d <= 5%` | PASS/FAIL |  |
| Raise single price to $19 | `live_skus >= 80`; `repeat_buyer_rate_60d >= 25%`; `bundle_attach_rate_60d >= 30%`; `refund_rate_30d <= 4%` | PASS/FAIL |  |

⸻

## 2) Bundle Gates

| Gate | Thresholds (all required) | Status | Evidence |
|---|---|---|---|
| Launch first bundle set | `live_skus >= 12`; 100% taxonomy completeness on live SKUs; `repeat_buyer_rate_60d >= 15%`; `routine_signal_count_30d >= 20` | PASS/FAIL |  |
| Expand bundle catalog | `live_skus >= 40`; `bundle_attach_rate_60d >= 25%`; no bundle refund rate above 6% in last 60 days | PASS/FAIL |  |

⸻

## 3) Routine Feature Gates (Soft SaaS)

| Gate | Thresholds (all required) | Status | Evidence |
|---|---|---|---|
| Enable Routine Tools (playlists/favorites/tonight queue) | `live_skus >= 40`; `returning_user_rate_30d >= 30%`; `routine_signal_count_30d >= 40` | PASS/FAIL |  |
| Enable adaptive routine suggestions | Routine Tools live >=8 weeks; `live_skus >= 80`; `returning_user_rate_30d >= 35%` | PASS/FAIL |  |

⸻

## 4) Access/Subscription Gates

| Gate | Thresholds (all required) | Status | Evidence |
|---|---|---|---|
| Start subscription beta | `live_skus >= 80`; Routine Tools live >=8 weeks; `all_access_requests_30d >= 25`; `bundle_attach_rate_60d >= 35%` | PASS/FAIL |  |
| Generalize subscription offer | Beta live >=8 weeks; beta retention at week 8 >=70%; ownership sales remain >=40% of pre-beta baseline | PASS/FAIL |  |

⸻

## 5) Translation Gates

| Gate | Thresholds (all required) | Status | Evidence |
|---|---|---|---|
| Start translation pilot | `live_skus >= 40`; top-20 SKU play share >=60%; target-language traffic share >=10% for 8 straight weeks | PASS/FAIL |  |
| Expand beyond pilot | Pilot conversion >=80% of source-language benchmark; pilot refund rate not worse than +2 percentage points vs source language | PASS/FAIL |  |

⸻

## 6) Hard Blocks

If any condition is true, freeze non-critical launches:

- Taxonomy completeness <100% on live SKUs.
- Rolling 4-week publish slot completion <85%.
- Data freshness >7 days old.
- Refund rate_30d >7%.

⸻

## 7) Sign-Off

Weekly sign-off fields:

- Reviewer:
- Review date:
- Overall status: `ON_TRACK` / `AT_RISK` / `BLOCKED`
- Next unlocked gate:
- Blockers to resolve this week:
