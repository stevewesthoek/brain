import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { JEV_MONTHLY_LIMIT_USD, JEV_PILOT_LIMIT_USD, monthUtc } from './jev-contract.mjs';
import { calculateJevTokenCost, deriveCostCorrectionId, resolveJevPricing } from './jev-pricing.mjs';

const SQLITE = '/usr/bin/sqlite3';

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function stateDir() {
  const configured = process.env.BRAIN_JEV_STATE_DIR;
  return configured && path.isAbsolute(configured) ? configured : path.join(os.homedir(), '.brain', 'jev');
}

function dbPath() {
  return path.join(stateDir(), 'usage.sqlite');
}

function runSql(sql) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(stateDir(), { recursive: true, mode: 0o700 });
    const child = spawn(SQLITE, ['-json', '-cmd', '.timeout 5000', dbPath()], { cwd: '/', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error(`ledger_sqlite_failed:${stderr.trim().slice(0, 160)}`));
      try { resolve(stdout.trim() ? JSON.parse(stdout) : []); } catch { reject(new Error('ledger_sqlite_invalid_output')); }
    });
    child.stdin.end(sql);
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await runSql(`PRAGMA table_info(${table});`);
  if (!columns.some((entry) => entry.name === column)) await runSql(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}

export async function initializeLedger() {
  await runSql(`
    CREATE TABLE IF NOT EXISTS jev_monthly_usage (
      utc_month TEXT PRIMARY KEY,
      monthly_limit_usd REAL NOT NULL,
      reserved_spend_usd REAL NOT NULL DEFAULT 0,
      reconciled_spend_usd REAL NOT NULL DEFAULT 0,
      calls INTEGER NOT NULL DEFAULT 0,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      pilot_limit_usd REAL NOT NULL DEFAULT ${JEV_PILOT_LIMIT_USD},
      pilot_reserved_spend_usd REAL NOT NULL DEFAULT 0,
      pilot_reconciled_spend_usd REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS jev_call_usage (
      call_id TEXT PRIMARY KEY,
      utc_month TEXT NOT NULL,
      projected_spend_usd REAL NOT NULL,
      settled_spend_usd REAL,
      status TEXT NOT NULL,
      calling_surface TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      settled_at TEXT,
      settled_cost_basis TEXT NOT NULL DEFAULT 'conservative_projection',
      pricing_provider TEXT,
      pricing_model TEXT,
      pricing_effective_date TEXT,
      pricing_source TEXT,
      reservation_released_usd REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS jev_cost_corrections (
      correction_id TEXT PRIMARY KEY,
      utc_month TEXT NOT NULL,
      old_settled_spend_usd REAL NOT NULL,
      new_settled_spend_usd REAL NOT NULL,
      difference_usd REAL NOT NULL,
      reason TEXT NOT NULL,
      pricing_provider TEXT NOT NULL,
      pricing_model TEXT NOT NULL,
      pricing_effective_date TEXT NOT NULL,
      pricing_source TEXT NOT NULL,
      corrected_at TEXT NOT NULL
    );
  `);
  await ensureColumn('jev_call_usage', 'settled_cost_basis', "TEXT NOT NULL DEFAULT 'conservative_projection'");
  await ensureColumn('jev_call_usage', 'pricing_provider', 'TEXT');
  await ensureColumn('jev_call_usage', 'pricing_model', 'TEXT');
  await ensureColumn('jev_call_usage', 'pricing_effective_date', 'TEXT');
  await ensureColumn('jev_call_usage', 'pricing_source', 'TEXT');
  await ensureColumn('jev_call_usage', 'reservation_released_usd', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn('jev_monthly_usage', 'pilot_limit_usd', `REAL NOT NULL DEFAULT ${JEV_PILOT_LIMIT_USD}`);
  await ensureColumn('jev_monthly_usage', 'pilot_reserved_spend_usd', 'REAL NOT NULL DEFAULT 0');
  await ensureColumn('jev_monthly_usage', 'pilot_reconciled_spend_usd', 'REAL NOT NULL DEFAULT 0');
}

export async function readBudget(now = new Date()) {
  await initializeLedger();
  const month = monthUtc(now);
  const nowIso = new Date(now).toISOString();
  const rows = await runSql(`
    BEGIN IMMEDIATE;
    INSERT INTO jev_monthly_usage (utc_month, monthly_limit_usd, updated_at)
      VALUES (${sqlString(month)}, ${JEV_MONTHLY_LIMIT_USD}, ${sqlString(nowIso)})
      ON CONFLICT(utc_month) DO NOTHING;
    SELECT utc_month, monthly_limit_usd, reserved_spend_usd, reconciled_spend_usd, calls, input_tokens, output_tokens, updated_at, pilot_limit_usd, pilot_reserved_spend_usd, pilot_reconciled_spend_usd
      FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)};
    COMMIT;
  `);
  return [...rows].reverse().find((row) => row.utc_month === month) ?? null;
}

export async function reserveBudget({ callId, projectedSpendUsd, callingSurface, now = new Date() }) {
  await initializeLedger();
  const month = monthUtc(now);
  const nowIso = new Date(now).toISOString();
  const projected = Number(projectedSpendUsd.toFixed(6));
  const rows = await runSql(`
    BEGIN IMMEDIATE;
    INSERT INTO jev_monthly_usage (utc_month, monthly_limit_usd, updated_at)
      VALUES (${sqlString(month)}, ${JEV_MONTHLY_LIMIT_USD}, ${sqlString(nowIso)})
      ON CONFLICT(utc_month) DO NOTHING;
    UPDATE jev_monthly_usage
      SET reserved_spend_usd = reserved_spend_usd + ${projected},
          pilot_reserved_spend_usd = pilot_reserved_spend_usd + CASE WHEN ${sqlString(callingSurface)} = 'brain' THEN ${projected} ELSE 0 END,
          updated_at = ${sqlString(nowIso)}
      WHERE utc_month = ${sqlString(month)}
        AND NOT EXISTS (SELECT 1 FROM jev_call_usage WHERE call_id = ${sqlString(callId)})
        AND reserved_spend_usd + reconciled_spend_usd + ${projected} <= monthly_limit_usd
        AND (${sqlString(callingSurface)} <> 'brain' OR pilot_reserved_spend_usd + pilot_reconciled_spend_usd + ${projected} <= pilot_limit_usd);
    INSERT INTO jev_call_usage (call_id, utc_month, projected_spend_usd, status, calling_surface, created_at)
      SELECT ${sqlString(callId)}, ${sqlString(month)}, ${projected}, 'reserved', ${sqlString(callingSurface)}, ${sqlString(nowIso)}
      WHERE changes() = 1;
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM jev_call_usage WHERE call_id = ${sqlString(callId)} AND status = 'reserved') THEN 'reserved'
      WHEN EXISTS (SELECT 1 FROM jev_call_usage WHERE call_id = ${sqlString(callId)} AND status IN ('settled','released')) THEN 'existing'
      ELSE 'exhausted'
    END AS outcome,
      COALESCE((SELECT status FROM jev_call_usage WHERE call_id = ${sqlString(callId)}), 'none') AS existing_status,
      (SELECT monthly_limit_usd FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)}) AS monthly_limit_usd,
      (SELECT reserved_spend_usd FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)}) AS reserved_spend_usd,
      (SELECT reconciled_spend_usd FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)}) AS reconciled_spend_usd,
      (SELECT pilot_limit_usd FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)}) AS pilot_limit_usd,
      (SELECT pilot_reserved_spend_usd FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)}) AS pilot_reserved_spend_usd,
      (SELECT pilot_reconciled_spend_usd FROM jev_monthly_usage WHERE utc_month = ${sqlString(month)}) AS pilot_reconciled_spend_usd;
    COMMIT;
  `);
  const row = [...rows].reverse().find((candidate) => candidate.outcome) ?? {};
  return Object.freeze({ ok: row.outcome === 'reserved', outcome: row.outcome, ...row });
}

export async function reconcileBudget({ callId, settledSpendUsd, inputTokens = 0, outputTokens = 0, status = 'settled', costBasis = 'conservative_projection', pricing = null, now = new Date() }) {
  await initializeLedger();
  const nowIso = new Date(now).toISOString();
  const settled = Number(settledSpendUsd.toFixed(6));
  const safeStatus = status === 'settled' ? 'settled' : 'released';
  const safeBasis = ['provider_reported', 'token_calculated', 'conservative_projection'].includes(costBasis) ? costBasis : 'conservative_projection';
  const projectedSql = `(SELECT projected_spend_usd FROM jev_call_usage WHERE call_id = ${sqlString(callId)} AND status = 'reserved')`;
  const pilotProjectedSql = `(SELECT projected_spend_usd FROM jev_call_usage WHERE call_id = ${sqlString(callId)} AND status = 'reserved' AND calling_surface = 'brain')`;
  const releaseSql = `MAX(0, COALESCE(${projectedSql}, 0) - ${settled})`;
  const rows = await runSql(`
    BEGIN IMMEDIATE;
    UPDATE jev_monthly_usage
      SET reserved_spend_usd = MAX(0, reserved_spend_usd - COALESCE(${projectedSql}, 0)),
          pilot_reserved_spend_usd = MAX(0, pilot_reserved_spend_usd - COALESCE(${pilotProjectedSql}, 0)),
          updated_at = ${sqlString(nowIso)},
          reconciled_spend_usd = reconciled_spend_usd + CASE WHEN ${sqlString(safeStatus)} = 'settled' THEN ${settled} ELSE 0 END,
          pilot_reconciled_spend_usd = pilot_reconciled_spend_usd + CASE WHEN ${sqlString(safeStatus)} = 'settled' AND EXISTS (SELECT 1 FROM jev_call_usage WHERE call_id = ${sqlString(callId)} AND calling_surface = 'brain') THEN ${settled} ELSE 0 END,
          calls = calls + CASE WHEN ${sqlString(safeStatus)} = 'settled' THEN 1 ELSE 0 END,
          input_tokens = input_tokens + CASE WHEN ${sqlString(safeStatus)} = 'settled' THEN ${Math.max(0, Math.trunc(inputTokens))} ELSE 0 END,
          output_tokens = output_tokens + CASE WHEN ${sqlString(safeStatus)} = 'settled' THEN ${Math.max(0, Math.trunc(outputTokens))} ELSE 0 END
      WHERE utc_month = (SELECT utc_month FROM jev_call_usage WHERE call_id = ${sqlString(callId)});
    UPDATE jev_call_usage
      SET settled_spend_usd = ${settled}, status = ${sqlString(safeStatus)}, input_tokens = ${Math.max(0, Math.trunc(inputTokens))}, output_tokens = ${Math.max(0, Math.trunc(outputTokens))}, settled_at = ${sqlString(nowIso)},
          settled_cost_basis = ${sqlString(safeBasis)},
          pricing_provider = ${pricing?.providerId ? sqlString(pricing.providerId) : 'NULL'},
          pricing_model = ${pricing?.modelRef ? sqlString(pricing.modelRef) : 'NULL'},
          pricing_effective_date = ${pricing?.effectiveDate ? sqlString(pricing.effectiveDate) : 'NULL'},
          pricing_source = ${pricing?.source ? sqlString(pricing.source) : 'NULL'},
          reservation_released_usd = ${releaseSql}
      WHERE call_id = ${sqlString(callId)} AND status = 'reserved';
    SELECT call_id, status, settled_spend_usd, input_tokens, output_tokens, settled_cost_basis, pricing_model, reservation_released_usd FROM jev_call_usage WHERE call_id = ${sqlString(callId)};
    COMMIT;
  `);
  return [...rows].reverse().find((row) => row.call_id === callId) ?? null;
}

export async function correctHistoricalCost({ utcMonth, modelRef, reason, now = new Date() }) {
  if (!/^\d{4}-\d{2}$/.test(utcMonth) || !reason || reason.length > 512) throw new TypeError('invalid cost correction request');
  const pricing = resolveJevPricing(modelRef);
  if (!pricing) throw new TypeError('pricing unavailable for requested model');
  await initializeLedger();
  const rows = await runSql(`SELECT call_id, projected_spend_usd, settled_spend_usd, status, input_tokens, output_tokens, settled_cost_basis FROM jev_call_usage WHERE utc_month = ${sqlString(utcMonth)} ORDER BY call_id;`);
  const settledRows = rows.filter((row) => row.status === 'settled');
  if (settledRows.some((row) => !Number.isInteger(row.input_tokens) || !Number.isInteger(row.output_tokens))) throw new Error('historical_usage_incomplete');
  const correctionId = deriveCostCorrectionId({ utcMonth, modelRef, callIds: settledRows.map((row) => row.call_id), reason });
  const existing = await runSql(`SELECT correction_id, old_settled_spend_usd, new_settled_spend_usd, difference_usd, reason FROM jev_cost_corrections WHERE correction_id = ${sqlString(correctionId)};`);
  if (existing[0]) return { outcome: 'already_corrected', correction: existing[0] };
  if (settledRows.some((row) => row.settled_cost_basis !== 'conservative_projection')) throw new Error('historical_cost_not_uniformly_conservative');
  const priced = settledRows.map((row) => {
    const calculated = calculateJevTokenCost({ modelRef, inputTokens: row.input_tokens, outputTokens: row.output_tokens });
    if (!calculated) throw new Error('historical_pricing_unavailable');
    return { ...row, calculated };
  });
  const oldTotal = Number(priced.reduce((sum, row) => sum + Number(row.settled_spend_usd ?? 0), 0).toFixed(6));
  const newTotal = Number(priced.reduce((sum, row) => sum + row.calculated.amountUsd, 0).toFixed(6));
  const difference = Number((newTotal - oldTotal).toFixed(6));
  const nowIso = new Date(now).toISOString();
  const updates = priced.map((row) => `UPDATE jev_call_usage SET settled_spend_usd = ${row.calculated.amountUsd}, settled_cost_basis = 'token_calculated', pricing_provider = ${sqlString(pricing.providerId)}, pricing_model = ${sqlString(pricing.modelRef)}, pricing_effective_date = ${sqlString(pricing.effectiveDate)}, pricing_source = ${sqlString(pricing.source)}, reservation_released_usd = MAX(0, projected_spend_usd - ${row.calculated.amountUsd}) WHERE call_id = ${sqlString(row.call_id)} AND status = 'settled';`).join('\n');
  await runSql(`
    BEGIN IMMEDIATE;
    ${updates}
    UPDATE jev_monthly_usage SET reconciled_spend_usd = (SELECT COALESCE(SUM(settled_spend_usd), 0) FROM jev_call_usage WHERE utc_month = ${sqlString(utcMonth)} AND status = 'settled'), pilot_reconciled_spend_usd = (SELECT COALESCE(SUM(settled_spend_usd), 0) FROM jev_call_usage WHERE utc_month = ${sqlString(utcMonth)} AND status = 'settled' AND calling_surface = 'brain'), updated_at = ${sqlString(nowIso)} WHERE utc_month = ${sqlString(utcMonth)};
    INSERT INTO jev_cost_corrections (correction_id, utc_month, old_settled_spend_usd, new_settled_spend_usd, difference_usd, reason, pricing_provider, pricing_model, pricing_effective_date, pricing_source, corrected_at)
      VALUES (${sqlString(correctionId)}, ${sqlString(utcMonth)}, ${oldTotal}, ${newTotal}, ${difference}, ${sqlString(reason)}, ${sqlString(pricing.providerId)}, ${sqlString(pricing.modelRef)}, ${sqlString(pricing.effectiveDate)}, ${sqlString(pricing.source)}, ${sqlString(nowIso)});
    COMMIT;
  `);
  return { outcome: 'corrected', correctionId, utcMonth, oldSettledSpendUsd: oldTotal, newSettledSpendUsd: newTotal, differenceUsd: difference, callCount: priced.length, pricing };
}

export function ledgerLocation() {
  return dbPath();
}
