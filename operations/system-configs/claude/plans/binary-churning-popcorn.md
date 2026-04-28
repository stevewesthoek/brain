# Plan: Task 12 — Dashboard Composition Reset

## Context

The current dashboard renders all panels in a single vertical stack inside one `overflow-y-auto` container: DashboardOverview → PlanPlaceholderPanel → ExecutionFlowPreview → ExecutionHandoffPanel → KnowledgeSourcesPanel → ActiveContextPanel → InfoPanels. This creates a giant center-column scrollbar and violates DESIGN.md's "no page scroll" rule. The left rail nav items are decorative `<div>` elements with no click handlers. This task converts the dashboard into a real section-based control center.

**Huashu skill found:** `/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/huashu-design/SKILL.md` — read and confirmed.

---

## Files to Change

1. `apps/web/src/app/dashboard/page.tsx` — section state, nav buttons, conditional rendering
2. `apps/web/src/app/dashboard/components/InsightPanel.tsx` — add `section` prop, contextual right panel
3. `apps/web/src/app/dashboard/components/KnowledgeSourcesPanel.tsx` — internal scroll on source list

**Files NOT to change:**
- DashboardShell.tsx, DashboardTopBar.tsx, DashboardOverview.tsx, PlanPlaceholderPanel.tsx, ExecutionFlowPreview.tsx, ExecutionHandoffPanel.tsx, ActiveContextPanel.tsx, InfoPanels.tsx
- All protected files (openapi, custom GPT instructions, globals.css, tailwind.config.ts)

---

## Change 1: page.tsx

### Add type + state
```ts
type DashboardSection = 'overview' | 'sources' | 'plan' | 'handoff' | 'settings'
const [activeDashboardSection, setActiveDashboardSection] = useState<DashboardSection>('overview')
```

### Remove ref that is no longer used
Remove `knowledgeSourcesRef` — it was only used to `scrollIntoView` to the sources section.  
Keep `addSourceFormRef` — still passed to KnowledgeSourcesPanel internally.

### Left rail: 5 real nav buttons
Replace the three decorative `<div>` nav items with five `<button>` elements:
- Overview, Sources, Plan, Handoff, Settings
- Active state: `bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-50 font-medium`
- Inactive state: `text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900`

### Main content: conditional section rendering
Change main content wrapper from `overflow-y-auto` to `overflow-hidden flex flex-col`. Each section fills the space with its own layout.

**Overview section** (default, no scroll):
```
<div class="flex-1 overflow-hidden p-6 flex flex-col gap-5">
  {error && <ErrorBanner />}      ← inline, extracted from old placement
  <DashboardOverview />            ← metrics + manage/add buttons
  <div class="flex-1 min-h-0">
    <PlanPlaceholderPanel />       ← fills remaining height
  </div>
</div>
```
- `onManageSources` → `setActiveDashboardSection('sources')` (no more scrollIntoView)
- `onAddSource` → `setActiveDashboardSection('sources')`

**Sources section** (internal scroll on list):
```
<div class="flex-1 overflow-hidden flex flex-col">
  <KnowledgeSourcesPanel />        ← source list has overflow-y-auto (see Change 3)
</div>
```

**Plan section** (no scroll — both components are compact/static):
```
<div class="flex-1 overflow-hidden p-6 flex flex-col gap-6">
  <PlanPlaceholderPanel />
  <ExecutionFlowPreview />
</div>
```

**Handoff section** (prompt boxes have their own scroll already):
```
<div class="flex-1 overflow-hidden p-6">
  <ExecutionHandoffPanel />        ← already has scrollable pre boxes internally
</div>
```

**Settings section** (gentle internal scroll acceptable for reference content):
```
<div class="flex-1 overflow-y-auto p-6 space-y-6">
  <ActiveContextPanel />
  <InfoPanels />
</div>
```

### InsightPanel: add section prop
Pass `section={activeDashboardSection}` to InsightPanel.

---

## Change 2: InsightPanel.tsx

Add `section: DashboardSection` prop (use `type DashboardSection = 'overview' | 'sources' | 'plan' | 'handoff' | 'settings'` locally or via import).

Replace static "Workflow Guidance" / "Handoff Readiness" content with section-contextual content:

| Section | Right panel content |
|---|---|
| overview | "Readiness" — compact next-step card derived from `loading`/`error`/`sourceCount` |
| sources | "Source Health" — short guide on index statuses, what to do if indexing stalls |
| plan | "Plan Lifecycle" — how BuildFlow plans and prompts work together |
| handoff | "Where to Paste" — paste Codex in terminal with `codex`, Claude Code in terminal with `claude` |
| settings | "Local Stack" — curl verification commands for ports 3052/3053/3054 |

Keep the component compact (no essays). Each contextual block: 2–4 lines max.  
Retain existing props: `loading`, `error`, `sourceCount` (still used for overview content).

---

## Change 3: KnowledgeSourcesPanel.tsx

The source list currently renders as `<div class="space-y-3">{sources.map(...)}</div>` with no height constraint. When this is the full Sources pane, the list can be long. Change the component structure to flex column so the source list area can scroll internally.

Structure change inside KnowledgeSourcesPanel:
- Outer wrapper: `flex flex-col h-full`
- Header/form area: fixed (natural height)
- Source list area: `flex-1 min-h-0 overflow-y-auto` with `py-3 space-y-3`

This confines the scroll to the list, not the full browser viewport.

---

## Layout Rules Maintained

- `h-screen overflow-hidden` stays on the root wrapper in page.tsx ✅
- No `min-h-screen` in dashboard ✅
- No `container mx-auto` in dashboard ✅
- Dark mode ancestor wrapper stays ✅
- Theme toggle, localStorage key, handoff copy — all untouched ✅

---

## Verification

```bash
pnpm --dir apps/web type-check
pnpm local:rebuild-web
pnpm local:verify
curl -sS http://127.0.0.1:3052/health | head -5
curl -sS http://127.0.0.1:3053/health | head -5
curl -sS http://127.0.0.1:3054/api/openapi | head -5
curl -sS http://127.0.0.1:3054/api/actions/status | head -5
curl -i -sS https://buildflow.prochat.tools/api/openapi | head -10
curl -i -sS https://buildflow.prochat.tools/api/actions/status | head -10
rg -n "h-screen|overflow-hidden|min-h-screen|container mx-auto" apps/web/src/app/dashboard
rg -n "/api/agent/" apps/web/src/app/dashboard/page.tsx
git diff --name-only -- docs/CUSTOM_GPT_INSTRUCTIONS.md docs/openapi.chatgpt.json apps/web/src/app/api/openapi/route.ts apps/web/src/app/globals.css
```
