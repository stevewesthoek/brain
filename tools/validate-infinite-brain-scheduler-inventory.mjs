#!/usr/bin/env node

// Compatibility entrypoint for older conformance callers. The typed Brain
// Scheduler registry is the only inventory authority now.
import { loadAndValidateRegistry } from './scheduler/registry.mjs';

try {
  const { registry } = loadAndValidateRegistry({ checkEntrypoints: true });
  console.log(`scheduler-inventory-valid compatibility=typed-registry jobs=${registry.jobs.length} external_activation=unknown`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
