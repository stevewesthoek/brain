#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { loadAdmissionRegistry, validateAdmissionRegistry } from './validate-mcp-provider-admissions.mjs';

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function requireAbsolute(value, label) {
  if (!value || !path.isAbsolute(value)) throw new Error(`${label} must be an absolute path`);
  return path.resolve(value);
}

function quote(value) { return JSON.stringify(value); }

export function renderProjectRegistration(admission, { providerRoot, credentialFile, nodeExecutable }) {
  const tools = admission.scope.tools.map((tool) => tool.name);
  const suboperations = Array.from(new Set(admission.scope.tools.flatMap((tool) => tool.allowedSuboperations)));
  const isCredentialFree = admission.authentication?.mode === 'none';
  const isExecutableDirect = isCredentialFree && admission.provider?.executable === true;
  const entrypoint = path.join(providerRoot, admission.provider.entrypoint);
  const active = admission.status === 'active-local';
  const lines = [
    `[mcp_servers.${admission.transport.serverName}]`,
    isExecutableDirect ? `command = ${quote(entrypoint)}` : `command = ${quote(nodeExecutable)}`,
    isExecutableDirect ? `args = []` : `args = [${quote(entrypoint)}]`,
    isExecutableDirect ? null : `cwd = ${quote(providerRoot)}`,
    `enabled = ${active ? 'true' : 'false'}`,
    `required = ${active ? 'true' : 'false'}`,
    `startup_timeout_sec = ${admission.limits.startupTimeoutSeconds}`,
    `tool_timeout_sec = ${admission.limits.toolTimeoutSeconds}`,
    'default_tools_approval_mode = "writes"',
    '',
    `[mcp_servers.${admission.transport.serverName}.env]`,
  ].filter((line) => line !== null);
  if (!isCredentialFree && credentialFile) {
    lines.push(`${admission.authentication.credentialFileEnvironmentVariable} = ${quote(credentialFile)}`);
  }
  lines.push(`${admission.scope.toolAllowlistEnvironmentVariable} = ${quote(tools.join(','))}`);
  lines.push(`${admission.scope.suboperationAllowlistEnvironmentVariable} = ${quote(suboperations.join(','))}`);
  for (const [name, value] of Object.entries(admission.scope.fixedEnvironment ?? {}).sort(([left], [right]) => left.localeCompare(right))) {
    lines.push(`${name} = ${quote(value)}`);
  }
  lines.push('');
  return lines.join('\n');
}

export function verifyRenderedRuntimeRoot(admission, providerRoot) {
  const rootStat = fs.lstatSync(providerRoot);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('Runtime provider root must be a non-symlink directory');
  for (const artifact of admission.provider.artifacts ?? []) {
    if (artifact.path.startsWith('archive:') || artifact.path.startsWith('npm:') || artifact.note?.includes('working-tree-only')) continue;
    const file = path.resolve(providerRoot, artifact.path);
    const relative = path.relative(providerRoot, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`Runtime artifact escapes provider root: ${artifact.path}`);
    const stat = fs.lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Runtime artifact is not a regular file: ${artifact.path}`);
    const actual = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    if (actual !== artifact.sha256) throw new Error(`Runtime artifact digest mismatch: ${artifact.path}`);
  }
}

function requireOwnerOnlyFile(file, label) {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw new Error(`${label} must be an owner-only regular file`);
}

function requireExecutableFile(file, label) {
  const stat = fs.statSync(file);
  if (!stat.isFile() || (stat.mode & 0o111) === 0) throw new Error(`${label} must be an executable regular file`);
}

function main() {
  const admissionId = option('--admission');
  const providerRoot = requireAbsolute(option('--provider-root'), '--provider-root');
  const verificationProviderRoot = option('--verification-provider-root')
    ? requireAbsolute(option('--verification-provider-root'), '--verification-provider-root')
    : providerRoot;
  const providerRevision = option('--provider-revision');
  const nodeExecutable = fs.realpathSync(requireAbsolute(option('--node'), '--node'));
  const output = option('--output') ? requireAbsolute(option('--output'), '--output') : undefined;
  const registry = loadAdmissionRegistry(option('--registry') ?? undefined);
  const admission = registry.admissions.find((item) => item.admissionId === admissionId);
  if (!admission) throw new Error(`Unknown admission: ${admissionId}`);
  const errors = validateAdmissionRegistry(registry, {
    providerRoots: new Map([[admission.provider.providerId, verificationProviderRoot]]),
    providerRevisions: providerRevision ? new Map([[admission.provider.providerId, providerRevision]]) : new Map(),
  });
  if (errors.length) throw new Error(errors.join('\n'));
  verifyRenderedRuntimeRoot(admission, providerRoot);
  const isCredentialFree = admission.authentication?.mode === 'none';
  let credentialFile = null;
  if (!isCredentialFree) {
    credentialFile = requireAbsolute(option('--credential-file'), '--credential-file');
    requireOwnerOnlyFile(credentialFile, 'Credential file');
  }
  requireExecutableFile(nodeExecutable, 'Node executable');
  const rendered = renderProjectRegistration(admission, { providerRoot, credentialFile, nodeExecutable });
  if (!output) { process.stdout.write(rendered); return; }
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== rendered) throw new Error('Generated MCP project registration is stale');
    process.stdout.write(`mcp-project-registration-current admission=${admissionId}\n`);
    return;
  }
  fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, rendered, { mode: 0o600 });
  fs.renameSync(temporary, output);
  fs.chmodSync(output, 0o600);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { main(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
