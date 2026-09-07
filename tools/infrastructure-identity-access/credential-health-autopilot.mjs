#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runCredentialHealthEvaluation } from './credential-health-orchestrator.mjs';
import { buildAutopilotSnapshot, writeAutopilotSnapshot } from './credential-autopilot-core.mjs';

const root = path.resolve(process.env.BRAIN_CREDENTIAL_VAULT_ROOT ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--notify')) {
  console.error(JSON.stringify({ ok: false, reasonCode: 'invalid_arguments', containsSecrets: false, secretValueReturned: false }));
  process.exit(2);
}
const notify = args.includes('--notify');

try {
  const health = await runCredentialHealthEvaluation({ root, notify });
  const snapshot = buildAutopilotSnapshot({ root, now: health.generatedAt, health });
  const statePath = writeAutopilotSnapshot({ root, snapshot });
  console.log(JSON.stringify({
    ok: true,
    command: 'credential-health-autopilot',
    statePath,
    activation: snapshot.activation,
    discovery: snapshot.discovery.counts,
    health: health.summary,
    expiryCount: snapshot.expiry.length,
    rotationCount: snapshot.rotation.length,
    hostCount: snapshot.hosts.length,
    applicationAuthCount: snapshot.applicationAuth.length,
    containsSecrets: false,
    secretValueReturned: false,
  }));
} catch (error) {
  console.error(JSON.stringify({ ok: false, reasonCode: 'credential_health_autopilot_failed', message: error instanceof Error ? error.message.replace(/[\r\n]/g, ' ').slice(0, 300) : 'unknown', containsSecrets: false, secretValueReturned: false }));
  process.exitCode = 1;
}
