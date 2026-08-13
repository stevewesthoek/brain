import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

/**
 * Graphify continuous-execution readiness gate.
 *
 * The old hook/watch schema/examples were removed when B8.5 replaced continuous
 * structural Graphify with a bounded event-driven semantic gate. This test now
 * validates the current canonical profile directly.
 */

const PROFILE_PATH = './operations/specs/graphify-operational-profile.json';
const SCHEDULER_PATH = './tools/scripts/office-nightly-scheduler.sh';
const LEGACY_PATH = './tools/scripts/graphify-nightly.sh';

const profile = JSON.parse(readFileSync(PROFILE_PATH, 'utf8'));
const scheduler = readFileSync(SCHEDULER_PATH, 'utf8');
const legacy = readFileSync(LEGACY_PATH, 'utf8');

assert.strictEqual(profile.execution.automaticFullScan, false, 'automatic full scan must remain disabled');
assert.strictEqual(profile.execution.runnerMode, 'explicit-only', 'semantic runner must remain explicit-only');
assert.strictEqual(profile.execution.codeOnlyInvokeRunner, false, 'code-only changes must not invoke a runner');
assert.strictEqual(profile.execution.structuralGraphGeneration, 'frozen', 'structural Graphify must remain frozen');
assert.strictEqual(profile.execution.schedulerMode, 'event-driven-semantic-gate', 'scheduler must remain event-gated');
assert.strictEqual(profile.safety.externalOrLocalModelRequired, false, 'Graphify must not require a model runtime');
assert.strictEqual(profile.corpus.mindApproved, false, 'Mind semantic scope must remain disabled');
assert.match(scheduler, /graphify-semantic-event\.mjs/, 'Office scheduler must call the semantic event gate');
assert.match(legacy, /GRAPHIFY_CONTAINED_EXECUTION/, 'legacy containment marker must remain documented');
assert.match(legacy, /exit 78/, 'legacy structural entrypoint must remain fail-closed');
assert.doesNotMatch(legacy.toLowerCase(), /ollama serve|mtplx serve|launchctl kickstart|launchctl load/, 'legacy runner must not auto-start local inference');

console.log('✅ Graphify continuous execution remains disabled; bounded semantic event gating is canonical.');
