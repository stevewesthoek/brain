📄 OPERATIONS SPEC

Version: v1.0
Date: 2026-03-01
Status: Active
Purpose: Canonical operating rules for publishing cadence, release quality, and business decision gates.

⸻

## 0) Scope And Precedence

Use this document as source of truth when operational docs conflict.

Precedence order:

1. `operations-spec.md`
2. `../content-system/bedtime-scripture-format.md` + `../content-system/video-template.md`
3. `publishing-schedule-8-weeks.md` + `roadmap.md`
4. Other planning docs

If a rule changes, update this document first.

⸻

## 1) Canonical Weekly Cadence

Timezone: Europe/Lisbon

Weekly slots:

- Sunday 20:00 — YouTube publish
- Tuesday 16:00 — Blog publish
- Tuesday 20:00 — YouTube publish
- Thursday 20:00 — YouTube publish

Weekly output target:

- 3 YouTube videos
- 1 blog article

8-week output target:

- 24 YouTube videos
- 8 blog articles

⸻

## 2) Release Rules

Every YouTube release must meet all rules:

- Narration begins at `0:00`.
- No branded intro/outro segments.
- Optional technical fade-in/out is allowed only if <=2 seconds and non-verbal.
- One video maps to one SKU.
- Description includes product link + bundle link + method link.

Every blog release must meet all rules:

- Links to at least one specific SKU page.
- Links to one bundle page.
- Links to method page.
- Published in the Tuesday 16:00 slot.

⸻

## 3) Business Model Snapshot

Free channel:

- YouTube listening is free.

Paid product:

- Downloadable WAV (24-bit / 48kHz).
- Downloadable MP3 (320 kbps).
- Base product includes only these two files.

Pricing ladder:

- $9 until `live_skus >= 40`.
- $12 until `live_skus >= 80`.
- $19 once `live_skus >= 80` and gates are met.

SaaS intent:

- The library becomes routine tools first, then subscription later (see gates).

Public messaging constraints:

- Publicly state only the current price ($9 until updated).
- Do not mention the pricing ladder or upcoming increases.
- Do not mention YouTube upload specs or bitrate.

⸻

## 4) Weekly Content Mix Guardrails

Per 7-day cycle:

- At least 2 narrative/story uploads.
- At least 1 calm/psalm/loop upload.
- Maximum 1 repeat/variant upload until library reaches 40 live SKUs.

This keeps discovery + habit balanced.

⸻

## 5) Core Metric Definitions

Use these exact formulas.

- `live_skus`: count of publicly available purchasable SKUs.
- `repeat_buyer_rate_60d`: buyers with >=2 purchases in last 60 days / total buyers in last 60 days.
- `bundle_attach_rate_60d`: orders that include a bundle / total orders in last 60 days.
- `refund_rate_30d`: refunded orders in last 30 days / total orders in last 30 days.
- `returning_user_rate_30d`: returning library users / total library users in last 30 days.
- `routine_signal_count_30d`: count of comments/emails/support messages in last 30 days that explicitly reference routine behavior (for example: “every night”, “bedtime routine”, “we play this nightly”).
- `all_access_requests_30d`: count of explicit requests for all-access or subscription-style access in last 30 days.

⸻

## 6) Decision Gates (Numeric)

All listed conditions must be true before moving.

| Decision | Numeric Gate (all required) | Action |
|---|---|---|
| Launch first bundle | `live_skus >= 12`; 100% of those SKUs have taxonomy fields populated (`routine_position`, `energy`, `emotional_tag`, `loopable`); `repeat_buyer_rate_60d >= 15%`; `routine_signal_count_30d >= 20` | Launch 1 flagship bundle + 2 supporting bundles |
| Raise single price from $9 to $12 | `live_skus >= 40`; `repeat_buyer_rate_60d >= 20%`; `refund_rate_30d <= 5%` | Increase single SKU price to $12 |
| Raise single price from $12 to $19 | `live_skus >= 80`; `repeat_buyer_rate_60d >= 25%`; `bundle_attach_rate_60d >= 30%`; `refund_rate_30d <= 4%` | Increase single SKU price to $19 |
| Enable Routine Tools (Phase 2) | `live_skus >= 40`; `returning_user_rate_30d >= 30%`; `routine_signal_count_30d >= 40` | Ship playlists, favorites, tonight queue |
| Start Access/Subscription beta (Phase 4) | `live_skus >= 80`; Routine Tools already live for >=8 weeks; `all_access_requests_30d >= 25`; `bundle_attach_rate_60d >= 35%` | Launch controlled subscription beta while keeping ownership |
| Start translation pilot | `live_skus >= 40`; top 20 SKUs generate >=60% of total plays; target-language traffic share >=10% for 8 consecutive weeks | Translate top 10 SKUs first |

⸻

## 7) Hard Blocks

Do not proceed if any block is true:

- Taxonomy completeness below 100% for live SKUs.
- Pricing change attempted before gate threshold.
- Subscription launch before Routine Tools are live.
- Weekly cadence misses more than 2 publish slots in a rolling 4-week window.

⸻

## 8) Weekly Operating Ritual

Run this on Monday:

1. Check prior week slot completion against Section 1.
2. Update metrics from Section 5.
3. Evaluate gate status from Section 6.
4. Approve current week queue (Sun/Tue/Thu YouTube + Tue blog).
5. Publish a short internal status note: `on_track`, `at_risk`, or `blocked`.
