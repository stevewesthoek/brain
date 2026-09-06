import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  HANDOFF_KIND,
  HANDOFF_SCHEMA_VERSION,
  PROFILE_SPECS,
  processCategory,
} from './codex-identity-lifecycle-handoff.mjs';

test('process gate classifies native Codex surfaces and excludes WebGPT', () => {
  assert.equal(processCategory('/Applications/ChatGPT.app/Contents/MacOS/ChatGPT'), 'native_chatgpt_application');
  assert.equal(processCategory('/Applications/ChatGPT Classic.app/Contents/MacOS/ChatGPT Classic'), 'native_chatgpt_application');
  assert.equal(processCategory('/opt/homebrew/bin/codex app-server'), 'native_codex_app_server');
  assert.equal(processCategory('/Users/Office/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService'), 'native_computer_use_service');
  assert.equal(processCategory('/Users/Office/.codex/plugins/cache/openai-bundled/unified-computer-use/26.901/scripts/launch.mjs'), 'native_computer_use_service');
  assert.equal(processCategory('/Applications/Codex Web GPT.app/Contents/MacOS/Codex Web GPT'), null);
  assert.equal(processCategory('/Users/Office/.codex-chatgpt-web/versions/5.0.3/app/browser-helper.cjs'), null);
});

test('handoff profile collection is generic metadata with stable account semantics', () => {
  assert.equal(PROFILE_SPECS.length, 2);
  assert.deepEqual(PROFILE_SPECS.map((profile) => profile.preferred), [true, false]);
  assert.deepEqual(PROFILE_SPECS.map((profile) => profile.role), ['primary', 'secondary']);
  const serialized = JSON.stringify({ schemaVersion: HANDOFF_SCHEMA_VERSION, kind: HANDOFF_KIND, profiles: PROFILE_SPECS });
  assert.doesNotMatch(serialized, /@/);
  assert.doesNotMatch(serialized, /access[_-]?token|refresh[_-]?token|password|cookie/i);
});

test('handoff schema is present and requires secret exclusion', () => {
  const schema = JSON.parse(fs.readFileSync(new URL('../operations/specs/codex-identity-lifecycle-handoff-v1.schema.json', import.meta.url), 'utf8'));
  assert.equal(schema.properties.schemaVersion.const, HANDOFF_SCHEMA_VERSION);
  assert.equal(schema.properties.kind.const, HANDOFF_KIND);
  assert.equal(schema.properties.containsSecrets.const, false);
  assert.ok(schema.required.includes('expectedMainSha'));
  assert.ok(schema.required.includes('expectedOriginMainSha'));
  assert.ok(schema.required.includes('processAbsencePredicates'));
  assert.ok(schema.required.includes('webGptPolicy'));
});
