# Animations & Product Demo Videos

## Workflow

1. **Storyboard** — What moments does the animation show? (visual timeline)
2. **Key frames** — Define start, end, intermediate states
3. **HTML prototype** — Code animation using CSS or JavaScript
4. **Timing** — Duration, easing, stagger, delays
5. **Performance** — Test for smooth 60 FPS
6. **Verify in browser** — Play repeatedly, check on mobile
7. **Export** — Only if tools available (Playwright + ffmpeg)

## CSS vs. JavaScript

**CSS animations:** Simple, smooth, often GPU-accelerated
- `@keyframes` for repeating or one-shot animation
- Transitions for state changes (hover, active, etc.)
- `animation-delay: calc(var(--index) * 100ms)` for staggered reveals

**JavaScript (Framer Motion, GSAP):**
- Complex, choreographed sequences
- Scroll-triggered reveals or parallax
- **Before using:** Check that library exists in project dependencies
- Prefer Framer Motion for React; use GSAP for complex scroll work

**Default:** CSS first; escalate to JavaScript only if needed.

## Anti-Slop Rules

- **Transform + opacity only** (GPU-accelerated, smooth)
- Avoid animating `top`, `left`, `width`, `height` (causes layout repaints)
- Spring physics over linear (stiffness: 100, damping: 20)
- Staggered reveals for lists: never instant mount
- All animations serve a purpose (not just fluff)
- Include `prefers-reduced-motion` fallback for accessibility

## Performance Checklist

- [ ] 60 FPS target on modern hardware
- [ ] Smooth on mobile browsers (throttle to test)
- [ ] No jank or layout shifts
- [ ] Animations don't block interactions
- [ ] Loading times fast (cache-friendly)

## Export Checklist

**Before claiming MP4/GIF export:**
1. Verify Playwright or Puppeteer available
2. Verify ffmpeg available (for MP4) or imagemagick/gifsicle (for GIF)
3. Run export; confirm file generated and plays correctly
4. If tools missing, provide export-ready HTML + instructions

**Export fallback:**
```bash
# If ffmpeg unavailable:
# 1. Screenshot sequence with Playwright: playwright-screenshots/frame-*.png
# 2. User converts with available tools (online GIF maker, local ffmpeg if installed)
```

## Quality Checklist

- [ ] Animation timing feels natural (not too fast or slow)
- [ ] Easing curves meaningful (spring, ease-out, etc.)
- [ ] Stagger creates visual flow, not chaos
- [ ] Reduced-motion fallback present
- [ ] Tested on Chrome, Firefox, Safari, mobile
- [ ] Verified export file plays smoothly
