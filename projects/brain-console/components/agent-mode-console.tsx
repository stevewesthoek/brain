'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Activity, Bot, CircleAlert, Coins, GitBranch, ListChecks, Server, ShieldCheck } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import { agentModeConsoleProjectionSchema, type AgentModeAttentionProjection, type AgentModeConsoleProjection, type OperatorSessionResponse } from '@/lib/braincore-schemas';
import { formatUsd, timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { AgentModeConsoleDetail, type AgentModeDetailSelection } from '@/components/agent-mode-console-detail';
import { OperatorSessionPanel, ReviewControlButtons, RunControlButtons } from '@/components/operator-controls';
import { markOperatorNotificationRead, readOperatorAttention, readOperatorSession } from '@/lib/operator-client';

type ConsoleTab = 'overview' | 'attention' | 'roots' | 'agents' | 'organizations' | 'workcells' | 'tasks' | 'resources' | 'failures';

function id(value: string | null): React.ReactNode {
  return value ? <code className="console-id" title={value}>{value}</code> : <span className="meta">—</span>;
}

function safeStatus(value: string | null | undefined): string {
  return value ?? 'unknown';
}

function SummaryCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Activity }) {
  return (
    <article className="card compact-card metric-card">
      <div className="card-header">
        <div className="card-description">{label}</div>
        <Icon size={17} aria-hidden="true" />
      </div>
      <div className="metric">{value}</div>
      <div className="meta">{detail}</div>
    </article>
  );
}

function EmptyTable({ message }: { message: string }) {
  return <div className="card"><div className="card-title">Nothing to show</div><p className="meta">{message}</p></div>;
}

function DetailLink({ selection, onOpen, children }: { selection: AgentModeDetailSelection; onOpen: (selection: AgentModeDetailSelection) => void; children: React.ReactNode }) {
  return <button type="button" className="agent-console-detail-link" onClick={() => onOpen(selection)}>{children}</button>;
}

function ControlAuditPanel({ audits }: { audits: AgentModeConsoleProjection['controlAudits'] }) {
  return <section className="card"><div className="card-header"><div><div className="card-title">Recent control audit</div><div className="card-description">Bounded durable lifecycle and review receipts; operator sessions remain server-side.</div></div><ShieldCheck size={18} /></div>{audits.length === 0 ? <p className="meta">No recent control receipts are available.</p> : <div className="stack compact-detail-stack">{audits.slice(0, 5).map((audit) => <div className="agent-console-list-row" key={audit.receiptRef}><div className="min-w-0"><div><StatusBadge status={audit.status} /> <span>{audit.decision ?? audit.action} · {audit.operatorId ?? audit.serviceActor ?? audit.actor}</span></div><div className="meta">{id(audit.targetId)} · {audit.reasonCode} · {timeAgo(audit.occurredAt)}</div></div><div className="meta">{audit.processIdentityVerified === true ? 'identity verified' : audit.signalSent === true ? 'signal sent' : ''}</div></div>)}</div>}</section>;
}

function OverviewTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return (
    <div className="stack">
      <section className="grid two">
        <article className="card">
          <div className="card-header"><div><div className="card-title">Organizations</div><div className="card-description">Durable K5 ownership and finalization</div></div><GitBranch size={18} /></div>
          {data.organizations.length === 0 ? <p className="meta">No organization plans are present.</p> : data.organizations.map((organization) => (
            <div className="agent-console-list-row" key={organization.organizationPlanId}>
              <div className="min-w-0"><div className="card-title"><DetailLink selection={{ kind: 'organization', id: organization.organizationPlanId }} onOpen={onOpen}>{id(organization.organizationPlanId)}</DetailLink></div><div className="meta">Supervisor {id(organization.supervisorAgentId)}</div></div>
              <div className="row"><StatusBadge status={organization.finalStatus ?? organization.status} /><span className="meta">{organization.succeededCount}/{organization.workItemCount} succeeded</span></div>
            </div>
          ))}
        </article>
        <article className="card">
          <div className="card-header"><div><div className="card-title">Current work</div><div className="card-description">Task and attempt state from Brain Core</div></div><Activity size={18} /></div>
          <div className="mini-stats">
            <div><span>Tasks</span><strong>{data.summary.runningTaskCount}</strong></div>
            <div><span>Attempts</span><strong>{data.summary.runningAttemptCount}</strong></div>
            <div><span>Uncertain</span><strong>{data.summary.uncertainCount}</strong></div>
            <div><span>Blocked</span><strong>{data.summary.blockedCount}</strong></div>
          </div>
        </article>
      </section>
      <section className="grid two">
        <article className="card">
          <div className="card-header"><div><div className="card-title">Budgets</div><div className="card-description">Durable root reservations and settled usage</div></div><Coins size={18} /></div>
          {data.budgets.length === 0 ? <p className="meta">No root budget facts are available.</p> : data.budgets.map((budget) => <div className="agent-console-list-row" key={budget.rootGoalId}><DetailLink selection={{ kind: 'budget', id: budget.rootGoalId }} onOpen={onOpen}>{id(budget.rootGoalId)}</DetailLink><span className="meta">reserved {formatUsd(budget.reservedCost)} · settled {formatUsd(budget.settledCost)}</span></div>)}
        </article>
        <article className="card">
          <div className="card-header"><div><div className="card-title">Read-only queues</div><div className="card-description">Only durable metadata is shown</div></div><ShieldCheck size={18} /></div>
          <div className="mini-stats">
            <div><span>Approvals</span><strong>{data.summary.pendingApprovalCount}</strong></div>
            <div><span>Schedules</span><strong>{data.summary.activeScheduleCount}</strong></div>
            <div><span>Evidence</span><strong>{data.evidenceSummary.evidenceCount}</strong></div>
            <div><span>Failures</span><strong>{data.failures.length}</strong></div>
          </div>
        </article>
      </section>
      {data.schedules.length > 0 ? <section className="card"><div className="card-title">Schedules</div>{data.schedules.slice(0, 5).map((schedule) => <div className="agent-console-list-row" key={schedule.scheduleId}><DetailLink selection={{ kind: 'schedule', id: schedule.scheduleId }} onOpen={onOpen}>{id(schedule.scheduleId)}</DetailLink><span><StatusBadge status={schedule.status} /> <span className="meta">next {timeAgo(schedule.nextEligibleAt)}</span></span></div>)}</section> : null}
      {data.approvals.length > 0 ? <section className="card"><div className="card-header"><div><div className="card-title">Pending Agent Mode reviews</div><div className="card-description">Decisions remain subject to Brain Core review authority.</div></div><ShieldCheck size={18} /></div>{data.approvals.map((approval) => <div className="agent-console-list-row" key={approval.approvalId}><div><div><code className="console-id">{approval.reviewId ?? approval.approvalId}</code></div><div className="meta">{approval.workerAgentId ?? approval.objectType} · evidence {approval.evidenceHash ? 'bound' : 'unavailable'}</div></div><ReviewControlButtons reviewId={approval.reviewId ?? approval.approvalId} evidenceHash={approval.evidenceHash} /></div>)}</section> : null}
      <ControlAuditPanel audits={data.controlAudits} />
      {data.failures.length > 0 ? <section className="card"><div className="card-title">Latest operational exceptions</div><FailureTable failures={data.failures.slice(0, 5)} onOpen={onOpen} /></section> : null}
    </div>
  );
}

function AgentsTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'terminal' | 'failed' | 'uncertain'>('all');
  const agents = data.agents.filter((agent) => filter === 'all' || (filter === 'active' ? ['active', 'assigned', 'reserved', 'running'].includes(agent.lifecycleStatus) : filter === 'terminal' ? ['completed', 'cancelled', 'failed', 'expired', 'retired'].includes(agent.lifecycleStatus) : agent.lifecycleStatus === filter));
  return (
    <div className="stack">
      <div className="split"><div><div className="card-title">Agent hierarchy</div><div className="card-description">Bounded durable Agent Mode agents; filters are local view state.</div></div><select className="select agent-console-filter" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}><option value="all">All agents</option><option value="active">Active</option><option value="terminal">Terminal</option><option value="failed">Failed</option><option value="uncertain">Uncertain</option></select></div>
      {agents.length === 0 ? <EmptyTable message="No agents match this view." /> : <div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Agent</th><th>Role</th><th>Root / parent</th><th>Status</th><th>Depth</th><th>Runtime / model</th><th>Updated</th></tr></thead><tbody>{agents.map((agent) => <tr key={agent.agentId}><td><DetailLink selection={{ kind: 'agent', id: agent.agentId }} onOpen={onOpen}>{id(agent.agentId)}</DetailLink></td><td><div>{agent.organizationRoleId ?? agent.roleTemplateId ?? '—'}</div></td><td><div>{id(agent.rootGoalId)}</div><div className="meta">parent {id(agent.parentAgentId)}</div></td><td><StatusBadge status={agent.lifecycleStatus} /></td><td>{agent.depth ?? '—'}</td><td><div>{agent.runtimeRef ?? '—'}</div><div className="meta">{agent.modelRef ?? 'no model fact'}</div></td><td className="meta">{timeAgo(agent.updatedAt)}</td></tr>)}</tbody></table></div>}
    </div>
  );
}

function OrganizationsTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return data.organizations.length === 0 ? <EmptyTable message="No durable organization plans are present." /> : <div className="stack">{data.organizations.map((organization) => <article className="card" key={organization.organizationPlanId}><div className="card-header"><div><div className="card-title"><DetailLink selection={{ kind: 'organization', id: organization.organizationPlanId }} onOpen={onOpen}>{id(organization.organizationPlanId)}</DetailLink></div><div className="meta">Root {id(organization.rootGoalId)} · supervisor {id(organization.supervisorAgentId)}</div></div><StatusBadge status={organization.finalStatus ?? organization.status} /></div><div className="mini-stats"><div><span>Ready</span><strong>{organization.readyCount}</strong></div><div><span>Running</span><strong>{organization.runningCount}</strong></div><div><span>Succeeded</span><strong>{organization.succeededCount}</strong></div><div><span>Failed / uncertain</span><strong>{organization.failedCount} / {organization.uncertainCount}</strong></div></div><div className="agent-console-list-row"><span>Auditor {organization.auditorStatus ?? 'not yet selected'}</span><span className="meta">cost {formatUsd(organization.aggregateCost)} · final {id(organization.finalResultId)}</span></div><div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Work item</th><th>Role</th><th>Readiness</th><th>Delegation</th><th>Lifecycle</th><th>Evidence / cost</th></tr></thead><tbody>{organization.workItems.map((item) => <tr key={item.workItemId}><td><div>{item.workItemKey}</div><div className="meta">{id(item.workItemId)}</div></td><td>{item.organizationRoleId}</td><td><StatusBadge status={item.readiness} /></td><td><StatusBadge status={item.delegationState} /></td><td><div><DetailLink selection={{ kind: 'agent', id: item.childAgentId ?? '' }} onOpen={onOpen}>{id(item.childAgentId)}</DetailLink></div><div className="meta"><DetailLink selection={{ kind: 'task', id: item.taskId ?? '' }} onOpen={onOpen}>{id(item.taskId)}</DetailLink></div></td><td>{item.evidenceRefCount} refs · {formatUsd(item.settledCost)}</td></tr>)}</tbody></table></div></article>)}</div>;
}

function TasksTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return data.tasks.length === 0 ? <EmptyTable message="No durable tasks are present." /> : <div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Task</th><th>Run</th><th>Attempt</th><th>Agent / root</th><th>Status</th><th>Runtime / model</th><th>Updated</th><th>Controls</th></tr></thead><tbody>{data.tasks.map((task) => <tr key={task.taskId}><td><DetailLink selection={{ kind: 'task', id: task.taskId }} onOpen={onOpen}>{id(task.taskId)}</DetailLink></td><td><DetailLink selection={{ kind: 'run', id: task.runId ?? '' }} onOpen={onOpen}>{id(task.runId)}</DetailLink></td><td><DetailLink selection={{ kind: 'attempt', id: task.attemptId ?? '' }} onOpen={onOpen}>{id(task.attemptId)}</DetailLink></td><td><div><DetailLink selection={{ kind: 'agent', id: task.agentId ?? '' }} onOpen={onOpen}>{id(task.agentId)}</DetailLink></div><div className="meta">{id(task.rootGoalId)}</div></td><td><StatusBadge status={task.uncertaintyState ?? task.status} /></td><td><div>{task.runtimeRef ?? '—'}</div><div className="meta">{task.modelRef ?? 'no model fact'}</div></td><td className="meta">{timeAgo(task.updatedAt)}</td><td>{task.runId ? <RunControlButtons runId={task.runId} status={task.status} /> : <span className="meta">No run</span>}</td></tr>)}</tbody></table></div>;
}

function RootsTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return data.rootGoals.length === 0 ? <EmptyTable message="No durable root-goal authority facts are present." /> : <div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Root goal</th><th>Jarvis / organization</th><th>Status</th><th>Children</th><th>Budget</th><th>Deadline</th></tr></thead><tbody>{data.rootGoals.map((root) => <tr key={root.rootGoalId}><td><DetailLink selection={{ kind: 'root', id: root.rootGoalId }} onOpen={onOpen}>{id(root.rootGoalId)}</DetailLink></td><td><div><DetailLink selection={{ kind: 'agent', id: root.jarvisAgentId ?? '' }} onOpen={onOpen}>{id(root.jarvisAgentId)}</DetailLink></div><div className="meta">{id(root.organizationPlanId)}</div></td><td><StatusBadge status={root.status} /><div className="meta">{root.cancellationState ?? 'no cancellation'}</div></td><td>{root.activeChildren ?? '—'} active · {root.totalChildCreations ?? '—'} created</td><td>{root.reservedCost === null ? 'unknown' : formatUsd(root.reservedCost)} reserved · {root.settledCost === null ? 'unknown' : formatUsd(root.settledCost)} settled</td><td className="meta">{root.deadline ? timeAgo(root.deadline) : 'unknown'}</td></tr>)}</tbody></table></div>;
}

function WorkcellsTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return data.workcells.length === 0 ? <EmptyTable message="No durable Workcells are currently visible." /> : <div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Workcell</th><th>Repository / branch</th><th>Owner</th><th>Status</th><th>Lease</th><th>Validation / diff</th></tr></thead><tbody>{data.workcells.map((workcell) => <tr key={workcell.workcellId}><td><DetailLink selection={{ kind: 'workcell', id: workcell.workcellId }} onOpen={onOpen}>{id(workcell.workcellId)}</DetailLink><div className="meta">{id(workcell.taskId)} · {id(workcell.attemptId)}</div></td><td><div>{workcell.repositoryRef || 'unknown repository'}</div><div className="meta">{workcell.branch || 'unknown branch'} · base {workcell.baseRef || 'unknown'}</div></td><td>{id(workcell.ownerAgent)}</td><td><StatusBadge status={workcell.status} /><div className="meta">{timeAgo(workcell.updatedAt)}</div></td><td>{workcell.lease ? <><StatusBadge status={workcell.lease.current ? 'active' : workcell.lease.status} /><div className="meta">{id(workcell.lease.ownerAttempt)}</div></> : <span className="meta">No lease fact</span>}</td><td><div>{workcell.validation ? `${workcell.validation.result} · ${workcell.validation.validatorProfile}` : 'validation unavailable'}</div><div className="meta">{workcell.diff ? `${workcell.diff.changedFileCount} changed files · ${workcell.diff.diffHash}` : 'diff unavailable'}</div></td></tr>)}</tbody></table></div>;
}

function ResourcesTab({ data }: { data: AgentModeConsoleProjection }) {
  return <div className="grid two"><article className="card"><div className="card-header"><div><div className="card-title">Nodes</div><div className="card-description">Durable host-health facts only; no probes.</div></div><Server size={18} /></div>{data.nodeResources.length === 0 ? <p className="meta">Node health unavailable.</p> : data.nodeResources.map((node) => <div className="agent-console-list-row" key={`${node.sourceId}:${node.resourceId}`}><div><div>{id(node.resourceId ?? node.sourceId)}</div><div className="meta">{node.providerId ?? 'provider unknown'} · {timeAgo(node.observedAt)}</div></div><StatusBadge status={node.status ?? node.freshness ?? 'unknown'} /></div>)}</article><article className="card"><div className="card-title">Runtimes</div>{data.runtimes.length === 0 ? <p className="meta">Runtime facts unavailable.</p> : data.runtimes.map((runtime) => <div className="agent-console-list-row" key={runtime.dispatchId ?? runtime.attemptId ?? runtime.runtimeRef}><div><div>{runtime.runtimeRef ?? 'unknown runtime'}</div><div className="meta">{runtime.runtimeProfileRef ?? 'profile unknown'} · {id(runtime.attemptId)}</div></div><StatusBadge status={runtime.uncertaintyState ?? runtime.status} /></div>)}</article><article className="card"><div className="card-title">Models / providers</div>{data.modelResources.length === 0 ? <p className="meta">No durable model/provider facts are available.</p> : data.modelResources.map((model) => <div className="agent-console-list-row" key={model.operationId}><div><div>{model.modelRef ?? 'model unknown'}</div><div className="meta">{model.providerId ?? 'provider unknown'} · {model.route ?? 'route unknown'}</div></div><StatusBadge status={model.status} /></div>)}</article><article className="card"><div className="card-title">Execution resources</div>{data.executionResources.length === 0 ? <p className="meta">No execution-resource facts are available.</p> : data.executionResources.map((resource) => <div className="agent-console-list-row" key={resource.resourceId}><div><div>{id(resource.resourceId)}</div><div className="meta">{resource.runtimeRef ?? 'runtime unknown'} · {id(resource.attemptId)}</div></div><StatusBadge status={resource.freshness === 'unknown' ? 'unavailable' : resource.status} /></div>)}</article></div>;
}

