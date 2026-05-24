// ── VO Studio Read Models ─────────────────────────────────────────────────────
//
// Phase 0.8: Normalized read model adapters for the Video Orchestrator Studio.
// All adapters return fixture data. No writes, no mutations, no credentials.
//
// Endpoints wired in routes.ts:
//   GET /video-orchestrator/projects
//   GET /video-orchestrator/accounts
//   GET /video-orchestrator/pipeline-profiles
//   GET /video-orchestrator/content-items
//   GET /video-orchestrator/packages/:id
//   GET /video-orchestrator/analytics/summary?projectId=X

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VOProject {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  accountCount: number;
  pipelineCount: number;
}

export interface VOProjectsResponse {
  ok: true;
  items: VOProject[];
  count: number;
}

export type VOAdapterMode = 'direct_upload' | 'n8n_fallback' | 'manual_only';
export type VOCredentialState = 'configured' | 'expired' | 'unconfigured';

export interface VOQuotaState {
  usage: number;
  limit: number;
  resetAt: string;
}

export interface VOAccount {
  id: string;
  platform: string;
  displayName: string;
  adapterMode: VOAdapterMode;
  credentialState: VOCredentialState;
  quotaState: VOQuotaState;
  manual_fallback_capable: boolean;
}

export interface VOAccountsResponse {
  ok: true;
  items: VOAccount[];
  count: number;
}

export type VOCompositionFormat = '16:9' | '9:16' | '1:1' | '4:3';

export interface VOPipelineProfile {
  id: string;
  name: string;
  compositionFormat: VOCompositionFormat;
  subtitleMode: string;
  thumbnailTemplate: string;
  scheduledAt: string | null;
}

export interface VOPipelineProfilesResponse {
  ok: true;
  items: VOPipelineProfile[];
  count: number;
}

export type VOContentStatus = 'draft' | 'queued' | 'processing' | 'completed' | 'failed';

export interface VOContentItem {
  id: string;
  title: string;
  briefText: string;
  status: VOContentStatus;
  createdAt: string;
  updatedAt: string;
  sourceAudioPath: string | null;
  sourceImagePath: string | null;
}

export interface VOContentItemsResponse {
  ok: true;
  items: VOContentItem[];
  count: number;
}

export type VOPackageStatus = 'pending' | 'building' | 'ready' | 'posted' | 'failed';
export type VOPackageStage = 'composition' | 'subtitles' | 'thumbnails' | 'posting' | 'done';

export interface VOArtifactFile {
  path: string;
  format: string;
  sizeBytes: number;
}

export interface VOArtifacts {
  composition: VOArtifactFile[];
  subtitles: { path: string; format: string } | null;
  thumbnails: VOArtifactFile[];
}

export interface VOPostingTarget {
  platform: string;
  account: string;
  status: 'pending' | 'posted' | 'failed';
  publishedAt: string | null;
}

export interface VOApproval {
  type: 'pre-publish' | 'content-review';
  status: 'pending' | 'approved' | 'rejected';
  decidedAt: string | null;
  decidedBy: string | null;
}

export interface VOPackage {
  id: string;
  contentItemId: string;
  status: VOPackageStatus;
  stage: VOPackageStage;
  progressPercent: number;
  artifacts: VOArtifacts;
  postingTargets: VOPostingTarget[];
  approvals: VOApproval[];
  createdAt: string;
  updatedAt: string;
}

export interface VOPackageResponse {
  ok: true;
  package: VOPackage;
}

export interface VOPackageNotFoundResponse {
  ok: false;
  error: { code: string; message: string };
}

export interface VOAnalyticsSummary {
  projectId: string;
  published: number;
  scheduled: number;
  failed: number;
  avgPublishTime: string;
  lastPublished: string | null;
}

