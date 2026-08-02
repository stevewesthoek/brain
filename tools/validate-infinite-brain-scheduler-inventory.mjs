#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '..');
const inventoryPath = path.join(root, 'operations/specs/infinite-brain-scheduler-inventory.json');
const schedulerPath = path.join(root, 'tools/scripts/office-nightly-scheduler.sh');
const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const scheduler = fs.readFileSync(schedulerPath, 'utf8');
const errors = [];
const allowedActivation = new Set(['configured', 'deployed', 'observed', 'verified', 'unknown']);
const allowedMindModes = new Set(['dry-run-report-only', 'report-only']);
const ids = new Set();

for (const job of inventory.jobs ?? []) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(job.id ?? '') || ids.has(job.id)) errors.push(`invalid or duplicate job id: ${job.id}`);
  ids.add(job.id);
  if (!Array.isArray(job.command) || job.command.length === 0 || !job.command.every(part => typeof part === 'string' && part.length > 0)) errors.push(`${job.id}: command must be a fixed non-empty string array`);
  if (!Number.isInteger(job.timeoutSeconds) || job.timeoutSeconds <= 0) errors.push(`${job.id}: timeoutSeconds is required`);
  for (const field of ['failureState', 'receipt', 'killSwitch', 'privilege', 'safeMode']) if (typeof job[field] !== 'string' || job[field].length === 0) errors.push(`${job.id}: ${field} is required`);
  if (!allowedActivation.has(job.externalActivation)) errors.push(`${job.id}: externalActivation is invalid`);
  if (job.externalActivation !== 'unknown') errors.push(`${job.id}: external activation cannot be inferred from repository configuration`);
  const entrypointPath = path.join(root, job.entrypoint ?? '');
  const entrypoint = fs.existsSync(entrypointPath) ? fs.readFileSync(entrypointPath, 'utf8') : '';
  const sourceText = `${scheduler}\n${entrypoint}`;
  if (!Array.isArray(job.sourceMarkers) || job.sourceMarkers.some(marker => !sourceText.includes(marker))) errors.push(`${job.id}: source markers do not match the repository scheduler or declared entrypoint`);
  if (job.privilege === 'mind-read-only' && !allowedMindModes.has(job.safeMode)) errors.push(`${job.id}: Mind job must be report-only or dry-run`);
  if (job.privilege === 'mind-write-capable' && job.safeMode !== 'disabled') errors.push(`${job.id}: Mind-write-capable job must be disabled`);
}
for (const required of ['mind-steward-dry-run', 'mind-compile-loop', 'graphify-nightly']) if (!ids.has(required)) errors.push(`missing required job: ${required}`);
if (/run_(stb_pipeline_batch|n8n_backup|claude_session_cleanup|dance_of_life_sync|gemini_cleanup|google_ads_sync|gws_token_refresh|video_orchestrator_storage_cleanup|memory_context_refresh|graphify_nightly|ing_bank_statement_download|skill_prune) \|\|/.test(scheduler)) errors.push('unsafe scheduler branch remains active');
if (!scheduler.includes('bash %q --mode=report-only >> %q 2>&1')) errors.push('Mind compile loop is not pinned to report-only mode');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`scheduler-inventory-valid jobs=${inventory.jobs.length} external_activation=unknown`);
