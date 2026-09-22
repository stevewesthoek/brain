#!/usr/bin/env node

import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { createMacOSKeychainAdapter } from '../infrastructure-identity-access/macos-keychain-adapter.mjs';
import { JEV_KEYCHAIN_REFERENCE, monthUtc, sanitizeProviderResult, sha256, validateJevRequest } from './jev-contract.mjs';
import { correctHistoricalCost, initializeLedger, ledgerLocation, readBudget, reconcileBudget, reserveBudget } from './jev-ledger.mjs';
import { calculateJevTokenCost, estimateJevReservation, resolveJevPricing } from './jev-pricing.mjs';

const execFileAsync = promisify(execFile);
const BRIDGE_DIR = import.meta.dirname;
const BOUNDARY = path.join(BRIDGE_DIR, 'macos-keychain-request-boundary.swift');
const REQUESTER = path.join(BRIDGE_DIR, 'typesafe-request.mjs');
const ENROLLER = path.join(BRIDGE_DIR, 'macos-keychain-enroll-typesafe.swift');
const NODE = process.execPath;

function output(payload) {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}

function safeError(error) {
  const code = error?.code;
  return code === 'ENOENT' ? 'bridge_dependency_missing' : 'provider_request_failed';
}

function costFrom({ providerCostUsd, model, usage, projectedSpendUsd }) {
  if (typeof providerCostUsd === 'number' && Number.isFinite(providerCostUsd) && providerCostUsd >= 0 && providerCostUsd <= 10) {
    return { amountUsd: Number(providerCostUsd.toFixed(6)), basis: 'provider_reported', pricing: null };
  }
  return calculateJevTokenCost({ modelRef: model, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens })
    ?? { amountUsd: projectedSpendUsd, basis: 'conservative_projection', pricing: null };
}

function parseCli(argv) {
  const [group, action, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    if (rest[index].startsWith('--')) options[rest[index].slice(2)] = rest[index + 1] ?? true;
  }
  return { group, action, options };
}

