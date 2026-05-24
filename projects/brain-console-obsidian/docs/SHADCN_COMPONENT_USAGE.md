# shadcn-ui Component Usage Guide

Quick reference for using the Brain Console shadcn component library in TypeScript code.

---

## Import

```typescript
import {
  Button,
  Card,
  Badge,
  Progress,
  Tab,
  StatusPill,
  Table,
  ActivityLog,
  Alert,
  Input,
  Select,
  Divider,
  Spacer,
  Flex,
  Grid,
} from '../components/Design/shadcn-components';
```

---

## Basic Patterns

### Building a Card with Status

```typescript
// Before: scattered inline styles
const html = `
  <div style="background: #1a1f3a; border: 1px solid #2d3354; border-left: 4px solid #4ade80;">
    <div style="font-size: 0.9rem; font-weight: 600;">System Health</div>
    <div style="color: #9ca3af; margin-top: 12px;">Status: OK</div>
  </div>
`;

// After: component-based
const html = Card({
  title: 'System Health',
  content: 'Status: OK',
  statusBorder: 'ok',
});
```

### Status Indicators

```typescript
// Status Pill (with icon)
StatusPill({
  status: 'online',
  label: 'Brain Core',
  icon: '✓',
});

// Badge (compact count)
Badge({
  count: 8,
  status: 'warning',
});
```

### Progress Indicator

```typescript
// Before: hardcoded progress bar
const html = `<div style="width: 100%; height: 8px; background: #2a2f4a;">
  <div style="width: 60%; height: 100%; background: #ff6b3d;"></div>
</div>60%`;

// After: component
const html = Progress({
  percent: 60,
  status: 'ok',
  showLabel: true,
});
```

### Building a Table

```typescript
// Before: scattered <table> markup with hardcoded column widths
const html = `
  <table style="width: 100%;">
    <thead>
      <tr>
        <th style="width: 100px;">Job ID</th>
        <th style="width: 80px;">Status</th>
      </tr>
    </thead>
    ...
  </table>
`;

// After: responsive component
const html = Table({
  columns: ['id', 'status', 'progress'],
  columnLabels: ['Job ID', 'Status', 'Progress'],
  rows: [
    { id: 'abc123', status: 'running', progress: '75%' },
    { id: 'def456', status: 'pending', progress: '0%' },
  ],
});
```

### Layout with Flex

```typescript
// Before: manual flex styling
const html = `
  <div style="display: flex; gap: 12px; align-items: center;">
    <span>Label</span>
    <span>Value</span>
  </div>
`;

// After: component
const html = Flex({
  direction: 'row',
  gap: 'md',
  align: 'center',
  justify: 'start',
  children: '<span>Label</span><span>Value</span>',
});
```

### Grid Layout

```typescript
// Before: hardcoded grid
const html = `
  <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
    ${card1}${card2}${card3}
  </div>
`;

// After: component
const html = Grid({
  columns: 3,
  gap: 'md',
  children: `${card1}${card2}${card3}`,
});
```

---

## Real-World Examples

### Example 1: Activity Panel

```typescript
import { ActivityLog, Card, Spacer } from '../components/Design/shadcn-components';

function renderActivityPanel(events) {
  return Card({
    title: 'Recent Activity',
    content: `
      ${ActivityLog({
        entries: events.map(e => ({
          timestamp: e.timestamp,
          message: e.message,
          status: e.level, // 'ok' | 'warning' | 'error' | 'pending'
        })),
        maxEntries: 20,
      })}
    `,
  });
}
```

### Example 2: Status Dashboard

```typescript
import { StatusPill, Card, Flex, Badge, Spacer } from '../components/Design/shadcn-components';

function renderStatusDashboard(systemStatus) {
  return `
    <div>
      ${Card({
        content: Flex({
          direction: 'row',
          gap: 'lg',
          justify: 'between',
          align: 'center',
          children: `
            ${StatusPill({
              status: systemStatus.brainCore.status,
              label: 'Brain Core',
            })}
            ${StatusPill({
              status: systemStatus.modelRouter.status,
              label: 'Model Router',
            })}
            ${StatusPill({
              status: systemStatus.wiki.status,
              label: 'Wiki',
            })}
            ${Badge({
              count: systemStatus.pendingApprovals,
              status: systemStatus.pendingApprovals > 0 ? 'warning' : 'ok',
            })}
          `,
        }).title: 'System Status'}
      )}
    </div>
  `;
}
```

### Example 3: Job Queue Table

```typescript
import { Table, Badge, Progress, Spacer } from '../components/Design/shadcn-components';

function renderJobQueue(jobs) {
  const rows = jobs.map(job => ({
    id: job.id.slice(0, 8),
    account: job.account,
    phase: job.currentPhase,
    progress: Progress({
      percent: job.progressPercent,
      status: job.progressPercent === 100 ? 'ok' : 'ok',
    }),
    status: Badge({
      count: job.status === 'running' ? '...' : job.status,
      status: job.status === 'error' ? 'error' : 'ok',
    }),
  }));

  return Table({
    columns: ['id', 'account', 'phase', 'progress', 'status'],
    columnLabels: ['Job ID', 'Account', 'Phase', 'Progress', 'Status'],
    rows,
  });
}
```

