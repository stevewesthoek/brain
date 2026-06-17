/**
 * Video Orchestrator Studio — Canonical Read Model
 *
 * This file defines the complete data contract for the VO Studio read APIs.
 * All read endpoints return data structured according to these types.
 * These are the single source of truth for the Console UI.
 *
 * Mirror of VO worker Python schema where applicable.
 * Keep in sync with operations/system-configs/model-selector/ and VO worker.
 */

// ---------------------------------------------------------------------------
// Status enums
// ---------------------------------------------------------------------------

export type ProjectStatus = 'active' | 'archived' | 'disabled';
export type AdapterMode = 'direct' | 'n8n-dispatch' | 'manual-only' | 'unavailable';
export type CredentialState = 'configured' | 'missing' | 'invalid' | 'expired';
export type JobStatus =
  | 'queued'
  | 'in_progress'
  | 'pending_approval'
  | 'approved'
  | 'published'
  | 'failed'
  | 'manual_fallback';
export type StageStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';
export type ArtifactStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// Brand & Project config
// ---------------------------------------------------------------------------

export interface BrandProfile {
  id: string;
  label: string;
  brandLine: string; // "YeshuaAcademy.com"
  labelText: string; // "BIBLE STUDY"
  accentColor: string; // "#F5C842"
  logoPath: string | null;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  brandProfileId: string;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Platform & Format specs
// ---------------------------------------------------------------------------

export interface PlatformSpec {
  id: string; // "youtube", "facebook", "tiktok", etc.
  label: string;
  enabled: boolean;
  directUploadHandler: string | null; // "youtube", "n8n-dispatch", null for manual
  capabilities: string[]; // ["video/1080p", "captions", "thumbnails"]
  maxVideoSizeMb: number;
  maxDurationSec: number;
  acceptedFormats: string[]; // ["landscape_1920x1080", "vertical_1080x1920"]
}

export interface FormatSpec {
  id: string; // "landscape_1920x1080_16x9", "vertical_1080x1920_9x16", etc.
  label: string;
  width: number;
  height: number;
  aspectRatio: string;
  platforms: string[]; // platform IDs that accept this format
}

export interface PipelineProfile {
  id: string;
  name: string;
  projectId: string;
  enabled: boolean;
  stages: string[]; // ["normalize", "subtitle", "compose", "thumbnail", "metadata", "publish"]
  targetPlatforms: string[]; // platform IDs to publish to
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Platform accounts & credentials
// ---------------------------------------------------------------------------

export interface PlatformAccount {
  id: string;
  projectId: string;
  platformId: string; // "youtube", "facebook", etc.
  accountHandle: string;
  displayName: string;
  email: string | null;
  credentialState: CredentialState;
  adapterMode: AdapterMode;
  quotaRemaining: number | null;
  quotaResetAt: string | null;
  enabledProfiles: string[]; // profile IDs allowed to use this account
  createdAt: string;
  lastVerifiedAt: string | null;
}

// ---------------------------------------------------------------------------
// Content & Production
// ---------------------------------------------------------------------------

export interface ContentItem {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: JobStatus;
  sourceAudioPath: string;
  backgroundImagePath: string;
  sourceVideoPath?: string | null;
  durationSec: number | null;
  language: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArtifactVariant {
  id: string; // "variant_a", "variant_b"
  type: string; // "thumbnail", "composition", etc.
  path: string;
  metadata: Record<string, string | number | boolean>;
  active: boolean;
}

export interface ProductionPackage {
  id: string;
  contentItemId: string;
  projectId: string;
  pipelineProfileId: string;
  status: JobStatus;
  stage: StageStatus;
  artifacts: ArtifactVariant[];
  approvals: Approval[];
  postingTargets: PostingTarget[];
  auditEvents: AuditEvent[];
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  publishedAt: string | null;
}

export interface PostingTarget {
  id: string;
  packageId: string;
  platformId: string;
  accountId: string;
  status: JobStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  publishedUrl: string | null;
  error: string | null;
}

export interface PostingJob {
  id: string;
  packageId: string;
  postingTargetId: string;
  platformId: string;
  accountId: string;
  jobType: string; // "compose", "subtitle", "thumbnail", "metadata", "post", etc.
  status: JobStatus;
  workerNode: string | null;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Analytics & Performance
// ---------------------------------------------------------------------------

export interface PerformanceSnapshot {
  platformId: string;
  videoId: string;
  views: number;
  impressions: number;
  ctr: number;
  avgViewDurationSec: number;
  likes: number;
  comments: number;
  shares: number;
  fetchedAt: string;
}

export interface AnalyticsSummary {
  projectId: string;
  platformId: string;
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalViews: number;
  totalImpressions: number;
  avgCtr: number;
  totalDurationWatchedHours: number;
  topVideos: Array<{
    videoId: string;
    title: string;
    views: number;
    ctr: number;
  }>;
}

// ---------------------------------------------------------------------------
// Approvals & Audit
// ---------------------------------------------------------------------------

export interface Approval {
  id: string;
  packageId: string;
  type: 'thumbnail' | 'metadata' | 'final_review';
  status: ApprovalStatus;
  requiredFields: string[];
  approvedBy: string | null;
  rejectedBy: string | null;
  requestedAt: string;
  respondedAt: string | null;
  notes: string;
}

export interface AuditEvent {
  id: string;
  packageId: string;
  timestamp: string;
  eventType: string; // "job_started", "job_completed", "approval_requested", etc.
  actor: string; // "system", "worker", "user"
  details: Record<string, string | number | boolean | null>;
}

// ---------------------------------------------------------------------------
// Read API Response Wrappers
// ---------------------------------------------------------------------------

export interface VOProjectsResponse {
  projects: Project[];
  brands: BrandProfile[];
}

export interface VOAccountsResponse {
  accounts: PlatformAccount[];
  platforms: PlatformSpec[];
}

export interface VOPipelineProfilesResponse {
  profiles: PipelineProfile[];
  formats: FormatSpec[];
}

export interface VOContentItemsResponse {
  items: ContentItem[];
  count: number;
}

export interface VOPackageResponse {
  package: ProductionPackage;
  contentItem: ContentItem;
  postingJobs: PostingJob[];
}

export interface VOAnalyticsSummaryResponse {
  summary: AnalyticsSummary;
  projectName: string;
  platformLabel: string;
}

// ---------------------------------------------------------------------------
// Health & Status
// ---------------------------------------------------------------------------

export interface WorkerHealth {
  workerId: string;
  status: 'healthy' | 'degraded' | 'offline';
  lastHeartbeatAt: string;
  jobsProcessedToday: number;
  activeJobs: number;
  errorRate: number; // 0.0 - 1.0
}

export interface SelectorHealth {
  status: 'healthy' | 'degraded' | 'offline';
  currentProvider: string;
  geminiQuotaRemaining: number;
  localOllamaStatus: 'healthy' | 'unhealthy';
  lastSelectionAt: string;
}

export interface VOStudioHealth {
  worker: WorkerHealth;
  selector: SelectorHealth;
  activeJobs: number;
  blockers: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Wire format helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

export function projectFromWire(r: Raw): Project {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    status: r.status,
    brandProfileId: r.brand_profile_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function platformAccountFromWire(r: Raw): PlatformAccount {
  return {
    id: r.id,
    projectId: r.project_id,
    platformId: r.platform_id,
    accountHandle: r.account_handle,
    displayName: r.display_name,
    email: r.email ?? null,
    credentialState: r.credential_state,
    adapterMode: r.adapter_mode,
    quotaRemaining: r.quota_remaining ?? null,
    quotaResetAt: r.quota_reset_at ?? null,
    enabledProfiles: r.enabled_profiles ?? [],
    createdAt: r.created_at,
    lastVerifiedAt: r.last_verified_at ?? null,
  };
}

export function contentItemFromWire(r: Raw): ContentItem {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status,
    sourceAudioPath: r.source_audio_path,
    backgroundImagePath: r.background_image_path,
    durationSec: r.duration_sec ?? null,
    language: r.language ?? 'en',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function packageFromWire(r: Raw): ProductionPackage {
  const artifacts = (r.artifacts ?? []).map((a: Raw) => ({
    id: a.id,
    type: a.type,
    path: a.path,
    metadata: a.metadata ?? {},
    active: a.active ?? false,
  }));

  const approvals = (r.approvals ?? []).map((a: Raw) => ({
    id: a.id,
    packageId: a.package_id,
    type: a.type,
    status: a.status,
    requiredFields: a.required_fields ?? [],
    approvedBy: a.approved_by ?? null,
    rejectedBy: a.rejected_by ?? null,
    requestedAt: a.requested_at,
    respondedAt: a.responded_at ?? null,
    notes: a.notes ?? '',
  }));

  const postingTargets = (r.posting_targets ?? []).map((t: Raw) => ({
    id: t.id,
    packageId: t.package_id,
    platformId: t.platform_id,
    accountId: t.account_id,
    status: t.status,
    scheduledAt: t.scheduled_at ?? null,
    publishedAt: t.published_at ?? null,
    publishedUrl: t.published_url ?? null,
    error: t.error ?? null,
  }));

  const auditEvents = (r.audit_events ?? []).map((e: Raw) => ({
    id: e.id,
    packageId: e.package_id,
    timestamp: e.timestamp,
    eventType: e.event_type,
    actor: e.actor,
    details: e.details ?? {},
  }));

  return {
    id: r.id,
    contentItemId: r.content_item_id,
    projectId: r.project_id,
    pipelineProfileId: r.pipeline_profile_id,
    status: r.status,
    stage: r.stage,
    artifacts,
    approvals,
    postingTargets,
    auditEvents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    approvedAt: r.approved_at ?? null,
    publishedAt: r.published_at ?? null,
  };
}
