'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import { agentModeConsoleDetailResponseSchema, type AgentModeConsoleDetailResponse } from '@/lib/braincore-schemas';
import { formatUsd, timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

export type AgentModeDetailSelection = {
  kind: 'agent' | 'task' | 'run' | 'attempt' | 'organization' | 'budget' | 'schedule' | 'failure' | 'evidence';
  id: string;
};

type DetailLinkProps = {
  selection: AgentModeDetailSelection;
  onOpen: (selection: AgentModeDetailSelection) => void;
  children: React.ReactNode;
};

type DetailLifecycle = {
  taskId: string | null;
  runId: string | null;
  attemptId: string | null;
  status: string | null;
  runtimeRef: string | null;
  modelRef: string | null;
  settledCost: number | null;
};

function DetailLink({ selection, onOpen, children }: DetailLinkProps) {
  return <button type="button" className="agent-console-detail-link" onClick={() => onOpen(selection)}>{children}</button>;
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="agent-console-detail-field"><dt>{label}</dt><dd>{children}</dd></div>;
}

function Value({ value }: { value: string | number | null | undefined }) {
  if (value === null || value === undefined || value === '') return <span className="meta">—</span>;
  return typeof value === 'string' && (value.includes(':') || value.length > 24) ? <code className="console-id" title={value}>{value}</code> : <span>{value}</span>;
}

function LifecycleSummary({ lifecycle, onOpen }: { lifecycle: DetailLifecycle | null; onOpen: (selection: AgentModeDetailSelection) => void }) {
  if (!lifecycle) return <span className="meta">No lifecycle binding</span>;
  return <div className="stack compact-detail-stack"><div className="row"><StatusBadge status={lifecycle.status ?? 'unknown'} /><span className="meta">{lifecycle.runtimeRef ?? 'no runtime fact'}</span></div><div className="meta">Task <DetailLink selection={{ kind: 'task', id: lifecycle.taskId ?? '' }} onOpen={onOpen}><Value value={lifecycle.taskId} /></DetailLink> · Run <DetailLink selection={{ kind: 'run', id: lifecycle.runId ?? '' }} onOpen={onOpen}><Value value={lifecycle.runId} /></DetailLink> · Attempt <DetailLink selection={{ kind: 'attempt', id: lifecycle.attemptId ?? '' }} onOpen={onOpen}><Value value={lifecycle.attemptId} /></DetailLink></div><div className="meta">model {lifecycle.modelRef ?? 'no model fact'} · cost {formatUsd(lifecycle.settledCost ?? 0)}</div></div>;
}

function DetailDefinition({ children }: { children: React.ReactNode }) {
  return <dl className="agent-console-detail-grid">{children}</dl>;
}

function AgentDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'agent' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <div className="stack"><DetailDefinition><DetailField label="Agent"><Value value={detail.agentId} /></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Parent"><Value value={detail.parentAgentId} /></DetailField><DetailField label="Organization"><Value value={detail.organizationPlanId} />{detail.workItemId ? <> · <Value value={detail.workItemId} /></> : null}</DetailField><DetailField label="Role">{detail.organizationRoleId ?? detail.roleTemplateId ?? '—'}</DetailField><DetailField label="Lifecycle"><StatusBadge status={detail.lifecycleStatus} /></DetailField><DetailField label="Depth">{detail.depth ?? '—'}</DetailField><DetailField label="Deadline"><Value value={detail.deadline} /></DetailField><DetailField label="Cancellation">{detail.cancellationState ?? 'none recorded'}</DetailField></DetailDefinition><section className="card compact-card"><div className="card-title">Related lifecycle</div><LifecycleSummary lifecycle={detail.runtime} onOpen={onOpen} /></section><section className="card compact-card"><div className="card-title">Children</div>{detail.children.length === 0 ? <p className="meta">No child agents are linked.</p> : detail.children.map((child) => <div className="agent-console-detail-list-row" key={child.agentId}><DetailLink selection={{ kind: 'agent', id: child.agentId }} onOpen={onOpen}><Value value={child.agentId} /></DetailLink><StatusBadge status={child.status} /></div>)}</section><section className="card compact-card"><div className="card-title">Budget</div>{detail.budget ? <DetailLink selection={{ kind: 'budget', id: detail.budget.budgetId }} onOpen={onOpen}><span>reserved {formatUsd(detail.budget.reservedCost ?? 0)} · settled {formatUsd(detail.budget.settledCost ?? 0)}</span></DetailLink> : <p className="meta">No durable budget binding.</p>}</section></div>;
}

function TaskDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'task' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <DetailDefinition><DetailField label="Task"><Value value={detail.taskId} /></DetailField><DetailField label="Type">{detail.taskType ?? '—'}</DetailField><DetailField label="Task spec"><Value value={detail.taskSpecRef} /></DetailField><DetailField label="Input hash"><Value value={detail.inputHash} /></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Agent"><DetailLink selection={{ kind: 'agent', id: detail.agentId ?? '' }} onOpen={onOpen}><Value value={detail.agentId} /></DetailLink></DetailField><DetailField label="Parent"><Value value={detail.parentAgentId} /></DetailField><DetailField label="Status"><StatusBadge status={detail.status} /></DetailField><DetailField label="Lifecycle"><LifecycleSummary lifecycle={detail.lifecycle} onOpen={onOpen} /></DetailField></DetailDefinition>;
}

function RunDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'run' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <DetailDefinition><DetailField label="Run"><Value value={detail.runId} /></DetailField><DetailField label="Task"><DetailLink selection={{ kind: 'task', id: detail.taskId }} onOpen={onOpen}><Value value={detail.taskId} /></DetailLink></DetailField><DetailField label="Agent"><DetailLink selection={{ kind: 'agent', id: detail.agentId ?? '' }} onOpen={onOpen}><Value value={detail.agentId} /></DetailLink></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Status"><StatusBadge status={detail.status} /></DetailField><DetailField label="Lifecycle"><LifecycleSummary lifecycle={detail.lifecycle} onOpen={onOpen} /></DetailField></DetailDefinition>;
}

function EvidenceList({ evidence, onOpen }: { evidence: Array<{ evidenceRef: string; verificationStatus: string; digest: string | null; createdAt: string | null }>; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return evidence.length === 0 ? <p className="meta">No bounded evidence metadata is linked.</p> : <div className="stack compact-detail-stack">{evidence.map((entry) => <div className="agent-console-detail-list-row" key={entry.evidenceRef}><DetailLink selection={{ kind: 'evidence', id: entry.evidenceRef }} onOpen={onOpen}><Value value={entry.evidenceRef} /></DetailLink><span className="meta">{entry.verificationStatus} · {timeAgo(entry.createdAt)}</span></div>)}</div>;
}

function AttemptDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'attempt' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <div className="stack"><DetailDefinition><DetailField label="Attempt"><Value value={detail.attemptId} /></DetailField><DetailField label="Run"><DetailLink selection={{ kind: 'run', id: detail.runId }} onOpen={onOpen}><Value value={detail.runId} /></DetailLink></DetailField><DetailField label="Task"><DetailLink selection={{ kind: 'task', id: detail.taskId ?? '' }} onOpen={onOpen}><Value value={detail.taskId} /></DetailLink></DetailField><DetailField label="Agent"><DetailLink selection={{ kind: 'agent', id: detail.agentId }} onOpen={onOpen}><Value value={detail.agentId} /></DetailLink></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Status"><StatusBadge status={detail.uncertaintyState ?? detail.status} /></DetailField><DetailField label="Runtime">{detail.runtimeRef ?? '—'} · {detail.runtimeProfileRef ?? '—'}</DetailField><DetailField label="Model / route">{detail.modelRef ?? 'no model fact'} · {detail.route ?? '—'}</DetailField><DetailField label="Cancellation">{detail.cancellationState ?? 'none recorded'}</DetailField></DetailDefinition><section className="card compact-card"><div className="card-title">Evidence metadata</div><EvidenceList evidence={detail.evidence} onOpen={onOpen} /></section>{detail.budget ? <section className="card compact-card"><div className="card-title">Budget</div><DetailLink selection={{ kind: 'budget', id: detail.budget.budgetId }} onOpen={onOpen}>reserved {formatUsd(detail.budget.reservedCost ?? 0)} · settled {formatUsd(detail.budget.settledCost ?? 0)}</DetailLink></section> : null}</div>;
}

function OrganizationDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'organization' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <div className="stack"><DetailDefinition><DetailField label="Plan"><Value value={detail.organizationPlanId} /></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Supervisor"><DetailLink selection={{ kind: 'agent', id: detail.supervisorAgentId }} onOpen={onOpen}><Value value={detail.supervisorAgentId} /></DetailLink></DetailField><DetailField label="Role">{detail.supervisorOrganizationRoleId}</DetailField><DetailField label="Status"><StatusBadge status={detail.status} /></DetailField><DetailField label="Readiness"><StatusBadge status={detail.readiness} /></DetailField><DetailField label="Deadline"><Value value={detail.deadline} /></DetailField></DetailDefinition><section className="card compact-card"><div className="card-title">Work items and dependencies</div><div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Item</th><th>Dependencies</th><th>Readiness</th><th>Lifecycle</th><th>Evidence / cost</th></tr></thead><tbody>{detail.workItems.map((item) => <tr key={item.workItemId}><td><div>{item.workItemKey}</div><div><DetailLink selection={{ kind: 'organization', id: detail.organizationPlanId }} onOpen={onOpen}><Value value={item.workItemId} /></DetailLink></div></td><td>{item.dependencies.length === 0 ? <span className="meta">none</span> : <div className="stack compact-detail-stack">{item.dependencies.map((dependency) => <div key={dependency.workItemKey}><span>{dependency.workItemKey}</span> <StatusBadge status={dependency.status} /></div>)}</div>}</td><td><StatusBadge status={item.readiness} /></td><td><DetailLink selection={{ kind: 'agent', id: item.childAgentId ?? '' }} onOpen={onOpen}><Value value={item.childAgentId} /></DetailLink><div className="meta"><DetailLink selection={{ kind: 'task', id: item.taskId ?? '' }} onOpen={onOpen}><Value value={item.taskId} /></DetailLink> · <StatusBadge status={item.terminalStatus ?? item.delegationState} /></div></td><td><div>{item.evidenceRefs.length} refs</div><div>{formatUsd(item.settledCost)}</div></td></tr>)}</tbody></table></div></section>{detail.finalResult ? <section className="card compact-card"><div className="card-title">Final result</div><DetailDefinition><DetailField label="Result"><Value value={detail.finalResult.finalResultId} /></DetailField><DetailField label="Status"><StatusBadge status={detail.finalResult.status} /></DetailField><DetailField label="Auditor"><Value value={detail.finalResult.auditorWorkItemId} /></DetailField><DetailField label="Auditor result"><Value value={detail.finalResult.auditorResultRef} /></DetailField><DetailField label="Digest"><Value value={detail.finalResult.aggregateDigest} /></DetailField><DetailField label="Settled cost">{formatUsd(detail.finalResult.totalSettledCost)}</DetailField><DetailField label="Finalized"><Value value={detail.finalResult.finalizedAt} /></DetailField></DetailDefinition></section> : <p className="meta">No final organization result is durably recorded.</p>}</div>;
}

function BudgetDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'budget' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <div className="stack"><DetailDefinition><DetailField label="Budget"><Value value={detail.budgetId} /></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Steps">{detail.usedSteps ?? '—'} used · {detail.reservedSteps ?? '—'} reserved / {detail.maxSteps ?? '—'} max</DetailField><DetailField label="Tokens">{detail.usedTokens ?? '—'} used · {detail.reservedTokens ?? '—'} reserved / {detail.maxTokens ?? '—'} max</DetailField><DetailField label="Cost">{formatUsd(detail.usedCost ?? 0)} used · {formatUsd(detail.reservedCost ?? 0)} reserved · {formatUsd(detail.settledCost ?? 0)} settled</DetailField><DetailField label="Remaining">{detail.remainingCost === null ? 'unknown' : formatUsd(detail.remainingCost)}</DetailField><DetailField label="Children">{detail.activeChildren ?? '—'} active · {detail.totalChildCreations ?? '—'} created</DetailField></DetailDefinition><section className="card compact-card"><div className="card-title">Child allocations</div>{detail.childAllocations.length === 0 ? <p className="meta">No child allocation facts are available.</p> : detail.childAllocations.map((allocation) => <div className="agent-console-detail-list-row" key={allocation.attemptId}><DetailLink selection={{ kind: 'attempt', id: allocation.attemptId }} onOpen={onOpen}><Value value={allocation.attemptId} /></DetailLink><span className="meta">{allocation.status} · {formatUsd(allocation.settledCost)} settled</span></div>)}</section></div>;
}

