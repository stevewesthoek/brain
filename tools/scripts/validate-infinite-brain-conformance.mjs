#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadPathRegistry, validatePathRegistry } from '../mind-canonical-path-registry.mjs';
import { loadAndValidateContractRegistry } from '../validate-infinite-brain-contract-registry.mjs';
import { loadContractLayers, validateContractLayers } from '../validate-infinite-brain-contract-layers.mjs';
import { loadAdmissionRegistry, validateAdmissionRegistry } from '../validate-mcp-provider-admissions.mjs';

const SCRIPT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TASK_HEADING = /^### ((?:BS0|MS0)\.\d+|[BM][1-8]\.\d+[a-z]?) — (.+)$/gm;
const TASK_ID = /\b((?:BS0|MS0)\.\d+|[BM][1-8]\.\d+[a-z]?)\b/g;
const FORMATTED_TASK_TITLE = /(?:`|\*\*)((?:BS0|MS0)\.\d+|[BM][1-8]\.\d+[a-z]?) — (.+?)(?:`|\*\*)/g;
const SEMVER = /^\d+\.\d+\.\d+$/;

function readText(root, relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function documentVersion(text, label) {
  return text.match(/^\*\*Version:\*\*\s*([^\s]+)$/m)?.[1] ?? `missing:${label}`;
}

function bullet(section, label) {
  const lines = section.split('\n');
  const marker = `- **${label}:**`;
  const index = lines.findIndex((line) => line.startsWith(marker));
  if (index < 0) return null;
  const values = [lines[index].slice(marker.length).trim()];
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const line = lines[cursor];
    if (line.startsWith('- **') || line.startsWith('### ') || line.startsWith('## ')) break;
    if (line.trim() && /^\s+/.test(line)) values.push(line.trim());
    else if (line.trim()) break;
  }
  return values.join(' ').replace(/\s+/g, ' ').trim();
}

function taskState(status) {
  const value = status.toLowerCase();
  if (value.includes('blocked')) return 'blocked';
  if (value.includes('paused')) return 'paused';
  if (value.includes('complete')) return 'complete';
  if (value.includes('deployed')) return 'deployed';
  if (value.includes('verified')) return 'verified';
  if (value.includes('observed')) return 'observed';
  if (value.includes('configured') || value.includes('bridge ready')) return 'configured';
  if (value.includes('candidate') || value.includes('in progress')) return 'candidate';
  if (value.includes('pending') || value.includes('not started') || value.includes('planned')) return 'planned';
  return 'unknown';
}

