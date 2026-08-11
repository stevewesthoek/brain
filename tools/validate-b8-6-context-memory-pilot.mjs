#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function validatePilotContract({ pilot, benchmarkManifest, freshnessContract }) {
  const errors = [];
  if (pilot.task !== 'B8.6') errors.push('task');
  if (pilot.pilotRepositories?.length !== 2) errors.push('exactly-two-pilot-repositories');
  const ids = pilot.pilotRepositories?.map((repo) => repo.repositoryId) ?? [];
  if (JSON.stringify(ids) !== JSON.stringify(['brain', 'prochat'])) errors.push('brain-plus-prochat-only');
  if (pilot.pilotRepositories?.[0]?.role !== 'system' || pilot.pilotRepositories?.[1]?.role !== 'application') errors.push('pilot-roles');
  if (ids.includes('mind') || ids.includes('workbench')) errors.push('forbidden-pilot-repository');
  if (!pilot.pilotRepositories?.every((repo) => Array.isArray(repo.retrievalProbes) && repo.retrievalProbes.length >= 2)) errors.push('retrieval-probes');

  const headroom = 1 - benchmarkManifest.rehearsalPolicy.requiredHeadroomRatio;
  const expected = {
    maximumColdIndexWallMs: benchmarkManifest.resourceBudget.coldStart.maximumIndexingTimeMsPerRepository * headroom,
    maximumColdIndexPeakRssMiB: benchmarkManifest.resourceBudget.coldStart.maximumPeakRssMiB * headroom,
    maximumColdIndexPeakCpuPercent: benchmarkManifest.resourceBudget.coldStart.maximumPeakCpuPercent * headroom,
    maximumRefreshWallMs: benchmarkManifest.resourceBudget.steadyState.maximumRefreshMs * headroom,
    maximumRefreshPeakRssMiB: benchmarkManifest.resourceBudget.steadyState.maximumRefreshPeakRssMiB * headroom,
    maximumRefreshPeakCpuPercent: benchmarkManifest.resourceBudget.steadyState.maximumRefreshPeakCpuPercent * headroom,
    maximumIndexBytes: benchmarkManifest.resourceBudget.capacity.maximumIndexBytesPerRepository * headroom,
    maximumRebuildWallMs: benchmarkManifest.resourceBudget.coldStart.maximumIndexingTimeMsPerRepository * headroom,
  };
  for (const [key, value] of Object.entries(expected)) if (pilot.acceptance?.[key] !== value) errors.push(`inherited-limit:${key}`);
  if (freshnessContract.freshnessPolicy.requiredHeadroomRatio !== benchmarkManifest.rehearsalPolicy.requiredHeadroomRatio) errors.push('headroom-ratio-drift');
  if (pilot.acceptance?.minimumStructuralProbeHitRate !== 1) errors.push('structural-hit-rate');
  if (pilot.acceptance?.minimumExactSourceFallbackHitRate !== 1) errors.push('fallback-hit-rate');
  if (!Number.isInteger(pilot.acceptance?.maximumCbmNavigationEstimatedTokensPerProbe) || pilot.acceptance.maximumCbmNavigationEstimatedTokensPerProbe > 1000 || pilot.acceptance.maximumCbmNavigationEstimatedTokensPerProbe <= 0) errors.push('navigation-token-cap');
  if (pilot.acceptance?.requireSourceHeadUnchanged !== true || pilot.acceptance?.requireSourceWorktreeUnchanged !== true) errors.push('source-immutability');
  if (pilot.acceptance?.requireGraphifyDisablement !== true || pilot.acceptance?.requireRollback !== true) errors.push('disable-rollback-gates');
  if (pilot.rolloutDecision?.globalAutomaticRollout !== false || pilot.rolloutDecision?.perRepositoryAdmissionRequired !== true) errors.push('rollout-boundary');
  if (pilot.safety?.sourceRepositoriesReadOnly !== true || pilot.safety?.noMindMutation !== true || pilot.safety?.noWorkbenchMutation !== true || pilot.safety?.noPush !== true || pilot.safety?.noExternalOrLocalModelInvocation !== true) errors.push('safety-boundary');
  if (pilot.architecture?.structuralMode !== 'full' || pilot.architecture?.exactSourceAuthority !== true || pilot.architecture?.graphifyStructuralState !== 'frozen') errors.push('architecture-boundary');
  return errors;
}

function main() {
  const pilot = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/b8-6-context-memory-pilot.json'), 'utf8'));
  const benchmarkManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json'), 'utf8'));
  const freshnessContract = JSON.parse(fs.readFileSync(path.join(ROOT, 'operations/specs/b8-3-context-memory-freshness.json'), 'utf8'));
  const errors = validatePilotContract({ pilot, benchmarkManifest, freshnessContract });
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('b8-6-pilot-contract=valid repositories=brain,prochat rollout=per-repository-only');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
