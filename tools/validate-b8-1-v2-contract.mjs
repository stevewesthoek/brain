#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.json');
const schemaPath = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-manifest.schema.json');
const evidenceSchemaPath = path.join(ROOT, 'operations/specs/b8-1-v2-context-memory-benchmark-evidence.schema.json');
function unique(values) { return new Set(values).size === values.length; }
function git(repo, args) { return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 }); }

export function validateContract() {
  const errors = [];
  const manifest = JSON.parse(fs.readFileSync(manifestPath)); const schema = JSON.parse(fs.readFileSync(schemaPath));
  const ajv = new Ajv2020({ allErrors: true, strict: false }); const validate = ajv.compile(schema);
  if (!validate(manifest)) errors.push(...(validate.errors ?? []).map(error => `schema ${error.instancePath}: ${error.message}`));
  ajv.compile(JSON.parse(fs.readFileSync(evidenceSchemaPath)));
  if (manifest.resourceBudget.steadyState.maximumRefreshP95Ms > manifest.resourceBudget.steadyState.maximumRefreshMs) errors.push('refresh p95 limit exceeds maximum');
  if (manifest.rehearsalPolicy.requiredPassingRuns > manifest.rehearsalPolicy.minimumIndependentRuns) errors.push('required passing runs exceeds minimum independent runs');
  if (manifest.providerContract.requiredIndexMode !== 'full') errors.push('provider mode must be full');
  for (const fixture of manifest.fixtures) {
    const question = fixture.question.toLowerCase();
    if (fixture.retrievalPattern && !question.includes(fixture.retrievalPattern.toLowerCase())) errors.push(`${fixture.fixtureId}: retrieval pattern must be visible in the benchmark question`);
    if (fixture.verification.algorithm === 'file-name-count' && !question.includes(fixture.verification.fileName.toLowerCase())) errors.push(`${fixture.fixtureId}: counted file name must be visible in the benchmark question`);
    if (fixture.callerCalleeApplicable) {
      if (!fixture.structuralTruth || !Array.isArray(fixture.expectedCallers) || !Array.isArray(fixture.expectedCallees)) errors.push(`${fixture.fixtureId}: missing structural truth`);
      if (!unique(fixture.expectedCallers ?? []) || !unique(fixture.expectedCallees ?? [])) errors.push(`${fixture.fixtureId}: duplicate structural truth item`);
    } else if (fixture.structuralTruth || fixture.expectedCallers || fixture.expectedCallees) errors.push(`${fixture.fixtureId}: nonstructural fixture carries structural scoring fields`);
  }
  for (const repository of manifest.repositories) {
    const repoRoot = path.resolve(path.dirname(manifestPath), repository.localPath); git(repoRoot, ['cat-file', '-e', `${repository.pinnedCommit}^{commit}`]);
    for (const fixture of manifest.fixtures.filter(item => item.repositoryId === repository.repositoryId && item.callerCalleeApplicable)) {
      const target = git(repoRoot, ['show', `${repository.pinnedCommit}:${fixture.expectedFile}`]);
      for (const callee of fixture.expectedCallees) if (!target.includes(callee)) errors.push(`${fixture.fixtureId}: expected callee absent from pinned target: ${callee}`);
      let files = [];
      try { files = git(repoRoot, ['grep', '-l', '-F', fixture.expectedSymbol, repository.pinnedCommit, '--']).trim().split('\n').filter(Boolean).map(file => file.replace(`${repository.pinnedCommit}:`, '')); } catch {}
      files = files.filter(file => manifest.coveragePolicy.eligibleExtensions.includes(path.posix.extname(file).toLowerCase()))
        .filter(file => !file.split('/').some(segment => manifest.coveragePolicy.excludedDirectoryNames.includes(segment)));
      let derivedCallers = [];
      if (fixture.structuralTruth.callerRelation === 'import-consumers') {
        const symbol = fixture.expectedSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const symbolPattern = new RegExp(`\\b${symbol}\\b`);
        derivedCallers = files.filter(file => manifest.coveragePolicy.eligibleExtensions.includes(path.posix.extname(file).toLowerCase())).filter(file => {
          try {
            const source = git(repoRoot, ['show', `${repository.pinnedCommit}:${file}`]);
            return [...source.matchAll(/^import[\s\S]*?from\s+['"][^'"]+['"]\s*;?/gm)].some(match => symbolPattern.test(match[0].slice(0, match[0].lastIndexOf('from'))));
          } catch { return false; }
        });
      } else if (fixture.structuralTruth.callerRelation === 'call-sites' || fixture.structuralTruth.callerRelation === 'no-explicit-caller') {
        const symbol = fixture.expectedSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const call = new RegExp(`\\b${symbol}\\s*\\(`);
        derivedCallers = files.filter(file => manifest.coveragePolicy.eligibleExtensions.includes(path.posix.extname(file).toLowerCase())).filter(file => file !== fixture.expectedFile).filter(file => {
          try { const source = git(repoRoot, ['show', `${repository.pinnedCommit}:${file}`]); return call.test(source) && !new RegExp(`(?:function|const|let|var)\\s+${symbol}\\b`).test(source); } catch { return false; }
        });
      }
      const expected = [...fixture.expectedCallers].sort(); const derived = [...new Set(derivedCallers)].sort();
      if (JSON.stringify(expected) !== JSON.stringify(derived)) errors.push(`${fixture.fixtureId}: caller truth mismatch expected=${JSON.stringify(expected)} derived=${JSON.stringify(derived)}`);
    }
  }
  return { valid: errors.length === 0, errors };
}
const result = validateContract();
if (process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  console.log(`b8-1-v2-contract-valid=${result.valid}`); if (!result.valid) console.log(result.errors.join('\n')); process.exitCode = result.valid ? 0 : 1;
}
