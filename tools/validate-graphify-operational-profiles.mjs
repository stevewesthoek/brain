#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const profilePath = path.join(root, 'operations/specs/graphify-operational-profiles.json');
const registryPath = path.join(root, 'operations/specs/infinite-brain-path-registry.json');
const governancePath = path.join(root, 'operations/specs/graphify-transition-governance.json');

function readProfileCatalog() {
  return JSON.parse(fs.readFileSync(profilePath, 'utf8'));
}

function validateProfile(profile, expectedRepository, errors) {
  if (profile.generatedOutputAuthority !== 'non-authoritative') errors.push(`${profile.profileId}: generated output must be non-authoritative`);
  if (profile.publication !== 'atomic-staged-rename') errors.push(`${profile.profileId}: publication must be atomic-staged-rename`);
  if (profile.currentCommitsOnly !== true) errors.push(`${profile.profileId}: current commits must be used`);
  if (profile.projectOwnedModulesVisible !== true) errors.push(`${profile.profileId}: project-owned modules must remain visible`);
  if (profile.generatedOutputsUntracked !== true) errors.push(`${profile.profileId}: generated outputs must remain untracked`);
  if (profile.repositoryFocus !== expectedRepository) errors.push(`${profile.profileId}: repository focus mismatch`);
  if (!Array.isArray(profile.corpus?.repositories) || profile.corpus.repositories.length !== 1 || profile.corpus.repositories[0] !== expectedRepository) errors.push(`${profile.profileId}: corpus repository allowlist mismatch`);
  const excluded = profile.corpus?.excluded ?? [];
  for (const item of ['.env', 'node_modules', 'runtime', 'graphify-out', '.graphify-out', '.git', 'credential', 'secret', 'backup']) {
    if (!excluded.some((entry) => entry.includes(item))) errors.push(`${profile.profileId}: missing exclusion ${item}`);
  }
  if (!Number.isInteger(profile.retention?.maxRuns) || profile.retention.maxRuns < 1) errors.push(`${profile.profileId}: invalid retention maxRuns`);
  if (!Number.isInteger(profile.retention?.maxAgeDays) || profile.retention.maxAgeDays < 1) errors.push(`${profile.profileId}: invalid retention maxAgeDays`);
  if (!Number.isInteger(profile.retention?.keepFailureReceipts) || profile.retention.keepFailureReceipts < 1) errors.push(`${profile.profileId}: invalid retention keepFailureReceipts`);
}

/**
 * Check that the registry's graphify path entries and the profile catalog are
 * structurally consistent.  The intended relationships are:
 *
 *   graphify-operational-output (.graphify-out/)  — compatibility root; NOT an operationalOutputRoot
 *   graphify-compatibility-output (graphify-out/) — compatibility root; NOT an operationalOutputRoot
 *   runtime/local/graphify/...                    — current operationalOutputRoot per profile catalog
 *
 * Both compatibility roots must appear in the excluded list of every profile.
 * Neither compatibility root may appear as an operationalOutputRoot in any profile.
 * The relationship must be flagged clearly if a profile claims a compatibility root
 * as its operational output.
 */
function validateProfileRegistryConsistency(catalog, errors) {
  if (!fs.existsSync(registryPath)) {
    errors.push('registry-consistency: path registry not found at ' + registryPath);
    return;
  }
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const graphifyEntries = (registry.entries ?? []).filter(
    (e) => e.pathId === 'graphify-operational-output' || e.pathId === 'graphify-compatibility-output'
  );
  if (graphifyEntries.length === 0) {
    errors.push('registry-consistency: no graphify path entries found in registry');
    return;
  }

  const compatLiterals = graphifyEntries.map((e) => e.literal).filter(Boolean);
  // e.g. ['.graphify-out/', 'graphify-out/']

  for (const profile of (catalog.profiles ?? [])) {
    const outputRoot = profile.operationalOutputRoot ?? '';
    const excluded = profile.corpus?.excluded ?? [];

    // A compatibility root must not be the operationalOutputRoot of any profile.
    for (const literal of compatLiterals) {
      const literalNoSlash = literal.replace(/\/$/, '');
      if (outputRoot === literal || outputRoot === literalNoSlash ||
          outputRoot.startsWith(literal) || outputRoot.startsWith(literalNoSlash + '/')) {
        errors.push(
          `registry-consistency: profile ${profile.profileId} declares operationalOutputRoot=${outputRoot}` +
          ` which matches compatibility root ${literal} — compatibility roots must not be declared as operational output roots`
        );
      }
    }

    // A compatibility root must be in the excluded list of every profile.
    for (const literal of compatLiterals) {
      const literalNoSlash = literal.replace(/\/$/, '');
      const isExcluded = excluded.some((e) => e === literal || e === literalNoSlash || e.includes(literalNoSlash));
      if (!isExcluded) {
        errors.push(
          `registry-consistency: profile ${profile.profileId} does not exclude compatibility root ${literal} from its corpus`
        );
      }
    }
  }
}

