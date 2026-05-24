# Agent Orchestrator View — Brain Console Tab

## Context

The Phase 0.7 agent orchestration backend is fully implemented in brain-core (39 tests, committed). The Brain Console already has an `agents` section in `SECTION_TABS` and a stub `renderAgentsSection()` that renders 4 basic cards using list-style markup. The goal is to replace this stub with a rich, production-quality Agent Orchestrator View that renders the task graph, approval gates, agent registry, run history, cost summary, and recovery blockers using the global design system (`renderCard`, `renderCompactStatGrid`, `.bc-badge`, `.bc-stat-card`, `.bc-kpi-row` etc.). No new tabs, no new endpoints, no new client fetch functions — all data is already being fetched. This is a pure view.ts rendering upgrade.

---

## What Already Exists (no changes needed)

**Already fetched in `Promise.allSettled` (164 items, aligned ✓):**
- `state.agents` — agent registry (10 entries)
- `state.agentRuns` — run history
- `state.agentEvents` — approval audit events
- `state.agentCostSummary` — cost tracking
- `state.recoveryItems` — recovery blockers
- `state.agentConsole` — composite: taskGraph, taskState, executorPlan, approvalGates, counts (fetched in `readBrainConsoleSnapshot()`)

**Already in `client.ts`:** `BrainCoreAgentConsoleSummary` interface with `taskGraph: any`, `taskState: any`, `executorPlan: any`, `approvalGates: any` fields. All needed data comes via these `any`-typed sub-fields.

**Already in `SECTION_TABS`:** `{ id: 'agents', label: 'Agents', icon: '◈' }` — tab already visible.

**`renderAgentsSection()` exists** at view.ts line 3549 — currently a 4-card stub using `<ul><li>` markup. This is what we replace.

---

## Implementation Plan

### Single file to modify: `src/view.ts`

Replace `renderAgentsSection()` at line 3549 and rewrite the four card renderer functions (`renderAgentViewCard`, `renderAgentViewLedgerCard`, `renderApprovalAuditTrailCard`, `renderRecoveryPanelCard`) to use the design system properly.

---

### Section Layout

`renderAgentsSection()` will render two rows:

**Row 1 — KPI bar (`.bc-kpi-row`):**
- Active Runs
- Blocked Runs
- Pending Approvals
- Tasks Complete / Total
- Cost Today

**Row 2 — Card grid (`.brain-console__dashboard-grid`):**
- **Task Graph** — task list with status badges and dependency counts
- **Approval Gates** — pending/approved/rejected counts + supported kinds + blockers
- **Agent Registry** — compact grid of 10 agents: name, role, status badge, health indicator
- **Run History** — last 8 runs with status badge, age, safety chips
- **Cost Summary** — budget status, today/week/month estimates, top 3 expensive tasks
- **Recovery / Blockers** — severity-colored list of actionable blockers

---

### Card Design Patterns (strict adherence)

All cards use existing helpers — no new CSS classes needed:

```ts
// KPI bar
renderCompactStatGrid(el, [
  { label: 'Active', value: String(n) },
  ...
])

// Status badges — use bc-badge with tone classes
const badge = el.createEl('span', { cls: 'bc-badge' });
badge.textContent = status;
badge.classList.add(`bc-badge--${mapStatusTone(status)}`);

// Task list rows
el.createEl('div', { cls: 'brain-console__list-note', text: '...' })
```

Status → tone mapping (local helper function):
- `running` / `ok` / `completed` / `available` → `ok` (green)
- `blocked` / `error` / `failed` / `rejected` → `error` (red)
- `pending` / `planned` / `waiting_approval` → `warn` (yellow)
- `unknown` / `external` / `cancelled` → `neutral`

---

### Exact Changes to `view.ts`

#### 1. Replace `renderAgentsSection()` (line 3549–3562)

New implementation renders a KPI row from `state.agentConsole` (or zero-state fallback), then a 3-column `brain-console__dashboard-grid` with 6 cards.

#### 2. Replace `renderAgentViewCard()` (line 6742–6771)

New implementation: compact agent registry table. For each of the 10 agents: icon-dot for health status, name in bold, role badge, status badge, skills count. Uses `renderCompactStatGrid` for the summary header.

#### 3. Replace `renderAgentViewLedgerCard()` (line 6940–7011)

New implementation: run history. Header stat row (total/blocked/completed). For each of 8 most recent runs: status badge, title, agent ID, age, one-line safety summary. Safety chips as `bc-badge--neutral` pills.

#### 4. Add `renderApprovalGatesCard()` — new function

Reads `state.agentConsole?.approvalGates` and renders a stat grid (pending/approved/rejected/expired counts) + supported kinds list + blocker list if any.

Rename existing `renderApprovalAuditTrailCard()` to use `bc-badge` for event type styling instead of ad-hoc classes.

#### 5. Keep `renderRecoveryPanelCard()` (line 7054+)

Minor touch-up: replace raw `brain-console__list-warning` class with `bc-badge--error` for severity indicators.

#### 6. Add `renderAgentTaskGraphCard()` — new function

Reads `state.agentConsole?.taskGraph`. Shows:
- Header stats: total tasks, completed, blocked, pending
- Task list (max 8): task title, status badge, `approvalRequired` indicator
- `nextSafeStep` text at bottom

#### 7. Add `renderAgentCostCard()` — new function

Reads `state.agentCostSummary`. Shows:
- Budget badge (ok/warning/throttled) + spent/threshold
- Today / week / month cost grid
- Top 3 expensive tasks as compact rows

---

### No Promise Changes Needed

The Promise.allSettled array stays at 164/164. No new fetches — `agentConsole` (which contains taskGraph, approvalGates, executorPlan) is already fetched via `readBrainConsoleSnapshot()`.

The `agentConsole` fields are typed as `any` in `BrainCoreAgentConsoleSummary` — we access them with optional chaining (`state.agentConsole?.taskGraph?.tasks`) and handle undefined gracefully.

---

## Files Changed

| File | What changes |
|------|-------------|
| `src/view.ts` | Replace `renderAgentsSection()` + 4 card renderers + add 2 new card functions |

No changes to: `src/client.ts`, `src/main.ts`, `styles.css`, `manifest.json`.

---

## Verification

```bash
# 1. Type check (must pass clean)
npm run typecheck

# 2. Promise alignment check (must stay 164/164)
python3 -c "
import re
with open('src/view.ts') as f: content = f.read()
pm = re.search(r'await Promise\.allSettled\(\[(.*?)\]\s*\);', content, re.DOTALL)
promises = [e.strip() for e in pm.group(1).split('\n') if e.strip() and not e.strip().startswith('//')]
dm = re.search(r'const \[(.+?)\] = settledValues', content, re.DOTALL)
dvars = [v.strip() for v in dm.group(1).split(',')]
ok = len(promises) == len(dvars)
print(f'Promises: {len(promises)}, Destructured: {len(dvars)}', '✓' if ok else '✗ MISALIGNED')
"

# 3. Deploy
npm run build && npm run package && npm run install:active-vault
pkill -x "Obsidian" && sleep 2 && open -a Obsidian

# 4. Visual checks in Obsidian:
# - Click "Agents" tab
# - KPI bar shows Active/Blocked/Approvals/Tasks/Cost
# - Task graph card shows task list with status badges
# - Approval gates card shows pending/approved counts
# - Agent registry shows 10 agents with health/role/status
# - Run history shows last 8 runs
# - Cost card shows budget status + today/week estimates
# - Recovery card shows blockers (or "No blockers" state)
# - All cards use orange/zinc/mono design system (no rogue colors)
```