function linkedPaths(value) {
  if (!value) return [];
  const paths = [];
  for (const match of value.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) paths.push(match[1]);
  for (const match of value.matchAll(/`([^`]+)`/g)) {
    if (match[1].includes('/') && !match[1].includes(' ')) paths.push(match[1]);
  }
  return [...new Set(paths)].sort();
}

export function parseTaskInventory(text, repository) {
  const matches = [...text.matchAll(TASK_HEADING)];
  return matches.map((match, index) => {
    const section = text.slice(match.index, matches[index + 1]?.index ?? text.length);
    const rawStatus = bullet(section, 'Status') ?? 'planned';
    const state = taskState(rawStatus);
    const implementation = bullet(section, 'Files')
      ?? bullet(section, 'File')
      ?? bullet(section, 'Path')
      ?? bullet(section, 'Scope')
      ?? bullet(section, 'Likely scope');
    const validation = bullet(section, 'Minimum validation')
      ?? bullet(section, 'Verify')
      ?? bullet(section, 'Test')
      ?? bullet(section, 'Tests');
    const evidence = bullet(section, 'Evidence');
    const stop = bullet(section, 'Stop conditions') ?? bullet(section, 'Stop if');
    const nextAction = bullet(section, 'Change')
      ?? bullet(section, 'Exact outcome')
      ?? bullet(section, 'Purpose');
    return {
      id: match[1],
      title: match[2].trim(),
      repository,
      status: rawStatus,
      state,
      dependencies: bullet(section, 'Prerequisites') ?? bullet(section, 'Prerequisite') ?? 'not explicitly declared',
      evidencePaths: linkedPaths([rawStatus, evidence].filter(Boolean).join(' ')),
      implementationPaths: linkedPaths(implementation),
      validationStatus: state === 'complete' ? 'verified' : state === 'blocked' ? 'blocked' : validation ? 'planned' : 'unknown',
      blocker: state === 'blocked' ? rawStatus : stop ?? 'none recorded',
      nextAction: nextAction ?? 'not explicitly declared',
    };
  });
}

function duplicateIds(tasks) {
  const seen = new Set();
  return tasks.map((task) => task.id).filter((id) => seen.has(id) || !seen.add(id));
}

function explicitTaskReferences(text) {
  return [...new Set([...text.matchAll(TASK_ID)].map((match) => match[1]))].sort();
}

function explicitTaskTitleReferences(text) {
  return [...text.matchAll(FORMATTED_TASK_TITLE)].map((match) => ({ id: match[1], title: match[2].trim() }));
}

function requiredSequence(prefix, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => `${prefix}.${start + index}`);
}

function exactSet(values, expected) {
  return values.length === expected.length && expected.every((value) => values.includes(value));
}

function evidenceWarnings(tasks, repositoryRoot, planPath) {
  const planDirectory = path.dirname(path.join(repositoryRoot, planPath));
  const warnings = [];
  for (const task of tasks) {
    if (task.state === 'complete' && task.evidencePaths.length === 0) {
      warnings.push(`task-complete-without-evidence:${task.repository}:${task.id}`);
    }
    for (const evidencePath of task.evidencePaths) {
      if (/^[a-z]+:/i.test(evidencePath) || evidencePath.startsWith('#')) continue;
      const localPath = evidencePath.split('#')[0];
      const existsFromPlan = localPath && fs.existsSync(path.resolve(planDirectory, localPath));
      const existsFromRoot = localPath && fs.existsSync(path.resolve(repositoryRoot, localPath));
      if (localPath && !existsFromPlan && !existsFromRoot) {
        warnings.push(`task-stale-evidence-link:${task.repository}:${task.id}:${evidencePath}`);
      }
    }
  }
  return warnings;
}

export function buildMetadataSnapshot({ brainRoot, mindRoot }) {
  const brainRoadmap = readText(brainRoot, 'operations/specs/infinite-brain-runtime-roadmap.md');
  const brainPlan = readText(brainRoot, 'operations/specs/infinite-brain-runtime-implementation-plan.md');
  const brainStatus = readText(brainRoot, 'operations/runbooks/infinite-brain-roadmap-status.md');
  const mindRoadmap = readText(mindRoot, 'system/mind-roadmap.md');
  const mindPlan = readText(mindRoot, 'system/mind-implementation-plan.md');
  const mindFolder = readText(mindRoot, 'system/folder-contract.md');
  const mindTask = readText(mindRoot, 'system/task-kanban-contract.md');
  const mindBridge = readText(mindRoot, 'system/brain-mind-bridge.md');
  const legacyMcp = readText(brainRoot, 'operations/system-configs/mcp/b1-0a-guarded-save-to-mind/README.md');
  const pathRegistry = loadPathRegistry({ repoRoot: brainRoot });
  const capabilityState = readJson(brainRoot, 'operations/specs/capability-state.json');
  const contractRegistry = readJson(brainRoot, 'operations/specs/infinite-brain-contract-registry.json');
  const contractLayers = readJson(brainRoot, 'operations/specs/infinite-brain-contract-layer-map.json');
  const admissionRegistry = readJson(brainRoot, 'operations/specs/mcp-provider-admissions.json');
  const brainTasks = parseTaskInventory(brainPlan, 'brain');
  const mindTasks = parseTaskInventory(mindPlan, 'mind');
  const pathById = new Map(pathRegistry.entries.map((entry) => [entry.pathId, entry]));
  const capabilityById = new Map(capabilityState.capabilities.map((entry) => [entry.capabilityId, entry]));
  const workbench = admissionRegistry.admissions.find((entry) => entry.admissionId === 'workbench-for-brain');
  const migrationTool = workbench?.scope?.tools?.find((entry) => entry.name === 'runWorkbenchCommand');
  const ms09ReportPath = path.join(mindRoot, 'system/reports/ms0-9-task-authority-migration-gate-2026-07-14.md');
  const ms09Report = fs.existsSync(ms09ReportPath) ? fs.readFileSync(ms09ReportPath, 'utf8') : '';

  return {
    versions: {
      brainRoadmap: documentVersion(brainRoadmap, 'brain-roadmap'),
      brainPlan: documentVersion(brainPlan, 'brain-plan'),
      mindRoadmap: documentVersion(mindRoadmap, 'mind-roadmap'),
      mindPlan: documentVersion(mindPlan, 'mind-plan'),
      contractRegistry: contractRegistry.registryVersion,
      pathRegistry: pathRegistry.registryVersion,
      contractLayers: contractLayers.schemaVersion,
      capabilityState: capabilityState.schemaVersion,
      providerAdmission: admissionRegistry.schemaVersion,
    },
    tasks: {
      brain: brainTasks,
      mind: mindTasks,
      duplicateBrainIds: duplicateIds(brainTasks),
      duplicateMindIds: duplicateIds(mindTasks),
      brainRoadmapReferences: explicitTaskReferences(brainRoadmap),
      mindRoadmapReferences: explicitTaskReferences(mindRoadmap),
      brainRoadmapTitleReferences: explicitTaskTitleReferences(brainRoadmap),
      mindRoadmapTitleReferences: explicitTaskTitleReferences(mindRoadmap),
    },
    mindPolicy: {
      successIntake: mindFolder.includes('Canonical Mind success-intake path:\n\n```text\ninbox/new/'),
      failureIntake: mindFolder.includes('Canonical Mind failed-processing target:\n\n```text\ninbox/failed/'),
      kanbanAuthority: mindTask.includes('`kanban.md` is the sole current human task authority'),
      bridgeIsTypedExchange: mindBridge.includes('The bridge owns typed exchange.'),
    },
    pathPolicy: {
      successIntake: pathById.get('inbox-new')?.literal,
      failureIntake: pathById.get('inbox-failed')?.literal,
      taskAuthority: pathById.get('kanban-current-authority')?.literal,
      compatibilityDefaultsSafe: pathRegistry.entries
        .filter((entry) => !entry.type.startsWith('canonical-'))
        .every((entry) => entry.activeDefaultAllowed === false),
    },
    capabilityClaims: {
      saveToMindLiveDeployment: capabilityById.get('save-to-mind-live-deployment'),
      workbenchMcpBridge: capabilityById.get('workbench-mcp-bridge'),
    },
    mcp: {
      admissionStatus: workbench?.status,
      providerRevision: workbench?.provider?.revision,
      tools: (workbench?.scope?.tools ?? []).map((entry) => entry.name).sort(),
      migrationSuboperations: [...(migrationTool?.allowedSuboperations ?? [])].sort(),
      legacyClassificationSafe: legacyMcp.includes('disabled compatibility source')
        && legacyMcp.includes('not approved as the canonical Brain bridge or an active mutation path'),
    },
    currentPlanning: {
      statusNamesBs016: brainStatus.includes('BS0.16'),
      b10aComplete: brainPlan.includes('### B1.0a — Deploy and verify Save-to-Mind target paths')
        && brainTasks.find((task) => task.id === 'B1.0a')?.status.toLowerCase().includes('complete'),
      mindM14Complete: mindTasks.find((task) => task.id === 'M1.4')?.state === 'complete',
    },
    warnings: [
      ...evidenceWarnings(brainTasks, brainRoot, 'operations/specs/infinite-brain-runtime-implementation-plan.md'),
      ...evidenceWarnings(mindTasks, mindRoot, 'system/mind-implementation-plan.md'),
      ...(ms09Report.includes('MS0.9 is blocked, not complete')
        && mindTasks.find((task) => task.id === 'MS0.9')?.state === 'planned'
        ? ['mind-task-status-drift:MS0.9:plan=pending:evidence=blocked']
        : []),
    ],
  };
}

