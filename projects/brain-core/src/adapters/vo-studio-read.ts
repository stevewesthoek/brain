/**
 * VO Studio Read Model Adapters
 *
 * Fixture-backed implementation of VO Studio read APIs.
 * In production, these would query the VO worker database.
 * In tests/development, these serve fixture data.
 */

import type {
  BrandProfile,
  Project,
  PlatformAccount,
  PlatformSpec,
  FormatSpec,
  PipelineProfile,
  ContentItem,
  ProductionPackage,
  VOProjectsResponse,
  VOAccountsResponse,
  VOPipelineProfilesResponse,
  VOContentItemsResponse,
} from '../types/vo-studio.js';
import {
  projectFromWire,
  platformAccountFromWire,
  contentItemFromWire,
  packageFromWire,
} from '../types/vo-studio.js';
import * as fixtures from './vo-studio-fixtures.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = Record<string, any>;

/**
 * Get all projects and brand profiles
 */
export function getProjects(): VOProjectsResponse {
  const brands: BrandProfile[] = fixtures.brandProfiles.map((b: Raw) => ({
    id: b.id,
    label: b.label,
    brandLine: b.brand_line,
    labelText: b.label_text,
    accentColor: b.accent_color,
    logoPath: b.logo_path,
  }));

  const projects: Project[] = fixtures.projects.map((p: Raw) => projectFromWire(p));

  return { projects, brands };
}

/**
 * Get all platform accounts for a project
 */
export function getAccounts(projectId: string): VOAccountsResponse {
  const accounts: PlatformAccount[] = fixtures.platformAccounts
    .filter((a: Raw) => a.project_id === projectId)
    .map((a: Raw) => platformAccountFromWire(a));

  const platforms: PlatformSpec[] = fixtures.platformSpecs.map((p: Raw) => ({
    id: p.id,
    label: p.label,
    enabled: p.enabled,
    directUploadHandler: p.direct_upload_handler,
    capabilities: p.capabilities,
    maxVideoSizeMb: p.max_video_size_mb,
    maxDurationSec: p.max_duration_sec,
    acceptedFormats: p.accepted_formats,
  }));

  return { accounts, platforms };
}

/**
 * Get all pipeline profiles and formats for a project
 */
export function getPipelineProfiles(projectId: string): VOPipelineProfilesResponse {
  const profiles: PipelineProfile[] = fixtures.pipelineProfiles
    .filter((p: Raw) => p.project_id === projectId)
    .map((p: Raw) => ({
      id: p.id,
      name: p.name,
      projectId: p.project_id,
      enabled: p.enabled,
      stages: p.stages,
      targetPlatforms: p.target_platforms,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));

  const formats: FormatSpec[] = fixtures.formatSpecs.map((f: Raw) => ({
    id: f.id,
    label: f.label,
    width: f.width,
    height: f.height,
    aspectRatio: f.aspect_ratio,
    platforms: f.platforms,
  }));

  return { profiles, formats };
}

/**
 * Get all content items for a project
 */
export function getContentItems(projectId: string, limit = 50, offset = 0): VOContentItemsResponse {
  const filtered = fixtures.contentItems.filter((i: Raw) => i.project_id === projectId);

  const items: ContentItem[] = filtered
    .slice(offset, offset + limit)
    .map((i: Raw) => contentItemFromWire(i));

  return { items, count: filtered.length };
}

/**
 * Get a single content item by ID
 */
export function getContentItem(projectId: string, itemId: string): ContentItem | null {
  const item = fixtures.contentItems.find(
    (i: Raw) => i.project_id === projectId && i.id === itemId
  );
  return item ? contentItemFromWire(item) : null;
}

/**
 * Get a single package by ID
 */
export function getPackage(projectId: string, packageId: string): ProductionPackage | null {
  const pkg = fixtures.packages.find(
    (p: Raw) => p.project_id === projectId && p.id === packageId
  );
  return pkg ? packageFromWire(pkg) : null;
}

/**
 * Verify adapter mode for a platform account
 */
export function getAccountAdapterMode(
  projectId: string,
  accountId: string
): { mode: string; credentialState: string } | null {
  const account = fixtures.platformAccounts.find(
    (a: Raw) => a.project_id === projectId && a.id === accountId
  );
  return account
    ? {
        mode: account.adapter_mode,
        credentialState: account.credential_state,
      }
    : null;
}

/**
 * Check quota state for a platform account
 */
export function getAccountQuotaState(
  projectId: string,
  accountId: string
): { remaining: number | null; resetAt: string | null } | null {
  const account = fixtures.platformAccounts.find(
    (a: Raw) => a.project_id === projectId && a.id === accountId
  );
  return account
    ? {
        remaining: account.quota_remaining,
        resetAt: account.quota_reset_at,
      }
    : null;
}