/**
 * Check that the governance JSON does not expose obsolete B8 labels as current
 * executable next tasks.  Historical labels must be preserved for provenance but
 * must not appear as the active currentPhase or nextTask.
 */
function validateGovernanceNamespace(errors) {
  if (!fs.existsSync(governancePath)) return; // governance file is optional for the profile check
  let gov;
  try {
    gov = JSON.parse(fs.readFileSync(governancePath, 'utf8'));
  } catch {
    errors.push('governance-namespace: could not parse graphify-transition-governance.json');
    return;
  }

  const migration = gov.migrationPath ?? {};

  // currentPhase must not be a historical B8 label (B8.4R-complete, B8.5A, etc.)
  // without an explicit historical marker.
  const historicalPattern = /\bB8\.[0-9]+[A-Z][-\w]*\b/;
  if (typeof migration.currentPhase === 'string' && historicalPattern.test(migration.currentPhase)) {
    errors.push(
      `governance-namespace: migrationPath.currentPhase "${migration.currentPhase}" contains an obsolete pre-canonical B8 label; ` +
      `label must be annotated as historical-pre-canonical or replaced with capability-based language`
    );
  }

  // nextTask must not point to historical B8 labels as the current action.
  if (typeof migration.nextTask === 'string' && historicalPattern.test(migration.nextTask)) {
    errors.push(
      `governance-namespace: migrationPath.nextTask "${migration.nextTask}" contains obsolete pre-canonical B8 labels; ` +
      `replace with capability-based conditions or annotate as historical-pre-canonical`
    );
  }
}

function main() {
  const catalog = readProfileCatalog();
  const errors = [];
  if (catalog.catalogVersion !== '1.1.0') errors.push('catalogVersion must be 1.1.0');
  if (!Array.isArray(catalog.profiles) || catalog.profiles.length !== 2) errors.push('two bounded profiles are required');
  const brain = catalog.profiles?.find((profile) => profile.profileId === 'graphify-brain-architecture');
  const mind = catalog.profiles?.find((profile) => profile.profileId === 'graphify-mind-knowledge');
  if (!brain) errors.push('missing brain architecture profile');
  if (!mind) errors.push('missing mind knowledge profile');
  if (brain) validateProfile(brain, 'brain', errors);
  if (mind) validateProfile(mind, 'mind', errors);
  if (mind) {
    if (mind.corpus?.sourceState !== 'exact-commit-git-archive') errors.push('graphify-mind-knowledge: exact commit Git export is required');
    for (const extension of ['.md', '.mjs', '.js', '.ts', '.sh', '.py']) {
      if (!mind.corpus?.includedExtensions?.includes(extension)) errors.push(`graphify-mind-knowledge: missing included extension ${extension}`);
    }
    for (const exclusion of ['.obsidian', 'archive', 'history', 'generated']) {
      if (!mind.corpus?.excluded?.some((entry) => entry.includes(exclusion))) errors.push(`graphify-mind-knowledge: missing knowledge-corpus exclusion ${exclusion}`);
    }
    if (mind.generator?.name !== 'graphifyy' || mind.generator?.executable !== 'graphify') errors.push('graphify-mind-knowledge: graphifyy executable identity is required');
    if (!/^\d+\.\d+\.\d+$/.test(mind.generator?.version ?? '') || !/^[a-f0-9]{64}$/.test(mind.generator?.sha256 ?? '')) errors.push('graphify-mind-knowledge: exact generator version and sha256 are required');
    if (mind.generator?.networkAccess !== false || mind.generator?.modelAccess !== false) errors.push('graphify-mind-knowledge: contained generator must not use network or models');
  }
  validateProfileRegistryConsistency(catalog, errors);
  validateGovernanceNamespace(errors);

  if (errors.length > 0) {
    process.stdout.write(`catalog=fail\nerrors=${errors.length}\n`);
    for (const error of errors) process.stdout.write(`error=${error}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(`catalog=pass\nprofiles=${catalog.profiles.length}\nresult=pass\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
