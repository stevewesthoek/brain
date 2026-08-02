#!/usr/bin/env node
/**
 * validate-mcp-runtime-truth.mjs
 *
 * Read-only validator that detects discrepancies between documented MCP state
 * and observed runtime/configuration state. Supports fixture-only mode for
 * testing without touching real credentials or config files.
 *
 * Usage:
 *   node tools/validate-mcp-runtime-truth.mjs
 *   node tools/validate-mcp-runtime-truth.mjs --fixture-only
 *   node tools/validate-mcp-runtime-truth.mjs --admission-registry <path>
 *
 * Output:
 *   mcp-runtime-truth-check=<pass|warn|fail>
 *   <key>=<value>
 *   ...
 *
 * Never prints credential values, credential file contents, token values,
 * or raw TOML values that could contain secrets.
 */

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Constants — module-scoped, no CLI parsing at import time
// ---------------------------------------------------------------------------

const ADMISSION_REGISTRY_PATH = path.join(SCRIPT_ROOT, 'operations/specs/mcp-provider-admissions.json');

// ---------------------------------------------------------------------------
// Result aggregation helpers (stateless)
// ---------------------------------------------------------------------------

function aggregateLevel(detections) {
  let level = 'pass';
  for (const d of detections) {
    if (d.level === 'fail') return 'fail';
    if (d.level === 'warn' && level === 'pass') level = 'warn';
  }
  return level;
}

