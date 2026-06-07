/**
 * Pure selection logic for the AWS Video dashboard.
 * Extracted for testability — no React/DOM dependencies.
 */

const SELECTED_JOB_KEY = 'aws-video-selected-job-id';

export interface JobListItem {
  jobId: string;
  title?: string;
  status?: string;
}

export interface ControlPlaneSnapshot {
  jobId: string;
  selectedJob?: { jobId: string; status: string } | null;
  allowedActions?: Record<string, { enabled: boolean; reason?: string }>;
  review?: { media: Record<string, unknown> | null } | null;
  missingRequirements?: { field: string; label: string }[];
}

/**
 * Resolve the canonical job ID for control-plane queries.
 * Rules:
 * 1. If selectedJobId is set, always use it (regardless of jobList content).
 * 2. If no selectedJobId, fall back to jobList[0] for initial default.
 * 3. Never return null if selectedJobId is set — even if jobList is empty.
 */
export function resolveJobId(selectedJobId: string | null, jobList: JobListItem[]): string | null {
  return selectedJobId ?? jobList[0]?.jobId ?? null;
}

/**
 * Whether placeholderData from a previous control-plane response is safe to use.
 * Only safe if the previous query was for the same jobId.
 */
export function isPlaceholderSafe(prevQueryJobId: string | null | undefined, currentJobId: string | null): boolean {
  if (!prevQueryJobId || !currentJobId) return false;
  return prevQueryJobId === currentJobId;
}

/**
 * Determine if the Approve Review button should be enabled.
 * Canonical: control-plane allowedActions.approve_review.enabled = true
 */
export function isApproveReviewEnabled(controlPlane: ControlPlaneSnapshot | null): boolean {
  if (!controlPlane) return false;
  const action = controlPlane.allowedActions?.approve_review;
  return action?.enabled === true;
}

/**
 * Whether the review media is complete according to control-plane.
 */
export function isReviewMediaComplete(controlPlane: ControlPlaneSnapshot | null): boolean {
  if (!controlPlane?.review?.media) return false;
  const media = controlPlane.review.media;
  const requiredKeys = ['scenePlanKey', 'narrationScriptKey', 'audioKey', 'videoKey', 'thumbnailKey', 'publishKey', 'youtubePackageKey'];
  return requiredKeys.every(key => Boolean(media[key]));
}

/**
 * Get the storage key for persisted selected job ID.
 */
export function getStorageKey(): string {
  return SELECTED_JOB_KEY;
}
