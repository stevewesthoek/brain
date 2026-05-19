# Plan: Via di Eden — 100% Tina CMS Coverage

## Context

The site currently uses Tina CMS for ~30% of its content. The remaining ~70% is hardcoded in `src/data/via-di-eden/content.ts` and served through a static fallback in the locale context. The goal is to move every editable string, image, label, link, and setting into Tina CMS — fully bilingual (EN/IT) — so that no content changes require code deployments.

---

## Architecture (existing — do not change)

- Tina JSON files are imported **at build time** via Node `import` in `tina-adapter.ts` — no GraphQL API calls at runtime
- `getTinaContent(locale)` builds a `MarketingContent` object by overriding the static `translations` baseline with Tina data
- `LocaleProvider` receives a pre-built `contentMap` from the server page and distributes it to all components via `useLocale()` context
- The pattern to extend: add fields to Tina schema → add them to JSON → wire them in `tina-adapter.ts` → `content.ts` becomes the fallback only

---

## What Changes

### Phase 1: Tina Schema — Add 4 new sections + extend existing

**File: `tina/config.ts`**

**1. Extend `siteSettings` collection** (currently: siteTitle, metaDesc, socialImage, footerLinks, socialLinks)
Add:
- `logo` (image) — Navbar + Footer logo path
- `logoAlt` (localizedString) — Logo alt text EN/IT
- `bookingUrl` (string) — Acuity URL (used in Navbar CTA)
- `footerTagline` (localizedString)
- `footerLocation` (localizedString)
- `footerMenuTitle` (localizedString)
- `footerMenuLinks` (linkListField) — footer nav links
- `footerSocialTitle` (localizedString)
- `footerCopyright` (localizedString)
- `footerMadeByText` (localizedString)
- `footerMadeByUrl` (string)

**2. Extend `homePage` collection** (currently: hero, about/chiSiamo, hikesIntro, faq, contact, navigation)
Add:
- `escursioni.categoryDayHikes` (localizedString) — "TREKKING GIORNALIERI"
- `escursioni.categoryMultiDay` (localizedString) — "VIAGGI A PIEDI"
- `perChi` object: `title` (localizedString), `categories` (list of `{title, description}` both localizedString)
- `video` object: `title` (localizedString), `subtitle` (localizedString)
- `blog` object: `title` (localizedString), `subtitle` (localizedString), `cta` (localizedString)
- `contact.fields` object: `firstName`, `lastName`, `email`, `phone`, `message` (all localizedString)
- `contact.privacy` (localizedString), `contact.privacyLink` (localizedString)

**3. New `globalLabels` collection** — single doc `labels.json`
Path: `content/via-di-eden/labels`
Fields (all `localizedString`):
- `priceFrom`, `pricePerPerson`, `level`, `details`, `requestInfo`, `purchase`
- `duration`, `distances`, `elevation`, `difficulty`
- `confirmed`, `bookTrip`, `viewProgram`, `backToHome`
- `navCta` — "Prenota ora" / "Book now"
- `dayHikesPageTitle`, `dayHikesPageSubtitle`
- `multiDayPageTitle`, `multiDayPageSubtitle`, `multiDayPageTripLabel`
- Detail page: `programTitle`, `includedTitle`, `notIncludedTitle`, `bringTitle`
- Detail page: `finalCtaTitle`, `finalCtaSubtitle`, `priceLabel`, `infoCta`
- Detail page: `contactTitle`, `contactSubtitle`, `contactPlaceholder`
- Detail page quickInfo: `quickInfoDuration`, `quickInfoDistances`, `quickInfoElevation`, `quickInfoDifficulty`

**4. New `blogPosts` collection**
Path: `content/via-di-eden/blog`
Format: `json`
Fields: `slug` (string, isTitle), `title` (localizedString), `excerpt` (localizedText), `image` (image)

**5. Extend `homePage` hero to support slide images**
Change `hero.image` (single) → `hero.images` (list of image) and `hero.imageAlts` (localizedStringList or list of localizedString)

---

### Phase 2: JSON Content Files — Create/Update

**Files to create:**
- `content/via-di-eden/labels/labels.json` — all globalLabels content (from content.ts)
- `content/via-di-eden/blog/post-1.json` — "Disconnettersi per riconnettersi"
- `content/via-di-eden/blog/post-2.json` — "Il potere del silenzio"
- `content/via-di-eden/blog/post-3.json` — "Camminare per pensare"

**Files to update:**
- `content/via-di-eden/settings/site.json` — add logo, logoAlt, bookingUrl, footer fields
- `content/via-di-eden/pages/home.json` — add escursioni categories, perChi, video, blog labels, contact fields/privacy

---

### Phase 3: Tina Adapter — Wire all new fields

**File: `src/data/via-di-eden/tina-adapter.ts`**

