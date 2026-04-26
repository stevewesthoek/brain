# HTML Slide Decks & Presentations

## Workflow

1. **Outline** — Slides, sections, content flow
2. **HTML structure** — Slide markup (divs or semantic elements)
3. **Visual theme** — Color palette, typography from `DESIGN.md` or `brand-spec.md`
4. **Content** — Text, images, diagrams
5. **Navigation** — Keyboard (arrow keys, space) + optional click controls
6. **Transitions** — Smooth, meaningful (not distracting)
7. **Verify** — Test in browser, keyboard navigation
8. **Export/Share** — HTML link or PPTX conversion

## HTML-First Approach

Build decks in HTML rather than exporting from design tools:
- Any browser can present (no software required)
- Full control over styling and animations
- Faster iteration than PowerPoint/Keynote
- Easy version control in git

Frameworks: custom HTML + CSS, Reveal.js, Impress.js, etc.

## Browser Presentation

- Full-screen mode (F11 or browser fullscreen)
- Keyboard: arrow keys or Space to advance
- Optional: presenter notes in sidebar or speaker view
- Optional: slide counter and timer

## PPTX Export Caveat

**Honest approach:**
- If local conversion tooling exists (Playwright + python-pptx), use it
- If tools are missing, produce HTML deck + clear export instructions
- Never claim "editable PPTX" without actual .pptx file generated

When available:
1. Use headless browser to capture each slide as PNG/SVG
2. Assemble into PPTX using `python-pptx` library
3. Embed web fonts so edits work offline
4. Test in PowerPoint before sharing

If tools unavailable, user can export manually:
```bash
# HTML → PNG (using available tools)
# PNG → PPTX (open PowerPoint, Insert > Pictures)
```

## Quality Checklist

- [ ] Slide content clear and scannable
- [ ] Typography hierarchy strong (size, weight, contrast)
- [ ] Transitions smooth, not annoying
- [ ] Navigation intuitive (arrow keys, space)
- [ ] Images high quality; proper alt text
- [ ] Brand colors/theme applied consistently
- [ ] Tested in target presentation software (browser + PowerPoint if PPTX)
