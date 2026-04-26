# Export-Ready Sources & Media Exports

## Export Honesty Rules

- **Never claim export success without generated files**
- **Before using export tools, verify they exist**
- **If tools missing, provide export-ready source + exact commands**
- **Test export output before handing to user**

## PNG Export (Raster/Static)

Use case: High-resolution static screenshot for sharing, embedding, print-preview.

**Workflow:**
1. Open HTML at specific viewport (e.g., 1920x1080 for full-page)
2. Use Playwright or Puppeteer to capture as PNG
3. For print: capture at 300 DPI (scale 3x); verify color accuracy

**Tools check:**
```bash
# Check if Playwright available
npm list @playwright/test || echo "Playwright not installed"
```

If unavailable: Provide HTML link; user screenshots manually or uses browser DevTools.

## PDF Export (Print-Ready)

Use case: Multi-page report, presentation print-out, archival.

**Workflow:**
1. Ensure fonts embedded or available in browser
2. Use Playwright to generate PDF from HTML
3. Verify: page breaks, color rendering, font smoothness

**Tools check:** Same as PNG (Playwright).

If unavailable: Provide print-friendly HTML; user prints from browser (⌘P or Ctrl+P).

## SVG Export (Scalable Vector)

Use case: Logos, icons, diagrams that scale losslessly.

**Approach:**
- Build directly as inline SVG in HTML
- Or use Playwright/Puppeteer to convert HTML DOM to SVG (limited fidelity)
- Best practice: create SVG source directly, not as export

If exporting DOM to SVG:
- Complex interactions won't transfer
- Static graphics only
- Verify output visually before sharing

## GIF Export (Animated Loop)

Use case: Social media, email, instant preview of animation.

**Workflow:**
1. Use Playwright to capture screenshots at intervals (e.g., 30 FPS)
2. Stitch with gifsicle or imagemagick:
   ```bash
   gifsicle -d 33 frame-*.png > output.gif
   ```
3. Optimize file size (often 50% reduction possible)

**Tools check:**
```bash
which gifsicle || echo "gifsicle not installed"
which ffmpeg || echo "ffmpeg not installed"
```

If unavailable:
- Provide HTML animation link
- Provide frame screenshots in folder
- User can upload to online GIF maker

## MP4 Export (Video/Streaming)

Use case: Product demo, launch animation, wide platform support.

**Workflow:**
1. Use Playwright to capture screenshots at intervals
2. Stitch with ffmpeg:
   ```bash
   ffmpeg -framerate 30 -i frame-%04d.png -c:v libx264 -pix_fmt yuv420p output.mp4
   ```
3. Verify: playback, audio (if needed), file size

**Tools check:**
```bash
which ffmpeg || echo "ffmpeg not installed"
```

If unavailable:
- Provide HTML animation link
- Provide frame screenshots
- User converts with available online tools

## Export-Ready HTML (Fallback)

When tools are missing, always provide:
1. Self-contained HTML file (inline CSS/JS)
2. Screenshot showing expected output
3. **Exact export commands** for user to run locally:
   ```bash
   # For PNG screenshot:
   npx playwright test --headed

   # For MP4 (if ffmpeg installed):
   ffmpeg -framerate 30 -i frame-%04d.png -c:v libx264 output.mp4
   ```

## Quality Checklist

- [ ] Export file generated (if tools available)
- [ ] File size reasonable (optimize where possible)
- [ ] Colors accurate (test on target device/software)
- [ ] Playback/display smooth and clear
- [ ] Fonts embedded (for PDF) or web-safe
- [ ] Accessibility metadata preserved (alt text, etc.)
- [ ] Tested in target platform (email, social, print, etc.)
