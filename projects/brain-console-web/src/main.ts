import './styles.css';

type FetchState = 'idle' | 'pending' | 'ok' | 'error';
type ActivityLevel = 'info' | 'success' | 'warning' | 'error';
type VideoJobStatus = 'draft' | 'awaiting_approval' | 'approved' | 'generating' | 'generated' | 'ready_to_publish' | 'publishing' | 'published' | 'failed' | string;

interface ChannelStatus {
  channelId: string;
  displayName?: string;
  publishingStatus?: string;
  totalTopics?: number;
  youtubeEnabled?: boolean;
}

interface PipelineStatus {
  channels: ChannelStatus[];
  pipelineReady: boolean;
  generationStatus: string;
  publishingStatus: string;
}

interface VideoJobSummary {
  jobId: string;
  channelId: string;
  title: string;
  status: VideoJobStatus;
  currentStep: string | null;
  progress: number;
  createdAt: string | null;
  updatedAt: string | null;
  approval: { status: string; required: boolean };
  generation: { status: string; executionArn: string | null; startedAt: string | null; completedAt: string | null };
  publishing: { status: string; videoId: string | null; url: string | null };
  error: { step: string | null; message: string | null };
  artifacts: { script: string | null; narration: string | null; finalVideo: string | null; thumbnail: string | null };
}

interface Timeline {
  jobId: string;
  events: Array<{ step: string; status: string; timestamp: string | null; message: string }>;
}

interface ActivityEntry {
  at: string;
  level: ActivityLevel;
  message: string;
}

const BRAIN_CORE_URL = String(import.meta.env.VITE_BRAIN_CORE_URL ?? 'http://localhost:4877').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 7000;
const ACTIVE_STATES = new Set(['generating', 'publishing']);
const TERMINAL_GENERATION_STATES = new Set(['generating', 'generated', 'ready_to_publish', 'publishing', 'published']);

const state: {
  statusFetch: FetchState;
  jobsFetch: FetchState;
  pipeline: PipelineStatus | null;
  jobs: VideoJobSummary[];
  selectedJobId: string | null;
  selectedJob: VideoJobSummary | null;
  timeline: Timeline | null;
  error: string | null;
  activity: ActivityEntry[];
  lastRefresh: string;
  showDraftModal: boolean;
  draftChannelId: string;
  draftPrompt: string;
  draftSubmitting: boolean;
  loading: boolean;
} = {
  statusFetch: 'idle',
  jobsFetch: 'idle',
  pipeline: null,
  jobs: [],
  selectedJobId: null,
  selectedJob: null,
  timeline: null,
  error: null,
  activity: [],
  lastRefresh: 'never',
  showDraftModal: false,
  draftChannelId: '',
  draftPrompt: '',
  draftSubmitting: false,
  loading: false,
};

const rootElement = document.querySelector<HTMLDivElement>('#root');
if (!rootElement) throw new Error('Missing #root element');
const root: HTMLDivElement = rootElement;