export function validateMetadataSnapshot(snapshot) {
  const errors = [];
  const add = (code, condition) => { if (!condition) errors.push(code); };
  add('version:brain-roadmap-plan-mismatch', snapshot.versions.brainRoadmap === snapshot.versions.brainPlan);
  add('version:mind-roadmap-plan-mismatch', snapshot.versions.mindRoadmap === snapshot.versions.mindPlan);
  for (const [name, value] of Object.entries(snapshot.versions).filter(([name]) => !name.endsWith('Roadmap') && !name.endsWith('Plan'))) {
    add(`version:${name}:invalid`, SEMVER.test(value ?? ''));
  }
  add('version:core-contract-family-mismatch', exactSet(
    [snapshot.versions.contractRegistry, snapshot.versions.pathRegistry, snapshot.versions.contractLayers, snapshot.versions.capabilityState],
    Array(4).fill(snapshot.versions.contractRegistry),
  ));
  add('tasks:duplicate-brain-id', snapshot.tasks.duplicateBrainIds.length === 0);
  add('tasks:duplicate-mind-id', snapshot.tasks.duplicateMindIds.length === 0);
  const allTaskIds = new Set([...snapshot.tasks.brain, ...snapshot.tasks.mind].map((task) => task.id));
  for (const id of requiredSequence('BS0', 1, 23)) add(`tasks:missing:${id}`, allTaskIds.has(id));
  for (const id of requiredSequence('MS0', 1, 10)) add(`tasks:missing:${id}`, allTaskIds.has(id));
  for (const id of requiredSequence('B8', 1, 6)) add(`tasks:missing:${id}`, allTaskIds.has(id));
  for (const id of [...snapshot.tasks.brainRoadmapReferences, ...snapshot.tasks.mindRoadmapReferences]) {
    add(`tasks:roadmap-reference-missing:${id}`, allTaskIds.has(id));
  }
  const titleById = new Map([...snapshot.tasks.brain, ...snapshot.tasks.mind].map((task) => [task.id, task.title]));
  for (const reference of [...snapshot.tasks.brainRoadmapTitleReferences, ...snapshot.tasks.mindRoadmapTitleReferences]) {
    add(`tasks:roadmap-title-mismatch:${reference.id}`, titleById.get(reference.id) === reference.title);
  }
  add('path:mind-success-intake-stale', snapshot.mindPolicy.successIntake);
  add('path:mind-failure-intake-stale', snapshot.mindPolicy.failureIntake);
  add('path:mind-task-authority-stale', snapshot.mindPolicy.kanbanAuthority);
  add('bridge:typed-exchange-boundary-missing', snapshot.mindPolicy.bridgeIsTypedExchange);
  add('path:registry-success-intake-stale', snapshot.pathPolicy.successIntake === 'inbox/new/');
  add('path:registry-failure-intake-stale', snapshot.pathPolicy.failureIntake === 'inbox/failed/');
  add('path:registry-task-authority-stale', snapshot.pathPolicy.taskAuthority === 'kanban.md');
  add('path:unsafe-compatibility-default', snapshot.pathPolicy.compatibilityDefaultsSafe);
  const live = snapshot.capabilityClaims.saveToMindLiveDeployment;
  add('capability:live-deployment-evidence-missing', live?.configurationState === 'configured'
    && live?.deploymentState === 'deployed'
    && live?.observationState === 'observed'
    && live?.verificationState === 'verified'
    && live?.safetyState === 'verified'
    && live?.blockers?.length === 0);
  add('capability:b1-0a-completion-missing', snapshot.currentPlanning.b10aComplete);
  add('capability:mind-m1-4-resolved', snapshot.currentPlanning.mindM14Complete);
  add('mcp:admission-not-active-local', snapshot.mcp.admissionStatus === 'active-local');
  add('mcp:tool-scope-mismatch', exactSet(snapshot.mcp.tools, ['getWorkbenchStatus', 'readWorkbenchContext', 'runWorkbenchCommand']));
  add('mcp:migration-scope-mismatch', exactSet(snapshot.mcp.migrationSuboperations, ['n8n_workflow_migration']));
  add('mcp:legacy-authority-ambiguous', snapshot.mcp.legacyClassificationSafe);
  return errors;
}

