import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface InfraGoogleAdsMetrics {
  status: 'ok' | 'not-configured' | 'error';
  lastSync: string | null;
  dailyBudgetUSD: number;
  targetBudgetUSD: number;
  percentOfTarget: number;
  dayOfMonth: number;
  daysInMonth: number;
  lastMetricsDate: string | null;
  pendingMutations: number;
  mutationStatsByStatus: Record<string, number>;
  error?: string;
}

const GOOGLE_ADS_DB_PATH = path.join(
  os.homedir(),
  'Repos', 'stevewesthoek', 'brain', 'operations', 'google-ads', 'data', 'google_ads.sqlite3',
);

export function getInfraGoogleAdsMetrics(): InfraGoogleAdsMetrics {
  if (!fs.existsSync(GOOGLE_ADS_DB_PATH)) {
    return {
      status: 'not-configured',
      lastSync: null,
      dailyBudgetUSD: 0,
      targetBudgetUSD: 10_000,
      percentOfTarget: 0,
      dayOfMonth: new Date().getDate(),
      daysInMonth: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate(),
      lastMetricsDate: null,
      pendingMutations: 0,
      mutationStatsByStatus: {},
      error: 'Google Ads database not found at operations/google-ads/data/google_ads.sqlite3',
    };
  }

  try {
    // Dynamic import to avoid requiring better-sqlite3 when db doesn't exist
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as (path: string, opts?: { readonly?: boolean }) => {
      prepare: (sql: string) => { get: () => unknown; all: () => unknown[] };
      close: () => void;
    };

    const db = Database(GOOGLE_ADS_DB_PATH, { readonly: true });
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    let dailyBudgetUSD = 0;
    let targetBudgetUSD = 10_000;
    let lastMetricsDate: string | null = null;
    let lastSync: string | null = null;

    try {
      const row = db.prepare(
        "SELECT metrics_date, SUM(spend_usd) as spend_usd FROM daily_metrics_detail " +
        "WHERE campaign_id IS NULL AND metrics_date LIKE strftime('%Y-%m', 'now') || '%' " +
        "GROUP BY metrics_date ORDER BY metrics_date DESC LIMIT 1",
      ).get() as { metrics_date?: string; spend_usd?: number } | undefined;
      if (row) {
        dailyBudgetUSD = row.spend_usd ?? 0;
        lastMetricsDate = row.metrics_date ?? null;
      }
    } catch { /* table may not exist */ }

    try {
      const syncRow = db.prepare("SELECT MAX(synced_at) as last_sync FROM sync_log LIMIT 1").get() as { last_sync?: string } | undefined;
      lastSync = syncRow?.last_sync ?? null;
    } catch { /* table may not exist */ }

    const percentOfTarget = targetBudgetUSD > 0
      ? Math.round((dailyBudgetUSD / (targetBudgetUSD / daysInMonth * dayOfMonth)) * 100)
      : 0;

    let pendingMutations = 0;
    const mutationStatsByStatus: Record<string, number> = {};

    try {
      const mutationRows = db.prepare("SELECT status, COUNT(*) as cnt FROM pending_mutations GROUP BY status").all() as Array<{ status?: string; cnt?: number }>;
      for (const row of mutationRows) {
        if (row.status) {
          mutationStatsByStatus[row.status] = row.cnt ?? 0;
          if (row.status === 'pending') pendingMutations = row.cnt ?? 0;
        }
      }
    } catch { /* table may not exist */ }

    db.close();

    return { status: 'ok', lastSync, dailyBudgetUSD, targetBudgetUSD, percentOfTarget, dayOfMonth, daysInMonth, lastMetricsDate, pendingMutations, mutationStatsByStatus };
  } catch (err) {
    return {
      status: 'error',
      lastSync: null,
      dailyBudgetUSD: 0,
      targetBudgetUSD: 10_000,
      percentOfTarget: 0,
      dayOfMonth: new Date().getDate(),
      daysInMonth: 30,
      lastMetricsDate: null,
      pendingMutations: 0,
      mutationStatsByStatus: {},
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
