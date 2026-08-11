#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadGraphifyProfile, loadSemanticState, runSemanticEvent, scopeById } from './lib/b8-5-graphify-semantic.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROFILE_PATH = path.join(ROOT, 'operations/specs/graphify-operational-profile.json');

function parseArgs() {
  const result = { changedFiles: [] };
  for (const arg of process.argv.slice(2)) {
    const index = arg.indexOf('=');
    const key = (index < 0 ? arg : arg.slice(0, index)).replace(/^--/, '');
    const value = index < 0 ? true : arg.slice(index + 1);
    if (key === 'changed-file') result.changedFiles.push(value);
    else result[key] = value;
  }
  return result;
}

function git(...args) {
  return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function changedSince(previousHead, currentHead) {
  if (!previousHead || previousHead === currentHead) return [];
  try {
    execFileSync('git', ['-C', ROOT, 'cat-file', '-e', `${previousHead}^{commit}`], { stdio: 'ignore' });
  } catch {
    return [];
  }
  return git('diff', '--name-only', `${previousHead}..${currentHead}`).split('\n').filter(Boolean);
}

async function main() {
  const args = parseArgs();
  const mode = args.mode ?? 'scheduler';
  if (!['scheduler', 'manual'].includes(mode)) throw new Error('mode must be scheduler or manual');
  const profile = loadGraphifyProfile(PROFILE_PATH);
  const outputRoot = path.join(ROOT, profile.operationalOutputRoot);
  const currentHead = git('rev-parse', 'HEAD');
  const defaultScope = profile.corpus.semanticScopes[0]?.scopeId;
  const scopeId = args.scope ?? defaultScope;
  if (!scopeById(profile, scopeId)) throw new Error(`semantic scope not approved: ${scopeId}`);

  let changedFiles = args.changedFiles;
  if (mode === 'scheduler') {
    const state = loadSemanticState(outputRoot);
    changedFiles = changedSince(state.lastEvaluatedHead, currentHead);
  } else if (changedFiles.length === 0) {
    throw new Error('manual trigger requires at least one --changed-file and an approved --scope');
  }

  const runnerPath = args.runner ? path.resolve(args.runner) : null;
  const disabled = args.disabled === true || process.env[profile.execution.disableEnvironmentVariable] === '1';
  const result = await runSemanticEvent({ repositoryRoot: ROOT, profile, scopeId, changedFiles, runnerPath, outputRoot, sourceHead: currentHead, disabled });
  console.log(JSON.stringify({ mode, scopeId, changedFiles, status: result.status, runnerInvoked: result.runnerInvoked, receiptPath: result.receiptPath, freshness: result.state?.freshness }, null, 2));
  if (result.status === 'failed') process.exitCode = 2;
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
