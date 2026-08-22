#!/usr/bin/env node
import process from 'node:process';

import {
  readInfrastructureBackups,
  readInfrastructureCredentialStatus,
  readInfrastructureDoctor,
  readInfrastructureHealth,
  readInfrastructureIncidents,
  readInfrastructureResource,
  readInfrastructureStatus,
} from '../projects/brain-core/src/adapters/infrastructure-plane.mjs';

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function usage() {
  return [
    'Usage:',
    '  prochat infra status',
    '  prochat infra health',
    '  prochat infra incidents',
    '  prochat infra backups',
    '  prochat infra credentials',
    '  prochat infra inspect <resource-id>',
    '  prochat infra doctor',
    '',
    'All infrastructure commands are read-only and consume the canonical IKHP catalog/runtime projection.',
  ].join('\n');
}

export function runProchatCli(argv = process.argv.slice(2)) {
  const [domain, command, resourceId, ...extra] = argv;
  if (domain !== 'infra' || extra.length > 0) {
    throw new Error(usage());
  }

  switch (command) {
    case 'status':
      return readInfrastructureStatus();
    case 'health':
      return readInfrastructureHealth();
    case 'incidents':
      return readInfrastructureIncidents();
    case 'backups':
      return readInfrastructureBackups();
    case 'credentials':
      return readInfrastructureCredentialStatus();
    case 'inspect': {
      if (!resourceId) throw new Error(`resource-id is required\n${usage()}`);
      const resource = readInfrastructureResource(resourceId);
      if (!resource) throw new Error(`Infrastructure resource not found: ${resourceId}`);
      return resource;
    }
    case 'doctor':
      return readInfrastructureDoctor();
    default:
      throw new Error(usage());
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    print(runProchatCli());
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
