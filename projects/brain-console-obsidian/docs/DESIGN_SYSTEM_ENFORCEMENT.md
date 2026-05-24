# Brain Console Design System — Enforcement & Guidelines

**Date:** 2026-05-24  
**Status:** Phase 3 Complete  
**Scope:** Global design rules, enforcement mechanisms, maintenance procedures

---

## Design System Rules

### ✅ ALLOWED Patterns

#### 1. CSS Variables (Preferred)
```typescript
// ✅ GOOD - Use CSS variables for any visual property
style="color: var(--bc-status-ok); margin: var(--bc-spacing-md);"
```

#### 2. Component Library (Preferred)
```typescript
// ✅ GOOD - StatusPill for status indicators
StatusPill({ status: 'ok', label: 'Connected' })

// ✅ GOOD - Badge for counts/metrics
Badge({ count: 42, status: 'warning' })

// ✅ GOOD - Progress for progress bars
Progress({ percent: 78, status: 'ok' })
```

#### 3. Dynamic Inline Styles (Data-Driven Only)
```typescript
// ✅ GOOD - Dynamic width based on data
style="width: ${(value / max) * 100}%"

// ✅ GOOD - Computed positions, sizes from API data
style="left: ${x}px; top: ${y}px;"
```

#### 4. Tailwind Utilities (Future)
```typescript
// ✅ GOOD - Tailwind classes reference tokens
class="bc-text-primary bc-spacing-md rounded"
```

---

### ❌ FORBIDDEN Patterns

#### 1. Hardcoded Colors
```typescript
// ❌ NEVER - Hardcoded hex values
style="color: #ff6b3d; background: #1a1f3a;"

// ✅ INSTEAD - Use CSS variables
style="color: var(--bc-accent); background: var(--bc-bg-surface);"
```

#### 2. Hardcoded Spacing
```typescript
// ❌ NEVER - Arbitrary pixel values
style="padding: 14px 18px; margin: 10px; gap: 8px;"

// ✅ INSTEAD - Use spacing tokens
style="padding: var(--bc-spacing-lg); margin: var(--bc-spacing-md); gap: var(--bc-spacing-sm);"
```

#### 3. Hardcoded Border Radius
```typescript
// ❌ NEVER - Different border-radius values
style="border-radius: 6px;" // Also used 999px, 4px, 3px elsewhere

// ✅ INSTEAD - Use standard radius
style="border-radius: var(--bc-radius);"
```

#### 4. color-mix Inline Styles
```typescript
// ❌ NEVER - Design logic in templates
style="background: color-mix(in srgb, #ff6b3d 20%, transparent);"

// ✅ INSTEAD - Use component library
StatusPill({ status: 'ok', label: 'Status' })
```

#### 5. Component Duplication
```typescript
// ❌ NEVER - Re-inventing components
const html = `<div style="background: var(--bc-bg-surface); border: 1px solid...">`;

// ✅ INSTEAD - Use component library
Card({ title: 'Title', content: 'Content' })
```

---

## Token Reference

### Colors (CSS Variables)

#### Palette
```css
--bc-bg-primary: #0a0e27        /* Main canvas */
--bc-bg-surface: #1a1f3a        /* Card background */
--bc-bg-secondary: #2a2f4a      /* Secondary surface */
--bc-bg-muted: #0f1320          /* Darkest */

--bc-text-primary: #e5e7eb      /* Main text */
--bc-text-secondary: #9ca3af    /* Secondary text */
--bc-text-muted: #6b7280        /* Muted text */

--bc-accent: #ff6b3d            /* Primary accent */
--bc-accent-hover: #e55a2c      /* Hover state */
--bc-accent-faded: rgba(255,107,61,0.2)  /* Faded */

--bc-status-ok: #4ade80         /* Success */
--bc-status-warning: #facc15    /* Warning */
--bc-status-error: #ef4444      /* Error */
--bc-status-review: #f59e0b     /* Review */
--bc-status-preview: #ff6b3d    /* Preview */
--bc-status-disabled: #9ca3af   /* Disabled */

--bc-border-default: #2d3354    /* Standard border */
--bc-border-hover: #4a4a4a      /* Hover border */
--bc-border-strong: #3d4558     /* Strong border */
```

### Spacing (4px Base Unit)
```css
--bc-spacing-xs: 4px        /* Minimal */
--bc-spacing-sm: 8px        /* Small */
--bc-spacing-md: 12px       /* Medium (standard) */
--bc-spacing-lg: 16px       /* Large */
--bc-spacing-xl: 20px       /* Extra large */
--bc-spacing-2xl: 24px      /* 2x large */
```

