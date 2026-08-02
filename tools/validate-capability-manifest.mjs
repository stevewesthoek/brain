import {loadJsonFile, validateCapabilityManifest} from './capability-manifest-utils.mjs';

export function validateFixtureSet(set, options = {}) {
  return validateCapabilityManifest(set.valid, options);
}

async function main() {
  const fixturePath = process.argv[2] ?? 'operations/fixtures/capability-manifest-fixtures-v1.json';
  const fixtureSet = loadJsonFile(fixturePath);
  const errors = validateFixtureSet(fixtureSet);
  if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`capability-manifest=pass capabilities=${fixtureSet.valid.capabilities.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

