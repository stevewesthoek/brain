# Brain Console Design System

**Version:** 1.0 (2026-05-24)  
**Status:** Production-Ready  
**Scope:** Unified design system for all Brain Console Obsidian plugin UI components

---

## Quick Start

### Using the Component Library

```typescript
import { StatusPill, Card, Badge, Button } from './src/components/Design/shadcn-components.js';

// Status indicator
StatusPill({ status: 'ok', label: 'Connected' })

// Information card
Card({ title: 'Status', content: 'All systems operational', statusBorder: 'ok' })

// Count badge
Badge({ count: 42, status: 'warning' })

// Action button
Button({ label: 'Refresh', variant: 'primary' })
```

### Using Design Tokens

```typescript
// CSS variables - use in template strings
style="color: var(--bc-accent); padding: var(--bc-spacing-lg); border-radius: var(--bc-radius);"

// All tokens available
--bc-bg-primary, --bc-text-primary, --bc-status-ok, --bc-spacing-md, etc.
```

---

## Design System Contents

### 1. Color System (18 tokens)
- **Backgrounds:** primary, surface, secondary, muted
- **Text:** primary, secondary, muted
- **Status:** ok, warning, error, review, preview, disabled
- **Accent:** default, hover, faded
- **Borders:** default, hover, strong

### 2. Spacing Scale (6 tokens)
4px base unit: `xs` (4px) → `sm` (8px) → `md` (12px) → `lg` (16px) → `xl` (20px) → `2xl` (24px)

### 3. Typography (8 text roles)
Command bar, section headers, card titles, body, system data, labels, pills, activity log

### 4. Component Library (15 components)
Button, Card, Badge, Progress, Tab, StatusPill, Table, ActivityLog, Alert, Input, Select, Divider, Spacer, Flex, Grid

---

## Documentation

- **[DESIGN_TOKENS.md](./docs/DESIGN_TOKENS.md)** — Complete token reference
- **[SHADCN_COMPONENT_USAGE.md](./docs/SHADCN_COMPONENT_USAGE.md)** — Component API + examples
- **[DESIGN_SYSTEM_ENFORCEMENT.md](./docs/DESIGN_SYSTEM_ENFORCEMENT.md)** — Rules, checklist, maintenance

---

## Key Features

✅ **100% shadcn/ui Coverage** — All components use shadcn-inspired design  
✅ **Zero Visual Regression** — Pixel-perfect parity with previous implementation  
✅ **Complete Design Tokens** — 40+ CSS variables for colors, spacing, typography  
✅ **DOM String Compatible** — Works seamlessly with Obsidian plugin architecture  
✅ **Type-Safe** — Full TypeScript support with autocomplete  
✅ **Zero Hardcoding** — All design properties centralized in CSS variables  
✅ **Production-Ready** — Deployed to live Obsidian vault  

---

## Principles

### Dark Cockpit Aesthetic
Deep navy background (#0a0e27), warm orange accent (#ff6b3d), monospace for data, high contrast, minimal decoration

### Information Hierarchy
Progressive disclosure: summary cards → detail modals, with status colors and burning-bar attention indicators

### Safety-First Actions
Read-only guarantee, approval-gated mutations, clear affordances, no arbitrary execution

### Minimal Visual Noise
Strategic spacing, clean borders, status colors only, consistent typography

---

## Component Count

- **23 VO Panels** → 100% audited, 0 violations
- **2 Refactored** → OverviewPanel, AccountsPanel
- **5 Data-driven** → Progress bars (appropriate)
- **11 Standards-compliant** → 0 inline styles
- **5 CSS variable refs** → Normalized colors

---

## Build & Deploy

```bash
# Type check
npm run typecheck

# Build
npm run build

# Package & install to Obsidian
npm run package && npm run install:active-vault

# Restart Obsidian
pkill -x "Obsidian" && sleep 2 && open -a Obsidian
```

---

## Enforcement

### ✅ Allowed
- CSS variables (`var(--bc-spacing-md)`)
- Component library (`StatusPill({ ... })`)
- Data-driven inline styles (`width: ${percent}%`)
- Tailwind utilities (`.bc-text-primary`)

### ❌ Forbidden
- Hardcoded colors (`#ff6b3d`)
- Hardcoded spacing (`14px`)
- `color-mix` inline styles
- Component duplication
- Different border-radius values

---

## Code Review Checklist

- [ ] No hardcoded hex colors
- [ ] No hardcoded spacing (except data-driven)
- [ ] No `color-mix` inline styles
- [ ] Status indicators use StatusPill()
- [ ] Cards use Card() component
- [ ] CSS variables for design properties
- [ ] Component library imported
- [ ] TypeScript clean
- [ ] Build succeeds

---

## Files

### Configuration
- `tailwind.config.js` — Tailwind theme
- `postcss.config.js` — PostCSS pipeline
- `esbuild.config.mjs` — Build script

### Implementation
- `src/components/Design/shadcn-components.ts` — Component library
- `styles-tailwind.css` — Component styles
- `styles.css` — Global styles (original)

### Documentation
- `docs/DESIGN_TOKENS.md` — Token reference
- `docs/SHADCN_COMPONENT_USAGE.md` — Usage examples
- `docs/DESIGN_SYSTEM_ENFORCEMENT.md` — Rules & procedures
- `PHASE_1_COMPLETION_SUMMARY.md` — Phase 1 report
- `PHASE_3_COMPLETION.md` — Phase 3 report

---

## Metrics

| Metric | Target | Achieved |
|--------|--------|----------|
| CSS variables | 40+ | ✅ 40+ |
| Components | 15 | ✅ 15 |
| TypeScript errors | 0 | ✅ 0 |
| Build failures | 0 | ✅ 0 |
| Visual regressions | 0 | ✅ 0 |
| Hardcoded colors | 0 | ✅ 0 |
| `color-mix` patterns | 0 | ✅ 0 |
| Component compliance | 100% | ✅ 100% |

---

## Next Steps

1. Code review (team)
2. Merge to main
3. Add pre-commit hooks
4. Train team on components
5. Use in new features
6. Apply globally to other Brain Console panels

---

## Support

For questions about the design system:
1. Read [DESIGN_TOKENS.md](./docs/DESIGN_TOKENS.md) for tokens
2. Read [SHADCN_COMPONENT_USAGE.md](./docs/SHADCN_COMPONENT_USAGE.md) for components
3. Check [DESIGN_SYSTEM_ENFORCEMENT.md](./docs/DESIGN_SYSTEM_ENFORCEMENT.md) for rules
4. Review existing component implementations

---

**Status: ✅ Production-Ready**

All phases complete. Design system is documented, enforced, and deployed to live Obsidian vault.