### Border Radius
```css
--bc-radius: 4px            /* Single standard value */
```

### Typography
```css
--bc-font-cmd-bar: 0.95rem;
--bc-font-weight-cmd-bar: 700;
--bc-font-line-height-cmd-bar: 1.4;

--bc-font-section-header: 0.75rem;
--bc-font-family-section-header: monospace;
--bc-font-line-height-section-header: 1.2;

/* ... (see DESIGN_TOKENS.md for complete list) */
```

---

## Component Library API

### Core Components

#### StatusPill
```typescript
StatusPill({
  status: 'ok' | 'warning' | 'error' | 'review' | 'preview' | 'disabled',
  label: string,
  icon?: string,  // Default: '●'
  className?: string,
})
// Use for: Status indicators, connection states, health checks
```

#### Badge
```typescript
Badge({
  count: number | string,
  status: 'ok' | 'warning' | 'error' | 'preview' | 'disabled',
  className?: string,
})
// Use for: Counts, metrics, brief status indicators
```

#### Card
```typescript
Card({
  title?: string,
  content: string,
  statusBorder?: 'ok' | 'warning' | 'error' | 'review' | 'preview' | 'disabled',
  className?: string,
})
// Use for: Information containers, panels, cards
```

#### Progress
```typescript
Progress({
  percent: number,
  status?: 'ok' | 'warning' | 'error',
  showLabel?: boolean,
  className?: string,
})
// Use for: Progress bars, completion indicators
```

#### Button
```typescript
Button({
  label: string,
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost',
  disabled?: boolean,
  className?: string,
  onClick?: () => void,
  title?: string,
})
// Use for: Action buttons, CTAs, interactions
```

#### Table
```typescript
Table({
  columns: string[],
  columnLabels?: string[],
  rows: Array<Record<string, any>>,
  className?: string,
})
// Use for: Data grids, lists, tabular data
```

#### Tab
```typescript
Tab({
  label: string,
  isActive?: boolean,
  count?: number,
  onClick?: () => void,
  className?: string,
})
// Use for: Navigation tabs, grouped content
```

#### StatusPill
```typescript
StatusPill({
  status: 'online' | 'degraded' | 'error' | 'review' | 'preview' | 'disabled',
  label: string,
  icon?: string,
  className?: string,
})
// Use for: System status, health checks
```

#### ActivityLog
```typescript
ActivityLog({
  entries: Array<{
    timestamp: string,
    message: string,
    status?: 'ok' | 'warning' | 'error' | 'pending',
  }>,
  maxEntries?: number,
  className?: string,
})
// Use for: Event logs, activity streams, history
```

#### Alert
```typescript
Alert({
  title?: string,
  message: string,
  status: 'error' | 'warning' | 'success' | 'info',
  className?: string,
})
// Use for: Error messages, notifications, alerts
```

#### Input
```typescript
Input({
  placeholder?: string,
  value?: string,
  type?: 'text' | 'password' | 'email' | 'number',
  className?: string,
  onChange?: (value: string) => void,
})
// Use for: Form inputs, text entry
```

#### Select
```typescript
Select({
  options: Array<{ value: string | number; label: string }>,
  value?: string | number,
  placeholder?: string,
  className?: string,
  onChange?: (value: string) => void,
})
// Use for: Dropdowns, option selection
```

#### Layout Components

##### Flex
```typescript
Flex({
  direction?: 'row' | 'column',
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  align?: 'start' | 'center' | 'end' | 'stretch',
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly',
  children: string,
  className?: string,
})
// Use for: Flexible layouts, responsive rows/columns
```

##### Grid
```typescript
Grid({
  columns?: number,
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  children: string,
  className?: string,
})
// Use for: Grid layouts, card grids
```

##### Divider
```typescript
Divider({ className?: string })
// Use for: Section separators, visual breaks
```

##### Spacer
```typescript
Spacer({
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl',
  className?: string,
})
// Use for: Vertical spacing, layout gaps
```

---

## Code Review Checklist

When reviewing VO component code, check for:

