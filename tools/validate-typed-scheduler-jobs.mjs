#!/usr/bin/env node
import process from 'node:process';
import path from 'node:path';
import { loadAndValidateRegistry } from './scheduler/registry.mjs';

const root = path.resolve(import.meta.dirname, '..');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};

try {
  const { registry, manifestPath } = loadAndValidateRegistry({
    manifestPath: argument('--manifest', undefined),
    schemaPath: argument('--schema', undefined),
    rootDir: root,
    checkEntrypoints: true,
  });
  const counts = Object.fromEntries(['active', 'manual-only', 'policy-blocked', 'disabled', 'deprecated'].map((lifecycle) => [lifecycle, registry.jobs.filter((job) => job.lifecycle === lifecycle).length]));
  console.log(`typed-scheduler-jobs-valid jobs=${registry.jobs.length} manifest=${manifestPath} lifecycle=${JSON.stringify(counts)}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
