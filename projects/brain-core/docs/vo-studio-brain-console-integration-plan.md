# VO Studio — Brain Console Integration Plan

> Historical plan. This document reflects the older VO Studio integration approach. The active Brain Console boundary is now shared-only and project-specific authoring belongs in project repos.

**Date:** 2026-05-24  
**Status:** Ready for implementation  
**Scope:** Remove VO concepts from top-level Brain Console tabs; create single unified "Video Orchestrator" entry point  
**Phases:** Phase 10 (Dashboard completion) + Phase 11 (Brain Console integration)  

---

## Problem Statement

Current state: Studio, Orchestrators, Pipelines are top-level Brain Console tabs, competing with system infrastructure tabs (Infra, Monitoring, Apps, Sessions, etc.). This causes:
- Confusion about what each tab does
- Crowded top navigation
- Information cutoff in constrained viewport
- Misalignment with Brain Console design spec (lines 254-340)

Desired state: Single "Video Orchestrator" root tab containing scoped internal tabs (Overview, Studio, Pipelines, Accounts, History, Dashboard).

---

## Design Principles (From Research)

1. **Progressive disclosure:** Tabs manage complexity; users drill down without losing context
2. **Predictable hierarchy:** Each level maintains same tab structure (Airflow/Dagster pattern)
3. **Constrained viewport:** Horizontal tabs + collapsible cards conserve space better than sidebars
4. **Operational vs. Configuration split:** Studio = creation workflow; Pipelines = execution workflow; Dashboard = summary
5. **Dark cockpit aesthetic:** Reuse existing Brain Console CSS; no new theme

---

## Implementation Tasks

### Phase 10: Complete Dashboard Panel
- **Status:** In progress
- **Task:** Finish StudioDashboardPanel CSS styling
- **Acceptance:** Dashboard tab renders in VOShell with all 4 data sections (health, routing, webhooks, events)

### Phase 11: Brain Console Integration

#### Task 1: Update Brain Console Tab Structure

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/src/view.ts`

**Changes:**
1. Remove Studio, Orchestrators, Pipelines from SECTION_TABS array
2. Add single entry: `{ id: 'video-orchestrator', label: 'Video Orchestrator', icon: '◈' }`
3. Update BrainConsoleSectionId type to remove 'studio' | 'orchestrators' | 'pipelines', add 'video-orchestrator'

**Expected result:** Top-level navigation now has ~12 tabs instead of 15. VO concepts no longer flattened into root tabs.

#### Task 2: Create VOStudio Render Section

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/src/view.ts`

**Changes:**
1. Add new `renderVideoOrchestratorSection()` function
2. In `renderActiveSectionContent()`, add case for 'video-orchestrator' → calls new function
3. New function imports VOShell from components/VO and instantiates it with necessary state/data

**Container structure:**
```typescript
function renderVideoOrchestratorSection(
  content: HTMLElement,
  state: BrainConsoleViewState
): void {
  const container = content.createDiv({ cls: 'vo-studio-container' });
  
  const shell = new VOShell(container, {
    projects: state.voStudioProjects?.items,
    accounts: state.voStudioAccounts?.items,
    pipelineProfiles: state.voStudioPipelineProfiles?.items,
    contentItems: state.voStudioContentItems?.items,
    selector: state.aiModelSelector,
    analytics: state.voStudioAnalytics,
    accountStats: state.voStudioAccountStats,
  });
}
```

**Expected result:** Clicking "Video Orchestrator" tab loads VOShell in scoped container. Internal tabs (Overview, Studio, Pipelines, etc.) managed by VOShell, not Brain Console.

#### Task 3: CSS Styling for VO Studio Container

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/styles.css`

**Changes:**
1. Add `.vo-studio-container` — full-height flexbox, inherits dark theme from Brain Console
2. Add `.vo-studio-tabs-row` — horizontal tab bar at top, reuses .vo-tabs styling
3. Add `.vo-studio-content` — scrollable area below tabs, max-width constraint
4. Add responsive fallback for narrow viewports (single column, stacked tabs)

**Constraints:**
- Container must not overflow Brain Console section area
- Reuse existing color variables (--bg-primary, --accent-warm, --text-primary)
- Inherit responsive behavior from Brain Console media queries

**Expected result:** VO Studio section fits within Brain Console layout without breaking responsive design.

#### Task 4: Update VOShell Integration

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/src/components/VO/VOShell.ts`

**Changes:**
1. Add CSS class to container: `this.container.classList.add('vo-shell')`
2. Ensure all panel imports are correct and match existing VOShell pattern
3. No changes to internal tab management; VOShell remains autonomous

**Expected result:** VOShell integrates seamlessly with Brain Console without architectural changes.

#### Task 5: Update Type Exports

**File:** `/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian/src/components/VO/index.ts`

**Changes:**
1. Verify all exports are present (VOShell, all panels, types)
2. No new exports needed; Phase 10 additions already included

**Expected result:** No import errors when Brain Console references VO components.

---

## Validation Checklist

- [ ] Phase 10 complete: Dashboard panel renders with all 4 data sections
- [ ] SECTION_TABS updated: Only 12 top-level tabs, no Studio/Orchestrators/Pipelines
- [ ] renderVideoOrchestratorSection() defined and called correctly
- [ ] VOShell mounts in new section and manages internal tabs
- [ ] CSS: VO Studio container fits within Brain Console bounds
- [ ] Responsive: Works on narrow and wide viewports
- [ ] No TypeScript errors, no missing imports
- [ ] Manual test: Click "Video Orchestrator" tab, see internal tabs, switch between Overview/Studio/Pipelines/Dashboard
- [ ] No console errors, no memory leaks
- [ ] Brain Console build succeeds: `npm run build && npm run package && npm run install:active-vault`
- [ ] Obsidian restart loads new plugin version

---

## Files Modified

1. `projects/brain-console-obsidian/src/view.ts` — SECTION_TABS, BrainConsoleSectionId type, renderActiveSectionContent, new renderVideoOrchestratorSection
2. `projects/brain-console-obsidian/styles.css` — .vo-studio-container, .vo-studio-tabs-row, .vo-studio-content styles
3. `projects/brain-core/docs/obsidian-command-center-dashboard-spec-2026-05-17.md` — Documentation already updated (scoping clarification)

---

## Success Criteria

✅ Brain Console top navigation is clean and organized  
✅ VO concepts are scoped within unified "Video Orchestrator" section  
✅ User can navigate internal VO tabs without confusion  
✅ Dashboard tab (Phase 10) displays correctly within VO section  
✅ No regressions in Brain Console functionality  
✅ UI is responsive and readable in constrained viewport  

---

## Timeline Estimate

- Phase 10 (Dashboard CSS): 1 hour
- Phase 11 (Brain Console integration): 2-3 hours
- Testing + validation: 1 hour
- **Total: 4-5 hours**

---

## Rollback Plan

If integration breaks Brain Console:
1. Revert SECTION_TABS changes (restore Studio/Orchestrators/Pipelines entries)
2. Revert renderActiveSectionContent case addition
3. Rebuild and reinstall
4. Diagnose in detail before re-attempting integration

All changes are isolated to view.ts and styles.css; no database or config changes needed.
