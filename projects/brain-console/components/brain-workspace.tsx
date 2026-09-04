'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, CircleAlert, GitBranch, LockKeyhole, RefreshCw, ShieldCheck } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import { StatusBadge } from '@/components/status-badge';
import { timeAgo } from '@/lib/utils';
import { z } from 'zod';

type RecordValue = Record<string, unknown>;
type Task = RecordValue & { taskId: string; title: string; status: string; dependsOn: string[]; role: string; capabilityIds: string[]; aiTaskType: string; approvalRequired: boolean; notes: string };
type TaskGraph = RecordValue & { tasks: Task[]; taskCount: number; completedCount: number; blockedCount: number; pendingCount: number; generatedAt: string; nextSafeStep: string };
type TaskState = RecordValue & { steps: Array<RecordValue & { taskId: string; status: string; note: string }>; currentTaskId: string | null; resumedTaskId: string | null; nextSafeStep: string; generatedAt: string };
type ExecutorPlan = RecordValue & { steps: Array<RecordValue & { taskId: string; executorId: string; providerId: string; reason: string; source: string }>; nextSafeStep: string; generatedAt: string };
type Capability = RecordValue & { id: string; kind: string; label: string; enabled: boolean; safetyClass: string; description: string; preferredAiTaskTypes: string[] };

const objectSchema = z.record(z.unknown());
const capabilityEnvelopeSchema = z.object({ capabilities: z.array(objectSchema) });
const REFRESH_INTERVAL_MS = 30_000;

const workspaceNav = [
  { href: '/brain', label: 'Overview' },
  { href: '/brain/active-work', label: 'Active Work' },
  { href: '/brain/tasks-evidence', label: 'Tasks & Evidence' },
  { href: '/brain/quality-safety', label: 'Quality & Safety' },
  { href: '/brain/continuity', label: 'Continuity' },
  { href: '/brain/capability-routing', label: 'Capability Routing' },
];

type WorkspaceData = {
  taskGraph: TaskGraph | null;
  taskState: TaskState | null;
  executorPlan: ExecutorPlan | null;
  gates: RecordValue | null;
  capabilities: Capability[];
  infiniteStatus: RecordValue | null;
  runtimeReports: RecordValue | null;
  errors: string[];
};

async function read<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  return brainCoreRequest(path, schema, { timeoutMs: 12_000 });
}

async function loadWorkspace(): Promise<WorkspaceData> {
  const requests = await Promise.allSettled([
    read('/agent-task-graph', objectSchema),
    read('/agent-task-state', objectSchema),
    read('/agent-executor-plan', objectSchema),
    read('/agent-approval-gates', objectSchema),
    read('/api/agent/capabilities', capabilityEnvelopeSchema),
    read('/infinite-brain/status', objectSchema),
    read('/runtime/reports', objectSchema),
  ]);
  const errors: string[] = [];
  const value = (index: number): RecordValue | null => {
    const result = requests[index];
    if (result.status === 'fulfilled') return result.value as RecordValue;
    errors.push(result.reason instanceof Error ? result.reason.message : `Brain Core request ${index + 1} failed`);
    return null;
  };
  const graph = value(0);
  const state = value(1);
  const plan = value(2);
  const gates = value(3);
  const capabilityResult = requests[4].status === 'fulfilled' ? requests[4].value as { capabilities: RecordValue[] } : null;
  if (!capabilityResult) errors.push('Capability registry unavailable');
  const infiniteStatus = value(5);
  const runtimeReports = value(6);
  return {
    taskGraph: graph ? normalizeTaskGraph(graph) : null,
    taskState: state ? normalizeTaskState(state) : null,
    executorPlan: plan ? normalizeExecutorPlan(plan) : null,
    gates,
    capabilities: (capabilityResult?.capabilities ?? []).map(normalizeCapability),
    infiniteStatus,
    runtimeReports,
    errors,
  };
}

function asString(value: unknown, fallback = 'unknown'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): RecordValue {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
}

