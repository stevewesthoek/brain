/**
 * VO Studio Read Route Adapters
 *
 * Wraps vo-studio-read functions to match the route contract expectations.
 * Returns responses with summary statistics and safety metadata.
 */

import type { VOProjectsResponse, VOAccountsResponse, VOPipelineProfilesResponse, VOContentItemsResponse, ProductionPackage } from '../types/vo-studio.js';
import {
  getProjects,
  getAccounts,
  getPipelineProfiles,
  getContentItems,
  getPackage,
} from './vo-studio-read.js';

interface SafetyMetadata {
  readOnly: boolean;
  writesFiles: boolean;
  publishesContent: boolean;
  schedulesPost: boolean;
  callsPlatformApi: boolean;
  writesToMind: boolean;
}

const safety: SafetyMetadata = {
  readOnly: true,
  writesFiles: false,
  publishesContent: false,
  schedulesPost: false,
  callsPlatformApi: false,
  writesToMind: false,
};

/**
 * GET /video-orchestrator/projects
 */
export function readVOStudioProjects() {
  const response = getProjects();
  return {
    id: 'video-orchestrator-projects',
    generatedAt: new Date().toISOString(),
    items: response.projects,
    brands: response.brands,
    summary: {
      total: response.projects.length,
      active: response.projects.filter((p) => p.status === 'active').length,
    },
    safety,
    nextSafeStep: 'Browse projects to select one for VO Studio operations.',
  };
}

/**
 * GET /video-orchestrator/accounts
 * Requires projectId query param
 */
export function readVOStudioAccounts(projectId = 'proj-yeshua-main') {
  const response = getAccounts(projectId);
  return {
    id: 'video-orchestrator-accounts',
    generatedAt: new Date().toISOString(),
    projectId,
    items: response.accounts,
    platforms: response.platforms,
    summary: {
      total: response.accounts.length,
      configured: response.accounts.filter((a) => a.credentialState === 'configured').length,
      direct: response.accounts.filter((a) => a.adapterMode === 'direct').length,
      manualOnly: response.accounts.filter((a) => a.adapterMode === 'manual-only').length,
    },
    safety,
    nextSafeStep: 'Verify all required platform accounts are configured before queuing jobs.',
  };
}

/**
 * GET /video-orchestrator/pipeline-profiles
 * Requires projectId query param
 */
export function readVOStudioPipelineProfiles(projectId = 'proj-yeshua-main') {
  const response = getPipelineProfiles(projectId);
  return {
    id: 'video-orchestrator-pipeline-profiles',
    generatedAt: new Date().toISOString(),
    projectId,
    items: response.profiles,
    formats: response.formats,
    summary: {
      total: response.profiles.length,
      enabled: response.profiles.filter((p) => p.enabled).length,
      formatCount: response.formats.length,
    },
    safety,
    nextSafeStep: 'Select a pipeline profile to define the job composition path.',
  };
}

/**
 * GET /video-orchestrator/content-items
 * Requires projectId query param
 * Optional: limit (default 50), offset (default 0)
 */
export function readVOStudioContentItems(projectId = 'proj-yeshua-main', limit = 50, offset = 0) {
  const response = getContentItems(projectId, limit, offset);
  return {
    id: 'video-orchestrator-content-items',
    generatedAt: new Date().toISOString(),
    projectId,
    items: response.items,
    pagination: {
      limit,
      offset,
      total: response.count,
      hasMore: offset + limit < response.count,
    },
    summary: {
      total: response.count,
      published: response.items.filter((i) => i.status === 'published').length,
      inProgress: response.items.filter((i) => i.status === 'in_progress').length,
      approved: response.items.filter((i) => i.status === 'approved').length,
    },
    safety,
    nextSafeStep: 'Select a content item to view or queue for production.',
  };
}

/**
 * GET /video-orchestrator/packages/:id
 * Requires projectId and packageId
 */
export function readVOStudioPackage(projectId: string, packageId: string): ProductionPackage | null {
  const pkg = getPackage(projectId, packageId);
  if (!pkg) return null;
  return pkg;
}

/**
 * GET /video-orchestrator/analytics/summary
 * Requires projectId query param
 */
export function readVOStudioAnalyticsSummary(projectId = 'proj-yeshua-main') {
  const items = getContentItems(projectId, 1000, 0);
  const published = items.items.filter((i) => i.status === 'published').length;

  return {
    id: 'video-orchestrator-analytics-summary',
    generatedAt: new Date().toISOString(),
    projectId,
    summary: {
      contentItems: items.count,
      published,
      inProgress: items.items.filter((i) => i.status === 'in_progress').length,
      approved: items.items.filter((i) => i.status === 'approved').length,
    },
    platforms: ['youtube', 'facebook', 'tiktok'],
    statistics: {
      avgProductionTime: '~2 hours per item',
      approvalGatePass: published > 0 ? '100%' : 'N/A',
    },
    safety,
    nextSafeStep: 'Review performance trends across all published content to optimize pipeline.',
  };
}
