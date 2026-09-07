#!/usr/bin/env node

import { createMacOSKeychainAdapter } from './macos-keychain-adapter.mjs';

if (process.argv.length !== 2) {
  console.error('keychain-inventory=fail reason=no-arguments-accepted');
  process.exit(2);
}

try {
  const adapter = createMacOSKeychainAdapter();
  const [description, inventory] = await Promise.all([
    Promise.resolve(adapter.describe()),
    adapter.inspectNamespace(),
  ]);
  console.log(JSON.stringify({
    adapterId: description.adapterId,
    physicalStore: description.physicalStore,
    serviceNamespace: description.serviceNamespace,
    hostScope: description.hostScope,
    synchronization: description.synchronization,
    storageState: inventory.storageState ?? 'unknown',
    count: inventory.count ?? 0,
    items: inventory.items ?? [],
    containsSecrets: false,
    secretValueReturned: false,
  }));
  process.exitCode = inventory.ok === true ? 0 : 1;
} catch (error) {
  const reason = error instanceof Error ? error.message.replace(/[\\r\\n]/g, ' ').slice(0, 300) : 'unknown';
  console.error('keychain-inventory=fail reason=' + reason);
  process.exitCode = 1;
}
