#!/usr/bin/env node

import { runExactSourceFixture } from '../execute-b8-1-benchmark.mjs';

function readArg(name) {
  const direct = process.argv.find(arg => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

try {
  const fixtureBase64 = readArg('--fixture-base64');
  const sourcesDir = readArg('--sources-dir');
  if (!fixtureBase64 || !sourcesDir) throw new Error('fixture and sources directory are required');
  const fixture = JSON.parse(Buffer.from(fixtureBase64, 'base64url').toString('utf8'));
  const result = runExactSourceFixture(fixture, sourcesDir);
  process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`exact-source worker failed: ${error.message}\n`);
  process.exitCode = 2;
}
