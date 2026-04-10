# DESIGN.md — prochat.tools

*Extracted from prochat.tools brand tokens (April 2026). Professional SaaS, AI-first, developer-adjacent. Dark mode default.*

---

## 1. Visual Theme & Atmosphere

**Vibe:** Professional SaaS product with AI capabilities, developer-adjacent, approachable but premium.

**Mood:** Clean, precise, modern, with subtle AI-inspired accents (radial glows, smooth transitions).

**Density:** Medium-tight spacing. Not minimal (like Vercel), not dense (like Linear). Balanced whitespace with purpose.

**Dark mode first:** Primary interface is dark navy (`#0b1220`). Light mode is secondary (rarely used).

**Motion:** Smooth, purposeful transitions. 650ms duration on theme switches. Radial glow effects on interaction.

**Aesthetic classification:** Linear-adjacent but warmer. Precision-focused but approachable.

---

## 2. Color Palette & Roles

### Primary Colors

| Token | Hex | RGB | Role |
|-------|-----|-----|------|
| `blue-500` | `#5b7cff` | `(91, 124, 255)` | Secondary accent, hover states |
| `blue-600` | `#4c6fff` | `(76, 111, 255)` | **Primary accent**, buttons, selection, links |
| `blue-700` | `#3e5ae0` | `(62, 90, 224)` | Pressed/active state for `blue-600` |
| `blue-glow` | `#6d83ff` | `(109, 131, 255)` | Focus rings, AI radial glow effects |

### Backgrounds

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `background` | `#f7f8fa` | `#0b1220` | **Primary background** |
| `surface` | `#ffffff` | `#1a2540` | Cards, elevated surfaces, containers |
| `surface-hover` | `#f0f2f8` | `#252f47` | Hover state for surfaces |

### Text & Foreground

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `text-primary` | `#101828` | `#f3f5fa` | Body text, headings, primary content |
| `text-secondary` | `#667085` | `#a8afc3` | Secondary text, descriptions, labels |
| `text-tertiary` | `#98a2b3` | `#6b7280` | Tertiary text, placeholders, hints |

### Semantic Colors

| Token | Value | Role |
|-------|-------|------|
| `success` | `#10b981` | Success states, checkmarks, confirmations |
| `warning` | `#f59e0b` | Warnings, cautions, attention |
| `error` | `#ef4444` | Errors, destructive actions, failures |
| `info` | `#3b82f6` | Info messages, neutral callouts |

### Grayscale

| Token | Light | Dark |
|-------|-------|------|
| `gray-50` | `#fafafa` | `#0f1420` |
| `gray-100` | `#f3f4f6` | `#1a2540` |
| `gray-200` | `#e5e7eb` | `#3d4a63` |
| `gray-300` | `#d1d5db` | `#5a6b7e` |
| `gray-400` | `#9ca3af` | `#8994a8` |
| `gray-500` | `#6b7280` | `#a8afc3` |
| `gray-600` | `#4b5563` | `#d1d9e5` |
| `gray-700` | `#374151` | `#e5e7eb` |
| `gray-800` | `#1f2937` | `#f3f4f6` |
| `gray-900` | `#111827` | `#fafafa` |

---

## 3. Typography Rules

### Font Family

**Primary:** Host Grotesk (Google Fonts, weights 400–700)