function exitCodeFor(overallLevel, strict) {
  if (overallLevel === 'fail') return 1;
  if (overallLevel === 'warn' && strict) return 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Safe file readers (never expose secrets)
// ---------------------------------------------------------------------------

function safeReadText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function safeReadJson(filePath) {
  const text = safeReadText(filePath);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// TOML block detection helpers (no TOML parser — pattern-based, read-only)
// ---------------------------------------------------------------------------

/**
 * Check whether a TOML file contains a given [mcp_servers.<name>] section
 * that is NOT explicitly disabled (enabled = false).
 * Returns 'present-enabled' | 'present-disabled' | 'absent' | 'file-missing'
 */
function tomlMcpServerState(tomlText, serverName) {
  if (tomlText === null) return 'file-missing';
  // Normalize line endings
  const lines = tomlText.replace(/\r\n/g, '\n').split('\n');
  const sectionHeader = `[mcp_servers.${serverName}]`;
  let inSection = false;
  let foundSection = false;
  let explicitDisabled = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    // Detect start of a new top-level or nested section
    if (trimmed.startsWith('[')) {
      if (trimmed === sectionHeader) {
        inSection = true;
        foundSection = true;
      } else if (inSection) {
        // Leaving the section
        inSection = false;
      }
      continue;
    }
    if (inSection) {
      // Look for enabled = false (handles spacing variations)
      if (/^enabled\s*=\s*false/.test(trimmed)) {
        explicitDisabled = true;
      }
    }
  }

  if (!foundSection) return 'absent';
  return explicitDisabled ? 'present-disabled' : 'present-enabled';
}

/**
 * Extracts env block values from a TOML mcp_servers section.
 * Returns a plain object of key→value pairs found inside [mcp_servers.<name>.env]
 * Never returns the raw value; returns key names only plus a flag if a pattern
 * that looks like a bare credential was detected.
 */
function tomlMcpServerEnvKeys(tomlText, serverName) {
  if (!tomlText) return { keys: [], credentialValueDetected: false };
  const lines = tomlText.replace(/\r\n/g, '\n').split('\n');
  const envHeader = `[mcp_servers.${serverName}.env]`;
  let inEnv = false;
  const keys = [];
  let credentialValueDetected = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inEnv = trimmed === envHeader;
      continue;
    }
    if (!inEnv) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const rawVal = trimmed.slice(eqIdx + 1).trim();
    if (key) keys.push(key);
    // Detect patterns that look like bare credential values
    // (40+ hex chars, or "Bearer <token>" patterns, or long random strings)
    // Never print the value; only set the flag
    const unquoted = rawVal.replace(/^["']|["']$/g, '');
    if (/^[a-fA-F0-9]{40,}$/.test(unquoted)) credentialValueDetected = true;
    if (/^Bearer\s+\S{20,}/.test(unquoted)) credentialValueDetected = true;
    if (/^sk-[a-zA-Z0-9]{20,}/.test(unquoted)) credentialValueDetected = true;
    // Long random-looking strings (80+ non-whitespace, not a file path)
    if (unquoted.length >= 80 && !/[/\\]/.test(unquoted) && !/\$\{/.test(unquoted)) {
      credentialValueDetected = true;
    }
  }
  return { keys, credentialValueDetected };
}

/**
 * Check whether any config text contains a bare credential-like value.
 * Also checks JSON-based config for env block values.
 * Never prints the detected value.
 */
function configContainsCredentialValue(text) {
  if (!text) return false;
  // Skip lines that are clearly just file path references
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments
    if (trimmed.startsWith('#') || trimmed.startsWith('//')) continue;
    // Look for patterns after = or : that look like bare credentials
    const match = trimmed.match(/[:=]\s*["']?([^\s"',}\]]+)["']?/);
    if (!match) continue;
    const candidate = match[1];
    if (/^[a-fA-F0-9]{40,}$/.test(candidate)) return true;
    if (/^Bearer\s+\S{20,}/.test(candidate)) return true;
    if (/^sk-[a-zA-Z0-9]{20,}/.test(candidate)) return true;
    if (candidate.length >= 80 && !/[/\\]/.test(candidate) && !/\$/.test(candidate)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Admission registry loader
// ---------------------------------------------------------------------------

function loadAdmissionRegistry(filePath) {
  return safeReadJson(filePath);
}

function findAdmission(registry, admissionId) {
  if (!registry?.admissions) return null;
  return registry.admissions.find((a) => a.admissionId === admissionId) ?? null;
}

// ---------------------------------------------------------------------------
// Fixture data for --fixture-only mode
// ---------------------------------------------------------------------------

const FIXTURE = {
  // Simulate ~/.codex/config.toml content
  codexConfigToml: `
[mcp_servers.workbench]
command = "/usr/local/bin/node"
args = ["/repo/packages/mcp/dist/server.js"]

[mcp_servers.workbench.env]
WORKBENCH_MCP_ALLOWED_TOOLS = "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand"
WORKBENCH_MCP_ALLOWED_COMMAND_KINDS = "n8n_workflow_migration"
WORKBENCH_MCP_CREDENTIAL_FILE = "/Users/user/.credentials/workbench-mcp.token"

[mcp_servers.b1_0a_guarded_save_to_mind]
command = "/usr/local/bin/node"
args = ["/repo/tools/mcp/b1-0a-guarded-save-to-mind.mjs"]
`,

  // Simulate ~/.claude.json content (no mcpServers.workbench)
  claudeJson: JSON.stringify({
    version: 1,
    mcpServers: {}
  }),

  // Simulated graphify governance
  graphifyGovernance: JSON.stringify({
    deletionState: 'prohibited-before-retention-gate',
    schedulerActive: false
  }),

  // Simulated admission registry
  admissionRegistry: {
    schemaVersion: '1.0.0',
    reviewedAt: '2026-08-02',
    admissions: [
      {
        admissionId: 'workbench-for-brain',
        status: 'active-local',
        transport: { serverName: 'workbench' },
        provider: { revision: 'aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e', version: '1.3.3-beta' },
        scope: {
          toolAllowlistEnvironmentVariable: 'WORKBENCH_MCP_ALLOWED_TOOLS',
          suboperationAllowlistEnvironmentVariable: 'WORKBENCH_MCP_ALLOWED_COMMAND_KINDS',
          tools: [
            { name: 'getWorkbenchStatus', allowedSuboperations: [] },
            { name: 'readWorkbenchContext', allowedSuboperations: [] },
            { name: 'runWorkbenchCommand', allowedSuboperations: ['n8n_workflow_migration'] }
          ]
        }
      },
      {
        admissionId: 'codebase-memory-mcp-brain',
        status: 'candidate',
        provider: { version: '0.9.0' }
      }
    ]
  },

  // Known brain docs that might make false claims
  brainDocs: {
    'roadmap-status': 'P8 context-memory efficiency is planned only. Graphify structural indexing is quiesced.',
    'implementation-plan': 'B8.1 — planned. B8.2 — planned, blocked on B8.1.'
  }
};

// ---------------------------------------------------------------------------
// Detection 1: active-local admission but no client registration
// ---------------------------------------------------------------------------

export function detectAdmissionWithoutRegistration(opts = {}) {
  const { fixtureOnly = false, codexTomlText = null, claudeJsonText = null, registry = null } = opts;

  let tomlContent = codexTomlText;
  let claudeContent = claudeJsonText;
  let admissionRegistry = registry;

  if (fixtureOnly) {
    // In fixture mode, simulate the mismatch scenario by using registry but
    // clearing the registrations
    tomlContent = tomlContent ?? '';
    claudeContent = claudeContent ?? JSON.stringify({ mcpServers: {} });
    admissionRegistry = admissionRegistry ?? FIXTURE.admissionRegistry;
  } else {
    tomlContent = tomlContent ?? safeReadText(path.join(os.homedir(), '.codex/config.toml'));
    claudeContent = claudeContent ?? safeReadText(path.join(os.homedir(), '.claude.json'));
    admissionRegistry = admissionRegistry ?? loadAdmissionRegistry(ADMISSION_REGISTRY_PATH);
  }

  if (!admissionRegistry) {
    return { key: 'admission-without-registration', value: 'registry-missing', level: 'warn' };
  }

  const activeAdmissions = admissionRegistry.admissions?.filter((a) => a.status === 'active-local') ?? [];
  const issues = [];

  for (const admission of activeAdmissions) {
    const serverName = admission.transport?.serverName ?? admission.admissionId;
    const codexState = tomlMcpServerState(tomlContent, serverName);
    const claudeState = claudeJsonMcpServerPresent(claudeContent, serverName);

    if (codexState !== 'present-enabled' && claudeState !== 'present') {
      issues.push(`${admission.admissionId}: active-local but not registered in codex or claude`);
    }
  }

  if (issues.length > 0) {
    return { key: 'admission-without-registration', value: issues.join('; '), level: 'warn' };
  }
  return { key: 'admission-without-registration', value: 'none', level: 'info' };
}

function claudeJsonMcpServerPresent(claudeJsonText, serverName) {
  if (!claudeJsonText) return 'file-missing';
  try {
    const obj = JSON.parse(claudeJsonText);
    const servers = obj?.mcpServers ?? {};
    return serverName in servers ? 'present' : 'absent';
  } catch {
    return 'parse-error';
  }
}

// ---------------------------------------------------------------------------
// Detection 2: candidate provider described as default in documents
// ---------------------------------------------------------------------------

export function detectCandidateDescribedAsDefault(opts = {}) {
  const { fixtureOnly = false, docTexts = null, registry = null } = opts;

  let docs = docTexts;
  let admissionRegistry = registry;

  if (fixtureOnly) {
    docs = docs ?? FIXTURE.brainDocs;
    admissionRegistry = admissionRegistry ?? FIXTURE.admissionRegistry;
  } else {
    admissionRegistry = admissionRegistry ?? loadAdmissionRegistry(ADMISSION_REGISTRY_PATH);
    docs = docs ?? loadKnownBrainDocs();
  }

  const candidates = admissionRegistry?.admissions?.filter((a) => a.status === 'candidate') ?? [];
  const issues = [];

  for (const admission of candidates) {
    const baseId = admission.provider?.providerId ?? admission.admissionId;
    // Build a list of name variants to search for in natural language docs
    // e.g. "codebase-memory-mcp-brain" → also check "codebase-memory-mcp" and "codebase memory"
    const nameVariants = new Set([baseId]);
    // Strip common consumer suffixes (-brain, -for-brain)
    const withoutSuffix = baseId.replace(/-(for-)?brain$/, '');
    if (withoutSuffix !== baseId) nameVariants.add(withoutSuffix);
    // Add space-separated version of the hyphenated name
    nameVariants.add(withoutSuffix.replace(/-/g, ' '));
    // Add the base without the last segment (e.g., "codebase-memory" from "codebase-memory-mcp")
    const parts = withoutSuffix.split('-');
    if (parts.length >= 2) nameVariants.add(parts.slice(0, -1).join(' '));

    for (const [docKey, text] of Object.entries(docs ?? {})) {
      if (typeof text !== 'string') continue;
      const lines = text.split('\n');
      for (const line of lines) {
        const lineLower = line.toLowerCase();
        const matchesName = [...nameVariants].some((v) => lineLower.includes(v.toLowerCase()));
        if (
          matchesName &&
          /(is the default|as the default|default context memory|default activation)/i.test(line)
        ) {
          issues.push(`${admission.admissionId}: described as default in ${docKey}`);
          break; // Only report once per doc
        }
      }
    }
  }

  if (issues.length > 0) {
    return { key: 'candidate-described-as-default', value: issues.join('; '), level: 'fail' };
  }
  return { key: 'candidate-described-as-default', value: 'none', level: 'info' };
}

function loadKnownBrainDocs() {
  const docPaths = {
    'roadmap-status': path.join(SCRIPT_ROOT, 'operations/runbooks/infinite-brain-roadmap-status.md'),
    'implementation-plan': path.join(SCRIPT_ROOT, 'operations/specs/infinite-brain-runtime-implementation-plan.md'),
    'roadmap': path.join(SCRIPT_ROOT, 'operations/specs/infinite-brain-runtime-roadmap.md'),
    'mcp-workbench-readme': path.join(SCRIPT_ROOT, 'operations/system-configs/mcp/workbench/README.md'),
  };
  const result = {};
  for (const [key, p] of Object.entries(docPaths)) {
    const text = safeReadText(p);
    if (text) result[key] = text;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Detection 3: retired b1_0a bridge present and enabled
// ---------------------------------------------------------------------------

export function detectRetiredBridgeEnabled(opts = {}) {
  const { fixtureOnly = false, codexTomlText = null } = opts;

  let tomlContent = codexTomlText;
  if (fixtureOnly) {
    tomlContent = tomlContent ?? FIXTURE.codexConfigToml;
  } else {
    tomlContent = tomlContent ?? safeReadText(path.join(os.homedir(), '.codex/config.toml'));
  }

  const state = tomlMcpServerState(tomlContent, 'b1_0a_guarded_save_to_mind');

  if (state === 'present-enabled') {
    return {
      key: 'retired-bridge-enabled',
      value: 'b1_0a_guarded_save_to_mind is present and enabled in ~/.codex/config.toml; expected enabled=false',
      level: 'fail'
    };
  }
  if (state === 'file-missing') {
    return { key: 'retired-bridge-enabled', value: 'codex-config-missing', level: 'warn' };
  }
  return { key: 'retired-bridge-enabled', value: 'not-detected', level: 'info' };
}

// ---------------------------------------------------------------------------
// Detection 4: provider revision or artifact mismatch
// ---------------------------------------------------------------------------

export async function detectProviderRevisionMismatch(opts = {}) {
  const {
    fixtureOnly = false,
    providerRoots = new Map(),
    providerRevisions = new Map(),
    registry = null,
  } = opts;

  if (fixtureOnly) {
    return { key: 'provider-revision-mismatch', value: 'not-verified (fixture-only)', level: 'info' };
  }

  if (providerRoots.size === 0) {
    return { key: 'provider-revision-mismatch', value: 'not-verified (no --provider-root given)', level: 'info' };
  }

  const admissionRegistry = registry ?? loadAdmissionRegistry(ADMISSION_REGISTRY_PATH);
  if (!admissionRegistry) {
    return { key: 'provider-revision-mismatch', value: 'registry-missing', level: 'warn' };
  }

  // Detect duplicate provider bindings
  if (providerRoots.size !== [...new Set(providerRoots.keys())].length) {
    return { key: 'provider-revision-mismatch', value: 'duplicate-provider-binding', level: 'fail' };
  }

  const issues = [];

  for (const [providerId, rootPath] of providerRoots) {
    // Unknown provider
    const admission = admissionRegistry.admissions?.find(
      (a) => a.provider?.providerId === providerId
    );
    if (!admission) {
      issues.push(`${providerId}: unknown-provider-id`);
      continue;
    }

    const admittedRevision = admission.provider?.revision;

    // Determine if root is a Git repo
    let headRevision = null;
    let isGitRoot = false;
    try {
      headRevision = execFileSync('git', ['rev-parse', 'HEAD'], {
        cwd: rootPath, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      isGitRoot = true;
    } catch {
      // not a git repo — exported tree
    }

    if (isGitRoot) {
      // Git root: verify HEAD matches admitted revision
      if (headRevision !== admittedRevision) {
        issues.push(`${providerId}: revision-mismatch (HEAD=${headRevision} admitted=${admittedRevision})`);
        continue;
      }
      // If caller also supplied an explicit revision, it must agree
      if (providerRevisions.has(providerId) && providerRevisions.get(providerId) !== headRevision) {
        issues.push(`${providerId}: explicit-revision-disagrees-with-git-head`);
        continue;
      }
    } else {
      // Non-Git exported tree: require explicit revision binding
      if (!providerRevisions.has(providerId)) {
        issues.push(`${providerId}: non-git-root-requires-explicit-provider-revision`);
        continue;
      }
      const explicitRevision = providerRevisions.get(providerId);
      if (explicitRevision !== admittedRevision) {
        issues.push(`${providerId}: explicit-revision-mismatch (given=${explicitRevision} admitted=${admittedRevision})`);
        continue;
      }
    }

    // Artifact digest verification — skip working-tree-only artifacts
    for (const artifact of admission.provider?.artifacts ?? []) {
      if (artifact.note?.includes('working-tree-only')) continue;
      // Skip archive: and npm: virtual paths (not on disk)
      if (artifact.path.startsWith('archive:') || artifact.path.startsWith('npm:')) continue;
      const artifactPath = path.join(rootPath, artifact.path);
      try {
        const data = fs.readFileSync(artifactPath);
        const actual = crypto.createHash('sha256').update(data).digest('hex');
        if (actual !== artifact.sha256) {
          issues.push(`${providerId}/${artifact.path}: artifact-digest-mismatch`);
        }
      } catch {
        issues.push(`${providerId}/${artifact.path}: artifact-read-error`);
      }
    }

    // Check entrypoint is not unverified working-tree-only output
    const entrypoint = admission.provider?.entrypoint;
    if (entrypoint) {
      const entrypointArtifact = admission.provider?.artifacts?.find((a) => a.path === entrypoint);
      if (entrypointArtifact?.note?.includes('working-tree-only')) {
        issues.push(`${providerId}: runtime-entrypoint-unverified (${entrypoint} is working-tree-only)`);
      }
    }
  }

  if (issues.length > 0) {
    return { key: 'provider-revision-mismatch', value: issues.join('; '), level: 'fail' };
  }
  return { key: 'provider-revision-mismatch', value: 'verified', level: 'info' };
}

// ---------------------------------------------------------------------------
// Detection 5: Codebase Memory registered before canonical B8.2 acceptance
// ---------------------------------------------------------------------------

export function detectPrematureCodebaseMemoryRegistration(opts = {}) {
  const { fixtureOnly = false, codexTomlText = null, claudeJsonText = null, registry = null } = opts;

  let tomlContent = codexTomlText;
  let claudeContent = claudeJsonText;
  let admissionRegistry = registry;

  if (fixtureOnly) {
    tomlContent = tomlContent ?? '';
    claudeContent = claudeContent ?? JSON.stringify({ mcpServers: {} });
    admissionRegistry = admissionRegistry ?? FIXTURE.admissionRegistry;
  } else {
    tomlContent = tomlContent ?? safeReadText(path.join(os.homedir(), '.codex/config.toml'));
    claudeContent = claudeContent ?? safeReadText(path.join(os.homedir(), '.claude.json'));
    admissionRegistry = admissionRegistry ?? loadAdmissionRegistry(ADMISSION_REGISTRY_PATH);
  }

  const cbmAdmission = findAdmission(admissionRegistry, 'codebase-memory-mcp-brain');
  if (!cbmAdmission) {
    return { key: 'premature-codebase-memory-registration', value: 'no-cbm-admission-found', level: 'info' };
  }

  // B8.2 acceptance means status is 'active-local' or 'active'
  const b82Complete = ['active-local', 'active'].includes(cbmAdmission.status);
  if (b82Complete) {
    return { key: 'premature-codebase-memory-registration', value: 'b8.2-accepted', level: 'info' };
  }

  // B8.2 not complete — check if registered anywhere
  const codexState = tomlMcpServerState(tomlContent, 'codebase-memory-mcp');
  const claudeState = claudeJsonMcpServerPresent(claudeContent, 'codebase-memory-mcp');

  if (codexState === 'present-enabled' || claudeState === 'present') {
    const where = [
      codexState === 'present-enabled' ? 'codex' : null,
      claudeState === 'present' ? 'claude' : null
    ].filter(Boolean).join(', ');
    return {
      key: 'premature-codebase-memory-registration',
      value: `registered in ${where} before canonical B8.2 acceptance; admission status is ${cbmAdmission.status}`,
      level: 'fail'
    };
  }

  return { key: 'premature-codebase-memory-registration', value: 'not-registered', level: 'info' };
}

// ---------------------------------------------------------------------------
// Detection 6: Workbench tools or command kinds exceed admitted scope
// ---------------------------------------------------------------------------

export function detectWorkbenchScopeExceedance(opts = {}) {
  const { fixtureOnly = false, codexTomlText = null, registry = null } = opts;

  let tomlContent = codexTomlText;
  let admissionRegistry = registry;

  if (fixtureOnly) {
    tomlContent = tomlContent ?? FIXTURE.codexConfigToml;
    admissionRegistry = admissionRegistry ?? FIXTURE.admissionRegistry;
  } else {
    tomlContent = tomlContent ?? safeReadText(path.join(os.homedir(), '.codex/config.toml'));
    admissionRegistry = admissionRegistry ?? loadAdmissionRegistry(ADMISSION_REGISTRY_PATH);
  }

  const wbAdmission = findAdmission(admissionRegistry, 'workbench-for-brain');
  if (!wbAdmission) {
    return { key: 'workbench-scope-exceedance', value: 'no-workbench-admission', level: 'info' };
  }

  const admittedTools = new Set(wbAdmission.scope?.tools?.map((t) => t.name) ?? []);
  const admittedCommandKinds = new Set(
    wbAdmission.scope?.tools
      ?.flatMap((t) => t.allowedSuboperations ?? []) ?? []
  );

  const envInfo = tomlMcpServerEnvKeys(tomlContent, 'workbench');
  if (!envInfo.keys.length) {
    return { key: 'workbench-scope-exceedance', value: 'not-registered-or-no-env', level: 'info' };
  }

  // Try to extract actual tool list and command kinds from config
  // We read them as raw config keys only, not values
  const issues = [];

  // Re-parse env block to get actual string values for the allowlist vars only
  // (These are not secrets — they are tool names)
  const envValues = parseTomlEnvBlockSafe(tomlContent, 'workbench');

  const configuredTools = envValues['WORKBENCH_MCP_ALLOWED_TOOLS']
    ? envValues['WORKBENCH_MCP_ALLOWED_TOOLS'].split(',').map((t) => t.trim()).filter(Boolean)
    : null;
  const configuredKinds = envValues['WORKBENCH_MCP_ALLOWED_COMMAND_KINDS']
    ? envValues['WORKBENCH_MCP_ALLOWED_COMMAND_KINDS'].split(',').map((k) => k.trim()).filter(Boolean)
    : null;

  if (configuredTools) {
    for (const tool of configuredTools) {
      if (!admittedTools.has(tool)) {
        issues.push(`tool "${tool}" not in admitted scope`);
      }
    }
  }

  if (configuredKinds) {
    for (const kind of configuredKinds) {
      if (!admittedCommandKinds.has(kind)) {
        issues.push(`command-kind "${kind}" not in admitted scope`);
      }
    }
  }

  if (issues.length > 0) {
    return { key: 'workbench-scope-exceedance', value: issues.join('; '), level: 'fail' };
  }
  return { key: 'workbench-scope-exceedance', value: 'within-admitted-scope', level: 'info' };
}

/**
 * Parse env block values for allowlist variables only (tool names, not secrets).
 * Returns a plain object with only the allowlist variable values.
 */
function parseTomlEnvBlockSafe(tomlText, serverName) {
  if (!tomlText) return {};
  const lines = tomlText.replace(/\r\n/g, '\n').split('\n');
  const envHeader = `[mcp_servers.${serverName}.env]`;
  const ALLOWLIST_VARS = new Set([
    'WORKBENCH_MCP_ALLOWED_TOOLS',
    'WORKBENCH_MCP_ALLOWED_COMMAND_KINDS',
    'CBM_ALLOWED_TOOLS',
    'CBM_ALLOWED_SUBOPERATIONS',
    'BRAIN_PROFILE_ALLOWED_TOOLS',
    'BRAIN_PROFILE_ALLOWED_COMMAND_KINDS'
  ]);
  let inEnv = false;
  const result = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inEnv = trimmed === envHeader;
      continue;
    }
    if (!inEnv) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    if (!ALLOWLIST_VARS.has(key)) continue;
    const rawVal = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    result[key] = rawVal;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Detection 7: config contains a bare credential value
// ---------------------------------------------------------------------------

export function detectBareCredentialInConfig(opts = {}) {
  const { fixtureOnly = false, configTexts = null } = opts;

  let texts = configTexts;

  if (fixtureOnly) {
    // In fixture mode provide a clean config (no credentials)
    texts = texts ?? { 'fixture-config': FIXTURE.codexConfigToml };
  } else {
    // Read config files but only check them — never print contents
    const filePaths = {
      'codex-config': path.join(os.homedir(), '.codex/config.toml'),
    };
    texts = {};
    for (const [key, p] of Object.entries(filePaths)) {
      const content = safeReadText(p);
      if (content) texts[key] = content;
    }
  }

  const issues = [];
  for (const [configKey, text] of Object.entries(texts ?? {})) {
    // Only scan env blocks — not the full config
    if (configContainsCredentialValue(extractEnvBlocksOnly(text))) {
      issues.push(`${configKey}: credential-value-detected`);
    }
  }

  if (issues.length > 0) {
    return { key: 'bare-credential-in-config', value: issues.join('; '), level: 'fail' };
  }
  return { key: 'bare-credential-in-config', value: 'none-detected', level: 'info' };
}

function extractEnvBlocksOnly(tomlText) {
  if (!tomlText) return '';
  const lines = tomlText.replace(/\r\n/g, '\n').split('\n');
  let inEnv = false;
  const envLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inEnv = trimmed.includes('.env]');
      continue;
    }
    if (inEnv) envLines.push(line);
  }
  return envLines.join('\n');
}

// ---------------------------------------------------------------------------
// Detection 8: Graphify scheduler active while governance says frozen
// ---------------------------------------------------------------------------

export function detectGraphifySchedulerViolation(opts = {}) {
  const { fixtureOnly = false, governanceJson = null, schedulerActive = null } = opts;

  let governance = governanceJson;
  let isActive = schedulerActive;

  if (fixtureOnly) {
    governance = governance ?? JSON.parse(FIXTURE.graphifyGovernance);
    isActive = isActive ?? governance.schedulerActive;
  } else {
    const govPath = path.join(SCRIPT_ROOT, 'operations/specs/graphify-transition-governance.json');
    governance = governance ?? safeReadJson(govPath);
    // Determine scheduler active state from known skip-signal
    isActive = isActive ?? detectGraphifySchedulerActiveFromFiles();
  }

  if (!governance) {
    return { key: 'graphify-scheduler-violation', value: 'governance-missing', level: 'warn' };
  }

  const deletionState = governance.deletionState ?? governance.deletion_state;
  const frozen = deletionState && deletionState !== 'permitted';

  if (frozen && isActive === true) {
    return {
      key: 'graphify-scheduler-violation',
      value: `scheduler active while governance deletionState="${deletionState}"`,
      level: 'fail'
    };
  }
  return { key: 'graphify-scheduler-violation', value: frozen ? 'frozen-scheduler-inactive' : 'not-frozen', level: 'info' };
}

function detectGraphifySchedulerActiveFromFiles() {
  // Check for known scheduler skip-signal file or plist
  const plistPath = path.join(os.homedir(), 'Library/LaunchAgents/com.office.nightly-scheduler.plist');
  const plistText = safeReadText(plistPath);
  if (!plistText) return false;
  // If the plist mentions graphify-nightly and is not disabled, consider it potentially active
  // Conservative: only flag as active if explicitly loaded and running
  return plistText.includes('graphify-nightly') && !plistText.includes('Disabled') && !plistText.includes('<false/>');
}

// ---------------------------------------------------------------------------
// Detection 9: Document claims Graphify output is current architecture truth
// ---------------------------------------------------------------------------

export function detectGraphifyFalseTruthClaim(opts = {}) {
  const { fixtureOnly = false, docTexts = null } = opts;

  let docs = docTexts;

  if (fixtureOnly) {
    docs = docs ?? FIXTURE.brainDocs;
  } else {
    docs = docs ?? loadKnownBrainDocs();
  }

  const issues = [];
  const falseTruthPatterns = [
    /graphify.{0,50}(is|as|the)\s+(current|live|authoritative|canonical)\s+(architecture|truth)/i,
    /current architecture truth.{0,50}graphify/i,
    /graphify[- ]out.{0,50}(is|as)\s+(current|live|authoritative)/i
  ];

  for (const [docKey, text] of Object.entries(docs ?? {})) {
    if (typeof text !== 'string') continue;
    for (const pattern of falseTruthPatterns) {
      if (pattern.test(text)) {
        issues.push(`${docKey}: claims Graphify output is current architecture truth`);
        break;
      }
    }
  }

  if (issues.length > 0) {
    return { key: 'graphify-false-truth-claim', value: issues.join('; '), level: 'fail' };
  }
  return { key: 'graphify-false-truth-claim', value: 'none-detected', level: 'info' };
}

// ---------------------------------------------------------------------------
// Detection 10: Document claims Codebase Memory is active or default while
// admission remains candidate
// ---------------------------------------------------------------------------

export function detectCodebaseMemoryFalseDefaultClaim(opts = {}) {
  const { fixtureOnly = false, docTexts = null, registry = null } = opts;

  let docs = docTexts;
  let admissionRegistry = registry;

  if (fixtureOnly) {
    docs = docs ?? FIXTURE.brainDocs;
    admissionRegistry = admissionRegistry ?? FIXTURE.admissionRegistry;
  } else {
    docs = docs ?? loadKnownBrainDocs();
    admissionRegistry = admissionRegistry ?? loadAdmissionRegistry(ADMISSION_REGISTRY_PATH);
  }

  const cbmAdmission = findAdmission(admissionRegistry, 'codebase-memory-mcp-brain');
  if (!cbmAdmission || !['candidate', 'paused'].includes(cbmAdmission.status)) {
    return { key: 'codebase-memory-false-default-claim', value: 'admission-not-candidate', level: 'info' };
  }

  const issues = [];
  const falseClaims = [
    /codebase[- ]memory.{0,80}(is active|is the default|default activation|is activated)/i,
    /codebase memory mcp.{0,80}(active|default|enabled)/i
  ];

  for (const [docKey, text] of Object.entries(docs ?? {})) {
    if (typeof text !== 'string') continue;
    for (const pattern of falseClaims) {
      if (pattern.test(text)) {
        issues.push(`${docKey}: claims Codebase Memory is active/default while admission is ${cbmAdmission.status}`);
        break;
      }
    }
  }

  if (issues.length > 0) {
    return { key: 'codebase-memory-false-default-claim', value: issues.join('; '), level: 'fail' };
  }
  return { key: 'codebase-memory-false-default-claim', value: 'none-detected', level: 'info' };
}

// ---------------------------------------------------------------------------
// Fixture mode runner — clean built-in fixture, expected: all-pass (exit 0)
// ---------------------------------------------------------------------------

function runFixtureMode(strict = false) {
  console.log('# mcp-runtime-truth-check fixture mode');
  console.log('# Using built-in test fixtures — no real files read');
  console.log('');

  // Clean fixture: workbench registered in Codex, legacy bridge absent, no CBM registration
  const cleanToml = FIXTURE.codexConfigToml.replace(
    /\[mcp_servers\.b1_0a_guarded_save_to_mind\][\s\S]*?(?=\[|$)/, ''
  );

  const detections = [
    detectAdmissionWithoutRegistration({ fixtureOnly: true, codexTomlText: FIXTURE.codexConfigToml, claudeJsonText: FIXTURE.claudeJson, registry: FIXTURE.admissionRegistry }),
    detectCandidateDescribedAsDefault({ fixtureOnly: true, docTexts: FIXTURE.brainDocs, registry: FIXTURE.admissionRegistry }),
    detectRetiredBridgeEnabled({ fixtureOnly: true, codexTomlText: cleanToml }),
    { key: 'provider-revision-mismatch', value: 'not-verified (fixture-only)', level: 'info' },
    detectPrematureCodebaseMemoryRegistration({ fixtureOnly: true, codexTomlText: FIXTURE.codexConfigToml, claudeJsonText: FIXTURE.claudeJson, registry: FIXTURE.admissionRegistry }),
    detectWorkbenchScopeExceedance({ fixtureOnly: true, codexTomlText: FIXTURE.codexConfigToml, registry: FIXTURE.admissionRegistry }),
    detectBareCredentialInConfig({ fixtureOnly: true, configTexts: { 'fixture-config': cleanToml } }),
    detectGraphifySchedulerViolation({ fixtureOnly: true, governanceJson: JSON.parse(FIXTURE.graphifyGovernance), schedulerActive: false }),
    detectGraphifyFalseTruthClaim({ fixtureOnly: true, docTexts: FIXTURE.brainDocs }),
    detectCodebaseMemoryFalseDefaultClaim({ fixtureOnly: true, docTexts: FIXTURE.brainDocs, registry: FIXTURE.admissionRegistry }),
  ];

  for (const d of detections) {
    console.log(`${d.key}=${d.value}`);
  }

  const overallLevel = aggregateLevel(detections);
  console.log('');
  console.log(`mcp-runtime-truth-check=${overallLevel}`);
  process.exitCode = exitCodeFor(overallLevel, strict);
}

// ---------------------------------------------------------------------------
// Named failing-fixture scenario runner — expected: specific violation present
// ---------------------------------------------------------------------------

const FIXTURE_SCENARIOS = {
  'retired-bridge-enabled': () => {
    const tomlWithBridge = FIXTURE.codexConfigToml;
    return [
      detectRetiredBridgeEnabled({ fixtureOnly: true, codexTomlText: tomlWithBridge }),
    ];
  },
  'premature-cbm-registration': () => {
    const tomlWithCbm = FIXTURE.codexConfigToml + `
[mcp_servers.codebase-memory-mcp]
command = "/usr/local/bin/codebase-memory-mcp"
args = []
`;
    return [
      detectPrematureCodebaseMemoryRegistration({
        fixtureOnly: true,
        codexTomlText: tomlWithCbm,
        claudeJsonText: FIXTURE.claudeJson,
        registry: FIXTURE.admissionRegistry,
      }),
    ];
  },
  'scope-exceedance': () => {
    const tomlWithExtra = FIXTURE.codexConfigToml.replace(
      'WORKBENCH_MCP_ALLOWED_TOOLS = "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand"',
      'WORKBENCH_MCP_ALLOWED_TOOLS = "getWorkbenchStatus,readWorkbenchContext,runWorkbenchCommand,runUnapprovedTool"'
    );
    return [
      detectWorkbenchScopeExceedance({ fixtureOnly: true, codexTomlText: tomlWithExtra, registry: FIXTURE.admissionRegistry }),
    ];
  },
};

function runFixtureScenarioMode(scenarioName, strict = false) {
  const scenarioFn = FIXTURE_SCENARIOS[scenarioName];
  if (!scenarioFn) {
    console.error(`validate-mcp-runtime-truth: unknown --fixture-scenario "${scenarioName}"`);
    console.error(`Known scenarios: ${Object.keys(FIXTURE_SCENARIOS).join(', ')}`);
    process.exitCode = 2;
    return;
  }

  console.log(`# mcp-runtime-truth-check fixture-scenario=${scenarioName}`);
  console.log('');

  const detections = scenarioFn();
  for (const d of detections) {
    console.log(`${d.key}=${d.value}`);
  }

  const overallLevel = aggregateLevel(detections);
  console.log('');
  console.log(`mcp-runtime-truth-check=${overallLevel}`);
  process.exitCode = exitCodeFor(overallLevel, strict);
}

// ---------------------------------------------------------------------------
// Real mode runner
// ---------------------------------------------------------------------------

async function runRealMode(strict = false) {
  const cliArgs = process.argv.slice(2);

  // --provider-root workbench=/absolute/path  (may appear multiple times)
  const providerRoots = new Map();
  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === '--provider-root' && cliArgs[i + 1]) {
      const binding = cliArgs[i + 1];
      const sep = binding.indexOf('=');
      if (sep < 1) throw new Error('--provider-root requires provider-id=/absolute/path');
      providerRoots.set(binding.slice(0, sep), binding.slice(sep + 1));
      i++;
    }
  }

  // --provider-revision workbench=<sha>  (explicit revision for non-Git exported trees)
  const providerRevisions = new Map();
  for (let i = 0; i < cliArgs.length; i++) {
    if (cliArgs[i] === '--provider-revision' && cliArgs[i + 1]) {
      const binding = cliArgs[i + 1];
      const sep = binding.indexOf('=');
      if (sep < 1) throw new Error('--provider-revision requires provider-id=<sha>');
      providerRevisions.set(binding.slice(0, sep), binding.slice(sep + 1));
      i++;
    }
  }

  // --admission-registry override
  const regIdx = cliArgs.indexOf('--admission-registry');
  const registryPath = regIdx !== -1 && cliArgs[regIdx + 1]
    ? cliArgs[regIdx + 1]
    : ADMISSION_REGISTRY_PATH;

  const admissionRegistry = loadAdmissionRegistry(registryPath);
  const codexTomlText = safeReadText(path.join(os.homedir(), '.codex/config.toml'));
  const claudeJsonText = safeReadText(path.join(os.homedir(), '.claude.json'));
  const docTexts = loadKnownBrainDocs();
  const govPath = path.join(SCRIPT_ROOT, 'operations/specs/graphify-transition-governance.json');
  const governanceJson = safeReadJson(govPath);

  const sharedOpts = { fixtureOnly: false, codexTomlText, claudeJsonText, registry: admissionRegistry, docTexts, governanceJson };

  const providerRevisionResult = await detectProviderRevisionMismatch({
    fixtureOnly: false,
    providerRoots,
    providerRevisions,
    registry: admissionRegistry,
  });

  const detections = [
    detectAdmissionWithoutRegistration(sharedOpts),
    detectCandidateDescribedAsDefault(sharedOpts),
    detectRetiredBridgeEnabled(sharedOpts),
    providerRevisionResult,
    detectPrematureCodebaseMemoryRegistration(sharedOpts),
    detectWorkbenchScopeExceedance(sharedOpts),
    detectBareCredentialInConfig(sharedOpts),
    detectGraphifySchedulerViolation(sharedOpts),
    detectGraphifyFalseTruthClaim(sharedOpts),
    detectCodebaseMemoryFalseDefaultClaim(sharedOpts),
  ];

  const overallLevel = aggregateLevel(detections);
  console.log(`mcp-runtime-truth-check=${overallLevel}`);
  for (const d of detections) {
    console.log(`${d.key}=${d.value}`);
  }
  process.exitCode = exitCodeFor(overallLevel, strict);
}

// ---------------------------------------------------------------------------
// Entry point — protected by main-module guard so imports never execute CLI
// ---------------------------------------------------------------------------

const IS_MAIN = (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))
);

if (IS_MAIN) {
  runCli().catch((err) => {
    console.error('validate-mcp-runtime-truth: unexpected error:', err.message);
    process.exit(2);
  });
}

async function runCli() {
  // Reload args inside the CLI entry so library functions stay pure
  const cliArgs = process.argv.slice(2);
  const fixtureOnly = cliArgs.includes('--fixture-only');
  const fixtureScenario = (() => {
    const idx = cliArgs.indexOf('--fixture-scenario');
    return idx !== -1 ? (cliArgs[idx + 1] ?? null) : null;
  })();
  const strict = cliArgs.includes('--strict');

  if (fixtureOnly) {
    runFixtureMode(strict);
    return;
  }
  if (fixtureScenario !== null) {
    runFixtureScenarioMode(fixtureScenario, strict);
    return;
  }
  await runRealMode(strict);
}