function addActivity(level: ActivityLevel, message: string): void {
  state.activity = [{ at: new Date().toLocaleTimeString(), level, message }, ...state.activity].slice(0, 12);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BRAIN_CORE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) as unknown : null;
    if (!response.ok) {
      throw new Error(`${init?.method ?? 'GET'} ${path} failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`${init?.method ?? 'GET'} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function unwrapData(value: unknown): Record<string, unknown> | null {
  const rootValue = asRecord(value);
  return asRecord(rootValue?.data) ?? rootValue;
}

function unwrapStatus(payload: unknown): PipelineStatus {
  const data = unwrapData(payload);
  return {
    channels: Array.isArray(data?.channels) ? data.channels as ChannelStatus[] : [],
    pipelineReady: Boolean(data?.pipelineReady),
    generationStatus: typeof data?.generationStatus === 'string' ? data.generationStatus : 'unknown',
    publishingStatus: typeof data?.publishingStatus === 'string' ? data.publishingStatus : 'unknown',
  };
}

function unwrapJobs(payload: unknown): VideoJobSummary[] {
  const rootValue = asRecord(payload);
  const data = asRecord(rootValue?.data);
  const jobs = Array.isArray(payload) ? payload : Array.isArray(rootValue?.jobs) ? rootValue.jobs : Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.filter(job => typeof asRecord(job)?.jobId === 'string') as VideoJobSummary[];
}

function unwrapJob(payload: unknown): VideoJobSummary {
  const data = unwrapData(payload);
  if (!data?.jobId) throw new Error(`Unexpected job response shape: ${Object.keys(asRecord(payload) ?? {}).join(', ')}`);
  return data as unknown as VideoJobSummary;
}

function unwrapTimeline(payload: unknown, fallbackJobId: string): Timeline {
  const data = unwrapData(payload);
  if (!data?.jobId || !Array.isArray(data.events)) return { jobId: fallbackJobId, events: [] };
  return data as unknown as Timeline;
}

function extractJobId(payload: unknown): string | null {
  const rootValue = asRecord(payload);
  const data = asRecord(rootValue?.data);
  const job = asRecord(rootValue?.job) ?? asRecord(data?.job);
  return [rootValue?.jobId, data?.jobId, job?.jobId].find((value): value is string => typeof value === 'string') ?? null;
}

async function refresh(reason = 'manual refresh'): Promise<void> {
  state.error = null;
  state.loading = true;
  state.lastRefresh = new Date().toLocaleTimeString();
  state.statusFetch = 'pending';
  state.jobsFetch = 'pending';
  addActivity('info', `Refresh started: ${reason}`);
  render();

  try {
    addActivity('info', 'Status request started');
    render();
    state.pipeline = unwrapStatus(await requestJson<unknown>('/api/video-orchestrator/status'));
    state.statusFetch = 'ok';
    if (!state.draftChannelId) state.draftChannelId = state.pipeline.channels[0]?.channelId ?? '';
    addActivity('success', 'Status request ok');
  } catch (error) {
    state.statusFetch = 'error';
    state.error = errorMessage(error);
    addActivity('error', state.error);
  }

  try {
    addActivity('info', 'Jobs request started');
    render();
    state.jobs = unwrapJobs(await requestJson<unknown>('/api/video-orchestrator/jobs/recent'));
    state.jobsFetch = 'ok';
    addActivity('success', `Loaded ${state.jobs.length} operational jobs`);
    const nextSelected = state.selectedJobId && state.jobs.some(job => job.jobId === state.selectedJobId)
      ? state.selectedJobId
      : state.jobs[0]?.jobId ?? null;
    if (nextSelected) await loadJob(nextSelected, false);
  } catch (error) {
    state.jobsFetch = 'error';
    state.error = errorMessage(error);
    addActivity('error', state.error);
  } finally {
    state.loading = false;
    render();
  }
}

async function loadJob(jobId: string, rerender = true): Promise<void> {
  state.selectedJobId = jobId;
  state.error = null;
  addActivity('info', `Loading job ${jobId}`);
  if (rerender) render();
  try {
    const [jobPayload, timelinePayload] = await Promise.all([
      requestJson<unknown>(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}`),
      requestJson<unknown>(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/timeline`),
    ]);
    state.selectedJob = unwrapJob(jobPayload);
    state.timeline = unwrapTimeline(timelinePayload, jobId);
    addActivity('success', `Loaded job ${jobId}`);
  } catch (error) {
    state.selectedJob = null;
    state.timeline = null;
    state.error = errorMessage(error);
    addActivity('error', state.error);
  } finally {
    if (rerender) render();
  }
}

async function createDraft(): Promise<void> {
  if (!state.draftChannelId || state.draftPrompt.trim().length < 10 || state.draftSubmitting) return;
  state.draftSubmitting = true;
  addActivity('info', 'Creating draft...');
  render();
  try {
    const payload = await requestJson<unknown>('/api/video-orchestrator/jobs/create-from-prompt', {
      method: 'POST',
      body: JSON.stringify({ channelId: state.draftChannelId, prompt: state.draftPrompt.trim(), requestedBy: 'brain-console-web' }),
    });
    const jobId = extractJobId(payload);
    if (!jobId) throw new Error('Create draft response did not include jobId');
    state.showDraftModal = false;
    state.draftPrompt = '';
    state.selectedJobId = jobId;
    addActivity('success', `Draft created: ${jobId}. Next: approve script.`);
    await refresh('draft created');
    await loadJob(jobId);
  } catch (error) {
    state.error = errorMessage(error);
    addActivity('error', state.error);
  } finally {
    state.draftSubmitting = false;
    render();
  }
}

async function postJobAction(jobId: string, action: 'approve' | 'changes' | 'generate', body: Record<string, unknown>): Promise<void> {
  const path = action === 'generate'
    ? `/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/generate`
    : action === 'approve'
      ? `/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/approve`
      : `/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/changes`;
  addActivity('info', `${action} started for ${jobId}`);
  render();
  try {
    await requestJson<unknown>(path, { method: 'POST', body: JSON.stringify(body) });
    addActivity('success', `${action} accepted for ${jobId}`);
    await refresh(`${action} accepted`);
    await loadJob(jobId);
  } catch (error) {
    state.error = errorMessage(error);
    addActivity('error', state.error);
    render();
  }
}

function render(): void {
  const activeCount = state.jobs.filter(job => ACTIVE_STATES.has(job.status)).length;
  const pendingCount = state.jobs.filter(job => job.status === 'draft' || job.status === 'awaiting_approval').length;
  const publishedCount = state.jobs.filter(job => job.status === 'published').length;

  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><div><strong>Brain Console Web</strong><span class="dot"></span></div><code>aws-video-only · Brain Core ${escapeHtml(BRAIN_CORE_URL)}</code></header>
      <section class="hero"><div><h1>AWS Video Pipeline</h1><p>Standalone Brain Console Web dashboard. Obsidian can view this page, but does not host the runtime.</p></div><button data-action="refresh">Refresh now</button></section>
      <section class="card diagnostics">
        <span>Status fetch: <strong class="${state.statusFetch}">${state.statusFetch}</strong></span>
        <span>Jobs fetch: <strong class="${state.jobsFetch}">${state.jobsFetch}</strong></span>
        <span>Loaded jobs: <strong>${state.jobs.length}</strong></span>
        <span>Last refresh: <strong>${escapeHtml(state.lastRefresh)}</strong></span>
        <span>Generation: <strong>${escapeHtml(state.pipeline?.generationStatus ?? 'unknown')}</strong></span>
        <span>Publishing: <strong>${escapeHtml(state.pipeline?.publishingStatus ?? 'unknown')}</strong></span>
        <span>Active: <strong>${activeCount}</strong></span>
        <span>Pending: <strong>${pendingCount}</strong></span>
        <span>Published: <strong>${publishedCount}</strong></span>
      </section>
      ${state.error ? `<section class="error">${escapeHtml(state.error)}</section>` : ''}
      ${renderActivity()}
      <section class="card actions"><div><h2>Create Draft</h2><p>Create a draft only. Approval remains required before generation.</p></div><button data-action="open-draft">Create Draft Video</button></section>
      <section class="grid"><div class="card jobs"><h2>Recent Jobs</h2>${renderJobs()}</div><div class="card detail"><h2>Selected Job</h2>${renderSelectedJob()}</div></section>
      <section class="card"><h2>Channels</h2><div class="channels">${renderChannels()}</div></section>
      ${state.showDraftModal ? renderDraftModal() : ''}
    </main>
  `;
}

function renderActivity(): string {
  return `<section class="card"><h2>Activity Log</h2>${state.activity.length === 0 ? '<p>No activity yet.</p>' : state.activity.map(entry => `<div class="activity ${entry.level}"><span>${entry.level}</span><p>${escapeHtml(entry.message)}</p><time>${escapeHtml(entry.at)}</time></div>`).join('')}</section>`;
}

function renderJobs(): string {
  if (state.jobs.length === 0) return '<p>No operational jobs returned yet.</p>';
  return state.jobs.map(job => `<button class="job ${job.jobId === state.selectedJobId ? 'selected' : ''}" data-action="select-job" data-job-id="${escapeHtml(job.jobId)}"><span class="badge ${escapeHtml(job.status)}">${escapeHtml(job.status.replaceAll('_', ' '))}</span><code>${escapeHtml(job.jobId)}</code><span>${escapeHtml(job.channelId)}</span><span>${escapeHtml(job.title)}</span><strong>${escapeHtml(nextAction(job))}</strong></button>`).join('');
}

function renderSelectedJob(): string {
  const job = state.selectedJob;
  if (!job) return '<p>Select a job.</p>';
  const canApprove = job.approval.status === 'pending';
  const canGenerate = job.approval.status === 'approved' && !TERMINAL_GENERATION_STATES.has(job.status);
  return `
    <h3>${escapeHtml(job.title)}</h3><code>${escapeHtml(job.jobId)}</code>
    <div class="detailGrid"><span>Status <strong>${escapeHtml(job.status)}</strong></span><span>Progress <strong>${job.progress}%</strong></span><span>Approval <strong>${escapeHtml(job.approval.status)}</strong></span><span>Generation <strong>${escapeHtml(job.generation.status)}</strong></span><span>Publishing <strong>${escapeHtml(job.publishing.status)}</strong></span><span>Step <strong>${escapeHtml(job.currentStep ?? '—')}</strong></span></div>
    <div class="buttonRow">${canApprove ? `<button data-action="approve-job" data-job-id="${escapeHtml(job.jobId)}">Approve script</button><button data-action="request-changes" data-job-id="${escapeHtml(job.jobId)}">Request changes</button>` : ''}${canGenerate ? `<button data-action="generate-job" data-job-id="${escapeHtml(job.jobId)}">Generate artifacts</button>` : ''}${job.status === 'ready_to_publish' ? '<span class="muted">Ready to publish — publishing intentionally disabled in this console.</span>' : ''}</div>
    <h3>Artifacts</h3><pre>${escapeHtml(JSON.stringify(job.artifacts, null, 2))}</pre>
    <h3>Timeline</h3>${(state.timeline?.events ?? []).length === 0 ? '<p>No timeline events yet.</p>' : (state.timeline?.events ?? []).map(event => `<div class="timeline"><code>${escapeHtml(event.step)}</code><span>${escapeHtml(event.status)}</span><p>${escapeHtml(event.message)}</p></div>`).join('')}
  `;
}

function renderChannels(): string {
  const channels = state.pipeline?.channels ?? [];
  if (channels.length === 0) return '<p>No channels configured.</p>';
  return channels.map(channel => `<div class="channel"><strong>${escapeHtml(channel.displayName ?? channel.channelId)}</strong><span>${escapeHtml(channel.channelId)} · ${channel.totalTopics ?? 0} topics · YouTube ${channel.youtubeEnabled ? 'enabled' : 'disabled'}</span></div>`).join('');
}

function renderDraftModal(): string {
  const channels = state.pipeline?.channels ?? [];
  return `<div class="modalBackdrop"><div class="modal"><h2>Create Draft Video</h2><label>Channel<select id="draft-channel" ${state.draftSubmitting ? 'disabled' : ''}>${channels.map(channel => `<option value="${escapeHtml(channel.channelId)}" ${channel.channelId === state.draftChannelId ? 'selected' : ''}>${escapeHtml(channel.displayName ?? channel.channelId)}</option>`).join('')}</select></label><label>Prompt<textarea id="draft-prompt" ${state.draftSubmitting ? 'disabled' : ''} placeholder="Describe the video...">${escapeHtml(state.draftPrompt)}</textarea></label><div class="buttonRow right"><button data-action="close-draft" ${state.draftSubmitting ? 'disabled' : ''}>Cancel</button><button data-action="create-draft" ${state.draftSubmitting || state.draftPrompt.trim().length < 10 ? 'disabled' : ''}>${state.draftSubmitting ? 'Creating...' : 'Create'}</button></div></div></div>`;
}

function bindEvents(): void {
  root.onclick = event => {
    const target = event.target as HTMLElement | null;
    const actionEl = target?.closest<HTMLElement>('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const jobId = actionEl.dataset.jobId;
    if (action === 'refresh') void refresh('manual refresh');
    if (action === 'open-draft') { state.showDraftModal = true; render(); }
    if (action === 'close-draft') { state.showDraftModal = false; render(); }
    if (action === 'create-draft') void createDraft();
    if (action === 'select-job' && jobId) void loadJob(jobId);
    if (action === 'approve-job' && jobId) void postJobAction(jobId, 'approve', { approvedBy: 'brain-console-web', notes: 'Approved from Brain Console Web' });
    if (action === 'request-changes' && jobId) {
      const notes = window.prompt('Request changes notes');
      if (notes) void postJobAction(jobId, 'changes', { requestedBy: 'brain-console-web', notes });
    }
    if (action === 'generate-job' && jobId && window.confirm('Generate video artifacts only. This will not publish to YouTube.')) {
      void postJobAction(jobId, 'generate', { requestedBy: 'brain-console-web' });
    }
  };
  root.oninput = event => {
    const target = event.target as HTMLTextAreaElement | null;
    if (target?.id === 'draft-prompt') state.draftPrompt = target.value;
  };
  root.onchange = event => {
    const target = event.target as HTMLSelectElement | null;
    if (target?.id === 'draft-channel') state.draftChannelId = target.value;
  };
}

function nextAction(job: VideoJobSummary): string {
  if (job.status === 'draft' || job.status === 'awaiting_approval') return 'Approve';
  if (job.status === 'approved') return 'Generate';
  if (job.status === 'ready_to_publish') return 'Publish disabled';
  if (job.status === 'published') return 'Done';
  if (job.status === 'failed') return 'Investigate';
  return 'Monitor';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
}

bindEvents();
render();
void refresh('initial load');
setInterval(() => void refresh('auto refresh'), 30_000);
