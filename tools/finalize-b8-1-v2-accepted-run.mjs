#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { verifyPlan } from './lib/b8-1-v2-plan-digest.mjs';
import { validateEvidenceObjects } from './validate-b8-1-v2-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EVIDENCE_SCHEMA_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json');
const MANIFEST_PATH = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');
const FINAL_DIR = path.join(ROOT, 'operations/reports/b8-1-v2-evidence');

const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });

function parseArgs() {
  return Object.fromEntries(process.argv.slice(2).map(arg => {
    const index = arg.indexOf('=');
    if (index < 0) return [arg.replace(/^--/, ''), true];
    return [arg.slice(2, index), arg.slice(index + 1)];
  }));
}

export function validateRecoveryAuthorization({ plan, authorizedPlanSha256, authorizedRunId }) {
  const errors = [];
  const planValidation = verifyPlan(plan);
  if (!planValidation.valid) errors.push(...planValidation.errors);
  if (!authorizedPlanSha256 || plan.planSha256 !== authorizedPlanSha256) errors.push('authorized plan digest mismatch');
  if (!authorizedRunId || plan.runId !== authorizedRunId) errors.push('authorized run id mismatch');
  return { valid: errors.length === 0, errors };
}

export function buildFinalEvidence(evidence, plan, removedAt) {
  return {
    ...evidence,
    cleanupStatus: {
      removed: true,
      runDirectory: plan.plannedCanonicalRunPath,
      removedAt,
    },
  };
}

async function main() {
  const options = parseArgs();
  if (!options.plan || !options['authorized-plan-sha256'] || !options['authorized-run-id']) {
    throw new Error('required: --plan=<path> --authorized-plan-sha256=<digest> --authorized-run-id=<run-id>');
  }

  const planPath = path.resolve(ROOT, options.plan);
  if (!planPath.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(planPath)) throw new Error('plan path must exist inside repository');
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  const auth = validateRecoveryAuthorization({ plan, authorizedPlanSha256: options['authorized-plan-sha256'], authorizedRunId: options['authorized-run-id'] });
  if (!auth.valid) throw new Error(`recovery authorization invalid: ${auth.errors.join('; ')}`);

  const runDir = path.resolve(plan.plannedCanonicalRunPath);
  const evidencePath = path.join(runDir, 'evidence.json');
  const preflightReceiptPath = path.join(runDir, 'preflight-receipt.json');
  if (!fs.existsSync(runDir) || !fs.existsSync(evidencePath) || !fs.existsSync(preflightReceiptPath)) throw new Error('accepted run artifacts are incomplete or absent');

  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
  const receipt = JSON.parse(fs.readFileSync(preflightReceiptPath, 'utf8'));
  if (receipt.runId !== plan.runId || receipt.planSha256 !== plan.planSha256 || receipt.authorizedPlanSha256 !== plan.planSha256 || receipt.authorizedRunId !== plan.runId) throw new Error('preflight receipt is not bound to approved plan/run');
  if (evidence.runId !== plan.runId || evidence.planSha256 !== plan.planSha256) throw new Error('evidence identity mismatch');
  if (evidence.acceptanceSummary?.allGatesPassed !== true || evidence.acceptanceSummary?.passingRuns !== evidence.acceptanceSummary?.requiredPassingRuns || (evidence.violations ?? []).length !== 0) throw new Error('run evidence is not an accepted zero-violation result');
  if (evidence.cleanupStatus?.removed !== false || evidence.cleanupStatus?.runDirectory !== plan.plannedCanonicalRunPath) throw new Error('run is not in the expected pre-cleanup finalization state');

  const finalEvidence = buildFinalEvidence(evidence, plan, new Date().toISOString());
  const schema = JSON.parse(fs.readFileSync(EVIDENCE_SCHEMA_PATH, 'utf8'));
  const schemaValidate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  if (!schemaValidate(finalEvidence)) throw new Error(`final evidence schema invalid: ${JSON.stringify(schemaValidate.errors)}`);
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const preCleanupValidation = validateEvidenceObjects({ evidence: finalEvidence, plan, manifest, preflightReceiptPath, checkFilesystem: false });
  if (!preCleanupValidation.valid) throw new Error(`final evidence contract invalid before cleanup: ${preCleanupValidation.errors.join('; ')}`);

  fs.mkdirSync(FINAL_DIR, { recursive: true, mode: 0o700 });
  const finalEvidencePath = path.join(FINAL_DIR, 'b8-1-v2-canonical-evidence.json');
  const finalReceiptPath = path.join(FINAL_DIR, 'preflight-receipt.json');
  const rawEvidenceSha256 = sha256(evidencePath);
  writeJson(finalEvidencePath, finalEvidence);
  fs.copyFileSync(preflightReceiptPath, finalReceiptPath);

  fs.rmSync(runDir, { recursive: true, force: true });
  if (fs.existsSync(runDir)) throw new Error('canonical run directory cleanup failed');

  const postCleanupValidation = validateEvidenceObjects({ evidence: finalEvidence, plan, manifest, preflightReceiptPath: finalReceiptPath, checkFilesystem: true });
  if (!postCleanupValidation.valid) throw new Error(`final evidence contract invalid after cleanup: ${postCleanupValidation.errors.join('; ')}`);

  writeJson(path.join(FINAL_DIR, 'disposition.json'), {
    runId: plan.runId,
    contractVersion: plan.contractVersion,
    disposition: 'ACCEPTED',
    evidencePath: finalEvidencePath,
    preflightReceiptPath: finalReceiptPath,
    planDigest: plan.planSha256,
    completedAt: new Date().toISOString(),
    passingRuns: finalEvidence.acceptanceSummary.passingRuns,
    requiredPassingRuns: finalEvidence.acceptanceSummary.requiredPassingRuns,
    recovery: {
      reason: 'post-acceptance cleanup metadata finalization',
      rawEvidenceSha256,
      benchmarkRerun: false,
    },
  });

  console.log('B8.1 accepted run finalized without benchmark rerun');
  console.log(`runId=${plan.runId}`);
  console.log(`planSha256=${plan.planSha256}`);
  console.log(`evidence=${finalEvidencePath}`);
}

const IS_MAIN = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (IS_MAIN) main().catch(error => { console.error(error.stack ?? error.message); process.exitCode = 1; });
