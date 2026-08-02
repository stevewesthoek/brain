import {loadJsonFile, validateCapabilityManifest} from './capability-manifest-utils.mjs';

export function validateCapabilityInventory(inventory, options = {}) {
  return validateCapabilityManifest(inventory, {runEvidence: true, ...options});
}

async function main() {
  const inventoryPath = process.argv[2] ?? 'operations/specs/infinite-brain-capabilities.json';
  const inventory = loadJsonFile(inventoryPath);
  const errors = validateCapabilityInventory(inventory);
  if (errors.length) {
    process.stderr.write(`${errors.join('\n')}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`capability-inventory=pass capabilities=${inventory.capabilities.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

