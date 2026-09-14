'use client';

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { operatorRequest, readOperatorSession, submitOperatorControl, OperatorClientError } from '@/lib/operator-client';
import { operatorSessionResponseSchema, type AgentModeControlResponse } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';

type LifecycleAction = 'pause' | 'resume' | 'cancel' | 'kill';
type ReviewDecision = 'approved' | 'rejected';

function newOperationId(): string {
  return `brain-console-operation:${crypto.randomUUID()}`;
}

function controlMessage(response: AgentModeControlResponse): string {
  return 'result' in response ? `${response.result.outcome} · ${response.result.reasonCode}` : response.error.message;
}

function Confirmation({ title, description, confirmLabel, destructive, onCancel, onConfirm }: { title: string; description: string; confirmLabel: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void }) {
  return <div className="operator-confirm-backdrop" role="presentation"><section className="card operator-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="operator-confirm-title"><div className="card-title" id="operator-confirm-title">{title}</div><p className="meta">{description}</p><div className="compact-actions"><button type="button" className="button compact secondary" onClick={onCancel}>Back</button><button type="button" className={destructive ? 'button compact danger-button' : 'button compact primary'} onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

export function OperatorSessionPanel() {
  const queryClient = useQueryClient();
  const session = useQuery({ queryKey: ['operator-session'], queryFn: readOperatorSession, refetchInterval: 60_000, retry: 0 });
  const [operatorId, setOperatorId] = useState('');
  const [operatorSecret, setOperatorSecret] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const login = useMutation({
    mutationFn: () => operatorRequest('/api/operator/session', operatorSessionResponseSchema, { method: 'POST', body: JSON.stringify({ schemaVersion: 'brain-console-operator-v1', operatorId, operatorSecret }) }),
    retry: 0,
    onSuccess: (result) => {
      setOperatorSecret('');
      if (!result.authenticated) setLoginError('Operator authentication failed.');
      else { setLoginError(null); void queryClient.invalidateQueries({ queryKey: ['operator-session'] }); }
    },
    onError: (error) => { setOperatorSecret(''); setLoginError(error instanceof OperatorClientError && error.code === 'operator_auth_unavailable' ? 'Operator authentication is unavailable.' : 'Operator authentication failed.'); },
  });
  const logout = useMutation({
    mutationFn: () => operatorRequest('/api/operator/session', operatorSessionResponseSchema, { method: 'DELETE' }),
    retry: 0,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['operator-session'] }),
  });
  const authenticatedSession = session.data?.authenticated ? session.data : null;
  return <section className="card operator-session-card"><div className="card-header"><div><div className="card-title">Operator session</div><div className="card-description">Mutation controls require a local authenticated session and CSRF-bound request.</div></div><StatusBadge status={authenticatedSession ? 'authenticated' : session.isError ? 'unavailable' : 'read-only'} label={authenticatedSession ? `signed in · ${authenticatedSession.operatorId}` : 'read-only'} /></div>{authenticatedSession ? <div className="split"><span className="meta">Expires {new Date(authenticatedSession.expiresAt).toLocaleString()}</span><button type="button" className="button compact secondary" disabled={logout.isPending} onClick={() => logout.mutate()}>Sign out</button></div> : <form className="operator-login-form" onSubmit={(event) => { event.preventDefault(); setLoginError(null); login.mutate(); }}><label>Operator ID<input value={operatorId} maxLength={128} autoComplete="off" onChange={(event) => setOperatorId(event.target.value)} /></label><label>Operator secret<input type="password" value={operatorSecret} maxLength={512} autoComplete="off" onChange={(event) => setOperatorSecret(event.target.value)} /></label><button type="submit" className="button compact primary" disabled={login.isPending || operatorId.length === 0 || operatorSecret.length === 0}>{login.isPending ? 'Signing in…' : 'Sign in'}</button></form>}{loginError ? <p className="compact-error" role="alert">{loginError}</p> : null}{logout.isError ? <p className="compact-error" role="alert">Unable to clear the operator session.</p> : null}</section>;
}

function useControlMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body, csrfToken }: { path: string; body: Record<string, string>; csrfToken: string }) => submitOperatorControl(path, body, csrfToken),
    retry: 0,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-mode-console'] });
      void queryClient.invalidateQueries({ queryKey: ['agent-mode-console-detail'] });
      void queryClient.invalidateQueries({ queryKey: ['operator-session'] });
    },
  });
}