export interface VOAnalyticsSummaryResponse {
  ok: true;
  summary: VOAnalyticsSummary;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJECT_FIXTURES: VOProject[] = [
  {
    id: 'proj-1',
    displayName: 'Says the Bible',
    createdAt: '2025-01-15T09:00:00.000Z',
    updatedAt: '2026-05-22T14:30:00.000Z',
    accountCount: 3,
    pipelineCount: 2,
  },
  {
    id: 'proj-2',
    displayName: 'Test Project',
    createdAt: '2026-04-01T10:00:00.000Z',
    updatedAt: '2026-05-20T11:15:00.000Z',
    accountCount: 1,
    pipelineCount: 1,
  },
];

const ACCOUNT_FIXTURES: VOAccount[] = [
  {
    id: 'acct-yt-1',
    platform: 'youtube',
    displayName: 'Says the Bible (YouTube)',
    adapterMode: 'direct_upload',
    credentialState: 'configured',
    quotaState: {
      usage: 3,
      limit: 10,
      resetAt: '2026-05-25T00:00:00.000Z',
    },
    manual_fallback_capable: true,
  },
  {
    id: 'acct-fb-1',
    platform: 'facebook',
    displayName: 'Says the Bible (Facebook)',
    adapterMode: 'n8n_fallback',
    credentialState: 'configured',
    quotaState: {
      usage: 12,
      limit: 200,
      resetAt: '2026-06-01T00:00:00.000Z',
    },
    manual_fallback_capable: true,
  },
  {
    id: 'acct-pin-1',
    platform: 'pinterest',
    displayName: 'Says the Bible (Pinterest)',
    adapterMode: 'manual_only',
    credentialState: 'unconfigured',
    quotaState: {
      usage: 0,
      limit: 100,
      resetAt: '2026-06-01T00:00:00.000Z',
    },
    manual_fallback_capable: true,
  },
];

const PIPELINE_PROFILE_FIXTURES: VOPipelineProfile[] = [
  {
    id: 'pipeline-daily',
    name: 'Daily Devotional (Landscape)',
    compositionFormat: '16:9',
    subtitleMode: 'burned-in',
    thumbnailTemplate: 'stb-default-v2',
    scheduledAt: '2026-05-24T07:00:00.000Z',
  },
  {
    id: 'pipeline-weekly-shorts',
    name: 'Weekly Shorts (Portrait)',
    compositionFormat: '9:16',
    subtitleMode: 'srt-sidecar',
    thumbnailTemplate: 'stb-portrait-v1',
    scheduledAt: '2026-05-27T09:00:00.000Z',
  },
  {
    id: 'pipeline-manual',
    name: 'Manual Review',
    compositionFormat: '16:9',
    subtitleMode: 'none',
    thumbnailTemplate: 'blank',
    scheduledAt: null,
  },
];

const CONTENT_ITEM_FIXTURES: VOContentItem[] = [
  {
    id: 'ci-1',
    title: 'John 3:16 — God So Loved the World',
    briefText: 'Core gospel message — the most widely known verse in scripture.',
    status: 'completed',
    createdAt: '2026-05-18T08:00:00.000Z',
    updatedAt: '2026-05-19T16:45:00.000Z',
    sourceAudioPath: '/media/audio/john-3-16.mp3',
    sourceImagePath: '/media/images/john-3-16-bg.jpg',
  },
  {
    id: 'ci-2',
    title: 'Psalm 23 — The Lord Is My Shepherd',
    briefText: 'Comfort and trust. One of the most beloved psalms.',
    status: 'queued',
    createdAt: '2026-05-20T09:00:00.000Z',
    updatedAt: '2026-05-22T11:00:00.000Z',
    sourceAudioPath: '/media/audio/psalm-23.mp3',
    sourceImagePath: null,
  },
  {
    id: 'ci-3',
    title: 'Romans 8:28 — All Things Work Together',
    briefText: 'Providence and hope in the midst of suffering.',
    status: 'processing',
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-24T08:30:00.000Z',
    sourceAudioPath: '/media/audio/romans-8-28.mp3',
    sourceImagePath: '/media/images/romans-8-28-bg.jpg',
  },
  {
    id: 'ci-4',
    title: 'Proverbs 3:5-6 — Trust in the Lord',
    briefText: 'Wisdom and surrender — letting go of self-reliance.',
    status: 'draft',
    createdAt: '2026-05-23T14:00:00.000Z',
    updatedAt: '2026-05-23T14:00:00.000Z',
    sourceAudioPath: null,
    sourceImagePath: null,
  },
  {
    id: 'ci-5',
    title: 'Isaiah 40:31 — Those Who Wait on the Lord',
    briefText: 'Renewal and strength. Eagles soaring imagery.',
    status: 'failed',
    createdAt: '2026-05-21T07:00:00.000Z',
    updatedAt: '2026-05-21T09:15:00.000Z',
    sourceAudioPath: '/media/audio/isaiah-40-31.mp3',
    sourceImagePath: '/media/images/isaiah-40-31-bg.jpg',
  },
];

const PACKAGE_FIXTURES: Record<string, VOPackage> = {
  'pkg-1': {
    id: 'pkg-1',
    contentItemId: 'ci-1',
    status: 'posted',
    stage: 'done',
    progressPercent: 100,
    artifacts: {
      composition: [
        { path: '/artifacts/pkg-1/video.mp4', format: 'mp4', sizeBytes: 52428800 },
      ],
      subtitles: { path: '/artifacts/pkg-1/subtitles.srt', format: 'srt' },
      thumbnails: [
        { path: '/artifacts/pkg-1/thumbnail-16x9.jpg', format: 'jpg', sizeBytes: 204800 },
      ],
    },
    postingTargets: [
      { platform: 'youtube', account: 'acct-yt-1', status: 'posted', publishedAt: '2026-05-19T17:00:00.000Z' },
      { platform: 'facebook', account: 'acct-fb-1', status: 'posted', publishedAt: '2026-05-19T17:05:00.000Z' },
    ],
    approvals: [
      { type: 'content-review', status: 'approved', decidedAt: '2026-05-19T16:50:00.000Z', decidedBy: 'steve' },
      { type: 'pre-publish', status: 'approved', decidedAt: '2026-05-19T16:55:00.000Z', decidedBy: 'steve' },
    ],
    createdAt: '2026-05-19T08:00:00.000Z',
    updatedAt: '2026-05-19T17:05:00.000Z',
  },
  'pkg-2': {
    id: 'pkg-2',
    contentItemId: 'ci-2',
    status: 'ready',
    stage: 'posting',
    progressPercent: 90,
    artifacts: {
      composition: [
        { path: '/artifacts/pkg-2/video.mp4', format: 'mp4', sizeBytes: 49283072 },
      ],
      subtitles: { path: '/artifacts/pkg-2/subtitles.srt', format: 'srt' },
      thumbnails: [
        { path: '/artifacts/pkg-2/thumbnail-16x9.jpg', format: 'jpg', sizeBytes: 196608 },
      ],
    },
    postingTargets: [
      { platform: 'youtube', account: 'acct-yt-1', status: 'pending', publishedAt: null },
      { platform: 'facebook', account: 'acct-fb-1', status: 'pending', publishedAt: null },
    ],
    approvals: [
      { type: 'content-review', status: 'approved', decidedAt: '2026-05-22T10:30:00.000Z', decidedBy: 'steve' },
      { type: 'pre-publish', status: 'pending', decidedAt: null, decidedBy: null },
    ],
    createdAt: '2026-05-22T08:00:00.000Z',
    updatedAt: '2026-05-24T09:00:00.000Z',
  },
  'pkg-3': {
    id: 'pkg-3',
    contentItemId: 'ci-3',
    status: 'building',
    stage: 'composition',
    progressPercent: 45,
    artifacts: {
      composition: [],
      subtitles: null,
      thumbnails: [],
    },
    postingTargets: [
      { platform: 'youtube', account: 'acct-yt-1', status: 'pending', publishedAt: null },
    ],
    approvals: [
      { type: 'content-review', status: 'pending', decidedAt: null, decidedBy: null },
      { type: 'pre-publish', status: 'pending', decidedAt: null, decidedBy: null },
    ],
    createdAt: '2026-05-24T08:00:00.000Z',
    updatedAt: '2026-05-24T08:30:00.000Z',
  },
};

const ANALYTICS_FIXTURES: Record<string, VOAnalyticsSummary> = {
  'proj-1': {
    projectId: 'proj-1',
    published: 47,
    scheduled: 12,
    failed: 3,
    avgPublishTime: '4h 22m',
    lastPublished: '2026-05-19T17:05:00.000Z',
  },
  'proj-2': {
    projectId: 'proj-2',
    published: 2,
    scheduled: 1,
    failed: 0,
    avgPublishTime: '3h 10m',
    lastPublished: '2026-05-10T14:00:00.000Z',
  },
};

const DEFAULT_ANALYTICS: VOAnalyticsSummary = {
  projectId: 'unknown',
  published: 0,
  scheduled: 0,
  failed: 0,
  avgPublishTime: 'n/a',
  lastPublished: null,
};

// ── Adapters ──────────────────────────────────────────────────────────────────

export function readVOProjects(): VOProjectsResponse {
  return {
    ok: true,
    items: PROJECT_FIXTURES,
    count: PROJECT_FIXTURES.length,
  };
}

export function readVOAccounts(): VOAccountsResponse {
  return {
    ok: true,
    items: ACCOUNT_FIXTURES,
    count: ACCOUNT_FIXTURES.length,
  };
}

export function readVOPipelineProfiles(): VOPipelineProfilesResponse {
  return {
    ok: true,
    items: PIPELINE_PROFILE_FIXTURES,
    count: PIPELINE_PROFILE_FIXTURES.length,
  };
}

export function readVOContentItems(): VOContentItemsResponse {
  return {
    ok: true,
    items: CONTENT_ITEM_FIXTURES,
    count: CONTENT_ITEM_FIXTURES.length,
  };
}

export function readVOPackage(packageId: string): VOPackageResponse | VOPackageNotFoundResponse {
  const pkg = PACKAGE_FIXTURES[packageId];
  if (!pkg) {
    return {
      ok: false,
      error: {
        code: 'not_found',
        message: `Package '${packageId}' not found.`,
      },
    };
  }
  return { ok: true, package: pkg };
}

export function readVOAnalyticsSummary(projectId: string): VOAnalyticsSummaryResponse {
  const summary = ANALYTICS_FIXTURES[projectId] ?? { ...DEFAULT_ANALYTICS, projectId };
  return { ok: true, summary };
}