```css
--font-sans: 'Host Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-brand: 'Host Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

No serif fonts. All headings, body, and labels use Host Grotesk.

### Font Scale & Hierarchy

| Token | Size (px) | Weight | Line Height | Letter Spacing | Use |
|-------|-----------|--------|-------------|----------------|-----|
| `h1` | 40 | 700 | 1.2 | -0.05em | Page heroes, main headings |
| `h2` | 32 | 700 | 1.25 | -0.05em | Section headings |
| `h3` | 24 | 700 | 1.33 | -0.05em | Subsection headings |
| `h4` | 20 | 600 | 1.4 | -0.04em | Component headings, cards |
| `h5` | 16 | 600 | 1.5 | -0.03em | Labels, small headings |
| `h6` | 14 | 600 | 1.5 | -0.02em | Tiny headings, captions |
| `body-lg` | 18 | 400 | 1.6 | 0em | Large body text, introductions |
| `body-md` | 15.5 | 400 | 1.6 | 0em | **Primary body text** |
| `body-sm` | 14 | 400 | 1.6 | 0em | Secondary text, descriptions |
| `label` | 12 | 500 | 1.5 | 0em | Form labels, captions, tags |
| `mono` | 13 | 400 | 1.6 | 0em | Code, terminal, technical text |

### Base Font Size & Scaling

- **Default:** `15.5px` at breakpoint 0–1279px
- **Large screens:** `15.75px` at breakpoint 1280px+
- Subtle scaling for typography hierarchy across devices

### Letter Spacing & Tracking

- **Headings:** -0.05em to -0.02em (tight)
- **Body:** 0em (neutral)
- **Labels:** 0em (neutral)
- **Mono:** 0em (neutral)

---

## 4. Component Stylings

### Buttons

**Primary Button**
- Background: `blue-600` (#4c6fff)
- Text: white, `body-md` weight 600
- Padding: 12px 24px
- Border radius: 8px
- Hover: `blue-500` (#5b7cff)
- Active/pressed: `blue-700` (#3e5ae0)
- Focus: 2px `blue-glow` (#6d83ff) outline
- Transition: all 650ms cubic-bezier(0.22, 1, 0.36, 1)

**Secondary Button**
- Background: `surface-hover`
- Text: `text-primary`
- Border: 1px `gray-300` (light) / `gray-500` (dark)
- Padding: 12px 24px
- Border radius: 8px
- Hover: background darken 5%
- Active: darken 10%
- Focus: 2px `blue-glow` outline

**Ghost Button**
- Background: transparent
- Text: `blue-600`, weight 600
- Border: none
- Padding: 12px 24px
- Hover: background 10% `blue-600` with opacity
- Active: background 20%
- Focus: 2px `blue-glow` outline

### Cards

- Background: `surface`
- Border: 1px `gray-200` (light) / `gray-400` (dark)
- Border radius: 12px
- Padding: 24px
- Hover: shadow 0 8px 16px rgba(0, 0, 0, 0.1)
- Transition: all 650ms ease

**Elevated Card**
- Box shadow: 0 4px 12px rgba(0, 0, 0, 0.15)
- Slightly higher padding: 32px

### Input Fields

- Background: `background`
- Border: 1px `gray-300` (light) / `gray-500` (dark)
- Text: `text-primary`, `body-md`
- Padding: 12px 16px
- Border radius: 8px
- Focus: 2px `blue-glow` outline, border color to `blue-600`
- Placeholder: `text-tertiary`, opacity 60%
- Transition: all 200ms ease

**Input States**
- Disabled: opacity 50%, cursor not-allowed
- Error: border `error` (#ef4444), focus outline `error`
- Success: border `success` (#10b981), focus outline `success`

### Navigation

- Background: `surface` on dark background
- Text: `text-primary`, weight 500
- Active link: `blue-600` with underline
- Hover: text `blue-600`, underline appears
- Transition: all 200ms ease

### Badges / Tags

- Background: `blue-600` with 15% opacity
- Text: `blue-600`, weight 500, `label` size
- Padding: 4px 12px
- Border radius: 6px
- Optional border: 1px `blue-600`

### Icons

- Size: 24px (default), 16px (small), 32px (large)
- Color: inherit from text color or `blue-600` for primary
- Stroke width: 2px (consistent)
- Library: Phosphor icons preferred (open-source, high quality)

---

## 5. Layout Principles

### Spacing Scale

```
4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 80px, 96px
```

Use these consistently. Never improvise spacing.

### Grid System

- **Desktop:** 12-column grid, max-width 1440px
- **Tablet:** 8-column grid
- **Mobile:** 4-column grid

Gutter: 24px (desktop), 20px (tablet), 16px (mobile)

### Container Padding

- **Desktop:** 48px left/right
- **Tablet:** 32px left/right
- **Mobile:** 20px left/right

### Whitespace

- **Tight sections** (hero, CTA): 64px vertical padding
- **Normal sections** (content, features): 80px vertical padding
- **Loose sections** (breathing room): 96px vertical padding

Never compress below 40px between major sections.

### Alignment

- All sections left-aligned with container max-width
- Content should breathe; avoid walls of text
- Use consistent column-based positioning

---

## 6. Depth & Elevation

### Shadow System

| Level | Shadow | Use |
|-------|--------|-----|
| **None** | - | Flat elements, backgrounds |
| **Subtle** | 0 2px 4px rgba(0,0,0,0.08) | Slight elevation, hover states |
| **Medium** | 0 4px 8px rgba(0,0,0,0.12) | Cards, dropdowns, modals |
| **Strong** | 0 8px 16px rgba(0,0,0,0.16) | Elevated cards, floating elements |
| **Dramatic** | 0 16px 32px rgba(0,0,0,0.24) | Modals, overlays, heavy emphasis |

Apply shadows on light backgrounds: increase opacity by 10–20%. On dark backgrounds: use as-is.

### Elevation (Z-index)

```
0 — base/background
10 — cards, surfaces
20 — dropdowns, popovers
30 — modals, dialogs
40 — tooltips
50 — notifications
```

Keep layering predictable. Never skip levels.

### AI Glow Effect

Subtle radial glow accent for AI-related elements:

```css
background: radial-gradient(circle at 50% 50%, rgba(109, 131, 255, 0.15), transparent 70%);
```

Use sparingly on hero backgrounds, AI-powered badges, or focus states.

---

## 7. Do's and Don'ts

### ✅ Do

- Use Host Grotesk for all typography
- Maintain tight letter-spacing on headings (even when breathing room exists)
- Apply consistent shadows from the system
- Use the full blue palette (500–700 spectrum)
- Transition all color changes with 650ms timing
- Align to the 8px and 24px spacing scales
- Keep dark mode as the primary experience
- Use radial glows for AI-related or interactive elements
- Keep components rounded (8–12px radius)

### ❌ Don't

- Mix fonts. Host Grotesk only.
- Use serif typefaces anywhere
- Override spacing with random pixel values
- Apply custom shadows not in the system
- Use flat blue on flat blue (always vary value or contrast)
- Rush animations. 650ms is the baseline.
- Create spacious light mode as the default
- Use harsh black (#000000) — use `#0b1220` instead
- Round corners below 8px or above 12px (except inline elements)
- Add decorative gradients (reserve gradients for functional UI)