export function createJevBridge({ inspectReference, invokeBoundedRequest, now = () => new Date() } = {}) {
  const keychain = createMacOSKeychainAdapter();
  const inspect = inspectReference ?? ((reference) => keychain.inspectReference(reference));
  const invoke = invokeBoundedRequest ?? (async (request) => {
    const args = [BOUNDARY, 'com.brain.typesafe', 'jev.api-key.v1', NODE, JSON.stringify([REQUESTER, JSON.stringify(request)])];
    const result = await execFileAsync('/usr/bin/swift', args, { cwd: '/', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: os.homedir(), USER: process.env.USER ?? '' }, encoding: 'utf8', maxBuffer: 128 * 1024, timeout: 120_000 });
    return JSON.parse(String(result.stdout).trim());
  });

  return Object.freeze({
    async status() {
      const budget = await readBudget(now());
      const credential = await inspect(JEV_KEYCHAIN_REFERENCE);
      return Object.freeze({
        ok: credential?.storageState === 'present',
        credential: { reference: JEV_KEYCHAIN_REFERENCE, storageState: credential?.storageState ?? 'unknown', diagnosticCode: credential?.diagnosticCode ?? 'unknown', containsSecrets: false },
        budget: { utcMonth: budget.utc_month, monthlyLimitUsd: budget.monthly_limit_usd, reservedSpendUsd: budget.reserved_spend_usd, reconciledSpendUsd: budget.reconciled_spend_usd, remainingUsd: Math.max(0, budget.monthly_limit_usd - budget.reserved_spend_usd - budget.reconciled_spend_usd), pilotLimitUsd: budget.pilot_limit_usd, pilotReservedSpendUsd: budget.pilot_reserved_spend_usd, pilotReconciledSpendUsd: budget.pilot_reconciled_spend_usd, pilotRemainingUsd: Math.max(0, budget.pilot_limit_usd - budget.pilot_reserved_spend_usd - budget.pilot_reconciled_spend_usd), calls: budget.calls, inputTokens: budget.input_tokens, outputTokens: budget.output_tokens, ledger: ledgerLocation() },
        provider: { providerId: 'typesafe', model: 'jev-latest', networkProbe: 'not_performed', pricing: resolveJevPricing('jev-latest') },
        containsSecrets: false,
      });
    },
    async decide(input, { callingSurface = 'brain' } = {}) {
      const startedAt = Date.now();
      const validated = validateJevRequest(input, { callingSurface });
      if (!validated.ok) return validated;
      const credential = await inspect(JEV_KEYCHAIN_REFERENCE);
      if (credential?.storageState !== 'present') return Object.freeze({ ok: false, reasonCode: 'CREDENTIAL_MISSING', credentialState: credential?.storageState ?? 'unknown', containsSecrets: false });
      const callId = `jev-call-${sha256({ request: validated.request, callingSurface }).slice(0, 32)}`;
      const reservation = estimateJevReservation({ request: validated.request });
      const projectedSpendUsd = reservation?.amountUsd ?? 0.01;
      const budgetReservation = await reserveBudget({ callId, projectedSpendUsd, callingSurface, now: now() });
      if (budgetReservation.outcome === 'existing') return Object.freeze({ ok: false, reasonCode: 'JEV_CALL_ALREADY_SETTLED', callId, latencyMs: Date.now() - startedAt, containsSecrets: false });
      if (!budgetReservation.ok) return Object.freeze({ ok: false, reasonCode: 'JEV_BUDGET_EXHAUSTED', budget: budgetReservation, latencyMs: Date.now() - startedAt, containsSecrets: false });
      let raw;
      try {
        raw = await invoke(validated.request);
      } catch (error) {
        await reconcileBudget({ callId, settledSpendUsd: 0, status: 'released', costBasis: 'conservative_projection', now: now() });
        return Object.freeze({ ok: false, reasonCode: safeError(error), callId, latencyMs: Date.now() - startedAt, containsSecrets: false });
      }
      const result = sanitizeProviderResult(raw, { expectedQuestion: validated.request.question, expectedQuestions: validated.request.questions });
      if (!result) {
        await reconcileBudget({ callId, settledSpendUsd: 0, status: 'released', costBasis: 'conservative_projection', now: now() });
        return Object.freeze({ ok: false, reasonCode: 'PROVIDER_RESPONSE_REJECTED', callId, latencyMs: Date.now() - startedAt, containsSecrets: false });
      }
      const cost = costFrom({ providerCostUsd: result.providerCostUsd, model: result.model, usage: result.usage, projectedSpendUsd });
      const settled = await reconcileBudget({ callId, settledSpendUsd: cost.amountUsd, inputTokens: result.usage.input_tokens, outputTokens: result.usage.output_tokens, status: 'settled', costBasis: cost.basis, pricing: cost.pricing, now: now() });
      return Object.freeze({ ok: true, schemaVersion: 'brain-jev.response.v1', callId, model: result.model, answer: result.answer, answers: result.answers, usage: result.usage, cost, budget: { utcMonth: monthUtc(now()), settledSpendUsd: settled?.settled_spend_usd ?? cost.amountUsd }, latencyMs: Date.now() - startedAt, containsSecrets: false, secretValueReturned: false });
    },
  });
}

async function provision() {
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/bin/swift', [ENROLLER], { cwd: '/', env: { PATH: '/usr/bin:/bin:/usr/sbin:/sbin', HOME: os.homedir(), USER: process.env.USER ?? '' }, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code !== 0) return reject(new Error('enrollment_failed'));
      resolve({ ok: true, reference: JEV_KEYCHAIN_REFERENCE, containsSecrets: false, secretValueReturned: false });
    });
  });
}

async function main(argv = process.argv.slice(2)) {
  const { group, action, options } = parseCli(argv);
  const bridge = createJevBridge();
  if (group !== 'jev') throw new Error('usage: brain-jev jev <status|provision|decide|audit-cost>');
  if (action === 'status') return bridge.status();
  if (action === 'provision') return provision();
  if (action === 'audit-cost') {
    if (typeof options.month !== 'string' || typeof options.model !== 'string' || typeof options.reason !== 'string') return { ok: false, reasonCode: 'INVALID_COST_CORRECTION', containsSecrets: false };
    return correctHistoricalCost({ utcMonth: options.month, modelRef: options.model, reason: options.reason });
  }
  if (action === 'decide') {
    if (typeof options['request-json'] !== 'string') return { ok: false, reasonCode: 'INVALID_REQUEST', message: '--request-json is required' };
    let request;
    try { request = JSON.parse(options['request-json']); } catch { return { ok: false, reasonCode: 'INVALID_REQUEST', message: 'request JSON is invalid' }; }
    return bridge.decide(request, { callingSurface: typeof options.surface === 'string' ? options.surface : 'brain' });
  }
  throw new Error('usage: brain-jev jev <status|provision|decide|audit-cost>');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { output(await main()); } catch (error) { output({ ok: false, reasonCode: safeError(error), containsSecrets: false }); process.exitCode = 1; }
}

export { main };
