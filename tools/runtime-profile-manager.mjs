#!/usr/bin/env node

import path from 'node:path';

import { loadJson } from './context-learning/context-learning-core.mjs';
import { validateIdentityAccessCatalog } from './validate-infrastructure-identity-access.mjs';
import {
  buildLaunchPlan,
  buildLoginHandoff,
  clearStaleRuntimeProfileLease,
  createRuntimeProfilePlan,
  createRuntimeProfileConfigurationPlan,
  doctorRuntimeProfile,
  executeLaunchPlan,
  executeRuntimeProfileConfiguration,
  executeRuntimeProfileCreation,
  listRuntimeProfiles,
} from './runtime-profile-manager/runtime-profile-manager-core.mjs';
import { createCodexCliRuntimeProfileAdapter } from './runtime-profile-manager/codex-cli-adapter.mjs';
import {
  buildSurfaceCapabilityMatrix,
  prepareAccountEnrollment,
} from './infrastructure-catalog/account-runtime-architecture.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_CATALOG = path.join(ROOT, 'operations/infrastructure/catalog/identity-access.v1.json');
const SCHEMA = path.join(ROOT, 'operations/specs/infrastructure-identity-access-v1.schema.json');

function usage() {
  return [
    'Usage: node tools/runtime-profile-manager.mjs <list|prepare-account|capabilities|create|materialize-config|doctor|login|launch|clear-stale> [options]',
    '',
    'Options:',
    '  --catalog PATH         Identity & Access catalog (default: canonical catalog)',
    '  --profiles-root PATH   parent directory for dedicated Codex CLI roots',
    '  --profile ID           opaque runtime profile ID',
    '  --surface ID           runtime surface for prepare-account',
    '  --provider ID          provider for prepare-account (default: openai)',
    '  --identity-ref REF     opaque provider identity reference; never an email or token',
    '  --matched-account-id ID trusted canonical account ID from private matching',
    '  --purpose ID           account purpose (default: overflow_capacity)',
    '  --preferred             explicit preferred-account policy for prepare-account',
    '  --bootstrap             allow launch only for initial login/bootstrap',
    '  --execute              execute create, launch, or clear-stale after --confirm',
    '  --confirm              explicit confirmation for local mutation/process start',
    '  --no-login-probe        skip the read-only codex login status probe',
    '  --model MODEL           optional non-secret model setting for materialize-config',
    '  --reasoning-effort X    optional non-secret reasoning setting for materialize-config',
    '  --personality NAME      optional non-secret personality setting for materialize-config',
    '',
    'clear-stale is available with --execute --confirm and removes only a verified stale manager lease; it never kills a process.',
    'There is intentionally no logout or auth-copy command. Desktop/WebGPT and MCP state are separate surfaces.',
  ].join('\n');
}