export function RunControlButtons({ runId, status }: { runId: string; status: string }) {
  const session = useQuery({ queryKey: ['operator-session'], queryFn: readOperatorSession, retry: 0 });
  const mutation = useControlMutation();
  const operationIds = useRef(new Map<string, string>());
  const [confirmation, setConfirmation] = useState<LifecycleAction | null>(null);
  const authenticatedSession = session.data?.authenticated ? session.data : null;
  if (!authenticatedSession) return <span className="meta">Sign in to control</span>;
  const operationId = (action: LifecycleAction) => { const key = `${runId}:${action}`; const existing = operationIds.current.get(key); if (existing) return existing; const created = newOperationId(); operationIds.current.set(key, created); return created; };
  const submit = (action: LifecycleAction) => { mutation.mutate({ path: `/api/agent-mode/control/run/${encodeURIComponent(runId)}`, csrfToken: authenticatedSession.csrfToken, body: { schemaVersion: 'agent-mode-control-v1', operationId: operationId(action), action, reason: `Operator requested ${action} from Brain Console.` } }); };
  const terminal = ['completed', 'failed', 'cancelled', 'expired', 'retired'].includes(status);
  return <div className="operator-control-group"><div className="compact-actions">{(['pause', 'resume', 'cancel', 'kill'] as const).map((action) => <button type="button" key={action} className={action === 'kill' ? 'button compact danger-button' : 'button compact secondary'} disabled={terminal || mutation.isPending} onClick={() => action === 'cancel' || action === 'kill' ? setConfirmation(action) : submit(action)}>{action}</button>)}</div>{mutation.data ? <span className="meta" role="status">{controlMessage(mutation.data)}</span> : null}{mutation.error ? <span className="compact-error" role="alert">Control unavailable.</span> : null}{confirmation ? <Confirmation title={`${confirmation} run?`} description={`This sends the ${confirmation} request for ${runId}. Brain Core will revalidate current state and runtime ownership.`} confirmLabel={`Confirm ${confirmation}`} destructive={confirmation === 'kill'} onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); submit(confirmation); }} /> : null}</div>;
}

export function ReviewControlButtons({ reviewId, evidenceHash }: { reviewId: string; evidenceHash: string | null }) {
  const session = useQuery({ queryKey: ['operator-session'], queryFn: readOperatorSession, retry: 0 });
  const mutation = useControlMutation();
  const operationIds = useRef(new Map<ReviewDecision, string>());
  const [confirmation, setConfirmation] = useState<ReviewDecision | null>(null);
  const authenticatedSession = session.data?.authenticated ? session.data : null;
  if (!authenticatedSession || !evidenceHash) return <span className="meta">Sign in to review</span>;
  const submit = (decision: ReviewDecision) => { const existing = operationIds.current.get(decision) ?? newOperationId(); operationIds.current.set(decision, existing); mutation.mutate({ path: `/api/agent-mode/control/review/${encodeURIComponent(reviewId)}`, csrfToken: authenticatedSession.csrfToken, body: { schemaVersion: 'agent-mode-control-v1', operationId: existing, decision, reason: `Operator ${decision} review from Brain Console.`, evidenceHash } }); };
  return <div className="operator-control-group"><div className="compact-actions"><button type="button" className="button compact primary" disabled={mutation.isPending} onClick={() => setConfirmation('approved')}>Approve</button><button type="button" className="button compact danger-button" disabled={mutation.isPending} onClick={() => setConfirmation('rejected')}>Reject</button></div>{mutation.data ? <span className="meta" role="status">{controlMessage(mutation.data)}</span> : null}{mutation.error ? <span className="compact-error" role="alert">Review unavailable.</span> : null}{confirmation ? <Confirmation title={`${confirmation === 'approved' ? 'Approve' : 'Reject'} review?`} description={`This records the ${confirmation} decision for ${reviewId}. No deploy, commit, or other downstream action is triggered by this decision.`} confirmLabel={`Confirm ${confirmation === 'approved' ? 'approval' : 'rejection'}`} destructive={confirmation === 'rejected'} onCancel={() => setConfirmation(null)} onConfirm={() => { setConfirmation(null); submit(confirmation); }} /> : null}</div>;
}
