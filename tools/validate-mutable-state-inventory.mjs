#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const inventoryPath = path.join(root, 'operations/reports/b7-4-mutable-state-inventory-2026-07-17.json');

function main() {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
  const errors = [];
  if (inventory.inventoryVersion !== '1.0.0') errors.push('inventoryVersion must be 1.0.0');
  if (!Array.isArray(inventory.items) || inventory.items.length < 6) errors.push('inventory items must be non-empty');
  const requiredStates = new Set(['tracked source', 'packaged binary', 'mutable local state', 'generated cache', 'runtime state', 'secrets-adjacent file']);
  const seenStates = new Set();
  for (const [index, item] of (inventory.items ?? []).entries()) {
    for (const field of ['path', 'sizeBytes', 'trackingState', 'owner', 'regenerationSource', 'runtimeDependency', 'migrationRisk', 'recommendedDisposition']) {
      if (!(field in item)) errors.push(`item:${index}:missing:${field}`);
    }
    if (typeof item.path !== 'string' || item.path.length === 0 || item.path.startsWith('/') || item.path.includes('..')) errors.push(`item:${index}:invalid:path`);
    if (!Number.isInteger(item.sizeBytes) || item.sizeBytes < 0) errors.push(`item:${index}:invalid:sizeBytes`);
    if (typeof item.runtimeDependency !== 'boolean') errors.push(`item:${index}:invalid:runtimeDependency`);
    seenStates.add(item.trackingState);
  }
  for (const state of requiredStates) {
    if (!seenStates.has(state)) errors.push(`missing tracking state: ${state}`);
  }
  if (!Array.isArray(inventory.proposedIgnoreRules) || inventory.proposedIgnoreRules.length === 0) errors.push('proposedIgnoreRules must be non-empty');
  if (!Array.isArray(inventory.proposedMoveRules) || inventory.proposedMoveRules.length === 0) errors.push('proposedMoveRules must be non-empty');
  if (!Array.isArray(inventory.migrationRiskSummary) || inventory.migrationRiskSummary.length === 0) errors.push('migrationRiskSummary must be non-empty');

  if (errors.length > 0) {
    process.stdout.write(`inventory=fail\nerrors=${errors.length}\n`);
    for (const error of errors) process.stdout.write(`error=${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`inventory=pass\nitems=${inventory.items.length}\nresult=pass\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
