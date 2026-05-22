import { getInfraVOWorkerConfig } from './infra-video-orchestrator-worker-config.js';
import { getInfraVOAccountStats } from './infra-video-orchestrator-accounts-stats.js';
import { getInfraVideoOrchestratorStatus } from './infra-video-orchestrator-status.js';
import type { BrainCoreInfraVOReadinessResponse } from '../types/api.js';

export async function getInfraVOReadiness(): Promise<BrainCoreInfraVOReadinessResponse> {
  const [workerConfig, accountStats, voStatus] = await Promise.allSettled([
    Promise.resolve(getInfraVOWorkerConfig()),
    getInfraVOAccountStats(),
    getInfraVideoOrchestratorStatus(),
  ]);

  const wc = workerConfig.status === 'fulfilled' ? workerConfig.value : null;
  const as = accountStats.status === 'fulfilled' ? accountStats.value : null;
  const vs = voStatus.status === 'fulfilled' ? voStatus.value : null;

  const checks: Array<{ id: string; label: string; status: 'pass' | 'fail' | 'warn' | 'unknown'; detail: string }> = [];

  // Worker: n8n webhook configured
  const n8nConfigured = wc?.ok && wc.config?.n8nWebhookConfigured === true;
  checks.push({
    id: 'n8n-configured',
    label: 'n8n webhook configured',
    status: n8nConfigured ? 'pass' : 'fail',
    detail: n8nConfigured ? wc!.config!.n8nWebhookUrl : 'VO_N8N_WEBHOOK_URL not set in worker plist',
  });

  // Worker: n8n reachable
  const n8nReachable = wc?.ok && wc.config?.n8nReachable === true;
  const n8nConfiguredBool = wc?.ok && wc.config?.n8nWebhookConfigured === true;
  checks.push({
    id: 'n8n-reachable',
    label: 'n8n webhook reachable',
    status: !n8nConfiguredBool ? 'unknown' : n8nReachable ? 'pass' : 'fail',
    detail: !n8nConfiguredBool ? 'n8n webhook not configured' : n8nReachable ? 'reachable' : (wc?.config?.n8nReachableError ?? 'unreachable'),
  });

  // Worker: CF Access configured
  const cfConfigured = wc?.ok && wc.config?.cfAccessConfigured === true;
  checks.push({
    id: 'cf-access',
    label: 'Cloudflare Access token configured',
    status: cfConfigured ? 'pass' : 'fail',
    detail: cfConfigured ? 'CF_ACCESS_CLIENT_ID and CF_ACCESS_CLIENT_SECRET set' : 'Placeholder values in worker plist — create service token in Cloudflare Zero Trust',
  });

  // Worker: YouTube OAuth
  const youtubeAuth = wc?.ok && wc.config?.youtubeOauthConfigured === true;
  checks.push({
    id: 'youtube-oauth',
    label: 'YouTube OAuth authorized',
    status: youtubeAuth ? 'pass' : 'fail',
    detail: youtubeAuth
      ? `Accounts: ${wc!.config!.youtubeOauthAccounts.join(', ')}`
      : 'No yt-oauth-* accounts in macOS keychain — run youtube_uploader.py auth-url',
  });

  // DB: connection
  const dbOk = vs?.ok === true;
  checks.push({
    id: 'vo-db',
    label: 'Video Orchestrator DB reachable',
    status: dbOk ? 'pass' : 'fail',
    detail: dbOk ? 'PostgreSQL on port 5450 connected' : (vs?.error ?? 'DB unreachable'),
  });

  // DB: active accounts
  const activeAccounts = as?.ok && as.stats.length > 0 ? as.stats.filter(s => s.totalJobs30d > 0 || s.lastJobAt).length : 0;
  checks.push({
    id: 'active-accounts',
    label: 'Active posting accounts',
    status: activeAccounts > 0 ? 'pass' : 'warn',
    detail: activeAccounts > 0 ? `${activeAccounts} account${activeAccounts !== 1 ? 's' : ''} with recent activity` : 'No accounts with recent post history',
  });

  // Queue: no stuck jobs
  const queueDepth = vs?.queueDepth;
  const dead = queueDepth?.dead ?? 0;
  const running = queueDepth?.running ?? 0;
  checks.push({
    id: 'queue-health',
    label: 'Job queue healthy',
    status: dead > 0 ? 'warn' : 'pass',
    detail: dead > 0
      ? `${dead} dead job${dead !== 1 ? 's' : ''} in queue — run: vo jobs to inspect`
      : running > 0
        ? `${running} job${running !== 1 ? 's' : ''} running`
        : 'Queue clear',
  });

  const passCount = checks.filter(c => c.status === 'pass').length;
  const failCount = checks.filter(c => c.status === 'fail').length;
  const warnCount = checks.filter(c => c.status === 'warn').length;
  const readinessScore = Math.round((passCount / checks.length) * 100);

  const overallStatus: 'ready' | 'partial' | 'blocked' =
    failCount > 2 ? 'blocked' :
    failCount > 0 || warnCount > 0 ? 'partial' :
    'ready';

  const manualActionsRequired = wc?.manualActionsRequired ?? [];

  return {
    ok: true,
    status: overallStatus,
    readinessScore,
    checks,
    passCount,
    failCount,
    warnCount,
    manualActionsRequired,
  };
}
