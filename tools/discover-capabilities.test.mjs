import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCapabilityInventory,
  discover,
  parseSkillFrontmatter,
} from './discover-capabilities.mjs';

test('natural-language Stripe request resolves the skill and CLI without MCP', () => {
  const matches = discover('inspect Stripe subscriptions', { limit: 20 });
  const ids = new Set(matches.map((record) => record.id));

  assert.ok(ids.has('skill.stripe'));
  assert.ok(ids.has('cli.stripe'));
  assert.equal(ids.has('mcp.codex-plugin.stripe'), false);
  assert.equal(matches.find((record) => record.id === 'cli.stripe')?.available, true);
  assert.equal(matches.find((record) => record.id === 'cli.stripe')?.runbook, 'operations/runbooks/stripe-cli.md');
});

test('inventory includes all source classes without overwriting duplicate names', () => {
  const inventory = buildCapabilityInventory();
  const skills = inventory.capabilities.filter((record) => record.kind === 'skill');
  const cloudflare = skills.filter((record) => record.name === 'cloudflare');

  assert.ok(skills.length >= 100);
  assert.equal(cloudflare.length, 2);
  assert.ok(cloudflare.some((record) => record.id === 'skill.cloudflare'));
  assert.ok(cloudflare.some((record) => record.id === 'skill.cloudflare.vendor'));
});

test('frontmatter parser handles folded and literal multiline descriptions', () => {
  const folded = parseSkillFrontmatter('---\nname: example\ndescription: >\n  first line\n  second line\n---\n');
  const literal = parseSkillFrontmatter('---\nname: example\ndescription: |\n  first line\n  second line\n---\n');

  assert.equal(folded.name, 'example');
  assert.equal(folded.description, 'first line second line');
  assert.equal(literal.description, 'first line second line');
});
