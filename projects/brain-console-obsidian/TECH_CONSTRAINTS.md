# Brain Console — Technology Constraints

## Runtime environment

The Brain Console is an **Obsidian plugin** — a TypeScript bundle loaded inside Obsidian's sandboxed Electron webview. This imposes hard constraints that define what is and is not possible for the UI.

---

## Hard limits (not negotiable)

### No React or component frameworks
Obsidian plugins render UI by writing **DOM strings directly** (via `el.innerHTML = ...` or `createEl()`). There is no React, Vue, Svelte, or any component runtime. shadcn/ui, Radix, and similar libraries are React-only and **cannot be installed or used**.

**What we can do instead:** Use shadcn/ui as a *visual reference* — copy its design tokens, spacing, color palette, and proportions into CSS. The result looks like shadcn but is plain HTML + CSS.

### No CDN or remote font loading
Obsidian opens in an Electron shell that may be offline or firewall-restricted. All fonts must be:
- Already bundled by Obsidian (e.g. **Inter** — Obsidian's own UI font)
- Already installed system-wide on the user's machine (e.g. **JetBrains Mono**, **SF Mono**)
- Or listed as safe fallbacks (system-ui, -apple-system, ui-monospace)

**Never** add `@import url('...')` or `@font-face` pointing to Google Fonts, Bunny Fonts, or any remote URL.

### No external JavaScript
All JS must be compiled into `dist/main.js` by esbuild at build time. No dynamic `import()` from CDN, no script tags, no external fetch for code.

### No npm packages with native bindings
Any npm package used in the plugin must be pure JavaScript, bundleable by esbuild. Packages with native Node.js addons (`.node` files) will not load inside the Obsidian webview.

---

## CSS rules

### Fonts available
| Purpose | Font | Reason available |
|---------|------|-----------------|
| UI text (default) | `'Inter'` | Obsidian bundles Inter as its UI font |
| Fallback sans | `system-ui, -apple-system, 'Helvetica Neue'` | System fonts |
| Code / values / mono | `'JetBrains Mono'` | Developer machine install |
| Mono fallback | `ui-monospace, 'SF Mono', Consolas` | System mono fonts |

**Rule:** Use `var(--bc-font-sans)` for all UI text, `var(--bc-font-mono)` for all code, generated output, dynamic values, status labels, and machine-generated text.

### Tailwind and PostCSS
Tailwind v4 is **compiled at build time** via `build.mjs` (PostCSS pipeline). Tailwind utility classes work in `styles.css` because the build step expands them. They do NOT work in TypeScript template strings — only CSS class names defined in `styles.css` are available at runtime.

### Design tokens
All visual values (color, spacing, radius, shadow, font size) must be defined as CSS custom properties in `:root` inside `styles.css`. Components reference these tokens — never hardcode values in TypeScript.

### Dark/light mode
Obsidian adds `body.theme-dark` or `body.theme-light` to the document body. Dark is the default. Light mode overrides go in `body.theme-light .brain-console { ... }`.

---

## Design system approach

**What we use:** CSS-only simulation of shadcn/ui's visual language.
- Token system mirrors shadcn zinc palette
- Component class names (`.bc-card`, `.bc-badge`, `.bc-button`) match shadcn vocabulary
- Typography, spacing, and radius follow shadcn defaults
- Dark mode is the primary mode

**What we do NOT use:** Actual shadcn component code, Radix UI primitives, React hooks, or any JavaScript from the shadcn repository.

**When evaluating designs:** Every design decision must be achievable with CSS classes + DOM strings. If it requires a React component, state hook, or external library — it cannot be implemented as-is.

---

## Color system

**Palette:** shadcn zinc (dark-first) with orange accent.
**No blue in UI chrome.** Blue (`--bc-info`) is reserved for semantic status only (e.g. "pending" state). The UI chrome uses only zinc grays + orange accent.
**Status colors** (green, yellow, red, neutral-gray) are used only for data indicators — never for decorative or structural elements.

---

## Deployment constraint

Three-step deploy, always in this exact order:
```
npm run build && npm run package && npm run install:active-vault
```
`dist/styles.css` (post-Tailwind build) is the CSS source. The root `styles.css` is the source file that feeds the build. Never deploy `styles.css` directly — always deploy from `dist/`.