Extend `getTinaContent(locale)` to map:
- All new `siteSettings` fields → `footer.*`, `nav.cta`, logo (stored separately, not in MarketingContent)
- All new `homePage` fields → `escursioni.categories`, `perChi`, `video`, `blog` (title/subtitle/cta), `contact.fields`, `contact.privacy`, `contact.privacyLink`
- `globalLabels` import → all `labels.*` and `pages.*` fields

Add new exports:
- `getTinaLabels(locale)` — returns the resolved labels object from `labels.json`
- `getTinaBlogPosts(locale)` — returns `blog.posts[]` from Tina blog collection
- `getTinaSiteSettings()` — returns logo, logoAlt, bookingUrl for use in Navbar/Footer

Add to `getTinaContentMap()`: include all new fields so the full `MarketingContent` is populated from Tina on both locales.

---

### Phase 4: Components — Wire through remaining hardcoded values

**`Navbar.tsx`**
- Logo `src` and `alt` → from `siteSettings` (passed via contentMap or direct import)
- Booking URL → from `siteSettings.bookingUrl`

**`Footer.tsx`**
- Logo `src` and `alt` → from `siteSettings`
- `footer.tagline`, `footer.location`, `footer.menu.*`, `footer.social.*`, `footer.copyright`, `footer.madeBy` → already read from `content` prop; need tina-adapter to populate these from Tina

**`Hero.tsx`**
- Slide images array → from `home.json` hero images list (replace hardcoded 4-image array with Tina-managed list, keeping current images as JSON defaults)

**`ChiSiamo.tsx`**
- Images `/images/Joe e Ash.jpeg` and `/images/IMG_9643.jpeg` → add two `image` fields to `about` section in home.json: `aboutImage` and `aboutImageThumb`

**`PerChi.tsx`**
- Images → add `image` field to each perChi category item in home.json perChi.categories

**`DayHikesPageContent.tsx`**
- Hero banner image and alt → add `dayHikesHeroImage` + `dayHikesHeroImageAlt` (localizedString) to `globalLabels` or siteSettings

**`MultiDayPageContent.tsx`**
- Hero banner image and alt → same pattern, `multiDayHeroImage` + `multiDayHeroImageAlt`

**`VideoStrip.tsx`**
- Video file path → add `videoUrl` (string) to home.json video object

**`BlogPreview.tsx`**
- Posts → switch from `content.blog.posts` (static) to `getTinaBlogPosts(locale)` passed as prop

---

### Phase 5: `content.ts` becomes pure fallback

After all wiring is done, `content.ts` stays as the safety net — it is never deleted. All fields must still be populated with sensible defaults. The Tina data overrides them; if Tina returns empty, components still render correctly.

---

## Files Modified

| File | Change |
|---|---|
| `tina/config.ts` | Add new fields to siteSettings, homePage; add globalLabels + blogPosts collections |
| `content/via-di-eden/settings/site.json` | Add logo, bookingUrl, footer fields |
| `content/via-di-eden/pages/home.json` | Add perChi, video, blog labels, contact fields, hero images list, about images, perChi images |
| `content/via-di-eden/labels/labels.json` | New file — all UI labels |
| `content/via-di-eden/blog/post-*.json` | 3 new blog post files |
| `src/data/via-di-eden/tina-adapter.ts` | Wire all new fields, add new exports |
| `src/components/via-di-eden/Navbar.tsx` | Logo + booking URL from Tina |
| `src/components/via-di-eden/Footer.tsx` | Logo from Tina |
| `src/components/via-di-eden/Hero.tsx` | Images list from Tina |
| `src/components/via-di-eden/ChiSiamo.tsx` | Images from Tina |
| `src/components/via-di-eden/PerChi.tsx` | Images from Tina |
| `src/components/via-di-eden/DayHikesPageContent.tsx` | Hero banner from Tina |
| `src/components/via-di-eden/MultiDayPageContent.tsx` | Hero banner from Tina |
| `src/components/via-di-eden/VideoStrip.tsx` | Video URL from Tina |
| `src/components/via-di-eden/BlogPreview.tsx` | Posts from Tina collection |
| `src/data/via-di-eden/content.ts` | No deletions; just becomes pure fallback |

---

## Execution Order

1. Schema first (`tina/config.ts`) — defines the shape
2. JSON files — populate content matching schema
3. Tina adapter — wire imports and mappings
4. Components — consume new fields
5. Build + verify — `npm run build` must pass clean
6. Commit and push

---

## Verification

- `npm run build` passes with no TypeScript errors
- All `MarketingContent` fields are populated from Tina in `getTinaContentMap()` — verify by console-logging the resolved content map in dev
- Locally: `npm run dev` → open http://localhost:3057/admin and confirm all new fields appear in CMS collections
- Confirm bilingual: switch locale EN↔IT on homepage and detail pages — all sections update
- Images: logo, hero slides, about portrait, perChi thumbnails, blog images all visible
