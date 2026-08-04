import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { AUTHORIZATION_ID, runContainedMindGraphify } from './run-contained-mind-graphify.mjs';

function write(file, content, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, mode ? { mode } : undefined);
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' }).trim();
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brain-contained-graphify-'));
  const mind = path.join(root, 'mind');
  const brain = path.join(root, 'brain');
  fs.mkdirSync(mind);
  fs.mkdirSync(brain);
  git(mind, ['init', '-q']);
  git(mind, ['config', 'user.email', 'test@example.com']);
  git(mind, ['config', 'user.name', 'Test']);
  write(path.join(mind, 'system', 'current.md'), '# Current\n## State\n');
  write(path.join(mind, 'tools', 'check.mjs'), 'export const check = true;\n');
  write(path.join(mind, '.obsidian', 'plugins', 'unsafe', 'main.js'), 'plugin internals\n');
  write(path.join(mind, 'archive', 'old.md'), '# Old\n');
  write(path.join(mind, 'assets', 'binary.png'), Buffer.from([0, 1, 2]));
  git(mind, ['add', '.']);
  git(mind, ['commit', '-qm', 'fixture']);
  const fake = path.join(root, 'graphify');
  write(fake, `#!/usr/bin/env node
const fs = require('node:fs'); const path = require('node:path');
if (process.argv[2] === '--version') { console.log('graphify 9.9.9'); process.exit(0); }
const corpus = process.argv[3]; const out = path.join(corpus, 'graphify-out'); fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(process.cwd(), '.graphify-run.lock'), 'staging only');
const nodes=[]; const links=[]; function walk(dir){ for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name); if(e.isDirectory()) walk(p); else if(!p.includes('graphify-out')){const rel=path.relative(corpus,p).replaceAll('\\\\','/'); nodes.push({id:rel,label:e.name,source_file:rel});}}} walk(corpus);
if(nodes.length>1) links.push({source:nodes[0].id,target:nodes[1].id,relation:'contains',source_file:nodes[0].source_file});
fs.writeFileSync(path.join(out,'graph.json'), JSON.stringify({nodes,links}));
`, 0o755);
  const digest = crypto.createHash('sha256').update(fs.readFileSync(fake)).digest('hex');
  const profilePath = path.join(root, 'profiles.json');
  const base = JSON.parse(fs.readFileSync(path.resolve('operations/specs/graphify-operational-profiles.json'), 'utf8'));
  const profile = base.profiles.find((item) => item.profileId === 'graphify-mind-knowledge');
  profile.generator.version = '9.9.9';
  profile.generator.sha256 = digest;
  write(profilePath, `${JSON.stringify(base)}\n`);
  return { root, mind, brain, fake, profilePath };
}

test('contained run uses exact Git corpus, excludes plugin internals, and publishes receipt atomically', () => {
  const x = fixture();
  const outputRoot = path.join(x.brain, 'runtime', 'local', 'graphify', 'mind-knowledge');
  const result = runContainedMindGraphify({ mindRoot: x.mind, outputRoot, graphifyBin: x.fake, profileCatalog: x.profilePath, authorizationId: AUTHORIZATION_ID });
  assert.equal(result.acceptance.status, 'pass');
  assert.equal(result.acceptance.exactMindHead, true);
  assert.equal(result.acceptance.includedPluginInternals, 0);
  assert.equal(result.acceptance.pluginInternalsExcluded, true);
  assert.equal(result.acceptance.includedMarkdownFiles, 1);
  assert.equal(result.acceptance.includedMindOwnedScripts, 1);
  assert.equal(fs.lstatSync(result.currentPath).isSymbolicLink(), true);
  assert.equal(fs.existsSync(path.join(result.currentPath, 'receipt.json')), true);
  const sources = JSON.parse(fs.readFileSync(path.join(result.currentPath, 'source-manifest.json'), 'utf8')).files.map((item) => item.path);
  assert.deepEqual(sources, ['system/current.md', 'tools/check.mjs']);
  assert.throws(() => runContainedMindGraphify({
    mindRoot: x.mind,
    outputRoot,
    graphifyBin: x.fake,
    profileCatalog: x.profilePath,
    authorizationId: AUTHORIZATION_ID,
  }), /one_shot_authorization_already_consumed/);
});

test('contained run fails closed without the exact one-shot authorization', () => {
  const x = fixture();
  assert.throws(() => runContainedMindGraphify({
    mindRoot: x.mind,
    outputRoot: path.join(x.brain, 'runtime', 'local', 'graphify', 'mind-knowledge'),
    graphifyBin: x.fake,
    profileCatalog: x.profilePath,
    authorizationId: 'wrong',
  }), /one_shot_authorization_required/);
});