### Anti-patterns to Avoid

- "AI purple" or "AI blue" on everything — use accents sparingly
- Decorative illustrations competing with content
- Three-column card grids below 1280px (collapses badly)
- Thin font weights below 14px (readability issues on dark)
- Mixing serif and sans-serif in the same section
- Opacity stacking shadows (creates muddy depth)

---

## 8. Responsive Behavior

### Breakpoints

```
Mobile: 0–639px
Tablet: 640–1023px
Desktop: 1024px+
Large desktop: 1280px+
```

### Typography Scaling

- **Mobile:** body-md 14px, h1 28px, h2 24px
- **Tablet:** body-md 15px, h1 32px, h2 28px
- **Desktop:** body-md 15.5px, h1 40px, h2 32px (base)
- **Large desktop:** body-md 15.75px, h1 40px, h2 32px (subtle increase)

### Layout Collapsing

- **Multi-column grids:** collapse to single column below 768px
- **Sidebars:** move below main content or hide (nav drawer)
- **Cards:** stack vertically on mobile, 2-column on tablet, 3+ on desktop
- **Padding:** reduce from 48px (desktop) to 20px (mobile) as viewport narrows

### Touch Targets

- Minimum 48px × 48px for interactive elements on mobile
- 44px × 44px acceptable for close buttons, secondary actions
- Increase spacing between touch targets on mobile (min 8px gap)

### Images & Media

- Full-width on mobile (minus padding)
- Max-width container on tablet/desktop
- Aspect ratios: 16:9 (hero), 4:3 (cards), 1:1 (avatars)

---

## 9. Agent Prompt Guide

**Quick color reference:**
```
Primary: #4c6fff (blue-600)
Secondary: #5b7cff (blue-500)
Pressed: #3e5ae0 (blue-700)
Glow: #6d83ff (focus rings, AI effects)
Dark bg: #0b1220
Text (dark mode): #f3f5fa
```

**Quick typography reference:**
```
All fonts: Host Grotesk
Headings: 700 weight, -0.05em tracking
Body: 400 weight, 15.5px default
Buttons: 600 weight, 12px padding vertical
```

**When building UI:**

1. Read this DESIGN.md first
2. Use colors from the palette above
3. Apply typography from Section 3
4. Style components using Section 4 as template
5. Respect spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 80, 96px
6. Add shadows from Section 6
7. Test on mobile (breakpoint 640px), tablet (1024px), desktop (1280px+)
8. All transitions: 650ms cubic-bezier(0.22, 1, 0.36, 1)

**Example prompt for agent:**
```
"Build a hero section using prochat DESIGN.md. 
Use blue-600 for the CTA button, Host Grotesk for heading. 
Apply dark background (#0b1220), add subtle glow on hover. 
Ensure responsive below 768px."
```

---

## Metadata

- **Brand:** prochat.tools
- **Extracted:** 2026-04-10
- **Tech stack:** Next.js 14, TypeScript, Tailwind CSS v3, shadcn/ui
- **Mode:** Dark-first (light mode secondary)
- **Font:** Host Grotesk (Google Fonts)
- **Color system:** Custom `--pc-*` CSS variables
- **Design system linter:** Available at `scripts/design/lint-design-system.mjs`

---

## Updates & Maintenance

This DESIGN.md is the source of truth for prochat.tools branding. Update it as the brand evolves. Keep the 9-section format.

All tools (Claude, Codex, Gemini) read this file. Changes propagate automatically.
