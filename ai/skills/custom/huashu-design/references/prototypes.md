# Clickable Prototypes & Device Mockups

## Workflow

1. **HTML markup** — Structure from layout spec
2. **CSS styling** — Colors, typography, spacing from `DESIGN.md` or `brand-spec.md`
3. **Interactivity** — Navigation, form handling, state changes
4. **Responsiveness** — Mobile (320px), tablet (768px), desktop (1440px+)
5. **Verify** — Open in browser, click through all flows
6. **Iterate** — Refine based on feedback

## Single-File HTML Default

Prefer self-contained `.html` file with inline CSS/JS when possible:
- Easier to share and test
- No build step required
- Works immediately in browser

For complex projects: small folder with `index.html`, `style.css`, `script.js`.

## Device Mockups & Frames

Show how design looks on real devices:
- Simple CSS-based frame (border + shadow)
- Responsive mockup (multiple device sizes)
- Side-by-side phone + desktop comparison

Use CSS `aspect-ratio` and scale to simulate real device dimensions.

## Interaction States Checklist

Before shipping:
- [ ] All navigation links/buttons functional
- [ ] Forms have client-side validation
- [ ] Hover states visible and intentional
- [ ] Active/focus states clear (no generic `opacity-80`)
- [ ] Mobile touch targets ≥ 48px
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] Performance smooth (60 FPS target on interactions)

## Quality Checklist

- [ ] Pixels aligned; shadows consistent
- [ ] Typography hierarchy clear (size, weight, color)
- [ ] Whitespace intentional and breathes
- [ ] Brand colors/fonts applied consistently
- [ ] No Lorem Ipsum; use real/contextual placeholder data
- [ ] Tested on Chrome, Firefox, Safari, mobile Safari