### ✅ Pre-Submit
- [ ] No hardcoded hex colors (#xxx)
- [ ] No hardcoded spacing (8px, 10px, etc.) outside data-driven context
- [ ] No inconsistent border-radius values
- [ ] Status indicators use StatusPill() or Badge()
- [ ] Cards use Card() component
- [ ] Progress bars use Progress() or inline width only
- [ ] CSS variables used for all design properties
- [ ] Component library imported where needed
- [ ] TypeScript typechecks: 0 errors
- [ ] Build succeeds with no warnings

### ✅ Design System Compliance
- [ ] Colors: All from token list (CSS variables)
- [ ] Spacing: All from spacing scale (xs/sm/md/lg/xl/2xl)
- [ ] Border-radius: Only --bc-radius used
- [ ] Typography: Uses defined text roles
- [ ] Components: Uses component library

### ✅ Visual Consistency
- [ ] Colors match Brain Console dark cockpit aesthetic
- [ ] Spacing visually consistent with other panels
- [ ] Border radius consistent (4px standard)
- [ ] Status colors match defined palette

---

## Maintenance Procedures

### Weekly: Visual Audit
```bash
# Check for color drifts
grep -r 'style="[^"]*#[0-9a-f]' src/components/VO/

# Check for spacing drifts
grep -r 'style="[^"]*px' src/components/VO/ | grep -v 'width.*%' | grep -v 'left.*px' | grep -v 'top.*px'

# Check for border-radius drifts
grep -r 'border-radius.*[0-9]px' src/components/VO/ | grep -v 'var(--bc-radius)'
```

### Monthly: Design Consistency Report
```bash
# Generate component compliance report
echo "=== Design System Compliance ===" && \
npm run typecheck && \
echo "✓ TypeScript clean" && \
npm run build && \
echo "✓ Build succeeds"
```

### Quarterly: Token Audit
- Review all CSS variables in use
- Check for duplicates or near-duplicates
- Verify spacing scale consistency
- Audit color usage across all components

---

## Escalation Procedures

### Issue: Color Mismatch
1. Compare against token list (DESIGN_TOKENS.md)
2. If not in list: Add to list + update CSS variables
3. If in list: Update component to use variable
4. Code review to catch future occurrences

### Issue: Spacing Inconsistency
1. Check which spacing scale value should be used
2. If not in scale: Consider if new scale value needed
3. Update all affected components to use standard token
4. Update tests

### Issue: Border Radius Variation
1. All border-radius should be 4px
2. Replace non-standard values with var(--bc-radius)
3. If special case needed: Add new token (--bc-radius-lg, etc.)
4. Document exception in this guide

### Issue: Component Duplication
1. Is there an existing component that solves this?
2. If yes: Refactor to use existing component
3. If no: Add to component library + document usage
4. Update code review checklist

---

## Performance Considerations

### Bundle Size
- Current: 433 KB (2.3% increase from Phase 0)
- Target: <450 KB
- Monitoring: `npm run build` output in CI

### Render Performance
- Component functions are pure (no side effects)
- HTML strings generated server-side (no DOM manipulation)
- CSS is static (no runtime recalculation)
- Zero JavaScript runtime overhead

### CSS File Size
- Current: 6,303 lines (110 KB)
- Tree-shaking enabled: Unused Tailwind utilities removed
- No performance regression observed

---

## Accessibility Guidelines

### Colors
- [ ] Color is never the only visual indicator
- [ ] Status always has text + icon in addition to color
- [ ] Text contrast ≥ 4.5:1 (WCAG AA)

### Components
- [ ] Buttons have visible labels or aria-label
- [ ] Truncated text has title attribute or tooltip
- [ ] Status indicators have both color + text
- [ ] Form inputs have associated labels

### Keyboard Navigation
- [ ] Tab order is logical
- [ ] Focus indicators visible
- [ ] All interactions keyboard-accessible

---

## Future Enhancements

### Phase 4: Responsive Design
- [ ] Add responsive table component
- [ ] Test at mobile/tablet breakpoints
- [ ] Document responsive patterns

### Phase 5: Theming System
- [ ] Light mode variant
- [ ] High-contrast mode
- [ ] Custom theme support

### Phase 6: Advanced Components
- [ ] Date picker
- [ ] Time selector
- [ ] Multi-select dropdown
- [ ] Rich text editor

---

## Reference Documents

- [Design Tokens](./DESIGN_TOKENS.md) — Complete token reference
- [Component Usage](./SHADCN_COMPONENT_USAGE.md) — Usage examples
- [Architecture](../README.md) — System overview

---

## Support

For questions about the design system:
1. Check [DESIGN_TOKENS.md](./DESIGN_TOKENS.md) for token definitions
2. Check [SHADCN_COMPONENT_USAGE.md](./SHADCN_COMPONENT_USAGE.md) for component examples
3. Review existing component implementations
4. Escalate to design team if still unclear

---

**Phase 3 Complete.** Design system is documented, enforced, and ready for long-term maintenance.