function FailureTable({ failures, onOpen }: { failures: AgentModeConsoleProjection['failures']; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return <div className="table-wrap"><table className="agent-console-table"><thead><tr><th>Object</th><th>ID</th><th>Root</th><th>Status</th><th>Reason</th><th>Updated</th></tr></thead><tbody>{failures.map((failure) => <tr key={`${failure.objectType}:${failure.objectId}`}><td>{failure.objectType}</td><td><DetailLink selection={{ kind: 'failure', id: failure.objectId }} onOpen={onOpen}>{id(failure.objectId)}</DetailLink></td><td>{id(failure.rootGoalId)}</td><td><StatusBadge status={failure.status} /></td><td><code>{failure.reasonCode}</code></td><td className="meta">{timeAgo(failure.updatedAt)}</td></tr>)}</tbody></table></div>;
}

function FailuresTab({ data, onOpen }: { data: AgentModeConsoleProjection; onOpen: (selection: AgentModeDetailSelection) => void }) {
  return data.failures.length === 0 ? <EmptyTable message="No failed, blocked, cancelled, uncertain, or dead-letter entries are currently visible." /> : <FailureTable failures={data.failures} onOpen={onOpen} />;
}

function AttentionTab({ attention, session }: { attention: AgentModeAttentionProjection | undefined; session: OperatorSessionResponse | undefined }) {
  const queryClient = useQueryClient();
  const read = useMutation({
    mutationFn: ({ notificationId, csrfToken }: { notificationId: string; csrfToken: string }) => markOperatorNotificationRead(notificationId, csrfToken),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['agent-mode-attention'] }),
  });
  if (!session?.authenticated) return <EmptyTable message="Sign in with the local operator session to view personalized unread notifications." />;
  if (!attention) return <EmptyTable message="Attention state is unavailable." />;
  return <div className="stack"><section className="card"><div className="card-header"><div><div className="card-title">Attention</div><div className="card-description">Durable Brain notifications and escalation references. Read acknowledgement does not resolve or approve work.</div></div><StatusBadge status={attention.freshness.status} /></div><div className="mini-stats"><div><span>Unread</span><strong>{attention.summary.unreadNotificationCount ?? '—'}</strong></div><div><span>Open escalations</span><strong>{attention.summary.openEscalationCount}</strong></div><div><span>Uncertain</span><strong>{attention.summary.uncertainItemCount}</strong></div><div><span>Dead letters</span><strong>{attention.summary.deadLetterCount}</strong></div></div></section>{attention.notifications.length === 0 ? <EmptyTable message="No durable notifications are available." /> : <section className="card"><div className="stack compact-detail-stack">{attention.notifications.map((notification) => <div className="agent-console-list-row" key={notification.notificationId}><div className="min-w-0"><div><StatusBadge status={notification.severity} /> <span>{notification.titleCode}</span>{notification.read === false ? <span className="meta"> · unread</span> : null}</div><div className="meta"><code className="console-id">{notification.notificationId}</code> · {notification.messageCode} · {timeAgo(notification.createdAt)}</div></div>{notification.read === false ? <button type="button" className="button compact secondary" disabled={read.isPending} onClick={() => read.mutate({ notificationId: notification.notificationId, csrfToken: session.csrfToken })}>Mark read</button> : null}</div>)}</div></section>}</div>;
}