function normalizeTaskGraph(value: RecordValue): TaskGraph {
  return {
    ...value,
    taskCount: asNumber(value.taskCount),
    completedCount: asNumber(value.completedCount),
    blockedCount: asNumber(value.blockedCount),
    pendingCount: asNumber(value.pendingCount),
    generatedAt: asString(value.generatedAt),
    nextSafeStep: asString(value.nextSafeStep),
    tasks: asArray(value.tasks).map((item) => {
      const task = asRecord(item);
      return {
        ...task,
        taskId: asString(task.taskId),
        title: asString(task.title, 'Untitled task'),
        status: asString(task.status),
        dependsOn: asArray(task.dependsOn).map((id) => asString(id)).filter(Boolean),
        role: asString(task.role),
        capabilityIds: asArray(task.capabilityIds).map((id) => asString(id)).filter(Boolean),
        aiTaskType: asString(task.aiTaskType),
        approvalRequired: task.approvalRequired === true,
        notes: asString(task.notes, 'No task note recorded.'),
      };
    }),
  };
}

function normalizeTaskState(value: RecordValue): TaskState {
  return {
    ...value,
    currentTaskId: typeof value.currentTaskId === 'string' ? value.currentTaskId : null,
    resumedTaskId: typeof value.resumedTaskId === 'string' ? value.resumedTaskId : null,
    generatedAt: asString(value.generatedAt),
    nextSafeStep: asString(value.nextSafeStep),
    steps: asArray(value.steps).map((item) => {
      const step = asRecord(item);
      return { ...step, taskId: asString(step.taskId), status: asString(step.status), note: asString(step.note, 'No continuity note recorded.') };
    }),
  };
}

function normalizeExecutorPlan(value: RecordValue): ExecutorPlan {
  return {
    ...value,
    generatedAt: asString(value.generatedAt),
    nextSafeStep: asString(value.nextSafeStep),
    steps: asArray(value.steps).map((item) => {
      const step = asRecord(item);
      return { ...step, taskId: asString(step.taskId), executorId: asString(step.executorId), providerId: asString(step.providerId), reason: asString(step.reason), source: asString(step.source) };
    }),
  };
}

function normalizeCapability(value: RecordValue): Capability {
  return {
    ...value,
    id: asString(value.id),
    kind: asString(value.kind),
    label: asString(value.label),
    enabled: value.enabled !== false,
    safetyClass: asString(value.safetyClass),
    description: asString(value.description, 'No capability description recorded.'),
    preferredAiTaskTypes: asArray(value.preferredAiTaskTypes).map((item) => asString(item)).filter(Boolean),
  };
}

function useWorkspace() {
  return useQuery({
    queryKey: ['brain-workspace'],
    queryFn: loadWorkspace,
    staleTime: 15_000,
    gcTime: 10 * 60_000,
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
}

function stateLabel(status: string): string {
  if (status === 'running') return 'CURRENT';
  if (status === 'completed' || status === 'success') return 'CURRENT';
  if (status === 'pending' || status === 'planned') return 'PENDING';
  if (status === 'blocked') return 'BLOCKED';
  if (status === 'failed' || status === 'error') return 'ERROR';
  return status.toUpperCase();
}

function stateStatus(status: string): string {
  if (status === 'running' || status === 'completed' || status === 'success') return 'fresh';
  if (status === 'pending' || status === 'planned') return 'planned';
  if (status === 'blocked') return 'blocked';
  if (status === 'failed' || status === 'error') return 'error';
  return status;
}

function State({ status }: { status: string }) {
  return <StatusBadge status={stateStatus(status)} label={stateLabel(status)} />;
}

function Availability({ available, label }: { available: boolean; label: string }) {
  return <StatusBadge status={available ? 'fresh' : 'unavailable'} label={label} />;
}

function WorkspaceHeader({ title, description, query }: { title: string; description: string; query: ReturnType<typeof useWorkspace> }) {
  return (
    <header className="brain-workspace-header">
      <div>
        <div className="eyebrow">Brain workspace</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="brain-workspace-header-meta">
        <StatusBadge status={query.isError ? 'error' : query.data?.errors.length ? 'partial' : 'fresh'} label={query.isFetching ? 'Refreshing' : query.isError ? 'Unavailable' : query.data?.errors.length ? 'Partial' : 'Live'} />
        <span className="meta">Read-only projection · every 30s</span>
      </div>
    </header>
  );
}

function WorkspaceNav() {
  const pathname = usePathname();
  return <nav className="brain-workspace-nav" aria-label="Brain workspace navigation">{workspaceNav.map((item) => { const active = item.href === '/brain' ? pathname === '/brain' : pathname.startsWith(item.href); return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} data-active={active ? 'true' : undefined}>{item.label}</Link>; })}</nav>;
}

function Panel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: ReactNode; className?: string }) {
  return <section className={`card brain-panel ${className}`}><div className="brain-panel-heading"><div>{eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}<h2>{title}</h2></div></div>{children}</section>;
}

