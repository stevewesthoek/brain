#!/usr/bin/env node
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAndValidateWorkstationConfigOwnership } from './lib/workstation-config-ownership.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SPEC = path.join(ROOT, 'operations/specs/workstation-config-ownership.json');

try {
  const result = loadAndValidateWorkstationConfigOwnership(SPEC, { repoRoot: ROOT });
  console.log(`workstation-config-ownership=valid version=${result.specVersion} runtimeRoots=${result.runtimeRoots} managedEntries=${result.managedEntries} forbiddenWholeRoots=${result.forbiddenWholeRootSymlinks} sshAliases=${result.sshAliases.join(',')}`);
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
