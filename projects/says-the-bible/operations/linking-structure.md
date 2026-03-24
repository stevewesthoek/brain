📄 LINKING STRUCTURE

Version: v1.0
Date: 2026-03-01
Status: Active
Purpose: Define mandatory internal linking rules across YouTube, blog, product, and bundle surfaces so traffic flows predictably to conversion.

Canonical reference: `operations-spec.md`

⸻

## 0) Core Flow

Primary path:

`YouTube video -> product page -> bundle page -> method page`

Secondary path:

`Blog article -> product page -> bundle page -> method page`

No orphan pages. Every page must link forward and laterally.

⸻

## 1) Required Links By Surface

| Surface | Required Links | Placement Rule | Minimum Count |
|---|---|---|---|
| YouTube description | Current SKU product page, primary bundle page, method page, one related video | First 6 lines for product + bundle; method below fold | 4 |
| Blog article | One SKU page, one bundle page, method page, one related blog article | First CTA before 25% scroll; bundle CTA in final 25% | 4 |
| Product page | Bundle page, method page, 2 related SKU pages | Bundle CTA above first fold; related SKUs below main CTA | 4 |
| Bundle page | Method page, 3 included SKU pages, one “start tonight” CTA | “Start tonight” CTA in hero section | 5 |
| Method page | 3 starter SKUs, flagship bundle page | First starter SKU within first 2 sections | 4 |

⸻

## 2) Anchor Text Rules

Use descriptive anchors only. Avoid generic text.

Allowed examples:

- `Listen: GENESIS -> NOAH`
- `Start with the Safety Bundle`
- `How this bedtime method works`

Avoid:

- `click here`
- `learn more`
- `link`

Anchor format for SKU links:

`BOOK -> STORY | Bedtime Audio`

⸻

## 3) Placement And Frequency Rules

- One primary CTA per viewport section.
- No section should contain more than 2 conversion CTAs.
- Bundle CTA appears exactly once above fold and once near end.
- Method page link appears exactly once in YouTube description and at least once on every web page.

⸻

## 4) UTM And Tracking Convention

Use this format for all cross-surface links:

`?utm_source=<source>&utm_medium=<medium>&utm_campaign=<campaign>&utm_content=<asset>`

Required values:

- `utm_source`: `youtube`, `blog`, `site`
- `utm_medium`: `description`, `article`, `internal`
- `utm_campaign`: release identifier (for example `week03_noah`)
- `utm_content`: exact asset slug (for example `genesis-noah-30m`)

No untagged marketing links.

⸻

## 5) Internal Linking QA Checklist

| Check | Pass Condition | Owner |
|---|---|---|
| YouTube description links | All 4 required links present and valid | Publishing |
| Blog article links | All 4 required links present and valid | Editorial |
| Product page links | Bundle + method + 2 related SKUs present | Product |
| Bundle page links | Method + 3 included SKUs + start CTA present | Product |
| UTM compliance | 100% of campaign links use required UTM fields | Growth |

Release is blocked if any row fails.

⸻

## 6) Link Governance

- If a URL changes, update all inbound links within 24 hours.
- Run a weekly broken-link check every Monday before scheduling posts.
- New page types must be added to this document before use.
