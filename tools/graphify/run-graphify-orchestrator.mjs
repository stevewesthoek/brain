#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const brainRoot = resolve(new URL('../..', import.meta.url).pathname);
const examplesPath = resolve(brainRoot, 'operations/specs/graphify-profile.examples.json');

function defaultReportPaths(profileName) {
  const safeProfileName = String(profileName ?? 'unknown').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  return {
    json: resolve(brainRoot, `runtime/local/graphify/${safeProfileName}-latest.json`),
    markdown: resolve(brainRoot, `runtime/local/graphify/${safeProfileName}-latest.md`),
  };
}

function parseArgs(argv) {
  const args = {
    repo: null,
    profile: null,
    operation: 'preflight',
    reportJson: null,
    reportMarkdown: null,
    execute: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--repo') {
      args.repo = argv[++index] ?? null;
    } else if (arg === '--profile') {
      args.profile = argv[++index] ?? null;
    } else if (arg === '--operation') {
      const operation = argv[++index] ?? null;
      if (!['preflight', 'full', 'update', 'critical-rebuild'].includes(operation)) {
        throw new Error('--operation must be preflight, full, update, or critical-rebuild');
      }
      args.operation = operation;
    } else if (arg === '--report-json') {
      args.reportJson = resolve(brainRoot, argv[++index] ?? '');
    } else if (arg === '--report-md') {
      args.reportMarkdown = resolve(brainRoot, argv[++index] ?? '');
    } else if (arg === '--execute') {
      args.execute = true;
    } else if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function helpText() {
  const lines = [
    'Usage: node tools/graphify/run-graphify-orchestrator.mjs --repo <path> [--profile <name>]',
    '',
    'Graphify orchestrator with optional guarded execution.',
    '',
    'Options:',
    '  --repo <path>         Target repository path to inspect. Required.',
    '  --profile <name>      Named example profile fallback when .graphify-profile.json is absent.',
    '  --operation <name>    Operation: preflight, full, update, or critical-rebuild. Default: preflight.',
    '  --execute             Enable execution for --operation update (requires GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true).',
    '  --report-json <path>  Brain-relative report JSON output.',
    '  --report-md <path>    Brain-relative report Markdown output.',
    '',
    'Guarded execution:',
    '  - Only --operation update can execute',
    '  - Requires GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true environment variable',
    '  - Full and critical-rebuild remain blocked even with --execute and the env flag',
    '',
    'Examples:',
    '  # Preflight only (default)',
    '  node tools/graphify/run-graphify-orchestrator.mjs --repo . --profile brain-runtime',
    '',
    '  # Plan an update (report-only)',
    '  node tools/graphify/run-graphify-orchestrator.mjs --repo . --operation update --profile brain-runtime',
    '',
    '  # Execute an update (requires env flag)',
    '  GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true node tools/graphify/run-graphify-orchestrator.mjs --repo . --operation update --execute --profile brain-runtime',
    '',
  ];
  return lines.join('\n');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function validateProfile(profile) {
  const errors = [];
  const required = [
    'graphifyStandardVersion',
    'profile',
    'repoRole',
    'modes',
    'outputs',
    'initialBuildPolicy',
    'criticalRebuildPolicy',
    'incrementalPolicy',
    'exclude',
  ];

  for (const key of required) {
    if (!(key in profile)) errors.push(`missing required field: ${key}`);
  }

  if (profile.graphifyStandardVersion !== '1') errors.push('graphifyStandardVersion must be "1"');
  if (!['mind-knowledge', 'brain-runtime', 'code-app', 'research', 'mixed'].includes(profile.profile)) {
    errors.push(`unsupported profile: ${profile.profile}`);
  }

  for (const key of ['modes', 'outputs', 'exclude']) {
    if (!Array.isArray(profile[key])) errors.push(`${key} must be an array`);
  }

  for (const key of ['initialBuildPolicy', 'criticalRebuildPolicy', 'incrementalPolicy']) {
    if (!profile[key] || typeof profile[key] !== 'object' || Array.isArray(profile[key])) {
      errors.push(`${key} must be an object`);
    }
  }

  const tracked = profile.trackGeneratedArtifacts ?? [];
  if (!Array.isArray(tracked)) {
    errors.push('trackGeneratedArtifacts must be an array when provided');
  } else {
    for (const artifact of tracked) {
      if (typeof artifact !== 'string' || !artifact.startsWith('graphify-out/')) {
        errors.push(`tracked artifact must live under graphify-out/: ${artifact}`);
      }
    }
  }

  return errors;
}

async function loadProfile(repoRoot, profileName) {
  const profilePath = resolve(repoRoot, '.graphify-profile.json');
  if (existsSync(profilePath)) {
    return {
      source: 'repo-local',
      path: profilePath,
      profile: await readJson(profilePath),
    };
  }

  if (!profileName) {
    throw new Error('No .graphify-profile.json found and --profile was not provided.');
  }

  const examples = await readJson(examplesPath);
  const profile = examples.examples?.[profileName];
  if (!profile) throw new Error(`Unknown example profile: ${profileName}`);

  return {
    source: 'brain-example',
    path: examplesPath,
    profile,
  };
}

function expectedOutputs(repoRoot, profile) {
  const outputs = [];
  if (profile.outputs?.includes('report')) outputs.push('graphify-out/GRAPH_REPORT.md');
  if (profile.outputs?.includes('json')) outputs.push('graphify-out/graph.json');
  if (profile.outputs?.includes('html')) outputs.push('graphify-out/graph.html');
  for (const optional of profile.optionalOutputs ?? []) {
    if (optional === 'callflow-html') outputs.push('graphify-out/callflow.html');
    if (optional === 'architecture-html') outputs.push('graphify-out/architecture.html');
  }

  return outputs.map(relativePath => ({
    path: relativePath,
    exists: existsSync(resolve(repoRoot, relativePath)),
  }));
}

function outputValidation(outputs) {
  const requiredCount = outputs.length;
  const availableCount = outputs.filter(output => output.exists).length;
  const missing = outputs.filter(output => !output.exists).map(output => output.path);
  return {
    status: requiredCount === 0 ? 'not-configured' : availableCount === requiredCount ? 'ok' : 'partial',
    requiredCount,
    availableCount,
    missing,
  };
}

function hookWatchReadiness(profile) {
  const hooks = profile.hooks ?? {
    enabled: false,
    postCommit: false,
    postCheckout: false,
    operation: 'update',
  };
  const watch = profile.watch ?? {
    enabled: false,
    debounceMs: 30000,
    maxRunsPerHour: 4,
    operation: 'update',
  };

  return {
    status: hooks.enabled || watch.enabled ? 'blocked' : 'disabled',
    hooks,
    watch,
    hookFeatureFlagEnabled: process.env.GRAPHIFY_ORCHESTRATOR_ENABLE_HOOKS === 'true',
    watchFeatureFlagEnabled: process.env.GRAPHIFY_ORCHESTRATOR_ENABLE_WATCH === 'true',
    message: 'Hook/watch execution remains disabled by default. O8 only reports readiness.',
  };
}

function checkGraphifyCommand() {
  const result = spawnSync('graphify', ['--version'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  return result.status === 0;
}

function selectorRequestFromPolicy(policy) {
  if (!policy) return null;

  return {
    taskType: policy.taskType ?? null,
    inputTokenCount: 0,
    urgent: false,
    previousFailures: [],
    qualityTier: policy.qualityTier ?? null,
    selectionPolicy: policy.selectionPolicy ?? null,
    fallbackPolicy: policy.fallbackPolicy ?? 'selector_default',
    taskMetadata: {
      quality_tier: policy.qualityTier ?? null,
      preferred_models: policy.preferredModels ?? [],
      preferred_providers: policy.preferredProviders ?? [],
      fallback_policy: policy.fallbackPolicy ?? 'selector_default',
      selection_policy: policy.selectionPolicy ?? null,
    },
  };
}

function selectorResolutionPlan(operation, selectorRequest) {
  const resolutionEnabled = process.env.GRAPHIFY_ORCHESTRATOR_ENABLE_SELECTOR_RESOLUTION === 'true';
  const resolutionSupported = ['full', 'critical-rebuild'].includes(operation);
  const resolutionRequested = Boolean(selectorRequest && resolutionSupported);

  return {
    resolutionRequested,
    resolutionEnabled,
    status: !resolutionRequested ? 'skipped' : resolutionEnabled ? 'ready' : 'blocked',
    blockedReason: resolutionRequested && !resolutionEnabled
      ? 'Selector resolution disabled. Set GRAPHIFY_ORCHESTRATOR_ENABLE_SELECTOR_RESOLUTION=true to enable.'
      : null,
    request: selectorRequest,
    selectedProvider: null,
    selectedModel: null,
    baseUrl: null,
    reason: null,
    costEstimate: null,
    error: null,
  };
}

function executionPlan(profile, operation, executeRequested) {
  const policyByOperation = {
    preflight: null,
    full: profile.initialBuildPolicy ?? null,
    update: profile.incrementalPolicy ?? null,
    'critical-rebuild': profile.criticalRebuildPolicy ?? null,
  };

  const commandByOperation = {
    preflight: null,
    full: 'graphify .',
    update: 'graphify . --update',
    'critical-rebuild': 'graphify .',
  };

  const selectorRequest = selectorRequestFromPolicy(policyByOperation[operation] ?? null);
  const executionEnabled = process.env.GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION === 'true';
  let plan = {
    operation,
    executeRequested,
    executionEnabled,
    plannedOnly: true,
    runsGraphify: false,
    callsAiModelSelector: false,
    writesTargetRepo: false,
    hardcodesModelFallback: false,
    graphifyCommand: commandByOperation[operation] ?? null,
    selectorPolicy: policyByOperation[operation] ?? null,
    selectorRequest,
    selector: selectorResolutionPlan(operation, selectorRequest),
  };

  if (!executeRequested) {
    return plan;
  }

  if (operation !== 'update') {
    plan.blockedReason = `Operation '${operation}' is not executable yet. Only 'update' can execute.`;
    return plan;
  }

  if (!executionEnabled) {
    plan.blockedReason = 'Execution disabled. Set GRAPHIFY_ORCHESTRATOR_ENABLE_EXECUTION=true to enable.';
    return plan;
  }

  if (!checkGraphifyCommand()) {
    plan.blockedReason = 'graphify command not found on PATH. Install graphify CLI to enable execution.';
    return plan;
  }

  plan.plannedOnly = false;
  plan.runsGraphify = true;
  plan.writesTargetRepo = true;
  return plan;
}

function getLastNChars(str, n) {
  if (!str) return '';
  return str.length > n ? str.slice(-n) : str;
}

function toMarkdown(report) {
  const lines = [
    '# Graphify Orchestrator Report',
    '',
    `Status: ${report.status}`,
    `Generated: ${report.generatedAt}`,
    '',
    '## Configuration',
    '',
    `Target repo: ${report.repo.path}`,
    `Profile source: ${report.profile.source}`,
    `Profile: ${report.profile.name}`,
    `Operation: ${report.execution.operation}`,
    `Execute requested: ${report.execution.executeRequested}`,
    `Execution enabled: ${report.execution.executionEnabled}`,
    `Planned only: ${report.execution.plannedOnly}`,
    '',
    '## Execution',
    '',
    `Command: ${report.execution.graphifyCommand ?? 'none'}`,
    `Selector policy: ${report.execution.selectorPolicy ? report.execution.selectorPolicy.taskType : 'none'}`,
  ];

  if (report.execution.selectorRequest) {
    lines.push('');
    lines.push('## AI Model Selector');
    lines.push('');
    lines.push(`Resolution requested: ${report.execution.selector?.resolutionRequested ?? false}`);
    lines.push(`Resolution enabled: ${report.execution.selector?.resolutionEnabled ?? false}`);
    lines.push(`Selector status: ${report.execution.selector?.status ?? 'skipped'}`);
    if (report.execution.selector?.blockedReason) lines.push(`Blocked: ${report.execution.selector.blockedReason}`);
    if (report.execution.selector?.selectedProvider) lines.push(`Selected provider: ${report.execution.selector.selectedProvider}`);
    if (report.execution.selector?.selectedModel) lines.push(`Selected model: ${report.execution.selector.selectedModel}`);
    if (report.execution.selector?.error) lines.push(`Error: ${report.execution.selector.error}`);
    lines.push('');
    lines.push('### Request');
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(report.execution.selectorRequest, null, 2));
    lines.push('```');
  }

  if (report.execution.blockedReason) {
    lines.push('', `Blocked: ${report.execution.blockedReason}`);
  }

  if (report.execution.startedAt) {
    lines.push('');
    lines.push('## Execution Result');
    lines.push('');
    lines.push(`Started: ${report.execution.startedAt}`);
    lines.push(`Ended: ${report.execution.endedAt}`);
    lines.push(`Duration: ${report.execution.durationMs}ms`);
    lines.push(`Exit code: ${report.execution.exitCode}`);

    if (report.execution.stdoutTail) {
      lines.push('');
      lines.push('### stdout (tail)');
      lines.push('');
      lines.push('```');
      lines.push(report.execution.stdoutTail);
      lines.push('```');
    }

    if (report.execution.stderrTail) {
      lines.push('');
      lines.push('### stderr (tail)');
      lines.push('');
      lines.push('```');
      lines.push(report.execution.stderrTail);
      lines.push('```');
    }
  }

  lines.push('');
  lines.push('## Safety');
  lines.push('');
  lines.push(`- Runs Graphify: ${report.safety.runsGraphify}`);
  lines.push(`- Calls AI Model Selector: ${report.safety.callsAiModelSelector}`);
  lines.push(`- Writes target repo: ${report.safety.writesTargetRepo}`);
  lines.push(`- Hardcodes model fallback: ${report.safety.hardcodesModelFallback}`);
  lines.push('');

  lines.push('## Validation');
  lines.push('');
  if (report.validation.errors.length === 0) {
    lines.push('- Profile validation passed.');
  } else {
    for (const error of report.validation.errors) {
      lines.push(`- ${error}`);
    }
  }
  lines.push('');

  lines.push('## Output validation');
  lines.push('');
  lines.push(`Status: ${report.outputValidation.status}`);
  lines.push(`Available: ${report.outputValidation.availableCount}/${report.outputValidation.requiredCount}`);
  if (report.outputValidation.missing.length > 0) {
    lines.push(`Missing: ${report.outputValidation.missing.join(', ')}`);
  }
  lines.push('');
  lines.push('## Hook/watch readiness');
  lines.push('');
  lines.push(`Status: ${report.hookWatchReadiness.status}`);
  lines.push(`Hooks enabled: ${report.hookWatchReadiness.hooks.enabled}`);
  lines.push(`Hook feature flag enabled: ${report.hookWatchReadiness.hookFeatureFlagEnabled}`);
  lines.push(`Watch enabled: ${report.hookWatchReadiness.watch.enabled}`);
  lines.push(`Watch feature flag enabled: ${report.hookWatchReadiness.watchFeatureFlagEnabled}`);
  lines.push(report.hookWatchReadiness.message);
  lines.push('');
  lines.push('## Expected outputs');
  lines.push('');
  for (const output of report.expectedOutputs) {
    lines.push(`- [${output.exists ? 'x' : ' '}] ${output.path}`);
  }
  lines.push('');

  return lines.join('\n');
}

async function resolveSelector(selectorPlan, profileName) {
  if (!selectorPlan?.resolutionRequested || !selectorPlan.resolutionEnabled) {
    return selectorPlan;
  }

  const safeProfileName = String(profileName ?? 'unknown').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  const requestPath = resolve(brainRoot, `runtime/local/graphify/${safeProfileName}-selector-request.json`);
  const resolverPath = resolve(brainRoot, 'tools/graphify/resolve-selector.py');

  await mkdir(dirname(requestPath), { recursive: true });
  await writeFile(requestPath, `${JSON.stringify(selectorPlan.request, null, 2)}\n`, 'utf8');

  const result = spawnSync('python3', [resolverPath, '--request', requestPath], {
    cwd: brainRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8',
    timeout: 60000,
  });

  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch (error) {
    return {
      ...selectorPlan,
      status: 'failed',
      error: `failed to parse selector resolver output: ${error instanceof Error ? error.message : String(error)}`,
      stdoutTail: getLastNChars(result.stdout ?? '', 2000),
      stderrTail: getLastNChars(result.stderr ?? '', 2000),
    };
  }

  const selection = parsed.selection ?? {};
  return {
    ...selectorPlan,
    status: result.status === 0 && parsed.status === 'ok' ? 'ok' : 'failed',
    selectedProvider: selection.provider_id ?? selection.provider ?? null,
    selectedModel: selection.model_id ?? selection.model ?? null,
    baseUrl: selection.base_url ?? selection.endpoint ?? null,
    reason: selection.reason ?? selection.decision_reason ?? null,
    costEstimate: selection.cost_estimate ?? selection.estimated_cost ?? null,
    error: parsed.error ?? null,
    result: parsed,
    stdoutTail: getLastNChars(result.stdout ?? '', 2000),
    stderrTail: getLastNChars(result.stderr ?? '', 2000),
  };
}

async function executeGraphify(repoRoot, profile) {
  const startedAt = new Date();
  let stdout = '';
  let stderr = '';
  let exitCode = 1;
  let endedAt = null;

  try {
    const result = spawnSync('graphify', ['.', '--update'], {
      cwd: repoRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
      timeout: 300000,
    });

    stdout = result.stdout ?? '';
    stderr = result.stderr ?? '';
    exitCode = result.status ?? 1;
  } catch (error) {
    stderr = error instanceof Error ? error.message : String(error);
  }

  endedAt = new Date();
  const durationMs = endedAt.getTime() - startedAt.getTime();
  const stdoutTail = getLastNChars(stdout, 2000);
  const stderrTail = getLastNChars(stderr, 2000);

  const graphJsonPath = resolve(repoRoot, 'graphify-out/graph.json');
  const reportPath = resolve(repoRoot, 'graphify-out/GRAPH_REPORT.md');

  let graphJsonValid = false;
  if (exitCode === 0 && existsSync(graphJsonPath)) {
    try {
      const content = await readFile(graphJsonPath, 'utf8');
      JSON.parse(content);
      graphJsonValid = true;
    } catch {
      graphJsonValid = false;
    }
  }

  const reportExists = exitCode === 0 && existsSync(reportPath);

  return {
    exitCode,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationMs,
    stdoutTail,
    stderrTail,
    validation: {
      graphJsonValid,
      reportExists,
      allValid: exitCode === 0 && graphJsonValid && reportExists,
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(helpText());
    return;
  }
  if (!args.repo) throw new Error('--repo is required');

  const repoRoot = resolve(args.repo);
  if (!existsSync(repoRoot)) throw new Error(`Target repo does not exist: ${repoRoot}`);

  const loadedProfile = await loadProfile(repoRoot, args.profile);
  const reportDefaults = defaultReportPaths(loadedProfile.profile.profile ?? args.profile);
  const reportJsonPath = args.reportJson ?? reportDefaults.json;
  const reportMarkdownPath = args.reportMarkdown ?? reportDefaults.markdown;
  const errors = validateProfile(loadedProfile.profile);
  const plan = executionPlan(loadedProfile.profile, args.operation, args.execute);
  const selector = errors.length === 0
    ? await resolveSelector(plan.selector, loadedProfile.profile.profile ?? args.profile)
    : plan.selector;
  const selectorCallAttempted = Boolean(selector?.resolutionRequested && selector?.resolutionEnabled);

  let executionResult = null;
  if (!plan.plannedOnly && args.operation === 'update') {
    executionResult = await executeGraphify(repoRoot, loadedProfile.profile);
  }

  const outputs = expectedOutputs(repoRoot, loadedProfile.profile);

  const status = errors.length > 0
    ? 'invalid-profile'
    : plan.blockedReason
      ? 'execution-blocked'
      : selector?.status === 'failed'
        ? 'selector-failed'
        : selector?.status === 'blocked'
          ? 'selector-blocked'
          : executionResult?.exitCode && executionResult.exitCode !== 0
            ? 'failed'
            : 'ok';

  const report = {
    status,
    mode: args.execute && args.operation === 'update' ? 'execution' : 'report-only',
    generatedAt: new Date().toISOString(),
    repo: {
      path: repoRoot,
    },
    profile: {
      source: loadedProfile.source,
      sourcePath: loadedProfile.path,
      name: loadedProfile.profile.profile ?? null,
      repoRole: loadedProfile.profile.repoRole ?? null,
      modes: loadedProfile.profile.modes ?? [],
    },
    validation: {
      errors,
    },
    execution: {
      operation: args.operation,
      executeRequested: args.execute,
      executionEnabled: plan.executionEnabled,
      plannedOnly: plan.plannedOnly,
      runsGraphify: plan.runsGraphify,
      graphifyCommand: plan.graphifyCommand,
      selectorPolicy: plan.selectorPolicy,
      selectorRequest: plan.selectorRequest,
      selector,
      blockedReason: plan.blockedReason ?? null,
      ...executionResult,
    },
    outputValidation: outputValidation(outputs),
    hookWatchReadiness: hookWatchReadiness(loadedProfile.profile),
    expectedOutputs: outputs,
    safety: {
      runsGraphify: plan.runsGraphify,
      callsAiModelSelector: selectorCallAttempted,
      writesTargetRepo: plan.writesTargetRepo,
      hardcodesModelFallback: plan.hardcodesModelFallback,
    },
  };

  await mkdir(dirname(reportJsonPath), { recursive: true });
  await mkdir(dirname(reportMarkdownPath), { recursive: true });
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(reportMarkdownPath, `${toMarkdown(report)}\n`, 'utf8');

  process.stdout.write(`Wrote ${reportJsonPath}\nWrote ${reportMarkdownPath}\nStatus: ${report.status}\n`);
}

main().catch(error => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