function commandLayers({ workbenchRoot }) {
  return [
    { layer: 'path', commands: [['node', ['tools/mind-canonical-path-registry.mjs', 'validate']]] },
    { layer: 'contract', commands: [
      ['node', ['tools/validate-infinite-brain-contract-registry.mjs']],
      ['node', ['tools/validate-infinite-brain-contract-layers.mjs']],
    ] },
    { layer: 'capability', commands: [
      ['node', ['tools/validate-capability-state.mjs']],
      ['node', ['tools/generate-capability-manifest.mjs']],
    ] },
    { layer: 'scheduler', commands: [
      ['node', ['tools/validate-infinite-brain-scheduler-inventory.mjs']],
      ['node', ['tools/validate-typed-scheduler-jobs.mjs']],
    ] },
    { layer: 'bridge', commands: [
      ['node', ['tools/validate-mcp-provider-admissions.mjs', '--provider-root', `workbench=${workbenchRoot}`]],
    ] },
    { layer: 'safety', commands: [
      ['node', ['operations/automations/n8n/validate-mind-inbox-paths.mjs']],
      ['node', ['tools/validate-graphify-operational-profile.mjs']],
      ['node', ['--test', 'tools/n8n-save-to-mind-freeze.test.mjs']],
    ] },
  ];
}