function parseArgs(argv) {
  const [operation, ...rest] = argv;
  const options = {
    catalog: DEFAULT_CATALOG,
    profilesRoot: undefined,
    profile: undefined,
    surface: undefined,
    provider: 'openai',
    identityRef: undefined,
    matchedAccountId: undefined,
    purpose: 'overflow_capacity',
    preferred: false,
    bootstrap: false,
    execute: false,
    confirm: false,
    probeAuthentication: true,
    model: undefined,
    reasoningEffort: undefined,
    personality: undefined,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (arg === '--bootstrap') options.bootstrap = true;
    else if (arg === '--preferred') options.preferred = true;
    else if (arg === '--execute') options.execute = true;
    else if (arg === '--confirm') options.confirm = true;
    else if (arg === '--no-login-probe') options.probeAuthentication = false;
    else if (['--catalog', '--profiles-root', '--profile', '--surface', '--provider', '--identity-ref', '--matched-account-id', '--purpose'].includes(arg)) {
      const value = rest[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[{ '--catalog': 'catalog', '--profiles-root': 'profilesRoot', '--profile': 'profile', '--surface': 'surface', '--provider': 'provider', '--identity-ref': 'identityRef', '--matched-account-id': 'matchedAccountId', '--purpose': 'purpose' }[arg]] = value;
    } else if (['--model', '--reasoning-effort', '--personality'].includes(arg)) {
      const value = rest[++index];
      if (!value) throw new Error(`${arg} requires a value`);
      options[{ '--model': 'model', '--reasoning-effort': 'reasoningEffort', '--personality': 'personality' }[arg]] = value;
    } else throw new Error(`unknown option: ${arg}\n${usage()}`);
  }
  if (!['list', 'prepare-account', 'capabilities', 'create', 'materialize-config', 'doctor', 'login', 'launch', 'clear-stale'].includes(operation)) throw new Error(usage());
  if (operation === 'prepare-account' && !options.surface) throw new Error('--surface is required for prepare-account');
  if (operation === 'prepare-account' && options.identityRef?.includes('@')) throw new Error('--identity-ref must be an opaque provider reference, not an email');
  if (['create', 'materialize-config', 'doctor', 'login', 'launch', 'clear-stale'].includes(operation) && !options.profile) throw new Error('--profile is required for this operation');
  if (options.execute && !options.confirm) throw new Error('--execute requires --confirm');
  if (options.execute && !['create', 'materialize-config', 'launch', 'clear-stale'].includes(operation)) throw new Error('--execute is only valid for create, materialize-config, launch, or clear-stale');
  if (['model', 'reasoningEffort', 'personality'].some((key) => options[key] !== undefined) && operation !== 'materialize-config') throw new Error('configuration settings are only valid for materialize-config');
  return { operation, options };
}

function loadCatalog(catalogPath) {
  const schema = loadJson(SCHEMA);
  const catalog = loadJson(path.resolve(catalogPath));
  const validation = validateIdentityAccessCatalog({ schema, catalog, label: '.runtime-profile-manager' });
  if (validation.errors.length > 0) throw new Error(`catalog validation failed:\n${validation.errors.map((error) => `ERROR ${error}`).join('\n')}`);
  return catalog;
}

export async function runRuntimeProfileManager(argv = process.argv.slice(2), dependencies = {}) {
  const { operation, options } = parseArgs(argv);
  const catalog = dependencies.catalog ?? loadCatalog(options.catalog);
  const adapter = dependencies.adapter ?? createCodexCliRuntimeProfileAdapter({ executable: dependencies.executable ?? 'codex', run: dependencies.run });
  const context = {
    profilesRoot: options.profilesRoot,
    routeOwnerRef: dependencies.routeOwnerRef ?? 'unknown',
    routeMutationRequested: false,
    cwd: ROOT,
    accountObservationMode: 'app-server',
  };

  if (operation === 'list') return listRuntimeProfiles({ catalog, adapter, context });
  if (operation === 'capabilities') return buildSurfaceCapabilityMatrix({ catalog });
  if (operation === 'prepare-account') {
    return prepareAccountEnrollment({
      catalog,
      observation: {
        observationId: `observation:prepare.${options.provider}.${options.surface}`,
        providerId: options.provider,
        providerPrincipalRef: options.identityRef ?? null,
        status: 'authenticated',
        observedAt: new Date().toISOString(),
      },
      surfaceId: options.surface,
      identityRef: options.identityRef,
      matchedAccountId: options.matchedAccountId,
      preferred: options.preferred,
      purpose: options.purpose,
      sourceRef: 'runtime-profile-manager:prepare-account',
    });
  }
  if (operation === 'create') {
    const plan = createRuntimeProfilePlan({ catalog, profileId: options.profile, adapter, context });
    if (!options.execute) return plan;
    return executeRuntimeProfileCreation({ plan, adapter, context });
  }
  if (operation === 'materialize-config') {
    const plan = createRuntimeProfileConfigurationPlan({ catalog, profileId: options.profile, adapter, context });
    if (!options.execute) return plan;
    return executeRuntimeProfileConfiguration({
      plan,
      catalog,
      adapter,
      context,
      settings: {
        model: options.model,
        model_reasoning_effort: options.reasoningEffort,
        personality: options.personality,
      },
    });
  }
  if (operation === 'doctor') return doctorRuntimeProfile({ catalog, profileId: options.profile, adapter, context, probeAuthentication: options.probeAuthentication });
  if (operation === 'login') return buildLoginHandoff({ catalog, profileId: options.profile, adapter, context });
  if (operation === 'clear-stale') {
    return clearStaleRuntimeProfileLease({ catalog, profileId: options.profile, adapter, context, execute: options.execute });
  }
  const plan = await buildLaunchPlan({ catalog, profileId: options.profile, adapter, context, bootstrap: options.bootstrap });
  if (!options.execute) return plan;
  return executeLaunchPlan({ plan, adapter, context });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRuntimeProfileManager().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (['NOT_OK', 'BLOCKED'].includes(result.status)) process.exitCode = 1;
  }).catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
