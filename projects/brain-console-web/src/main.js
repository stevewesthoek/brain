const BRAIN_CORE_URL = (window.BRAIN_CORE_URL || '').replace(/\/$/, '');
const REQUEST_TIMEOUT_MS = 7000;
const GENERATE_TIMEOUT_MS = 120000;
const ACTIVE_STATES = new Set(['generating', 'publishing']);
const TERMINAL_GENERATION_STATES = new Set(['generating', 'generated', 'ready_to_publish', 'publishing', 'published']);
const MENU_ITEMS = [
  ['overview', 'Overview'],
  ['jobs', 'Jobs'],
  ['detail', 'Selected Job'],
  ['create', 'Create Draft'],
  ['activity', 'Activity'],
  ['channels', 'Channels'],
];

const state = {
  activeView: 'jobs',
  statusFetch: 'idle',
  jobsFetch: 'idle',
  pipeline: null,
  jobs: [],
  selectedJobId: null,
  selectedJob: null,
  timeline: null,
  execution: null,
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
  state.activity = [{ at: new Date().toLocaleTimeString(), level, message }, ...state.activity].slice(0, 18);
}

async function requestJson(path, init = {}) {
  const timeoutMs = init.timeoutMs || REQUEST_TIMEOUT_MS;
  const requestInit = { ...init };
  delete requestInit.timeoutMs;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BRAIN_CORE_URL}${path}`, {
      ...requestInit,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(requestInit.headers || {}) },
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;
    if (!response.ok) {
      throw new Error(`${requestInit.method || 'GET'} ${path} failed with HTTP ${response.status}: ${text.slice(0, 240)}`);
    }
    return payload;
  } catch (error) {
    if (error && error.name === 'AbortError') throw new Error(`${requestInit.method || 'GET'} ${path} timed out after ${timeoutMs}ms`);
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

function unwrapExecution(payload) {
  return unwrapData(payload) || null;
}

function effectiveJob(job, execution) {
  const publishReady = execution?.awsStatus === 'SUCCEEDED';
  const awsFailed = ['FAILED', 'TIMED_OUT', 'ABORTED'].includes(execution?.awsStatus);
  if (awsFailed) {
    return {
      ...job,
      status: 'failed',
      progress: 0,
      currentStep: execution.error || execution.awsStatus,
      generation: { ...(job.generation || {}), status: 'failed' },
      error: { step: execution.error || 'aws_execution_failed', message: execution.cause || 'AWS execution failed' },
    };
  }
  if (publishReady && job.status !== 'published') {
    return {
      ...job,
      status: 'ready_to_publish',
      progress: 80,
      currentStep: 'publish_contract_created',
      generation: { ...(job.generation || {}), status: 'complete', completedAt: execution.stopDate || job.generation?.completedAt || null },
      publishing: { ...(job.publishing || {}), status: job.publishing?.status && job.publishing.status !== 'pending' ? job.publishing.status : 'pending' },
    };
  }
  return job;
}

function effectiveArtifacts(job) {
  const artifacts = asRecord(job.artifacts) || {};
  const publishing = asRecord(job.publishing) || {};
  const executionSucceeded = state.execution?.awsStatus === 'SUCCEEDED' && job.jobId === state.selectedJobId;
  return {
    script: artifacts.script || null,
    narration: artifacts.narration || null,
    finalVideo: artifacts.finalVideo || publishing.videoKey || (executionSucceeded ? `jobs/${job.jobId}/exports/generated-001-final.mp4` : null),
    thumbnail: artifacts.thumbnail || publishing.thumbnailKey || (executionSucceeded ? `jobs/${job.jobId}/exports/thumbnail-001.jpg` : null),
  };
}

function displayValue(value) {
  return value === null || value === undefined || value === '' ? 'not available' : String(value);
}

function extractJobId(payload) {
  const rootValue = asRecord(payload) || {};
  const data = asRecord(rootValue.data) || {};
  const job = asRecord(rootValue.job) || asRecord(data.job) || {};
  return [rootValue.jobId, data.jobId, job.jobId].find(value => typeof value === 'string') || null;
}

function channelsFromJobs() {
  const map = new Map();
  for (const job of state.jobs) {
    if (!job.channelId) continue;
    if (!map.has(job.channelId)) {
      map.set(job.channelId, { channelId: job.channelId, displayName: titleCase(job.channelId), totalTopics: 0, youtubeEnabled: false });
    }
  }
  return [...map.values()];
}

function effectiveChannels() {
  return state.pipeline?.channels?.length ? state.pipeline.channels : channelsFromJobs();
}

function derivedPipeline() {
  const effectiveJobs = state.jobs.map(job => job.jobId === state.selectedJobId ? effectiveJob(job, state.execution) : job);
  const selectedEffectiveJob = state.selectedJob ? effectiveJob(state.selectedJob, state.execution) : null;
  const active = effectiveJobs.some(job => ACTIVE_STATES.has(job.status));
  const readyToPublish = effectiveJobs.some(job => job.status === 'ready_to_publish') || selectedEffectiveJob?.status === 'ready_to_publish';
  const publishing = effectiveJobs.some(job => job.status === 'publishing') || selectedEffectiveJob?.status === 'publishing';
  return {
    channels: effectiveChannels(),
    pipelineReady: state.jobsFetch === 'ok',
    generationStatus: selectedEffectiveJob?.generation?.status || (active ? 'active' : state.jobs.length ? 'ready' : 'not available'),
    publishingStatus: selectedEffectiveJob?.publishing?.status || (publishing ? 'active' : readyToPublish ? 'pending' : state.jobs.length ? 'ready' : 'not available'),
  };
}

async function refresh(reason = 'manual refresh') {
  state.error = null;
  state.lastRefresh = new Date().toLocaleTimeString();
  state.statusFetch = 'pending';
  state.jobsFetch = 'pending';
  addActivity('info', `Refresh started: ${reason}`);
  render();

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
  }

  try {
    addActivity('info', 'Pipeline status request started');
    render();
    state.pipeline = unwrapStatus(await requestJson('/video-orchestrator/status'));
    state.statusFetch = 'ok';
    if (!state.draftChannelId) state.draftChannelId = effectiveChannels()[0]?.channelId || '';
    addActivity('success', 'Pipeline status request ok');
  } catch (error) {
    state.statusFetch = 'ok';
    state.pipeline = derivedPipeline();
    if (!state.draftChannelId) state.draftChannelId = effectiveChannels()[0]?.channelId || '';
    addActivity('warning', `Pipeline status unavailable; using jobs-derived summary (${errorMessage(error)})`);
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
    const [jobPayload, timelinePayload, executionPayload] = await Promise.all([
      requestJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}`),
      requestJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/timeline`),
      requestJson(`/api/video-orchestrator/jobs/${encodeURIComponent(jobId)}/execution`),
    ]);
    state.selectedJob = unwrapJob(jobPayload);
    state.timeline = unwrapTimeline(timelinePayload, jobId);
    state.execution = unwrapExecution(executionPayload);
    state.activeView = 'detail';
    if (state.execution?.awsStatus === 'FAILED') {
      addActivity('error', `AWS execution failed: ${state.execution.error || 'unknown'} — ${state.execution.cause || 'no cause provided'}`);
    } else if (state.execution?.awsStatus) {
      addActivity('success', `AWS execution status: ${state.execution.awsStatus}`);
    }
    addActivity('success', `Loaded job ${jobId}`);
  } catch (error) {
    state.selectedJob = null;
    state.timeline = null;
    state.execution = null;
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
    state.activeView = 'detail';
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
  addActivity('info', action === 'generate' ? `Generation started for ${jobId}. Starting AWS workflow can take up to 2 minutes...` : `${action} started for ${jobId}`);
  render();
  try {
    await requestJson(path, { method: 'POST', body: JSON.stringify(body), timeoutMs: action === 'generate' ? GENERATE_TIMEOUT_MS : REQUEST_TIMEOUT_MS });
    addActivity('success', action === 'generate' ? `Generation workflow accepted for ${jobId}` : `${action} accepted for ${jobId}`);
    await refresh(`${action} accepted`);
    await loadJob(jobId);
  } catch (error) {
    state.error = errorMessage(error);
    if (action === 'generate' && state.error.includes('timed out')) {
      addActivity('warning', `Generation request timed out locally; checking job status for ${jobId}`);
      await refresh('generation timeout follow-up');
      await loadJob(jobId);
      if (state.selectedJob && ACTIVE_STATES.has(state.selectedJob.status)) {
        state.error = null;
        addActivity('success', `Generation is running for ${jobId}`);
      } else {
        addActivity('error', `Generation timeout and job is not active: ${state.selectedJob?.status || 'unknown'}`);
      }
    } else {
      addActivity('error', state.error);
    }
    render();
  }
}

function render() {
  const pipeline = state.pipeline || derivedPipeline();
  const counts = getCounts();
  root.innerHTML = `
    <main class="appShell">
      <aside class="sidebar">
        <div class="brand"><span>Brain Console Web</span><span class="dot"></span></div>
        <div class="scope">AWS Video only</div>
        <nav>${MENU_ITEMS.map(([id, label]) => `<button class="navItem ${state.activeView === id ? 'active' : ''}" data-action="nav" data-view="${id}">${label}</button>`).join('')}</nav>
        <div class="sideStats">
          <div><span>Jobs</span><strong>${state.jobs.length}</strong></div>
          <div><span>Pending</span><strong>${counts.pending}</strong></div>
          <div><span>Active</span><strong>${counts.active}</strong></div>
          <div><span>Published</span><strong>${counts.published}</strong></div>
        </div>
      </aside>
      <section class="mainPane">
        <header class="pageHeader">
          <div><h1>AWS Video Pipeline</h1><p>Standalone Brain Console Web dashboard. Obsidian can view this page, but does not host the runtime.</p></div>
          <button data-action="refresh">Refresh now</button>
        </header>
        <section class="diagnostics compactCard">
          <span>Status <strong class="${state.statusFetch}">${state.statusFetch}</strong></span>
          <span>Jobs <strong class="${state.jobsFetch}">${state.jobsFetch}</strong></span>
          <span>Loaded <strong>${state.jobs.length}</strong></span>
          <span>Last <strong>${escapeHtml(state.lastRefresh)}</strong></span>
          <span>Generation <strong>${escapeHtml(pipeline.generationStatus)}</strong></span>
          <span>Publishing <strong>${escapeHtml(pipeline.publishingStatus)}</strong></span>
        </section>
        ${state.error ? `<section class="errorBanner">${escapeHtml(state.error)}</section>` : ''}
        <section class="contentPane">${renderActiveView()}</section>
      </section>
      ${state.showDraftModal ? renderDraftModal() : ''}
    </main>`;
}

function renderActiveView() {
  if (state.activeView === 'overview') return renderOverview();
  if (state.activeView === 'detail') return renderSelectedJob();
  if (state.activeView === 'create') return renderCreatePanel();
  if (state.activeView === 'activity') return renderActivity(true);
  if (state.activeView === 'channels') return renderChannelsPanel();
  return renderJobsPanel();
}

function renderOverview() {
  const counts = getCounts();
  return `<div class="dashboardGrid"><section class="compactCard"><h2>Pipeline summary</h2><div class="metricGrid"><div><span>Total jobs</span><strong>${state.jobs.length}</strong></div><div><span>Pending</span><strong>${counts.pending}</strong></div><div><span>Active</span><strong>${counts.active}</strong></div><div><span>Published</span><strong>${counts.published}</strong></div></div></section>${renderActivity(false)}</div>`;
}

function renderJobsPanel() {
  return `<div class="twoColumn"><section class="compactCard"><div class="sectionHeader"><h2>Recent Jobs</h2><button data-action="open-draft">Create Draft</button></div><div class="jobList">${renderJobs()}</div></section><section class="compactCard detailPreview"><h2>Selected Job</h2>${renderSelectedJobBody()}</section></div>`;
}

function renderActivity(full = true) {
  const entries = full ? state.activity : state.activity.slice(0, 7);
  return `<section class="compactCard activityCard"><h2>Activity Log</h2>${entries.length === 0 ? '<p>No activity yet.</p>' : entries.map(entry => `<div class="activity ${entry.level}"><span>${entry.level}</span><p>${escapeHtml(entry.message)}</p><time>${escapeHtml(entry.at)}</time></div>`).join('')}</section>`;
}

function renderJobs() {
  if (state.jobs.length === 0) return '<p>No operational jobs returned yet.</p>';
  return state.jobs.map(rawJob => {
    const job = rawJob.jobId === state.selectedJobId && state.selectedJob ? effectiveJob(state.selectedJob, state.execution) : rawJob;
    return `<button class="job ${rawJob.jobId === state.selectedJobId ? 'selected' : ''}" data-action="select-job" data-job-id="${escapeHtml(rawJob.jobId)}"><span class="badge ${escapeHtml(job.status)}">${escapeHtml(job.status.replaceAll('_', ' '))}</span><code>${escapeHtml(shortJobId(rawJob.jobId))}</code><span>${escapeHtml(displayValue(rawJob.channelId))}</span><span class="jobTitle">${escapeHtml(displayValue(rawJob.title))}</span><strong>${escapeHtml(nextAction(job))}</strong></button>`;
  }).join('');
}

function renderSelectedJob() {
  return `<section class="compactCard detailFull"><h2>Selected Job</h2>${renderSelectedJobBody()}</section>`;
}

function renderSelectedJobBody() {
  const rawJob = state.selectedJob;
  if (!rawJob) return '<p>Select a job.</p>';
  const job = effectiveJob(rawJob, state.execution);
  const artifacts = effectiveArtifacts(job);
  const approvalStatus = displayValue(job.approval?.status);
  const generationStatus = displayValue(job.generation?.status);
  const publishingStatus = displayValue(job.publishing?.status);
  const step = displayValue(job.currentStep);
  const canApprove = job.approval?.status === 'pending';
  const canGenerate = job.approval?.status === 'approved' && !TERMINAL_GENERATION_STATES.has(job.status) && state.execution?.awsStatus !== 'SUCCEEDED';
  const readyMessage = job.status === 'ready_to_publish'
    ? '<span class="successText">Ready to publish — publish contract exists. YouTube publishing is intentionally disabled in this console.</span>'
    : '';
  const errorMessage = job.error?.message
    ? `<section class="errorBanner compact">${escapeHtml(displayValue(job.error.step))}: ${escapeHtml(job.error.message)}</section>`
    : '';
  return `<div class="detailHeader"><div><h3>${escapeHtml(displayValue(job.title))}</h3><code>${escapeHtml(job.jobId)}</code></div><span class="badge ${escapeHtml(job.status)}">${escapeHtml(job.status.replaceAll('_', ' '))}</span></div><div class="detailGrid"><span>Status <strong>${escapeHtml(displayValue(job.status))}</strong></span><span>Progress <strong>${Number.isFinite(job.progress) ? `${job.progress}%` : 'not available'}</strong></span><span>Approval <strong>${escapeHtml(approvalStatus)}</strong></span><span>Generation <strong>${escapeHtml(generationStatus)}</strong></span><span>Publishing <strong>${escapeHtml(publishingStatus)}</strong></span><span>Step <strong>${escapeHtml(step)}</strong></span></div>${renderExecutionStatus()}${errorMessage}<div class="buttonRow">${canApprove ? `<button data-action="approve-job" data-job-id="${escapeHtml(job.jobId)}">Approve script</button><button data-action="request-changes" data-job-id="${escapeHtml(job.jobId)}">Request changes</button>` : ''}${canGenerate ? `<button data-action="generate-job" data-job-id="${escapeHtml(job.jobId)}">Generate artifacts</button>` : ''}${readyMessage}</div><div class="detailSplit"><div><h3>Artifacts</h3><pre>${escapeHtml(JSON.stringify(artifacts, null, 2))}</pre></div><div><h3>Timeline</h3>${(state.timeline?.events || []).length === 0 ? '<p>No timeline events yet.</p>' : (state.timeline?.events || []).map(event => `<div class="timeline"><code>${escapeHtml(event.step)}</code><span>${escapeHtml(event.status)}</span><p>${escapeHtml(event.message)}</p></div>`).join('')}</div></div>`;
}

function renderExecutionStatus() {
  const execution = state.execution;
  if (!execution) return '<section class="executionCard muted">AWS execution status: not available yet</section>';
  const statusClass = execution.awsStatus === 'FAILED' || execution.awsStatus === 'TIMED_OUT' || execution.awsStatus === 'ABORTED'
    ? 'error'
    : execution.awsStatus === 'SUCCEEDED'
      ? 'success'
      : execution.awsStatus === 'RUNNING'
        ? 'pending'
        : 'muted';
  return `<section class="executionCard ${statusClass}"><div><span>AWS Step Functions</span><strong>${escapeHtml(execution.awsStatus || 'unknown')}</strong></div><div><span>Execution</span><code>${escapeHtml(execution.executionArn || '—')}</code></div><div><span>Started</span><strong>${escapeHtml(execution.startDate || '—')}</strong></div><div><span>Stopped</span><strong>${escapeHtml(execution.stopDate || '—')}</strong></div>${execution.error ? `<div><span>Error</span><strong>${escapeHtml(execution.error)}</strong></div>` : ''}${execution.cause ? `<div class="executionCause"><span>Cause</span><strong>${escapeHtml(execution.cause)}</strong></div>` : ''}</section>`;
}

function renderCreatePanel() {
  return `<section class="compactCard createPanel"><h2>Create Draft</h2><p>Create a draft only. Approval remains required before generation.</p><button data-action="open-draft">Create Draft Video</button></section>`;
}

function renderChannelsPanel() {
  const channels = effectiveChannels();
  return `<section class="compactCard"><h2>Channels</h2><div class="channels">${channels.length === 0 ? '<p>No channels configured.</p>' : channels.map(channel => `<div class="channel"><strong>${escapeHtml(channel.displayName || channel.channelId)}</strong><span>${escapeHtml(channel.channelId)} · ${channel.totalTopics || 0} topics · YouTube ${channel.youtubeEnabled ? 'enabled' : 'disabled'}</span></div>`).join('')}</div></section>`;
}

function renderDraftModal() {
  const channels = effectiveChannels();
  return `<div class="modalBackdrop"><div class="modal"><h2>Create Draft Video</h2><label>Channel<select id="draft-channel" ${state.draftSubmitting ? 'disabled' : ''}>${channels.map(channel => `<option value="${escapeHtml(channel.channelId)}" ${channel.channelId === state.draftChannelId ? 'selected' : ''}>${escapeHtml(channel.displayName || channel.channelId)}</option>`).join('')}</select></label><label>Prompt<textarea id="draft-prompt" ${state.draftSubmitting ? 'disabled' : ''} placeholder="Describe the video...">${escapeHtml(state.draftPrompt)}</textarea></label><div class="buttonRow right"><button data-action="close-draft" ${state.draftSubmitting ? 'disabled' : ''}>Cancel</button><button data-action="create-draft" ${state.draftSubmitting || state.draftPrompt.trim().length < 10 ? 'disabled' : ''}>${state.draftSubmitting ? 'Creating...' : 'Create'}</button></div></div></div>`;
}

function bindEvents() {
  root.onclick = event => {
    const target = event.target;
    const actionEl = target?.closest?.('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const jobId = actionEl.dataset.jobId;
    if (action === 'nav') { state.activeView = actionEl.dataset.view || 'jobs'; render(); }
    if (action === 'refresh') void refresh('manual refresh');
    if (action === 'open-draft') { state.activeView = 'create'; state.showDraftModal = true; render(); }
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

function getCounts() {
  const selectedEffectiveStatus = state.selectedJob ? effectiveJob(state.selectedJob, state.execution).status : null;
  const jobs = state.jobs.map(job => job.jobId === state.selectedJobId && selectedEffectiveStatus ? { ...job, status: selectedEffectiveStatus } : job);
  return {
    active: jobs.filter(job => ACTIVE_STATES.has(job.status)).length,
    pending: jobs.filter(job => job.status === 'draft' || job.status === 'awaiting_approval').length,
    published: jobs.filter(job => job.status === 'published').length,
  };
}

function nextAction(job) {
  const effective = job.jobId === state.selectedJobId && state.selectedJob ? effectiveJob(state.selectedJob, state.execution) : job;
  if (effective.status === 'draft' || effective.status === 'awaiting_approval') return 'Approve';
  if (effective.status === 'approved') return 'Generate';
  if (effective.status === 'ready_to_publish') return 'Ready';
  if (effective.status === 'published') return 'Done';
  if (effective.status === 'failed') return 'Investigate';
  return 'Monitor';
}

function shortJobId(jobId) {
  return jobId.length > 34 ? `${jobId.slice(0, 18)}…${jobId.slice(-10)}` : jobId;
}

function titleCase(value) {
  return String(value).split('-').map(part => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part).join(' ');
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
