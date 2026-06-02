const BRAIN_CORE_URL = (window.BRAIN_CORE_URL || '').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 7000;
const ACTIVE_STATES = new Set(['generating', 'publishing']);
const TERMINAL_GENERATION_STATES = new Set(['generating', 'generated', 'ready_to_publish', 'publishing', 'published']);

const state = {
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
};

const root = document.querySelector('#root');
if (!root) throw new Error('Missing #root element');

function addActivity(level, message) {
  state.activity = [{ at: new Date().toLocaleTimeString(), level, message }, ...state.activity].slice(0, 12);
}

async function requestJson(path, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${BRAIN_CORE_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init.headers || {}) },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${init.method || 'GET'} ${path} failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
    return payload;
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error(`${init.method || 'GET'} ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`);
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function unwrapData(value) {
  const rootValue = asRecord(value);
  return asRecord(rootValue?.data) || rootValue;
}

function unwrapStatus(payload) {
  const data = unwrapData(payload) || {};
  return {
    channels: Array.isArray(data.channels) ? data.channels : [],
    pipelineReady: Boolean(data.pipelineReady),
    generationStatus: typeof data.generationStatus === 'string' ? data.generationStatus : 'unknown',
    publishingStatus: typeof data.publishingStatus === 'string' ? data.publishingStatus : 'unknown',
  };
}

function unwrapJobs(payload) {
  const rootValue = asRecord(payload) || {};
  const data = asRecord(rootValue.data) || {};
  const jobs = Array.isArray(payload) ? payload : Array.isArray(rootValue.jobs) ? rootValue.jobs : Array.isArray(data.jobs) ? data.jobs : [];
  return jobs.filter(job => asRecord(job)?.jobId);
}

function unwrapJob(payload) {
  const data = unwrapData(payload);
  if (!data?.jobId) throw new Error(`Unexpected job response shape: ${Object.keys(asRecord(payload) || {}).join(', ')}`);
  return data;
}

function unwrapTimeline(payload, fallbackJobId) {
  const data = unwrapData(payload);
  if (!data?.jobId || !Array.isArray(data.events)) return { jobId: fallbackJobId, events: [] };
  return data;
}

function extractJobId(payload) {
  const rootValue = asRecord(payload) || {};
  const data = asRecord(rootValue.data) || {};
  const job = asRecord(rootValue.job) || asRecord(data.job) || {};
  return [rootValue.jobId, data.jobId, job.jobId].find(value => typeof value === 'string') || null;
}

async function refresh(reason = 'manual refresh') {
  state.error = null;
  state.lastRefresh = new Date().toLocaleTimeString();
  state.statusFetch = 'pending';
  state.jobsFetch = 'pending';
  addActivity('info', `Refresh started: ${reason}`);
  render();

  try {
    addActivity('info', 'Status request started');
    render();
    state.pipeline = unwrapStatus(await requestJson('/api/video-orchestrator/status'));
    state.statusFetch = 'ok';
    if (!state.draftChannelId) state.draftChannelId = state.pipeline.channels[0]?.channelId || '';
    addActivity('success', 'Status request ok');
  } catch (error) {
    state.statusFetch = 'error';
    state.error = errorMessage(error);
    addActivity('error', state.error);
  }

  try {
    addActivity('info', 'Jobs request started');
    render();
    state.jobs = unwrapJobs(await requestJson('/api/video-orchestrator/jobs/recent'));
    state.jobsFetch = 'ok';
    addActivity('success', `Loaded ${state.jobs.length} operational jobs`);
    const nextSelected = state.selectedJobId && state.jobs.some(job => job.jobId === state.selectedJobId)
      ? state.selectedJobId
      : state.jobs[0]?.jobId || null;
    if (nextSelected) await loadJob(nextSelected, false);
  } catch (error) {
    state.jobsFetch = 'error';
    state.error = errorMessage(error);
    addActivity('error', state.error);
  } finally {
    render();
  }
}

