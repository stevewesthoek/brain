---
name: nextjs-fixed-header-hero-flex-overflow
description: Hero section content hides behind a fixed header on mobile despite correct pt-* — caused by flex items-center overflow behaviour with min-h.
---

# Next.js Fixed Header Hero Flex Overflow

## The insight
`flex items-center` centers children around the midpoint of the container.
When content height > (container height − padding), CSS still tries to center
around the midpoint — which means the top of the content goes *above* the
top padding. On mobile where hero content stacks tall, this pushes the heading
behind the fixed header even though `pt-28` is set correctly.

## When this applies
- Fixed/sticky header + `min-h-[100dvh]` hero with `flex items-center`
- Desktop looks correct; mobile shows content cut off at the top
- Adding more `pt-*` to the hero "helps a bit" but never fully fixes it
- The header is `fixed` and the hero has correct `pt-[header-height]`

## The approach
Don't use `justify-center`/`items-center` at the section level when mobile
content may overflow. Switch to `justify-start` on mobile (content flows
downward from the padding edge) and `lg:justify-center` on desktop where
content reliably fits.

## The fix
```tsx
// Replace h-screen + items-center with:
<section className="min-h-[100dvh] flex flex-col items-center justify-start lg:justify-center px-6 pt-28 pb-12">
```

Where `pt-28` (112px) = header height (72px logo + 2×20px `py-5` padding).

## Gotchas
- `h-screen` clips overflow instead of expanding — always prefer `min-h-[100dvh]`
- Use `100dvh` not `100vh` on mobile: `dvh` accounts for browser chrome
  (address bar collapsing), `vh` does not
- `pt-*` value must exactly match rendered header height — recalculate if
  header padding or logo size changes
- `absolute` header (scrolls away) vs `fixed` header (stays in viewport)
  are completely different bugs: confirm `fixed` before debugging overlap

## Context
Repo: jpv-bootcamp (pattern applies to any Next.js site with fixed header)
Discovered: 2026-04-07
Area: src/app/page.tsx — hero section