function ScheduleDetail({ detail }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'schedule' } }) {
  return <div className="stack"><DetailDefinition><DetailField label="Schedule"><Value value={detail.scheduleId} /></DetailField><DetailField label="Source">{detail.sourceType ?? '—'}</DetailField><DetailField label="Enabled"><StatusBadge status={detail.enabled ? 'enabled' : 'disabled'} /></DetailField><DetailField label="Status"><StatusBadge status={detail.status} /></DetailField><DetailField label="Next due"><Value value={detail.nextDueAt} /></DetailField><DetailField label="Next eligible"><Value value={detail.nextEligibleAt} /></DetailField><DetailField label="Last result">{detail.latestTerminalResult ?? 'not terminal'}</DetailField><DetailField label="Retry">{detail.retryState.attemptCount} / {detail.retryState.maxAttempts} · {detail.retryState.lastFailure ?? 'no failure'}</DetailField><DetailField label="Dead letters">{detail.deadLetterCount}</DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField></DetailDefinition><section className="card compact-card"><div className="card-title">Bounded scheduler history</div>{detail.history.length === 0 ? <p className="meta">No related scheduler history is available.</p> : detail.history.map((event) => <div className="agent-console-detail-list-row" key={event.eventId}><Value value={event.eventId} /><span><StatusBadge status={event.status} /> <span className="meta">{timeAgo(event.occurredAt)}</span></span></div>)}</section></div>;
}

function FailureDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'failure' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <div className="stack"><DetailDefinition><DetailField label="Object">{detail.objectType} · <Value value={detail.objectId} /></DetailField><DetailField label="Root"><Value value={detail.rootGoalId} /></DetailField><DetailField label="Agent"><DetailLink selection={{ kind: 'agent', id: detail.agentId ?? '' }} onOpen={onOpen}><Value value={detail.agentId} /></DetailLink></DetailField><DetailField label="Task"><DetailLink selection={{ kind: 'task', id: detail.taskId ?? '' }} onOpen={onOpen}><Value value={detail.taskId} /></DetailLink></DetailField><DetailField label="Run"><DetailLink selection={{ kind: 'run', id: detail.runId ?? '' }} onOpen={onOpen}><Value value={detail.runId} /></DetailLink></DetailField><DetailField label="Attempt"><DetailLink selection={{ kind: 'attempt', id: detail.attemptId ?? '' }} onOpen={onOpen}><Value value={detail.attemptId} /></DetailLink></DetailField><DetailField label="Status"><StatusBadge status={detail.status} /></DetailField><DetailField label="Reason"><code>{detail.reasonCode}</code><div className="meta">{detail.reasonMessage}</div></DetailField><DetailField label="Uncertainty">{detail.uncertaintyClassification ?? 'not uncertain'}</DetailField><DetailField label="Reconciliation">{detail.reconciliationState ?? 'not required'}</DetailField></DetailDefinition><section className="card compact-card"><div className="card-title">Evidence metadata</div><div className="stack compact-detail-stack">{detail.evidenceRefs.map((ref) => <DetailLink key={ref} selection={{ kind: 'evidence', id: ref }} onOpen={onOpen}><Value value={ref} /></DetailLink>)}</div></section></div>;
}