async function loadJob(jobId, rerender = true) {
  state.selectedJobId = jobId;
  state.error = null;
  addActivity('info', `Loading job ${jobId}`);
  if (rerender) render();
  try {
    const [jobPayload, timelinePayload] = await Promise.all([
      requestJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}`),
      requestJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/timeline`),
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

async function createDraft() {
  if (!state.draftChannelId || state.draftPrompt.trim().length < 10 || state.draftSubmitting) return;
  state.draftSubmitting = true;
  addActivity('info', 'Creating draft...');
  render();
  try {
    const payload = await requestJson('/api/video-orchestrator/jobs/create-from-prompt', {
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

async function postJobAction(jobId, action, body) {
  const path = action === 'generate'
    ? `/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/generate`
    : action === 'approve'
      ? `/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/approve`
      : `/api/video-orchestrator/scripts/${encodeURIComponent(jobId)}/changes`;
  addActivity('info', `${action} started for ${jobId}`);
  render();
  try {
    await requestJson(path, { method: 'POST', body: JSON.stringify(body) });
    addActivity('success', `${action} accepted for ${jobId}`);
    await refresh(`${action} accepted`);
    await loadJob(jobId);
  } catch (error) {
    state.error = errorMessage(error);
    addActivity('error', state.error);
    render();
  }
}

function render() {
  const activeCount = state.jobs.filter(job => ACTIVE_STATES.has(job.status)).length;
  const pendingCount = state.jobs.filter(job => job.status === 'draft' || job.status === 'awaiting_approval').length;
  const publishedCount = state.jobs.filter(job => job.status === 'published').length;
  root.innerHTML = `
    <main class="shell">
      <header class="topbar"><div><strong>Brain Console Web</strong><span class="dot"></span></div><code>aws-video-only · Brain Core ${escapeHtml(BRAIN_CORE_URL)}</code></header>
      <section class="hero"><div><h1>AWS Video Pipeline</h1><p>Standalone Brain Console Web dashboard. Obsidian can view this page, but does not host the runtime.</p></div><button data-action="refresh">Refresh now</button></section>
      <section class="card diagnostics"><span>Status fetch: <strong class="${state.statusFetch}">${state.statusFetch}</strong></span><span>Jobs fetch: <strong class="${state.jobsFetch}">${state.jobsFetch}</strong></span><span>Loaded jobs: <strong>${state.jobs.length}</strong></span><span>Last refresh: <strong>${escapeHtml(state.lastRefresh)}</strong></span><span>Generation: <strong>${escapeHtml(state.pipeline?.generationStatus || 'unknown')}</strong></span><span>Publishing: <strong>${escapeHtml(state.pipeline?.publishingStatus || 'unknown')}</strong></span><span>Active: <strong>${activeCount}</strong></span><span>Pending: <strong>${pendingCount}</strong></span><span>Published: <strong>${publishedCount}</strong></span></section>
      ${state.error ? `<section class="error">${escapeHtml(state.error)}</section>` : ''}
      ${renderActivity()}
      <section class="card actions"><div><h2>Create Draft</h2><p>Create a draft only. Approval remains required before generation.</p></div><button data-action="open-draft">Create Draft Video</button></section>
      <section class="grid"><div class="card jobs"><h2>Recent Jobs</h2>${renderJobs()}</div><div class="card detail"><h2>Selected Job</h2>${renderSelectedJob()}</div></section>
      <section class="card"><h2>Channels</h2><div class="channels">${renderChannels()}</div></section>
      ${state.showDraftModal ? renderDraftModal() : ''}
    </main>`;
}

function renderActivity() {
  return `<section class="card"><h2>Activity Log</h2>${state.activity.length === 0 ? '<p>No activity yet.</p>' : state.activity.map(entry => `<div class="activity ${entry.level}"><span>${entry.level}</span><p>${escapeHtml(entry.message)}</p><time>${escapeHtml(entry.at)}</time></div>`).join('')}</section>`;
}

function renderJobs() {
  if (state.jobs.length === 0) return '<p>No operational jobs returned yet.</p>';
  return state.jobs.map(job => `<button class="job ${job.jobId === state.selectedJobId ? 'selected' : ''}" data-action="select-job" data-job-id="${escapeHtml(job.jobId)}"><span class="badge ${escapeHtml(job.status)}">${escapeHtml(job.status.replaceAll('_', ' '))}</span><code>${escapeHtml(job.jobId)}</code><span>${escapeHtml(job.channelId)}</span><span>${escapeHtml(job.title)}</span><strong>${escapeHtml(nextAction(job))}</strong></button>`).join('');
}

function renderSelectedJob() {
  const job = state.selectedJob;
  if (!job) return '<p>Select a job.</p>';
  const canApprove = job.approval.status === 'pending';
  const canGenerate = job.approval.status === 'approved' && !TERMINAL_GENERATION_STATES.has(job.status);
  return `<h3>${escapeHtml(job.title)}</h3><code>${escapeHtml(job.jobId)}</code><div class="detailGrid"><span>Status <strong>${escapeHtml(job.status)}</strong></span><span>Progress <strong>${job.progress}%</strong></span><span>Approval <strong>${escapeHtml(job.approval.status)}</strong></span><span>Generation <strong>${escapeHtml(job.generation.status)}</strong></span><span>Publishing <strong>${escapeHtml(job.publishing.status)}</strong></span><span>Step <strong>${escapeHtml(job.currentStep || '—')}</strong></span></div><div class="buttonRow">${canApprove ? `<button data-action="approve-job" data-job-id="${escapeHtml(job.jobId)}">Approve script</button><button data-action="request-changes" data-job-id="${escapeHtml(job.jobId)}">Request changes</button>` : ''}${canGenerate ? `<button data-action="generate-job" data-job-id="${escapeHtml(job.jobId)}">Generate artifacts</button>` : ''}${job.status === 'ready_to_publish' ? '<span class="muted">Ready to publish — publishing intentionally disabled in this console.</span>' : ''}</div><h3>Artifacts</h3><pre>${escapeHtml(JSON.stringify(job.artifacts, null, 2))}</pre><h3>Timeline</h3>${(state.timeline?.events || []).length === 0 ? '<p>No timeline events yet.</p>' : (state.timeline?.events || []).map(event => `<div class="timeline"><code>${escapeHtml(event.step)}</code><span>${escapeHtml(event.status)}</span><p>${escapeHtml(event.message)}</p></div>`).join('')}`;
}

function renderChannels() {
  const channels = state.pipeline?.channels || [];
  if (channels.length === 0) return '<p>No channels configured.</p>';
  return channels.map(channel => `<div class="channel"><strong>${escapeHtml(channel.displayName || channel.channelId)}</strong><span>${escapeHtml(channel.channelId)} · ${channel.totalTopics || 0} topics · YouTube ${channel.youtubeEnabled ? 'enabled' : 'disabled'}</span></div>`).join('');
}

function renderDraftModal() {
  const channels = state.pipeline?.channels || [];
  return `<div class="modalBackdrop"><div class="modal"><h2>Create Draft Video</h2><label>Channel<select id="draft-channel" ${state.draftSubmitting ? 'disabled' : ''}>${channels.map(channel => `<option value="${escapeHtml(channel.channelId)}" ${channel.channelId === state.draftChannelId ? 'selected' : ''}>${escapeHtml(channel.displayName || channel.channelId)}</option>`).join('')}</select></label><label>Prompt<textarea id="draft-prompt" ${state.draftSubmitting ? 'disabled' : ''} placeholder="Describe the video...">${escapeHtml(state.draftPrompt)}</textarea></label><div class="buttonRow right"><button data-action="close-draft" ${state.draftSubmitting ? 'disabled' : ''}>Cancel</button><button data-action="create-draft" ${state.draftSubmitting || state.draftPrompt.trim().length < 10 ? 'disabled' : ''}>${state.draftSubmitting ? 'Creating...' : 'Create'}</button></div></div></div>`;
}

function bindEvents() {
  root.onclick = event => {
    const target = event.target;
    const actionEl = target?.closest?.('[data-action]');
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
    if (action === 'generate-job' && jobId && window.confirm('Generate video artifacts only. This will not publish to YouTube.')) void postJobAction(jobId, 'generate', { requestedBy: 'brain-console-web' });
  };
  root.oninput = event => {
    if (event.target?.id === 'draft-prompt') state.draftPrompt = event.target.value;
  };
  root.onchange = event => {
    if (event.target?.id === 'draft-channel') state.draftChannelId = event.target.value;
  };
}

function nextAction(job) {
  if (job.status === 'draft' || job.status === 'awaiting_approval') return 'Approve';
  if (job.status === 'approved') return 'Generate';
  if (job.status === 'ready_to_publish') return 'Publish disabled';
  if (job.status === 'published') return 'Done';
  if (job.status === 'failed') return 'Investigate';
  return 'Monitor';
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] || char));
}

bindEvents();
render();
void refresh('initial load');
setInterval(() => void refresh('auto refresh'), 30_000);
