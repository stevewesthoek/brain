import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocalAppsDashboard } from '../adapters/local-apps.js';
import { listLocalAppDefinitions } from '../adapters/local-app-orchestrator.js';

test('Fala is registered as a Brain Console local app', () => {
  const fala = listLocalAppDefinitions().find((app) => app.id === 'fala');

  assert.ok(fala, 'Fala should be registered in the canonical local app inventory');
  assert.equal(fala.name, 'Fala');
  assert.equal(fala.appPort, 3050);
  assert.equal(fala.appUrl, 'http://localhost:3050');
  assert.equal(fala.healthUrl, 'http://localhost:3050/api/health');
  assert.equal(fala.database?.engine, 'PostgreSQL');
  assert.equal(fala.database?.name, 'fala');
  assert.equal(fala.managed, true);
  assert.ok(fala.description.includes('Portuguese learning'));
});

test('Fala is visible in the Obsidian local-app dashboard payload', async () => {
  const dashboard = await readLocalAppsDashboard();
  const fala = dashboard.apps.find((app) => app.id === 'fala');

  assert.ok(fala, 'Fala should be included in the dashboard apps list');
  assert.equal(fala.name, 'Fala');
  assert.equal(fala.port, 3050);
  assert.equal(fala.url, 'http://localhost:3050');
  assert.equal(fala.source, 'infrastructure-config');
  assert.equal(fala.managed, true);
  assert.equal(fala.startSupported, true);
  assert.equal(fala.stopSupported, true);
});