function runCommand(brainRoot, executable, args) {
  const result = spawnSync(executable, args, {
    cwd: brainRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });
  return {
    command: [executable, ...args].join(' '),
    passed: result.status === 0,
    exitCode: result.status,
    signal: result.signal,
    summary: (result.status === 0 ? result.stdout : `${result.stdout}${result.stderr}`)
      .trim().split('\n').filter(Boolean).slice(-3),
  };
}

function safeDirectory(value, label) {
  if (!path.isAbsolute(value)) throw new Error(`${label} must be absolute`);
  const stat = fs.lstatSync(value);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`${label} must be a non-symlink directory`);
  return path.resolve(value);
}

export function runConformanceSuite({ brainRoot, mindRoot, workbenchRoot, runCommands = true }) {
  const roots = {
    brainRoot: safeDirectory(brainRoot, 'brain root'),
    mindRoot: safeDirectory(mindRoot, 'mind root'),
    workbenchRoot: safeDirectory(workbenchRoot, 'workbench root'),
  };
  const snapshot = buildMetadataSnapshot(roots);
  const metadataErrors = validateMetadataSnapshot(snapshot);
  const pathErrors = validatePathRegistry(loadPathRegistry({ repoRoot: roots.brainRoot }), { repoRoot: roots.brainRoot });
  const contract = loadAndValidateContractRegistry({ repoRoot: roots.brainRoot });
  const layerErrors = validateContractLayers(loadContractLayers({ repoRoot: roots.brainRoot }), { repoRoot: roots.brainRoot });
  const admissionErrors = validateAdmissionRegistry(
    loadAdmissionRegistry(path.join(roots.brainRoot, 'operations/specs/mcp-provider-admissions.json')),
    { providerRoots: new Map([['workbench', roots.workbenchRoot]]) },
  );
  const layers = runCommands ? commandLayers(roots).map((layer) => ({
    layer: layer.layer,
    commands: layer.commands.map(([executable, args]) => runCommand(roots.brainRoot, executable, args)),
  })) : [];
  const failedCommands = layers.flatMap((layer) => layer.commands.filter((command) => !command.passed));
  const errors = [
    ...metadataErrors,
    ...pathErrors.map((error) => `path:${error}`),
    ...contract.errors.map((error) => `contract:${error}`),
    ...layerErrors.map((error) => `layers:${error}`),
    ...admissionErrors.map((error) => `mcp:${error}`),
    ...failedCommands.map((command) => `command:${command.command}`),
  ];
  return {
    result: errors.length === 0 ? 'pass' : 'fail',
    metadataOnly: true,
    networkAccess: false,
    personalMindContentRead: false,
    taskCounts: { brain: snapshot.tasks.brain.length, mind: snapshot.tasks.mind.length },
    warnings: snapshot.warnings,
    errors,
    layers,
    inventory: { brain: snapshot.tasks.brain, mind: snapshot.tasks.mind },
  };
}

function option(argv, name, fallback) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : fallback;
}

function main() {
  const argv = process.argv.slice(2);
  const brainRoot = option(argv, '--brain-root', SCRIPT_ROOT);
  const mindRoot = option(argv, '--mind-root', path.resolve(brainRoot, '../mind'));
  const workbenchRoot = option(argv, '--workbench-root', path.resolve(brainRoot, '../../prochattools/saas/workbench-mrp6'));
  const report = runConformanceSuite({ brainRoot, mindRoot, workbenchRoot });
  if (argv.includes('--inventory-json')) {
    process.stdout.write(`${JSON.stringify({ result: report.result, warnings: report.warnings, errors: report.errors, inventory: report.inventory }, null, 2)}\n`);
  } else if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    process.stdout.write(`conformance=${report.result}\n`);
    process.stdout.write(`layers=${report.layers.length}\n`);
    process.stdout.write(`commands=${report.layers.reduce((count, layer) => count + layer.commands.length, 0)}\n`);
    process.stdout.write(`brain_tasks=${report.taskCounts.brain}\n`);
    process.stdout.write(`mind_tasks=${report.taskCounts.mind}\n`);
    process.stdout.write(`warnings=${report.warnings.length}\n`);
    report.warnings.forEach((warning) => process.stdout.write(`warning=${warning}\n`));
    report.errors.forEach((error) => process.stdout.write(`error=${error}\n`));
    process.stdout.write('network_access=false\n');
    process.stdout.write('personal_mind_content_read=false\n');
  }
  if (report.result !== 'pass') process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