function EvidenceDetail({ detail, onOpen }: { detail: Extract<AgentModeConsoleDetailResponse, { status: 'available' }>['detail'] & { kind: 'evidence' }; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <DetailDefinition><DetailField label="Evidence"><Value value={detail.evidenceRef} /></DetailField><DetailField label="Type">{detail.evidenceType}</DetailField><DetailField label="Receipt">{detail.receiptType}</DetailField><DetailField label="Verification">{detail.verificationStatus}</DetailField><DetailField label="Redaction">{detail.redactionStatus}</DetailField><DetailField label="Root"><Value value={detail.ownerRootGoalId} /></DetailField><DetailField label="Agent"><DetailLink selection={{ kind: 'agent', id: detail.ownerAgentId ?? '' }} onOpen={onOpen}><Value value={detail.ownerAgentId} /></DetailLink></DetailField><DetailField label="Task"><DetailLink selection={{ kind: 'task', id: detail.ownerTaskId ?? '' }} onOpen={onOpen}><Value value={detail.ownerTaskId} /></DetailLink></DetailField><DetailField label="Run"><DetailLink selection={{ kind: 'run', id: detail.ownerRunId ?? '' }} onOpen={onOpen}><Value value={detail.ownerRunId} /></DetailLink></DetailField><DetailField label="Attempt"><DetailLink selection={{ kind: 'attempt', id: detail.ownerAttemptId ?? '' }} onOpen={onOpen}><Value value={detail.ownerAttemptId} /></DetailLink></DetailField><DetailField label="Digest"><Value value={detail.digest} /></DetailField><DetailField label="Created"><Value value={detail.createdAt} /></DetailField><DetailField label="Content">Metadata only; raw evidence content is not exposed.</DetailField></DetailDefinition>;
}

function DetailBody({ response, onOpen }: { response: AgentModeConsoleDetailResponse; onOpen: (selection: AgentModeDetailSelection) => void }) {
  if (response.status !== 'available') return <div className="card"><div className="card-title">{response.status === 'unavailable' ? 'Agent Mode unavailable' : 'Detail not found'}</div><p className="meta">{response.status === 'unavailable' ? response.freshness.message : 'Brain Core has no retained durable object with this identity.'}</p></div>;
  switch (response.detail.kind) {
    case 'agent': return <AgentDetail detail={response.detail} onOpen={onOpen} />;
    case 'task': return <TaskDetail detail={response.detail} onOpen={onOpen} />;
    case 'run': return <RunDetail detail={response.detail} onOpen={onOpen} />;
    case 'attempt': return <AttemptDetail detail={response.detail} onOpen={onOpen} />;
    case 'organization': return <OrganizationDetail detail={response.detail} onOpen={onOpen} />;
    case 'budget': return <BudgetDetail detail={response.detail} onOpen={onOpen} />;
    case 'schedule': return <ScheduleDetail detail={response.detail} />;
    case 'failure': return <FailureDetail detail={response.detail} onOpen={onOpen} />;
    case 'evidence': return <EvidenceDetail detail={response.detail} onOpen={onOpen} />;
  }
}

export function AgentModeConsoleDetail({ selection, onClose, onOpen }: { selection: AgentModeDetailSelection | null; onClose: () => void; onOpen: (selection: AgentModeDetailSelection) => void }) {
  const query = useQuery({
    queryKey: ['agent-mode-console-detail', selection?.kind, selection?.id],
    queryFn: () => brainCoreRequest(`/agent-mode/console/detail/${encodeURIComponent(selection!.kind)}/${encodeURIComponent(selection!.id)}`, agentModeConsoleDetailResponseSchema),
    enabled: Boolean(selection),
    refetchInterval: 7_000,
  });
  useEffect(() => {
    if (!selection) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, selection]);
  if (!selection) return null;
  const stale = query.isFetching && Boolean(query.data);
  return <aside className="card agent-console-detail-panel" aria-labelledby="agent-console-detail-title"><div className="card-header"><div><div className="eyebrow">Read-only detail</div><h2 id="agent-console-detail-title">{selection.kind} <code className="console-id">{selection.id}</code></h2><div className="meta">{query.data ? `generated ${timeAgo(query.data.generatedAt)}` : 'reading Brain Core'}</div></div><button type="button" className="icon-button" aria-label="Close detail" onClick={onClose}><X size={18} /></button></div>{stale ? <div className="agent-console-stale-note">Refreshing durable detail…</div> : null}{query.isError && !query.data ? <div className="agent-console-detail-state"><StatusBadge status="unavailable" /><span>Brain Core detail is unavailable.</span></div> : query.isFetching && !query.data ? <div className="agent-console-detail-state">Loading durable detail…</div> : query.data ? <DetailBody response={query.data} onOpen={onOpen} /> : null}</aside>;
}