export function AgentModeConsole() {
  const [tab, setTab] = useState<ConsoleTab>('overview');
  const [selection, setSelection] = useState<AgentModeDetailSelection | null>(null);
  const query = useQuery({
    queryKey: ['agent-mode-console'],
    queryFn: () => brainCoreRequest('/agent-mode/console', agentModeConsoleProjectionSchema),
    refetchInterval: 7_000,
  });
  const session = useQuery({ queryKey: ['operator-session'], queryFn: readOperatorSession, retry: 0 });
  const attentionQuery = useQuery({ queryKey: ['agent-mode-attention'], queryFn: readOperatorAttention, refetchInterval: 7_000, retry: 0 });
  const data = query.data;
  const freshness = query.isError ? 'unavailable' : query.isFetching && data ? 'stale' : data?.freshness.status ?? 'loading';
  const tabs: Array<{ id: ConsoleTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'attention', label: `Attention${attentionQuery.data?.summary.unreadNotificationCount ? ` (${attentionQuery.data.summary.unreadNotificationCount})` : ''}` },
    { id: 'roots', label: 'Roots' },
    { id: 'agents', label: 'Agents' },
    { id: 'organizations', label: 'Organizations' },
    { id: 'workcells', label: 'Workcells' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'resources', label: 'Resources' },
    { id: 'failures', label: 'Failures' },
  ];

  return (
    <div className="stack agent-console-screen">
      <section className="page-heading"><div><div className="eyebrow">Agent Mode</div><h1>Agents</h1><p>Operational state is reconstructed from Brain Core’s durable Agent Mode StateStore. Lifecycle and review controls remain guarded by Brain Core.</p></div><div className="row"><StatusBadge status={freshness} label={freshness} /><span className="meta">{data ? `generated ${timeAgo(data.generatedAt)}` : 'waiting for Brain Core'}</span></div></section>
      <OperatorSessionPanel />
      {query.isError && !data ? <div className="card"><div className="card-title">Agent Mode unavailable</div><p>Brain Core did not return the canonical Agent Mode console projection.</p></div> : null}
      {query.isFetching && !data ? <div className="card"><div className="card-title">Loading Agent Mode</div><p className="meta">Reading the bounded projection from Brain Core…</p></div> : null}
      {data ? <>
        {query.isError ? <div className="card"><div className="card-title">Showing stale durable state</div><p className="meta">The latest projection is retained by TanStack Query with a visible stale indicator; it is not treated as fresh.</p></div> : null}
        <section className="grid cards agent-console-summary"><SummaryCard label="Active agents" value={data.summary.activeAgentCount} detail={`${data.summary.activeRootGoalCount} active roots`} icon={Bot} /><SummaryCard label="Running work" value={data.summary.runningTaskCount} detail={`${data.summary.runningAttemptCount} attempts`} icon={ListChecks} /><SummaryCard label="Uncertain" value={data.summary.uncertainCount} detail="requires durable reconciliation" icon={CircleAlert} /><SummaryCard label="Pending approvals" value={data.summary.pendingApprovalCount} detail={`${data.summary.activeScheduleCount} active schedules`} icon={ShieldCheck} /><SummaryCard label="Reserved cost" value={formatUsd(data.summary.reservedCost)} detail="root reservations" icon={Coins} /><SummaryCard label="Settled cost" value={formatUsd(data.summary.settledCost)} detail="durable settled facts" icon={Activity} /></section>
        <div className="tabs" role="tablist" aria-label="Agent Mode views">{tabs.map((candidate) => <button type="button" role="tab" aria-selected={tab === candidate.id} className={tab === candidate.id ? 'active' : ''} key={candidate.id} onClick={() => setTab(candidate.id)}>{candidate.label}</button>)}</div>
        {tab === 'overview' ? <OverviewTab data={data} onOpen={setSelection} /> : null}
        {tab === 'attention' ? <AttentionTab attention={attentionQuery.data} session={session.data} /> : null}
        {tab === 'roots' ? <RootsTab data={data} onOpen={setSelection} /> : null}
        {tab === 'agents' ? <AgentsTab data={data} onOpen={setSelection} /> : null}
        {tab === 'organizations' ? <OrganizationsTab data={data} onOpen={setSelection} /> : null}
        {tab === 'workcells' ? <WorkcellsTab data={data} onOpen={setSelection} /> : null}
        {tab === 'tasks' ? <TasksTab data={data} onOpen={setSelection} /> : null}
        {tab === 'resources' ? <ResourcesTab data={data} /> : null}
        {tab === 'failures' ? <FailuresTab data={data} onOpen={setSelection} /> : null}
        <AgentModeConsoleDetail selection={selection} onClose={() => setSelection(null)} onOpen={setSelection} />
        <div className="meta agent-console-source">Source: {data.freshness.sourceStatus}; StateStore present: {String(data.freshness.stateStorePresent)}; schema {data.schemaVersion}; refresh every 7 seconds.</div>
      </> : null}
    </div>
  );
}
