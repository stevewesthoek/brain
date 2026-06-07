import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

/**
 * Hook/Watch Disabled Readiness Test Suite
 *
 * Validates that Graphify hook and watch functionality remains disabled
 * by default across all profile examples. This is a safety gate that proves
 * continuous execution is blocked until explicitly enabled.
 */

const SCHEMA_PATH = './operations/specs/graphify-profile.schema.json';
const EXAMPLES_PATH = './operations/specs/graphify-profile.examples.json';

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function testProfileSchemaHookWatchDisabled() {
  const schema = loadJSON(SCHEMA_PATH);

  // Verify hookPolicy schema requires enabled=false
  const hookPolicy = schema.$defs.hookPolicy;
  assert.strictEqual(
    hookPolicy.properties.enabled.const,
    false,
    'Schema hookPolicy.enabled must have const=false'
  );
  assert.strictEqual(
    hookPolicy.properties.postCommit.const,
    false,
    'Schema hookPolicy.postCommit must have const=false'
  );
  assert.strictEqual(
    hookPolicy.properties.postCheckout.const,
    false,
    'Schema hookPolicy.postCheckout must have const=false'
  );

  // Verify watchPolicy schema requires enabled=false
  const watchPolicy = schema.$defs.watchPolicy;
  assert.strictEqual(
    watchPolicy.properties.enabled.const,
    false,
    'Schema watchPolicy.enabled must have const=false'
  );

  console.log('✓ Schema hook/watch policies require enabled=false');
}

function testProfileExamplesHookWatchDisabled() {
  const examples = loadJSON(EXAMPLES_PATH);

  for (const [name, profile] of Object.entries(examples.examples || {})) {
    const hooks = profile.hooks || {};
    assert.strictEqual(
      hooks.enabled,
      false,
      `Example '${name}' must have hooks.enabled=false, got ${hooks.enabled}`
    );
    assert.strictEqual(
      hooks.postCommit,
      false,
      `Example '${name}' must have hooks.postCommit=false, got ${hooks.postCommit}`
    );
    assert.strictEqual(
      hooks.postCheckout,
      false,
      `Example '${name}' must have hooks.postCheckout=false, got ${hooks.postCheckout}`
    );

    const watch = profile.watch || {};
    assert.strictEqual(
      watch.enabled,
      false,
      `Example '${name}' must have watch.enabled=false, got ${watch.enabled}`
    );
  }

  console.log(`✓ All ${Object.keys(examples.examples || {}).length} profile examples have hook/watch disabled`);
}

function testSchemaHookWatchAreOptional() {
  const schema = loadJSON(SCHEMA_PATH);

  // hooks and watch should NOT be in required fields
  const requiredFields = schema.required || [];
  assert(!requiredFields.includes('hooks'), 'hooks should not be required (can be omitted)');
  assert(!requiredFields.includes('watch'), 'watch should not be required (can be omitted)');

  // But if provided, they should enforce disabled state
  const hookDefault = schema.properties.hooks.default;
  assert.strictEqual(hookDefault.enabled, false, 'hooks default must have enabled=false');

  const watchDefault = schema.properties.watch.default;
  assert.strictEqual(watchDefault.enabled, false, 'watch default must have enabled=false');

  console.log('✓ Hook/watch fields are optional but default to disabled');
}

async function runAllTests() {
  try {
    testProfileSchemaHookWatchDisabled();
    testProfileExamplesHookWatchDisabled();
    testSchemaHookWatchAreOptional();

    console.log('\n✅ All hook/watch readiness tests passed');
    console.log('\nConclusion: Hook and watch execution remains disabled by default.');
    console.log('No repository will enable hooks/watch without explicit feature flag and approval.');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Hook/watch readiness test failed:', error.message);
    process.exit(1);
  }
}

runAllTests();