function MetricStrip({ data }: { data: WorkspaceData }) {
  const tasks = data.taskGraph?.tasks ?? [];
  const active = tasks.filter((task) => task.status === 'running').length;
  const attention = tasks.filter((task) => ['blocked', 'failed', 'error'].includes(task.status)).length;
  const enabled = data.capabilities.filter((capability) => capability.enabled).length;
  return <div className="brain-metric-strip"><div><span>Active orchestration</span><strong>{active}</strong><State status={active ? 'running' : 'completed'} /></div><div><span>Tasks in graph</span><strong>{tasks.length}</strong><span className="meta">{data.taskGraph?.pendingCount ?? 0} pending</span></div><div><span>Capability routes</span><strong>{enabled}</strong><span className="meta">{data.capabilities.length} registered</span></div><div><span>Attention</span><strong>{attention}</strong><State status={attention ? 'blocked' : 'completed'} /></div><div><span>Execution</span><strong>Contained</strong><StatusBadge status="blocked" label="Read-only" /></div></div>;
}

function Errors({ errors }: { errors: string[] }) {
  return errors.length ? <div className="brain-workspace-notice" role="status"><CircleAlert size={15} /><span>Some optional Brain sources are unavailable. Their absence is shown in the affected panels.</span></div> : null;
}

function OverviewView({ data }: { data: WorkspaceData }) {
  const tasks = data.taskGraph?.tasks ?? [];
  const current = tasks.find((task) => task.status === 'running');
  const gates = data.gates;
  const infiniteSafety = asRecord(data.infiniteStatus?.safety);
  return <>
    <MetricStrip data={data} />
    <div className="brain-overview-grid">
      <Panel title="What Brain is doing" eyebrow="Current orchestration" className="brain-panel-wide">
        {current ? <div className="brain-focus"><div className="brain-focus-icon"><GitBranch size={18} /></div><div><strong>{current.title}</strong><p>{current.notes}</p><div className="brain-inline-meta"><State status={current.status} /><span>{current.role}</span><span>{current.aiTaskType}</span></div></div><Link className="button-link" href={`/brain/tasks/${encodeURIComponent(current.taskId)}`}>Inspect <ArrowRight size={14} /></Link></div> : <EmptyState title="No active orchestration" detail="The current task graph has no running task. Pending work remains visible in Active Work." />}
      </Panel>
      <Panel title="Why this state" eyebrow="Decision context">
        <div className="brain-explanation"><ShieldCheck size={18} /><p>Brain is projecting a read-only graph. Executor selections and approval policy are visible, but no execution or Mind write is enabled.</p></div>
        <div className="brain-kv-list"><div><span>Next safe step</span><strong>{data.taskGraph?.nextSafeStep ?? 'Unavailable'}</strong></div><div><span>Source freshness</span><strong>{data.taskGraph?.generatedAt ? timeAgo(data.taskGraph.generatedAt) : 'Unknown'}</strong></div></div>
      </Panel>
      <Panel title="System posture" eyebrow="Capability domains">
        <div className="brain-posture-list"><Posture label="Code" detail="Read-only code orchestration" status={tasks.some((task) => task.capabilityIds.includes('skill.code')) ? 'fresh' : 'unavailable'} /><Posture label="Research" detail="No current task selected" status="unknown" /><Posture label="Design / Web" detail="Capability descriptors available" status={data.capabilities.some((capability) => capability.id === 'skill.design' || capability.id === 'skill.web') ? 'fresh' : 'unavailable'} /><Posture label="Quality / safety" detail={gates ? `Approval store ${asString(gates.approvalStoreStatus)}` : 'Gate source unavailable'} status={gates ? 'fresh' : 'unavailable'} /></div>
      </Panel>
      <Panel title="Quality and safety" eyebrow="Gates before action">
        <GateRow label="Execution" value="Disabled" detail="No execution-enabled path is exposed by this view." status="blocked" />
        <GateRow label="Mind writes" value={infiniteSafety.writesToMind === false ? 'Contained' : 'Unavailable'} detail="The current safety envelope does not permit writes." status={infiniteSafety.writesToMind === false ? 'blocked' : 'unknown'} />
        <GateRow label="Approval policy" value={gates ? `${asNumber(gates.pendingCount)} pending` : 'Unavailable'} detail={gates ? asString(gates.nextSafeStep) : 'Gate source unavailable.'} status={gates ? 'fresh' : 'unavailable'} />
      </Panel>
    </div>
    <Panel title="Recent Brain activity" eyebrow="Bounded operational events">
      {tasks.length ? <div className="brain-activity-list">{tasks.slice(0, 4).map((task) => <Link href={`/brain/tasks/${encodeURIComponent(task.taskId)}`} className="brain-activity-row" key={task.taskId}><State status={task.status} /><span><strong>{task.title}</strong><small>{task.role} · {task.aiTaskType}</small></span><ArrowRight size={14} /></Link>)}</div> : <EmptyState title="No task activity" detail="No task graph items are available from Brain Core." />}
    </Panel>
  </>;
}