### Example 4: Control Panel with Buttons

```typescript
import { Button, Flex, Alert, Spacer } from '../components/Design/shadcn-components';

function renderControlPanel(isRunning) {
  return `
    ${Alert({
      title: 'Note',
      message: 'Publishing is approval-gated. Please request approval first.',
      status: 'info',
    })}
    ${Spacer({ size: 'md' })}
    ${Flex({
      direction: 'row',
      gap: 'md',
      justify: 'start',
      children: `
        ${Button({
          label: isRunning ? 'Stop' : 'Start',
          variant: 'primary',
        })}
        ${Button({
          label: 'Request Approval',
          variant: 'secondary',
        })}
        ${Button({
          label: 'Preview',
          variant: 'outline',
        })}
      `,
    })}
  `;
}
```

---

## CSS Variable Access in TypeScript

Components automatically use CSS variables. To access variables in JavaScript:

```typescript
// Get computed CSS variable value
const accentColor = getComputedStyle(document.documentElement)
  .getPropertyValue('--bc-accent')
  .trim(); // '#ff6b3d'

const spacingMd = getComputedStyle(document.documentElement)
  .getPropertyValue('--bc-spacing-md')
  .trim(); // '12px'
```

---

## Component Props Reference

### Shared Props

Most components accept:
- `className?: string` — additional CSS classes

### Status Values

Used by: `Badge`, `Progress`, `StatusPill`, `Card`

```typescript
type Status = 'ok' | 'warning' | 'error' | 'review' | 'preview' | 'disabled';
```

### Spacing Values

Used by: `Spacer`, `Flex`, `Grid`

```typescript
type SpacingSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
// Maps to: 4px, 8px, 12px, 16px, 20px, 24px
```

### Direction Values

Used by: `Flex`

```typescript
type Direction = 'row' | 'column';
```

### Alignment Values

Used by: `Flex`

```typescript
type Align = 'start' | 'center' | 'end' | 'stretch';
type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
```

---

## Common Mistakes

### ❌ Don't: Hardcode colors

```typescript
// WRONG
const html = `<div style="color: #ff6b3d;">Status</div>`;

// RIGHT
const html = `<div style="color: var(--bc-accent);">Status</div>`;
```

### ❌ Don't: Skip component library

```typescript
// WRONG
const card = `
  <div style="background: #1a1f3a; border: 1px solid #2d3354; padding: 16px;">
    ${content}
  </div>
`;

// RIGHT
const card = Card({ content });
```

### ❌ Don't: Mix inline styles with components

```typescript
// WRONG
const html = Button({ label: 'Click' }) + `<span style="margin-left: 8px;">Extra</span>`;

// RIGHT
const html = Flex({
  gap: 'sm',
  direction: 'row',
  children: Button({ label: 'Click' }) + '<span>Extra</span>',
});
```

### ✅ Do: Use CSS variables consistently

```typescript
// RIGHT - component-based
const html = Card({
  title: 'Title',
  content: 'Content',
  statusBorder: 'ok',
});

// RIGHT - CSS variables in custom HTML
const html = `
  <div style="
    background-color: var(--bc-bg-surface);
    padding: var(--bc-spacing-lg);
    border-radius: var(--bc-radius);
  ">
    Custom content
  </div>
`;
```

---

## Testing Components

All components are pure functions returning HTML strings. Test by:

1. **Rendering and inspecting HTML output:**
   ```typescript
   const html = Card({ title: 'Test', content: 'Content' });
   console.log(html);
   // <div class="bc-card">...
   ```

2. **Checking CSS class presence:**
   ```typescript
   const html = Badge({ count: 5, status: 'ok' });
   expect(html).toContain('bc-badge');
   expect(html).toContain('ok');
   ```

3. **Verifying CSS variables are referenced:**
   ```typescript
   const html = Button({ label: 'Click' });
   expect(html).toContain('class=');
   expect(html).toContain('bc-button');
   ```

---

## Performance Tips

- ✅ Components are pure functions (no side effects)
- ✅ HTML strings are generated server-side (no DOM manipulation)
- ✅ CSS is static (no runtime style recalculation)
- ✅ Tailwind utilities are tree-shaken (unused CSS removed)
- ✅ No JavaScript event listeners attached by components

Performance is determined by rendering performance, not component library overhead.

---

## Troubleshooting

### Styles not applying

**Symptom:** Component renders but styles don't appear

**Fix:** Ensure `dist/styles.css` is loaded in Obsidian plugin:
```typescript
// In main.ts
import './styles.css';
```

### Component output looks different

**Symptom:** Components render differently than expected

**Fix:** Check that CSS variables are defined in `:root`:
```bash
grep --bc-accent dist/styles.css | head -1
```

### Colors don't match design spec

**Symptom:** Colors appear off

**Fix:** Verify theme is loaded (not using Obsidian default theme):
```typescript
// Check computed value
const accent = getComputedStyle(document.documentElement)
  .getPropertyValue('--bc-accent')
  .trim();
console.log(accent); // Should be '#ff6b3d'
```

---

## Next Steps

- [Design Tokens Reference](./DESIGN_TOKENS.md)
- [Brain Console Architecture](../projects/brain-console-obsidian/README.md)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [shadcn/ui Library](https://ui.shadcn.com/)
