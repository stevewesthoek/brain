#!/usr/bin/env node

import { runCredentialHealthEvaluation } from './credential-health-orchestrator.mjs';

const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--notify')) {
  console.error('credential-health=fail reason=only-allowed-argument-is---notify');
  process.exit(2);
}
try {
  const result = await runCredentialHealthEvaluation({ notify: args.includes('--notify') });
  console.log(JSON.stringify({
    schemaVersion: result.schemaVersion,
    generatedAt: result.generatedAt,
    policyCatalogVersion: result.policyCatalogVersion,
    summary: result.summary,
    containsSecrets: false,
  }));
} catch (error) {
  console.error(`credential-health=fail reason=${error instanceof Error ? error.message.replace(/[\r\n]/g, ' ').slice(0, 300) : 'unknown'}`);
  process.exitCode = 1;
}