function Posture({ label, detail, status }: { label: string; detail: string; status: string }) {
  return <div className="brain-posture-row"><span><strong>{label}</strong><small>{detail}</small></span><StatusBadge status={status} label={status === 'fresh' ? 'CURRENT' : status.toUpperCase()} /></div>;
}

function GateRow({ label, value, detail, status }: { label: string; value: string; detail: string; status: string }) {
  return <div className="brain-gate-row"><div><strong>{label}</strong><small>{detail}</small></div><span><StatusBadge status={status} label={value} /></span></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="brain-empty"><span className="eyebrow">No data</span><strong>{title}</strong><p>{detail}</p></div>;
}

function TaskRows({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return <EmptyState title="No tasks available" detail="Brain Core returned an empty task graph." />;
  return <div className="brain-task-list">{tasks.map((task) => <Link className="brain-task-row" href={`/brain/tasks/${encodeURIComponent(task.taskId)}`} key={task.taskId}><State status={task.status} /><span className="brain-task-main"><strong>{task.title}</strong><small>{task.taskId} · {task.role} · {task.aiTaskType}</small></span><span className="brain-task-route">{task.capabilityIds.join(', ') || 'No capability recorded'}</span><ArrowRight size={14} /></Link>)}</div>;
}

function GraphPanel({ tasks }: { tasks: Task[] }) {
  return <Panel title="Composition graph" eyebrow="Actual task dependencies" className="brain-graph-panel"><div className="brain-graph">{tasks.length ? tasks.map((task) => <div className="brain-graph-node" key={task.taskId}><div className="brain-graph-card"><State status={task.status} /><strong>{task.title}</strong><code>{task.taskId}</code></div>{task.dependsOn.length ? <div className="brain-graph-edge"><ArrowRight size={14} /><span>depends on {task.dependsOn.join(', ')}</span></div> : <div className="brain-graph-edge root"><span>root task</span></div>}</div>) : <EmptyState title="Graph unavailable" detail="No task graph nodes were returned." />}</div><p className="meta">Nodes and relationships are read from the current Brain task graph. No inferred nodes are added.</p></Panel>;
}

function ActiveWorkView({ data }: { data: WorkspaceData }) {
  const tasks = data.taskGraph?.tasks ?? [];
  return <><div className="brain-split-grid"><Panel title="Active and pending work" eyebrow="Task graph"><TaskRows tasks={tasks} /></Panel><Panel title="Continuation pointer" eyebrow="Current state"><ContinuitySummary data={data} /></Panel></div><GraphPanel tasks={tasks} /></>;
}

function TasksEvidenceView({ data }: { data: WorkspaceData }) {
  const tasks = data.taskGraph?.tasks ?? [];
  const evidenceStore = asRecord(data.infiniteStatus?.infrastructure && asRecord(data.infiniteStatus.infrastructure).evidenceStore);
  const evidenceStats = asRecord(evidenceStore.stats);
  return <><div className="brain-split-grid"><Panel title="Task Packets" eyebrow="Readable contract projection"><div className="brain-contract-intro"><CheckCircle2 size={18} /><p>Task graph items are presented as bounded task references, owners, capabilities, gates, and next actions. Full task-packet bodies are not connected to this read-only Core surface.</p></div><TaskRows tasks={tasks} /></Panel><Panel title="Evidence Packets" eyebrow="Provenance and receipts"><div className="brain-contract-stat"><strong>{asNumber(evidenceStats.totalRecords)}</strong><span>records available</span></div><Availability available={asNumber(evidenceStats.totalRecords) > 0} label={asNumber(evidenceStats.totalRecords) > 0 ? 'AVAILABLE' : 'UNAVAILABLE'} /><p className="meta">{asNumber(evidenceStats.totalRecords) > 0 ? 'Evidence references can be opened from task detail.' : 'No evidence packet store is connected in the current runtime projection. This is shown explicitly rather than inferred as a pass.'}</p><details className="brain-advanced"><summary>Evidence contract status</summary><p className="meta">Source: Infinite Brain evidence store projection. Raw packet bodies remain unloaded.</p></details></Panel></div><GraphPanel tasks={tasks} /></>;
}

function QualitySafetyView({ data }: { data: WorkspaceData }) {
  const gates = data.gates;
  const safety = asRecord(data.infiniteStatus?.safety);
  const reports = asArray(data.runtimeReports?.reports).map(asRecord);
  return <><div className="brain-split-grid"><Panel title="Safety envelope" eyebrow="Mutation boundary"><GateRow label="Mind writes" value={safety.writesToMind === false ? 'NOT ALLOWED' : 'UNAVAILABLE'} detail="Current Infinite Brain safety state" status={safety.writesToMind === false ? 'blocked' : 'unavailable'} /><GateRow label="Continuous runtime" value={safety.continuousRuntime === false ? 'NOT ENABLED' : 'UNAVAILABLE'} detail="No automatic execution loop is exposed" status={safety.continuousRuntime === false ? 'blocked' : 'unavailable'} /><GateRow label="Model fallback" value={safety.modelFallbackHardcoded === false ? 'NOT HARD-CODED' : 'UNAVAILABLE'} detail="Provider selection remains a Brain-owned concern" status={safety.modelFallbackHardcoded === false ? 'fresh' : 'unavailable'} /><GateRow label="External mutation" value="BLOCKED" detail="All actions remain behind Core approval contracts" status="blocked" /></Panel><Panel title="Recorded gates" eyebrow="Approval and quality state">{gates ? <><GateRow label="Approval store" value={asString(gates.approvalStoreStatus).toUpperCase()} detail={asString(gates.nextSafeStep)} status={asString(gates.approvalStoreStatus)} /><GateRow label="Pending approvals" value={String(asNumber(gates.pendingCount))} detail={`${asNumber(gates.approvedCount)} approved · ${asNumber(gates.rejectedCount)} rejected`} status={asNumber(gates.pendingCount) ? 'planned' : 'fresh'} /></> : <EmptyState title="Gate source unavailable" detail="Brain Core did not return the approval-gate projection." />}</Panel></div><Panel title="Runtime reports" eyebrow="Evidence-backed quality signals">{reports.length ? <div className="brain-report-list">{reports.map((report) => <div className="brain-report-row" key={asString(report.id)}><strong>{asString(report.id)}</strong><StatusBadge status={asString(report.status)} label={asString(report.status).toUpperCase()} /><span className="meta">{asString(report.message, 'No report message recorded.')}</span></div>)}</div> : <EmptyState title="No runtime reports" detail="Optional quality reports are not connected in the current runtime." />}</Panel></>;
}

function ContinuitySummary({ data }: { data: WorkspaceData }) {
  const state = data.taskState;
  return state ? <div className="brain-continuity-summary"><div><span>Current task</span><strong>{state.currentTaskId ?? 'None'}</strong></div><div><span>Resume pointer</span><strong>{state.resumedTaskId ?? 'None'}</strong></div><div><span>Eligibility</span><StatusBadge status="blocked" label="OBSERVATION ONLY" /></div><p className="meta">{state.nextSafeStep}</p></div> : <EmptyState title="Continuity unavailable" detail="Brain Core did not return a task-state projection." />;
}

function ContinuityView({ data }: { data: WorkspaceData }) {
  const state = data.taskState;
  return <><div className="brain-split-grid"><Panel title="Continuity status" eyebrow="Sparse task state"><ContinuitySummary data={data} /><div className="brain-safety-note"><LockKeyhole size={15} /><span>No automatic resume is offered. Any stale or conflicted continuation requires explicit review.</span></div></Panel><Panel title="Identity and freshness" eyebrow="Continuation context"><div className="brain-kv-list"><div><span>Task state generated</span><strong>{state?.generatedAt ? timeAgo(state.generatedAt) : 'Unknown'}</strong></div><div><span>Task graph</span><strong>{data.taskGraph?.generatedAt ? timeAgo(data.taskGraph.generatedAt) : 'Unknown'}</strong></div><div><span>Persistence</span><strong>{asRecord(state?.persistence).enabled === true ? 'Enabled' : 'Disabled'}</strong></div></div></Panel></div><Panel title="Continuity steps" eyebrow="Current, pending, and completed nodes">{state?.steps.length ? <div className="brain-step-list">{state.steps.map((step) => <div className="brain-step-row" key={step.taskId}><State status={step.status} /><span><strong>{step.taskId}</strong><small>{step.note}</small></span></div>)}</div> : <EmptyState title="No continuity steps" detail="No session or task continuation records are connected." />}</Panel></>;
}

function CapabilityRoutingView({ data }: { data: WorkspaceData }) {
  const plan = data.executorPlan;
  const providers = data.capabilities.filter((capability) => capability.kind === 'ai_surface');
  return <><Panel title="Capability Routing" eyebrow="Brain-selected execution paths"><div className="brain-contract-intro"><GitBranch size={18} /><p>Routing is observed here, not manually selected. Each row is the recorded executor choice and reason from Brain Core.</p></div>{plan?.steps.length ? <div className="brain-routing-list">{plan.steps.map((step) => <div className="brain-routing-row" key={step.taskId}><span><strong>{step.taskId}</strong><small>{step.reason}</small></span><ArrowRight size={14} /><span><strong>{step.providerId}</strong><small>{step.source} · {step.executorId}</small></span><StatusBadge status="fresh" label="CURRENT" /></div>)}</div> : <EmptyState title="Routing plan unavailable" detail="No executor selection plan was returned." />}</Panel><Panel title="Provider health context" eyebrow="Read-only diagnostics"><div className="brain-provider-list">{providers.length ? providers.map((provider) => <div className="brain-provider-row" key={provider.id}><span><strong>{provider.label}</strong><small>{provider.preferredAiTaskTypes.join(' · ') || 'No task types recorded'}</small></span><StatusBadge status={provider.enabled ? 'fresh' : 'stale'} label={provider.enabled ? 'AVAILABLE' : 'DISABLED'} /></div>) : <EmptyState title="Provider registry unavailable" detail="No provider capability descriptors were returned." />}</div></Panel></>;
}

function WorkspaceContent({ view, data }: { view: string; data: WorkspaceData }) {
  if (view === 'active-work') return <ActiveWorkView data={data} />;
  if (view === 'tasks-evidence') return <TasksEvidenceView data={data} />;
  if (view === 'quality-safety') return <QualitySafetyView data={data} />;
  if (view === 'continuity') return <ContinuityView data={data} />;
  if (view === 'capability-routing') return <CapabilityRoutingView data={data} />;
  return <OverviewView data={data} />;
}

export function BrainWorkspace({ view = 'overview' }: { view?: string }) {
  const query = useWorkspace();
  if (query.isPending && !query.data) return <div className="brain-workspace"><WorkspaceNav /><div className="brain-loading"><span className="skeleton skeleton-command-title" /><span className="skeleton skeleton-command-copy" /><span className="skeleton skeleton-panel" /></div></div>;
  if (!query.data) return <div className="brain-workspace"><WorkspaceNav /><Panel title="Brain workspace unavailable" eyebrow="Read-only projection"><EmptyState title="Brain Core did not respond" detail={query.error instanceof Error ? query.error.message : 'Retry when Brain Core is available.'} /><button className="button compact secondary" onClick={() => void query.refetch()}><RefreshCw size={14} /> Retry</button></Panel></div>;
  const title = view === 'overview' ? 'Brain overview' : workspaceNav.find((item) => item.href.endsWith(view))?.label ?? 'Brain workspace';
  const description = view === 'overview' ? 'A human-readable view of orchestration, context, capabilities, evidence, and safety boundaries.' : 'A bounded operational drill-down over existing Brain Core read models.';
  return <div className="brain-workspace"><WorkspaceHeader title={title} description={description} query={query} /><WorkspaceNav /><Errors errors={query.data.errors} /><WorkspaceContent view={view} data={query.data} /></div>;
}

export function BrainTaskDetail({ taskId }: { taskId: string }) {
  const query = useWorkspace();
  const task = query.data?.taskGraph?.tasks.find((item) => item.taskId === taskId);
  const executor = query.data?.executorPlan?.steps.find((item) => item.taskId === taskId);
  const continuity = query.data?.taskState?.steps.find((item) => item.taskId === taskId);
  if (query.isPending && !query.data) return <div className="brain-workspace"><Link className="button-link" href="/brain/active-work">← Active Work</Link><div className="brain-loading"><span className="skeleton skeleton-command-title" /><span className="skeleton skeleton-panel" /></div></div>;
  if (!task) return <div className="brain-workspace"><Link className="button-link" href="/brain/active-work">← Active Work</Link><Panel title="Task unavailable" eyebrow="Task detail"><EmptyState title={`No task ${taskId} in the current graph`} detail="The detail route is stable, but the referenced task is not present in the latest read-only snapshot." /></Panel></div>;
  return <div className="brain-workspace"><div className="brain-detail-back"><Link className="button-link" href="/brain/active-work">← Active Work</Link><span className="meta">Task detail · {task.taskId}</span></div><WorkspaceHeader title={task.title} description={task.notes} query={query} /><div className="brain-detail-grid"><Panel title="Task Packet" eyebrow="Human-readable contract"><div className="brain-detail-status"><State status={task.status} /><span>{task.role}</span><span>{task.aiTaskType}</span></div><div className="brain-kv-list"><div><span>Task ID</span><strong>{task.taskId}</strong></div><div><span>Primary owner</span><strong>{task.role}</strong></div><div><span>Selected capabilities</span><strong>{task.capabilityIds.join(', ') || 'None recorded'}</strong></div><div><span>Approval</span><strong>{task.approvalRequired ? 'Required' : 'Not required'}</strong></div><div><span>Dependencies</span><strong>{task.dependsOn.join(', ') || 'Root task'}</strong></div></div><details className="brain-advanced"><summary>View raw task reference</summary><pre>{JSON.stringify(task, null, 2)}</pre></details></Panel><Panel title="Capability resolution" eyebrow="Recorded route">{executor ? <div className="brain-resolution"><div><span>Executor</span><strong>{executor.executorId}</strong></div><div><span>Provider</span><strong>{executor.providerId}</strong></div><div><span>Source</span><strong>{executor.source}</strong></div><p>{executor.reason}</p></div> : <EmptyState title="No route recorded" detail="The task has no executor selection in the current plan." />}</Panel><Panel title="Quality and safety gates" eyebrow="Exact current state"><GateRow label="Task execution" value="READ-ONLY" detail="Brain Console does not expose a direct execution action." status="blocked" /><GateRow label="Continuity" value={continuity ? stateLabel(continuity.status) : 'UNAVAILABLE'} detail={continuity?.note ?? 'No continuity step is connected.'} status={continuity?.status ?? 'unavailable'} /><GateRow label="Evidence" value="UNAVAILABLE" detail="No evidence packet reference is attached to this task projection." status="unavailable" /></Panel><Panel title="Context and evidence" eyebrow="Atomic references"><EmptyState title="Context pack refs unavailable" detail="The current agent task projection does not expose selected Context Pack references or Evidence Packet receipts." /><details className="brain-advanced"><summary>Advanced contract boundary</summary><p className="meta">Full context bodies, provider payloads, secrets, and raw transcripts remain intentionally unloaded.</p></details></Panel></div></div>;
}
