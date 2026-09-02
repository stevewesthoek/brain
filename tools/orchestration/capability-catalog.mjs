import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { adapterDescriptorDefinitions } from './domain-adapters.mjs';

export const DESCRIPTOR_SCHEMA_VERSION = '2.0.0';
export const CONSUMERS = Object.freeze(['claude', 'codex', 'gemini', 'antigravity', 'kiro']);
export const DEFAULT_ACTIVE_PROFILE = 'default';

const KINDS = new Set(['skill', 'orchestrator', 'runbook', 'named_cli', 'validator', 'mcp_server', 'mcp_tool', 'local_app', 'workflow', 'adapter']);
const ROLES = new Set(['router', 'specialist', 'quality_gate', 'safety_gate', 'execution', 'adapter', 'utility']);
const RISKS = new Set(['read-only', 'low', 'medium', 'high', 'critical']);
const CONFIRMATIONS = new Set(['none', 'policy', 'user', 'admin']);
const HEALTH = new Set(['healthy', 'degraded', 'unavailable', 'disabled', 'unknown']);
const FRESHNESS = new Set(['fresh', 'review_due', 'stale', 'superseded', 'contradicted', 'unknown']);
const SOURCE_PREFIX_BYTES = 32768;

const ROUTING_OVERRIDES = Object.freeze({
  code: {
    role: 'router', label: 'Code Orchestrator', domains: ['code', 'software'],
    intents: ['build', 'fix', 'refactor', 'implement', 'debug'],
    triggers: ['build', 'fix', 'code', 'bug', 'feature', 'refactor', 'implement', 'debug', 'app', 'repository'],
    excludes: ['pure research', 'visual direction without implementation'], sideEffects: ['repository_write'], riskClass: 'medium', confirmationClass: 'policy',
    qualityGateRefs: ['gate.review', 'gate.qa'], preferredWith: ['review', 'qa', 'careful'],
  },
  design: {
    role: 'router', label: 'Design Orchestrator', domains: ['design', 'product', 'visual'],
    intents: ['design', 'visual_direction', 'layout', 'brand', 'ui'],
    triggers: ['design', 'visual', 'beautiful', 'premium', 'layout', 'landing page', 'website', 'dashboard', 'ui', 'redesign'],
    excludes: ['backend-only implementation', 'credential or production mutation'], sideEffects: ['repository_write'], riskClass: 'medium', confirmationClass: 'policy',
    qualityGateRefs: ['gate.design-review', 'gate.visual-qa'], preferredWith: ['web-design', 'design-review', 'code', 'qa'],
  },
  research: {
    role: 'router', label: 'Research Orchestrator', domains: ['research', 'evidence'],
    intents: ['research', 'compare', 'verify', 'synthesize', 'fact_check'],
    triggers: ['research', 'investigate', 'compare', 'verify', 'evidence', 'source', 'market', 'company', 'current', 'what is happening'],
    excludes: ['unbounded speculation'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none',
    qualityGateRefs: ['gate.source-provenance', 'gate.citation-completeness'], preferredWith: ['web', 'bible-research', 'scripture-sources'],
  },
  web: {
    role: 'router', label: 'Web Orchestrator', domains: ['web', 'browser', 'automation'],
    intents: ['browse', 'scrape', 'web_research', 'site_test', 'browser_automation'],
    triggers: ['browser', 'website', 'web', 'scrape', 'crawl', 'form', 'login', 'url', 'site', 'automation'],
    excludes: ['external write without confirmation'], sideEffects: ['external_state'], riskClass: 'medium', confirmationClass: 'user',
    qualityGateRefs: ['gate.source-provenance', 'gate.browser-evidence'], preferredWith: ['research', 'qa'],
  },
  video: {
    role: 'router', label: 'Video Orchestrator', domains: ['video', 'media', 'content'],
    intents: ['video_plan', 'script', 'voiceover', 'thumbnail', 'render', 'publish'],
    triggers: ['video', 'episode', 'script', 'voiceover', 'thumbnail', 'youtube', 'render', 'shorts', 'caption'],
    excludes: ['direct publishing without approval'], sideEffects: ['repository_write', 'external_state'], riskClass: 'medium', confirmationClass: 'policy',
    qualityGateRefs: ['gate.render-review', 'gate.content-review'], preferredWith: ['design', 'web', 'careful'],
  },
  memory: {
    role: 'router', label: 'Memory Orchestrator', domains: ['memory', 'personal_context'],
    intents: ['remember', 'recall', 'save_fact', 'decision_recall'],
    triggers: ['remember', 'recall', 'memory', 'what did we decide', 'save this', 'forget'],
    excludes: ['saving without explicit user intent'], sideEffects: ['memory_write_possible'], riskClass: 'medium', confirmationClass: 'user',
    qualityGateRefs: ['gate.memory-authority'], preferredWith: ['handoff', 'careful'],
  },
  review: {
    role: 'quality_gate', label: 'Review Gate', domains: ['quality', 'code', 'design'],
    intents: ['review', 'critique', 'preflight', 'adversarial_check'],
    triggers: ['review', 'critique', 'audit', 'preflight', 'diff', 'ready to ship'],
    excludes: ['silent mutation'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none',
    qualityGateRefs: [], preferredWith: ['code', 'design', 'research', 'qa'],
  },
  qa: {
    role: 'quality_gate', label: 'QA Gate', domains: ['quality', 'testing', 'verification'],
    intents: ['test', 'verify', 'qa', 'acceptance_check', 'visual_qa'],
    triggers: ['test', 'qa', 'verify', 'works', 'broken', 'regression', 'acceptance', 'visual check'],
    excludes: ['claiming success without evidence'], sideEffects: ['local_write'], riskClass: 'low', confirmationClass: 'policy',
    qualityGateRefs: [], preferredWith: ['code', 'design', 'web'],
  },
  handoff: {
    role: 'router', label: 'Handoff Orchestrator', domains: ['continuity', 'session'],
    intents: ['pause', 'resume', 'handoff', 'continue_later'],
    triggers: ['handoff', 'continue tomorrow', 'pause', 'resume', 'another agent', 'pick this up'],
    excludes: ['implicit external task creation'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none',
    qualityGateRefs: ['gate.continuity'], preferredWith: ['memory', 'careful'],
  },
  careful: {
    role: 'safety_gate', label: 'Careful Safety Gate', domains: ['risk', 'safety', 'operations'],
    intents: ['risk_review', 'confirmation', 'destructive_action_review', 'credential_boundary'],
    triggers: ['production', 'delete', 'destroy', 'deploy', 'credential', 'secret', 'database', 'payment', 'publish', 'financial'],
    excludes: ['unsafe execution', 'unconfirmed external mutation'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none',
    qualityGateRefs: ['gate.confirmation', 'gate.rollback'], preferredWith: ['code', 'web', 'video', 'memory'],
  },
  'bible-research': {
    role: 'specialist', label: 'Bible Research Specialist', domains: ['bible', 'theology', 'research'],
    intents: ['bible_research', 'passage_context', 'theological_synthesis'],
    triggers: ['bible', 'scripture', 'passage', 'romans', 'torah', 'covenant', 'yeshua', 'textual context'],
    excludes: ['unsupported doctrinal certainty'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none',
    qualityGateRefs: ['gate.source-provenance', 'gate.citation-completeness'], preferredWith: ['research', 'scripture-sources'],
  },
  'scripture-sources': {
    role: 'specialist', label: 'Scripture Sources Specialist', domains: ['bible', 'sources', 'research'],
    intents: ['scripture_sources', 'translation_compare', 'citation'],
    triggers: ['translation', 'manuscript', 'lexicon', 'scripture source', 'citation'],
    excludes: ['invented citations'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none',
    qualityGateRefs: ['gate.source-provenance', 'gate.citation-completeness'], preferredWith: ['bible-research'],
  },
  'web-design': {
    role: 'specialist', label: 'Web Design Specialist', domains: ['design', 'web', 'product'],
    intents: ['landing_page_spec', 'saas_spec', 'dashboard_spec', 'conversion_design'],
    triggers: ['landing page', 'saas', 'dashboard', 'funnel', 'marketing site', 'implementation-ready'],
    excludes: ['unbounded redesign'], sideEffects: [], riskClass: 'low', confirmationClass: 'none',
    qualityGateRefs: ['gate.design-review'], preferredWith: ['design', 'code', 'design-review'],
  },
  'design-review': {
    role: 'quality_gate', label: 'Design Review Specialist', domains: ['design', 'quality'],
    intents: ['design_review', 'visual_critique', 'brand_check'], triggers: ['design review', 'visual review', 'brand check', 'polish'],
    excludes: ['implementation without brief'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [], preferredWith: ['design', 'qa'],
  },
  'design-system': {
    role: 'specialist', label: 'Design System Specialist', domains: ['design', 'ui', 'frontend'],
    intents: ['design_system', 'tokens', 'components'], triggers: ['design system', 'tokens', 'components', 'spacing', 'type scale'],
    excludes: ['provider-specific implementation'], sideEffects: [], riskClass: 'low', confirmationClass: 'none', qualityGateRefs: ['gate.design-review'], preferredWith: ['design', 'code'],
  },
  'plan-eng-review': {
    role: 'quality_gate', label: 'Engineering Plan Review', domains: ['code', 'architecture', 'quality'],
    intents: ['engineering_plan', 'architecture_review'], triggers: ['architecture', 'engineering plan', 'implementation plan', 'blast radius'],
    excludes: ['execution'], sideEffects: [], riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [], preferredWith: ['code', 'review'],
  },
  investigate: {
    role: 'specialist', label: 'Investigation Specialist', domains: ['code', 'debugging'],
    intents: ['diagnose', 'investigate', 'root_cause'], triggers: ['investigate', 'diagnose', 'root cause', 'why is', 'debug'],
    excludes: ['unverified fix'], sideEffects: [], riskClass: 'low', confirmationClass: 'none', qualityGateRefs: ['gate.qa'], preferredWith: ['code', 'review'],
  },
  ship: {
    role: 'specialist', label: 'Ship Specialist', domains: ['code', 'delivery'],
    intents: ['commit', 'pull_request', 'ship'], triggers: ['ship', 'commit', 'pull request', 'merge'],
    excludes: ['force push', 'production deploy without confirmation'], sideEffects: ['repository_write', 'external_state'], riskClass: 'high', confirmationClass: 'user', qualityGateRefs: ['gate.review'], preferredWith: ['code', 'careful'],
  },
});

const SUPPLEMENTAL_SOURCES = Object.freeze([
  ...adapterDescriptorDefinitions(),
  { capabilityId: 'adapter.context-broker', kind: 'adapter', role: 'adapter', label: 'Context Broker Adapter', sourceRef: 'tools/context-learning/context-broker.mjs', domains: ['context', 'broker'], intents: ['capability_discovery', 'context_resolution'], triggers: ['context broker', 'capability list', 'capability inspect'], summary: 'Read-only broker contracts for context and capability discovery.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'workflow.universal-brain-entry', kind: 'workflow', role: 'router', label: 'Universal Brain Entry', sourceRef: 'tools/context-learning/universal-brain-entry.mjs', domains: ['routing', 'context'], intents: ['ordinary_intent_entry'], triggers: ['brain entry', 'ordinary request'], summary: 'Existing universal entry boundary; Phase 1 shadow routing does not replace or activate it.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'adapter.brain-core-agent-capabilities', kind: 'adapter', role: 'adapter', label: 'Brain Core Agent Capability Adapter', sourceRef: 'projects/brain-core/src/adapters/agent-capabilities.ts', domains: ['capability_catalog'], intents: ['capability_projection'], triggers: ['agent capability', 'capability adapter'], summary: 'Existing Brain Core capability summaries projected into the Phase 1 catalog.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'validator.context-learning-contracts', kind: 'validator', role: 'quality_gate', label: 'Context Learning Contract Validator', sourceRef: 'tools/validate-context-learning-contracts.mjs', domains: ['quality', 'contracts'], intents: ['contract_validation'], triggers: ['contract validation', 'context contract'], summary: 'Existing validator for context-learning contracts.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'validator.context-learning-broker', kind: 'validator', role: 'quality_gate', label: 'Context Learning Broker Validator', sourceRef: 'tools/validate-context-learning-broker.mjs', domains: ['quality', 'contracts'], intents: ['broker_validation'], triggers: ['broker validation'], summary: 'Existing validator for the read-only context broker surface.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'mcp.codebase-memory', kind: 'mcp_server', role: 'adapter', label: 'Codebase Memory MCP', sourceRef: 'operations/specs/mcp-provider-admissions.json', domains: ['code', 'structure', 'navigation'], intents: ['structural_navigation', 'code_search'], triggers: ['codebase memory', 'architecture map', 'caller callee'], summary: 'Admitted structural navigation provider; generated projections remain non-authoritative.', riskClass: 'medium', confirmationClass: 'policy', qualityGateRefs: [] },
  { capabilityId: 'mcp.mind-context', kind: 'mcp_server', role: 'adapter', label: 'Mind Context MCP', sourceRef: 'operations/specs/mcp-provider-admissions.json', domains: ['memory', 'context'], intents: ['personal_context_read'], triggers: ['personal context', 'strategy context', 'mind context'], summary: 'Admitted read-oriented Mind context provider; Mind mutation remains outside Phase 1.', riskClass: 'medium', confirmationClass: 'policy', qualityGateRefs: ['gate.memory-authority'] },
  { capabilityId: 'mcp.workbench', kind: 'mcp_server', role: 'adapter', label: 'Workbench MCP', sourceRef: 'operations/specs/mcp-provider-admissions.json', domains: ['workbench', 'operations'], intents: ['workbench_context'], triggers: ['workbench', 'operator context'], summary: 'Admitted Workbench provider with separate action boundaries; no Phase 1 execution.', riskClass: 'high', confirmationClass: 'user', qualityGateRefs: ['gate.confirmation'] },
  { capabilityId: 'gate.source-provenance', kind: 'validator', role: 'quality_gate', label: 'Source Provenance Gate', sourceRef: 'ai/policy/context-loading-order.md', domains: ['research', 'evidence'], intents: ['source_validation'], triggers: ['source provenance', 'primary source', 'evidence'], summary: 'Require cited, authority-aware source evidence before research claims.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.citation-completeness', kind: 'validator', role: 'quality_gate', label: 'Citation Completeness Gate', sourceRef: 'operations/specs/context-pack.schema.json', domains: ['research', 'evidence'], intents: ['citation_check'], triggers: ['citation', 'citations'], summary: 'Require citations and bounded unknowns for evidence-oriented work.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.review', kind: 'validator', role: 'quality_gate', label: 'Review Quality Gate', sourceRef: 'ai/policy/code-orchestration.md', domains: ['code', 'quality'], intents: ['review_gate'], triggers: ['review gate'], summary: 'Predict review for meaningful code changes.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.qa', kind: 'validator', role: 'quality_gate', label: 'QA Quality Gate', sourceRef: 'ai/policy/code-orchestration.md', domains: ['code', 'quality'], intents: ['qa_gate'], triggers: ['qa gate'], summary: 'Predict targeted QA when behavior or UI changes warrant verification.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.design-review', kind: 'validator', role: 'quality_gate', label: 'Design Review Gate', sourceRef: 'ai/policy/routing.md', domains: ['design', 'quality'], intents: ['design_gate'], triggers: ['design gate'], summary: 'Predict visual/design review for design-led work.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.visual-qa', kind: 'validator', role: 'quality_gate', label: 'Visual QA Gate', sourceRef: 'ai/policy/routing.md', domains: ['design', 'quality'], intents: ['visual_qa_gate'], triggers: ['visual qa'], summary: 'Predict visual verification for frontend and design output.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.browser-evidence', kind: 'validator', role: 'quality_gate', label: 'Browser Evidence Gate', sourceRef: 'ai/policy/routing.md', domains: ['web', 'quality'], intents: ['browser_evidence_gate'], triggers: ['browser evidence'], summary: 'Predict observable response or screenshot evidence for browser work.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.confirmation', kind: 'validator', role: 'safety_gate', label: 'Confirmation Gate', sourceRef: 'ai/policy/guardrails.md', domains: ['risk', 'safety'], intents: ['confirmation_gate'], triggers: ['confirmation gate'], summary: 'Block unsafe execution until the required confirmation class is satisfied.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.rollback', kind: 'validator', role: 'safety_gate', label: 'Rollback Gate', sourceRef: 'ai/policy/guardrails.md', domains: ['risk', 'safety'], intents: ['rollback_gate'], triggers: ['rollback'], summary: 'Require a rollback or recovery path for materially risky work.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.continuity', kind: 'validator', role: 'quality_gate', label: 'Continuity Gate', sourceRef: 'operations/specs/context-learning/session-continuity.v1.schema.json', domains: ['continuity'], intents: ['continuity_gate'], triggers: ['continuity'], summary: 'Ensure a handoff has bounded state and a resumable next step.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
  { capabilityId: 'gate.memory-authority', kind: 'validator', role: 'quality_gate', label: 'Memory Authority Gate', sourceRef: 'ai/policy/guardrails.md', domains: ['memory', 'safety'], intents: ['memory_authority_gate'], triggers: ['memory authority'], summary: 'Keep personal context authoritative and prevent implicit Mind mutation.', riskClass: 'read-only', confirmationClass: 'none', qualityGateRefs: [] },
]);

function defaultRepoRoot() {
  return path.resolve(import.meta.dirname, '../..');
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function sortStrings(values) {
  return unique(values).sort((a, b) => a.localeCompare(b));
}

function humanize(value) {
  return value.replace(/[-_.]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tokenize(value) {
  return String(value ?? '').toLowerCase().match(/[a-z0-9][a-z0-9_-]*/g) ?? [];
}

function safeRelative(filePath, root) {
  const relative = path.relative(root, filePath).split(path.sep).join('/');
  if (!relative || relative.startsWith('../') || relative.includes('..')) throw new Error(`unsafe source path: ${relative}`);
  return relative;
}

function readPrefix(filePath, stats, maxBytes = SOURCE_PREFIX_BYTES) {
  const fileSize = fs.statSync(filePath).size;
  const fd = fs.openSync(filePath, 'r');
  try {
    const firstBytes = Math.min(fileSize, 4);
    const first = Buffer.alloc(firstBytes);
    const firstRead = fs.readSync(fd, first, 0, firstBytes, 0);
    const firstText = first.subarray(0, firstRead).toString('utf8');
    if (!firstText.startsWith('---')) {
      stats.prefixReads += 1;
      stats.prefixBytes += firstRead;
      return firstText;
    }
    const chunks = [first.subarray(0, firstRead)];
    let totalBytes = firstRead;
    let position = firstRead;
    while (totalBytes < Math.min(fileSize, maxBytes)) {
      const bytesToRead = Math.min(4096, fileSize - position, maxBytes - totalBytes);
      if (bytesToRead <= 0) break;
      const buffer = Buffer.alloc(bytesToRead);
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, position);
      if (bytesRead <= 0) break;
      chunks.push(buffer.subarray(0, bytesRead));
      totalBytes += bytesRead;
      position += bytesRead;
      const text = Buffer.concat(chunks).toString('utf8');
      if (/^---\s*\n[\s\S]*?\n---\s*\n/.test(text)) {
        stats.prefixReads += 1;
        stats.prefixBytes += totalBytes;
        return text;
      }
    }
    stats.prefixReads += 1;
    stats.prefixBytes += totalBytes;
    return Buffer.concat(chunks).toString('utf8');
  } finally {
    fs.closeSync(fd);
  }
}

function readFrontmatter(filePath, stats) {
  const prefix = readPrefix(filePath, stats);
  const match = prefix.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return {};
  const metadata = {};
  for (const line of match[1].split('\n')) {
    const index = line.indexOf(':');
    if (index < 0) continue;
    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (value) metadata[key] = value;
  }
  return metadata;
}

function readFullBody(filePath, stats) {
  stats.fullBodyReads += 1;
  return fs.readFileSync(filePath, 'utf8');
}

function scanSkillSources(root, stats) {
  const skillRoot = path.join(root, 'ai', 'skills');
  const found = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name === '.git' || entry.name === 'node_modules') continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name === 'SKILL.md') found.push(fullPath);
    }
  }
  walk(skillRoot);
  stats.skillSourcesScanned = found.length;
  return found;
}

function parseProfileFile(filePath) {
  const profileName = path.basename(filePath, '.txt');
  const entries = [];
  for (const [index, line] of fs.readFileSync(filePath, 'utf8').split('\n').entries()) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    entries.push({ name: value, line: index + 1 });
  }
  return { profileName, entries };
}

function loadProfiles(root) {
  const profileRoot = path.join(root, 'docs', 'skills', 'profiles');
  if (!fs.existsSync(profileRoot)) return [];
  return fs.readdirSync(profileRoot).filter((name) => name.endsWith('.txt')).sort().map((name) => parseProfileFile(path.join(profileRoot, name)));
}

function sourceNameFromRef(sourceRef) {
  const parts = sourceRef.split('/');
  return parts.at(-2) ?? '';
}

function descriptorIdForSource(sourceRef, usedIds) {
  const sourceParts = sourceRef.split('/');
  const customIndex = sourceParts.indexOf('custom');
  const relativeParts = customIndex >= 0 ? sourceParts.slice(customIndex + 1, -1) : sourceParts.slice(-2, -1);
  const leaf = relativeParts.at(-1) ?? 'unknown';
  let id = `skill.${leaf.toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`;
  if (!usedIds.has(id)) return id;
  id = `skill.${relativeParts.join('.').toLowerCase().replace(/[^a-z0-9._-]+/g, '-')}`;
  let suffix = 2;
  while (usedIds.has(id)) id = `${id}-${suffix++}`;
  return id;
}

function loadIndexNames(root) {
  const indexPath = path.join(root, 'docs', 'skills', 'skill-index.md');
  if (!fs.existsSync(indexPath)) return new Set();
  const names = new Set();
  for (const match of fs.readFileSync(indexPath, 'utf8').matchAll(/^\|\s*`([^`]+)`\s*\|/gm)) names.add(match[1].trim());
  return names;
}

function loadActiveNames(root) {
  const activeRoot = path.join(root, 'ai', 'skills', 'active');
  if (!fs.existsSync(activeRoot)) return new Set();
  return new Set(fs.readdirSync(activeRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name));
}

function projectionNames(root, consumer) {
  const locations = {
    claude: path.join(root, 'operations', 'system-configs', 'claude', 'skills'),
    gemini: path.join(root, 'operations', 'system-configs', 'gemini', 'skills'),
    antigravity: path.join(root, 'operations', 'system-configs', 'antigravity', 'skills'),
    kiro: path.join(root, 'operations', 'system-configs', 'kiro', 'skills'),
    codex: path.join(root, 'operations', 'system-configs', 'codex', 'skills', 'user'),
  };
  const location = locations[consumer];
  if (!location || !fs.existsSync(location)) return { exists: false, names: new Set() };
  return { exists: true, names: new Set(fs.readdirSync(location, { withFileTypes: true }).filter((entry) => entry.isDirectory() || entry.isSymbolicLink()).map((entry) => entry.name)) };
}

function revisionForRef(root, relativePath, cache) {
  if (cache.has(relativePath)) return cache.get(relativePath);
  const result = spawnSync('git', ['-C', root, 'rev-parse', `HEAD:${relativePath}`], { encoding: 'utf8' });
  let revision = result.status === 0 ? result.stdout.trim() : null;
  const fullPath = path.join(root, relativePath);
  if (!revision && fs.existsSync(fullPath)) revision = crypto.createHash('sha256').update(fs.readFileSync(fullPath)).digest('hex');
  if (!revision) revision = 'unavailable';
  cache.set(relativePath, revision);
  return revision;
}

function deriveSemanticDefaults(sourceName, label, summary) {
  const terms = sortStrings(tokenize(`${sourceName} ${label} ${summary}`).filter((term) => term.length > 2));
  const domains = terms.filter((term) => ['code', 'design', 'research', 'web', 'video', 'memory', 'qa', 'review', 'handoff', 'careful', 'bible', 'scripture', 'deploy', 'cloud', 'browser', 'testing'].includes(term));
  return { domains: domains.length ? domains : ['general'], intents: terms.slice(0, 8).length ? terms.slice(0, 8) : ['supporting'], triggers: terms.slice(0, 12) };
}

function profileSourceExists(root, profileName) {
  const candidates = [
    path.join(root, 'ai', 'skills', 'custom', profileName, 'SKILL.md'),
    path.join(root, 'ai', 'skills', 'vendors', profileName, 'SKILL.md'),
  ];
  const roots = [path.join(root, 'ai', 'skills', 'custom'), path.join(root, 'ai', 'skills', 'vendors')];
  for (const sourceRoot of roots) {
    if (!fs.existsSync(sourceRoot)) continue;
    for (const owner of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
      if (!owner.isDirectory()) continue;
      candidates.push(path.join(sourceRoot, owner.name, profileName, 'SKILL.md'));
    }
  }
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function makeProvenance(fields, sourceRef, sourceRevision, derivation, routingFields = new Set(), routingRevision = sourceRevision) {
  const result = {};
  for (const field of fields) {
    result[field] = {
      sourceRef: routingFields.has(field) ? 'ai/policy/routing.md' : sourceRef,
      sourceRevision: routingFields.has(field) ? routingRevision : sourceRevision,
      derivation: routingFields.has(field) ? `${derivation}; bounded routing override` : derivation,
    };
  }
  return result;
}

function calculateDescriptorCost({ summary, instructionBytes = 0, evidence = 0 }) {
  const descriptor = Math.max(1, Math.ceil(Buffer.byteLength(summary, 'utf8') / 4) + 45);
  const instruction = Math.max(0, Math.ceil(instructionBytes / 4));
  return { descriptor, instruction, evidence, max: descriptor + instruction + evidence };
}

function buildStateModel({ sourcePresent, indexed, profileListed, defaultActive, exported, consumerReachable }) {
  return { sourcePresent, indexed, profileListed, defaultActive, exported, consumerReachable, runtimeActivated: false };
}

function sourceDescriptor({ root, sourcePath, sourceRef, profilesByName, indexNames, activeNames, projectionMap, revisionCache, stats, usedIds }) {
  const sourceName = sourceNameFromRef(sourceRef);
  const frontmatter = readFrontmatter(sourcePath, stats);
  const id = descriptorIdForSource(sourceRef, usedIds);
  usedIds.add(id);
  const override = ROUTING_OVERRIDES[sourceName] ?? {};
  const fallback = deriveSemanticDefaults(sourceName, frontmatter.name ?? humanize(sourceName), frontmatter.description ?? '');
  const summary = frontmatter.description ?? `Source skill for ${humanize(sourceName)}.`;
  const sourceRevision = revisionForRef(root, sourceRef, revisionCache);
  const profileRefs = sortStrings((profilesByName.get(sourceName) ?? []).map((item) => item.profileName));
  const profileListed = profileRefs.length > 0;
  const defaultActive = activeNames.has(sourceName);
  const exported = defaultActive;
  const consumerReachable = Object.fromEntries(CONSUMERS.map((consumer) => [consumer, defaultActive && projectionMap[consumer].names.has(sourceName)]));
  const semantic = { ...fallback, ...override };
  const routingFields = new Set(['role', 'label', 'domains', 'intents', 'triggers', 'excludes', 'sideEffects', 'riskClass', 'confirmationClass', 'qualityGateRefs', 'composition']);
  const descriptor = {
    schemaVersion: DESCRIPTOR_SCHEMA_VERSION,
    capabilityId: id,
    kind: 'skill',
    role: semantic.role ?? (sourceName.includes('review') || sourceName.includes('qa') ? 'quality_gate' : 'specialist'),
    label: semantic.label ?? frontmatter.name ?? humanize(sourceName),
    summary,
    sourceRef,
    sourceRevision,
    profileRefs,
    intents: sortStrings(semantic.intents),
    domains: sortStrings(semantic.domains),
    triggers: sortStrings(semantic.triggers),
    excludes: sortStrings(semantic.excludes ?? []),
    inputSchemaRefs: ['brain://intent/ordinary-language'],
    outputSchemaRefs: ['brain://shadow-route.v2'],
    requiredContextScopes: sortStrings(['brain-policy', ...(semantic.domains ?? []).slice(0, 2)]),
    contextCost: calculateDescriptorCost({ summary, instructionBytes: fs.statSync(sourcePath).size, evidence: semantic.role === 'router' ? 180 : 80 }),
    stateModel: buildStateModel({ sourcePresent: true, indexed: indexNames.has(sourceName), profileListed, defaultActive, exported, consumerReachable }),
    sideEffects: sortStrings(semantic.sideEffects ?? []),
    riskClass: semantic.riskClass ?? 'low',
    confirmationClass: semantic.confirmationClass ?? 'none',
    qualityGateRefs: sortStrings(semantic.qualityGateRefs ?? []),
    failureModes: sortStrings(['source_missing', 'stale_projection', ...(semantic.role === 'router' ? ['ambiguous_intent'] : ['insufficient_context'])]),
    continuity: { supportsResume: ['handoff', 'memory', 'code', 'research', 'design', 'video'].includes(sourceName), stateScope: sourceName === 'memory' ? 'mind-read-or-explicit-memory-write' : 'session-local', requiresExplicitHandoff: sourceName !== 'handoff' },
    composition: { canBePrimary: ['router', 'specialist'].includes(descriptorRole(semantic, sourceName)), canBeSpecialist: true, preferredWith: sortStrings(semantic.preferredWith ?? []), maxChildren: semantic.role === 'router' ? 4 : 2 },
    health: 'healthy',
    freshness: 'fresh',
  };
  descriptor.fieldProvenance = makeProvenance(Object.keys(descriptor), sourceRef, sourceRevision, frontmatter.name ? 'frontmatter plus profile/index projection' : 'source path plus bounded semantic projection', routingFields, revisionForRef(root, 'ai/policy/routing.md', revisionCache));
  return descriptor;
}

function descriptorRole(semantic, sourceName) {
  return semantic.role ?? (sourceName.includes('review') || sourceName.includes('qa') ? 'quality_gate' : 'specialist');
}

function supplementalDescriptor({ root, definition, revisionCache, projectionMap, activeNames, profilesByName }) {
  const sourceExists = fs.existsSync(path.join(root, definition.sourceRef));
  const sourceRevision = revisionForRef(root, definition.sourceRef, revisionCache);
  const sourceName = definition.capabilityId.replace(/^[^.]+\./, '');
  const profileRefs = sortStrings((profilesByName.get(sourceName) ?? []).map((item) => item.profileName));
  const defaultActive = definition.kind === 'skill' && activeNames.has(sourceName);
  const consumerReachable = Object.fromEntries(CONSUMERS.map((consumer) => [consumer, defaultActive && projectionMap[consumer].names.has(sourceName)]));
  const summary = definition.summary;
  const descriptor = {
    schemaVersion: DESCRIPTOR_SCHEMA_VERSION,
    capabilityId: definition.capabilityId,
    kind: definition.kind,
    role: definition.role,
    label: definition.label,
    summary,
    sourceRef: definition.sourceRef,
    sourceRevision,
    profileRefs,
    intents: sortStrings(definition.intents),
    domains: sortStrings(definition.domains),
    triggers: sortStrings(definition.triggers),
    excludes: [],
    inputSchemaRefs: ['brain://intent/ordinary-language'],
    outputSchemaRefs: ['brain://shadow-route.v2'],
    requiredContextScopes: sortStrings(['brain-policy', ...definition.domains.slice(0, 2)]),
    contextCost: calculateDescriptorCost({ summary, instructionBytes: sourceExists ? fs.statSync(path.join(root, definition.sourceRef)).size : 0, evidence: 60 }),
    stateModel: buildStateModel({ sourcePresent: sourceExists, indexed: true, profileListed: profileRefs.length > 0, defaultActive, exported: defaultActive, consumerReachable }),
    sideEffects: definition.sideEffects ?? [],
    riskClass: definition.riskClass,
    confirmationClass: definition.confirmationClass,
    qualityGateRefs: sortStrings(definition.qualityGateRefs),
    failureModes: sourceExists ? ['stale_admission', 'scope_mismatch'] : ['source_missing'],
    continuity: { supportsResume: true, stateScope: 'session-local', requiresExplicitHandoff: false },
    composition: { canBePrimary: definition.role === 'router', canBeSpecialist: ['adapter', 'quality_gate', 'safety_gate'].includes(definition.role), preferredWith: [], maxChildren: definition.role === 'router' ? 3 : 0 },
    health: definition.kind === 'mcp_server' ? (sourceExists ? 'healthy' : 'unavailable') : (sourceExists ? 'healthy' : 'unavailable'),
    freshness: sourceExists ? 'fresh' : 'unknown',
  };
  descriptor.fieldProvenance = makeProvenance(Object.keys(descriptor), definition.sourceRef, sourceRevision, 'bounded supplemental projection from existing canonical source', new Set());
  return descriptor;
}

function parseCliManifest(root, revisionCache) {
  const sourceRef = 'operations/CLI-MANIFEST.md';
  const fullPath = path.join(root, sourceRef);
  if (!fs.existsSync(fullPath)) return [];
  const sourceRevision = revisionForRef(root, sourceRef, revisionCache);
  const descriptors = [];
  const seen = new Set();
  for (const line of fs.readFileSync(fullPath, 'utf8').split('\n')) {
    const match = line.match(/^\|\s*`([^`]+)`\s*\|\s*(.*?)\|\s*(.*?)\|\s*(.*?)\|\s*(.*?)\|\s*$/);
    if (!match) continue;
    const [, name, , type, , notes] = match;
    if (!name || name === 'CLI' || seen.has(name)) continue;
    seen.add(name);
    const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const highRisk = /destroy|delete|write|provision|deploy|ledger-write|publish/.test(`${name} ${notes}`.toLowerCase());
    const external = /cloud|http|research|automation|media|finance|deploy/.test(`${type} ${notes}`.toLowerCase());
    const riskClass = highRisk ? 'high' : external ? 'medium' : 'low';
    const confirmationClass = highRisk ? 'user' : external ? 'policy' : 'none';
    const summary = `${humanize(name)} CLI; ${notes.trim() || `${type.trim()} capability from the canonical CLI manifest.`}`;
    const descriptor = {
      schemaVersion: DESCRIPTOR_SCHEMA_VERSION, capabilityId: `cli.${normalized}`, kind: 'named_cli', role: 'execution', label: humanize(name), summary,
      sourceRef, sourceRevision, profileRefs: [], intents: sortStrings([type.trim() || 'utility', ...tokenize(name).slice(0, 4)]), domains: sortStrings([type.trim() || 'utility']), triggers: sortStrings([name, ...tokenize(notes).slice(0, 5)]), excludes: highRisk ? ['unconfirmed mutation'] : [],
      inputSchemaRefs: ['brain://intent/ordinary-language'], outputSchemaRefs: ['brain://shadow-route.v2'], requiredContextScopes: ['brain-policy', 'operations'], contextCost: calculateDescriptorCost({ summary, evidence: 40 }),
      stateModel: buildStateModel({ sourcePresent: true, indexed: true, profileListed: false, defaultActive: false, exported: false, consumerReachable: Object.fromEntries(CONSUMERS.map((consumer) => [consumer, false])) }),
      sideEffects: highRisk ? ['external_state'] : external ? ['external_state_possible'] : [], riskClass, confirmationClass, qualityGateRefs: highRisk ? ['gate.confirmation', 'gate.rollback'] : [], failureModes: ['manifest_stale', 'command_unavailable'],
      continuity: { supportsResume: false, stateScope: 'session-local', requiresExplicitHandoff: false }, composition: { canBePrimary: false, canBeSpecialist: true, preferredWith: [], maxChildren: 0 }, health: 'unknown', freshness: 'review_due',
    };
    descriptor.fieldProvenance = makeProvenance(Object.keys(descriptor), sourceRef, sourceRevision, 'CLI manifest row projection', new Set());
    descriptors.push(descriptor);
  }
  return descriptors;
}

function parseRunbookDescriptors(root, revisionCache) {
  const runbookRoot = path.join(root, 'operations', 'runbooks');
  const descriptors = [];
  function walk(directory) {
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.md')) {
        const sourceRef = safeRelative(fullPath, root);
        const stem = entry.name.replace(/\.md$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const sourceRevision = revisionForRef(root, sourceRef, revisionCache);
        const risky = /deploy|production|credential|secret|delete|destroy|migration|publish/.test(stem);
        const summary = `Canonical runbook source for ${humanize(stem)}.`;
        const descriptor = {
          schemaVersion: DESCRIPTOR_SCHEMA_VERSION, capabilityId: `runbook.${stem}`, kind: 'runbook', role: 'utility', label: humanize(stem), summary,
          sourceRef, sourceRevision, profileRefs: [], intents: sortStrings(tokenize(stem).slice(0, 8)), domains: sortStrings(tokenize(stem).filter((term) => ['code', 'design', 'research', 'web', 'video', 'memory', 'deploy', 'security', 'context', 'skill', 'profile'].includes(term))), triggers: sortStrings(tokenize(stem)), excludes: risky ? ['unconfirmed mutation'] : [],
          inputSchemaRefs: ['brain://intent/ordinary-language'], outputSchemaRefs: ['brain://shadow-route.v2'], requiredContextScopes: ['brain-policy', 'operations'], contextCost: calculateDescriptorCost({ summary, evidence: risky ? 80 : 40 }),
          stateModel: buildStateModel({ sourcePresent: true, indexed: true, profileListed: false, defaultActive: false, exported: false, consumerReachable: Object.fromEntries(CONSUMERS.map((consumer) => [consumer, false])) }),
          sideEffects: risky ? ['external_state_possible'] : [], riskClass: risky ? 'high' : 'low', confirmationClass: risky ? 'user' : 'none', qualityGateRefs: risky ? ['gate.confirmation'] : [], failureModes: ['runbook_stale', 'scope_mismatch'],
          continuity: { supportsResume: true, stateScope: 'session-local', requiresExplicitHandoff: false }, composition: { canBePrimary: false, canBeSpecialist: true, preferredWith: [], maxChildren: 0 }, health: 'healthy', freshness: 'fresh',
        };
        descriptor.fieldProvenance = makeProvenance(Object.keys(descriptor), sourceRef, sourceRevision, 'runbook filename projection', new Set());
        descriptors.push(descriptor);
      }
    }
  }
  walk(runbookRoot);
  return descriptors;
}

function sortDescriptors(descriptors) {
  return descriptors.slice().sort((a, b) => a.capabilityId.localeCompare(b.capabilityId));
}

function compactDescriptor(descriptor) {
  const result = clone(descriptor);
  delete result.instructions;
  return result;
}

function listDescriptor(descriptor) {
  const result = compactDescriptor(descriptor);
  delete result.fieldProvenance;
  return result;
}

function scoreDescriptor(descriptor, query) {
  const terms = tokenize(query);
  if (!terms.length) return 0;
  const haystack = tokenize(`${descriptor.capabilityId} ${descriptor.label} ${descriptor.summary} ${descriptor.intents.join(' ')} ${descriptor.domains.join(' ')} ${descriptor.triggers.join(' ')}`);
  return terms.reduce((score, term) => score + (haystack.includes(term) ? (descriptor.triggers.includes(term) ? 4 : 1) : 0), 0);
}

function validateDescriptor(descriptor) {
  const errors = [];
  if (descriptor.schemaVersion !== DESCRIPTOR_SCHEMA_VERSION) errors.push('invalid schemaVersion');
  if (!KINDS.has(descriptor.kind)) errors.push('invalid kind');
  if (!ROLES.has(descriptor.role)) errors.push('invalid role');
  if (!RISKS.has(descriptor.riskClass)) errors.push('invalid riskClass');
  if (!CONFIRMATIONS.has(descriptor.confirmationClass)) errors.push('invalid confirmationClass');
  if (!HEALTH.has(descriptor.health)) errors.push('invalid health');
  if (!FRESHNESS.has(descriptor.freshness)) errors.push('invalid freshness');
  if (!descriptor.sourceRef) errors.push('missing sourceRef');
  if (!descriptor.sourceRevision || descriptor.sourceRevision === 'unavailable') errors.push('missing source revision');
  if (!descriptor.stateModel?.sourcePresent && descriptor.health === 'healthy') errors.push('unavailable source marked healthy');
  if (descriptor.riskClass === 'read-only' && ['user', 'admin'].includes(descriptor.confirmationClass)) errors.push('read-only descriptor has excessive confirmation');
  if (descriptor.riskClass === 'critical' && descriptor.confirmationClass === 'none') errors.push('critical descriptor lacks confirmation');
  const requiredFields = ['schemaVersion', 'capabilityId', 'kind', 'role', 'label', 'sourceRef', 'sourceRevision', 'profileRefs', 'intents', 'domains', 'triggers', 'excludes', 'inputSchemaRefs', 'outputSchemaRefs', 'requiredContextScopes', 'contextCost', 'stateModel', 'sideEffects', 'riskClass', 'confirmationClass', 'qualityGateRefs', 'failureModes', 'continuity', 'composition', 'health', 'freshness'];
  for (const field of requiredFields) if (!(field in descriptor)) errors.push(`missing field ${field}`);
  for (const field of requiredFields) if (!descriptor.fieldProvenance?.[field]) errors.push(`missing provenance ${field}`);
  if (descriptor.stateModel?.runtimeActivated !== false) errors.push('runtimeActivated must remain false in Phase 1');
  return errors;
}

function profileHealth(profiles, root) {
  return Object.fromEntries(profiles.map((profile) => {
    const seen = new Set();
    const duplicates = [];
    const unresolved = [];
    for (const entry of profile.entries) {
      if (seen.has(entry.name)) duplicates.push(entry.name);
      seen.add(entry.name);
      if (!profileSourceExists(root, entry.name)) unresolved.push(entry.name);
    }
    return [profile.profileName, { entries: profile.entries.length, duplicates: sortStrings(duplicates), unresolved: sortStrings(unresolved), resolved: profile.entries.length - unresolved.length, healthy: duplicates.length === 0 && unresolved.length === 0 }];
  }));
}

function projectionHealth(root, defaultNames) {
  const result = {};
  for (const consumer of CONSUMERS) {
    const projection = projectionNames(root, consumer);
    const missing = [...defaultNames].filter((name) => !projection.names.has(name));
    const extra = [...projection.names].filter((name) => !defaultNames.has(name));
    result[consumer] = { exists: projection.exists, names: [...projection.names].sort(), missing: missing.sort(), extra: extra.sort(), healthy: projection.exists && missing.length === 0 && extra.length === 0 };
  }
  return result;
}

function reconcile({ root, descriptors, profiles, activeNames, indexNames, projectionMap }) {
  const issues = [];
  const byId = new Map();
  for (const descriptor of descriptors) {
    if (byId.has(descriptor.capabilityId)) issues.push({ code: 'duplicate_capability_id', capabilityId: descriptor.capabilityId, detail: 'Capability ID appears more than once.' });
    byId.set(descriptor.capabilityId, descriptor);
    for (const error of validateDescriptor(descriptor)) issues.push({ code: error.replaceAll(' ', '_'), capabilityId: descriptor.capabilityId, detail: error });
  }
  const profileStatus = profileHealth(profiles, root);
  for (const [profileName, status] of Object.entries(profileStatus)) {
    for (const name of status.duplicates) issues.push({ code: 'duplicate_profile_entry', profile: profileName, detail: `${profileName}:${name}` });
    for (const name of status.unresolved) {
      issues.push({ code: 'profile_no_source', profile: profileName, detail: `${profileName}:${name}` });
      issues.push({ code: 'profile_source_divergence', profile: profileName, detail: `${profileName}:${name}` });
    }
  }
  const projectionStatus = projectionHealth(root, new Set([...activeNames]));
  for (const [consumer, status] of Object.entries(projectionStatus)) {
    if (!status.healthy) issues.push({ code: 'consumer_projection_divergence', profile: consumer, detail: `missing=${status.missing.join(',')};extra=${status.extra.join(',')};exists=${status.exists}` });
  }
  for (const descriptor of descriptors) {
    if (descriptor.kind === 'skill' && descriptor.stateModel.indexed === false) issues.push({ code: 'stale_projection', capabilityId: descriptor.capabilityId, detail: 'Skill source is present but absent from the human skill index.' });
    if (descriptor.kind === 'skill' && descriptor.profileRefs.length > 0 && descriptor.stateModel.sourcePresent === false) issues.push({ code: 'profile_source_divergence', capabilityId: descriptor.capabilityId, detail: 'Profile refers to a missing source.' });
  }
  return { valid: issues.length === 0, issues, summary: Object.fromEntries([...new Set(issues.map((issue) => issue.code))].sort().map((code) => [code, issues.filter((issue) => issue.code === code).length])), profileHealth: profileStatus, consumerProjectionHealth: projectionStatus, sourceInventory: { descriptors: descriptors.length, indexed: [...indexNames].length } };
}

export function createCapabilityCatalog({ repoRoot = defaultRepoRoot(), sourceRevision = null } = {}) {
  const root = path.resolve(repoRoot);
  const stats = { prefixReads: 0, prefixBytes: 0, fullBodyReads: 0, skillSourcesScanned: 0, runbooksScanned: 0 };
  const revisionCache = new Map();
  const profiles = loadProfiles(root);
  const profilesByName = new Map();
  for (const profile of profiles) for (const entry of profile.entries) profilesByName.set(entry.name, [...(profilesByName.get(entry.name) ?? []), profile]);
  const indexNames = loadIndexNames(root);
  const activeNames = loadActiveNames(root);
  const projectionMap = Object.fromEntries(CONSUMERS.map((consumer) => [consumer, projectionNames(root, consumer)]));
  const usedIds = new Set();
  const sourceDescriptors = scanSkillSources(root, stats).map((sourcePath) => {
    const sourceRef = safeRelative(sourcePath, root);
    return sourceDescriptor({ root, sourcePath, sourceRef, profilesByName, indexNames, activeNames, projectionMap, revisionCache, stats, usedIds });
  });
  const supplementalDescriptors = SUPPLEMENTAL_SOURCES.map((definition) => supplementalDescriptor({ root, definition, revisionCache, projectionMap, activeNames, profilesByName }));
  const cliDescriptors = parseCliManifest(root, revisionCache);
  const runbookDescriptors = parseRunbookDescriptors(root, revisionCache);
  stats.runbooksScanned = runbookDescriptors.length;
  const descriptors = sortDescriptors([...sourceDescriptors, ...supplementalDescriptors, ...cliDescriptors, ...runbookDescriptors]);
  const reconciliation = reconcile({ root, descriptors, profiles, activeNames, indexNames, projectionMap });
  const fixedSourceRevision = sourceRevision ?? null;

  function list({ query = '', maxItems = 100, kind = null } = {}) {
    const candidates = descriptors.filter((descriptor) => !kind || descriptor.kind === kind).map((descriptor) => ({ descriptor, score: scoreDescriptor(descriptor, query) }));
    candidates.sort((left, right) => right.score - left.score || left.descriptor.capabilityId.localeCompare(right.descriptor.capabilityId));
    const selected = candidates.slice(0, Math.max(0, maxItems)).map(({ descriptor }) => listDescriptor(descriptor));
    return { schemaVersion: DESCRIPTOR_SCHEMA_VERSION, operation: 'capabilities_list', query, descriptors: selected, telemetry: { ...stats, fullBodyReadsDuringList: 0, descriptorCount: descriptors.length, candidatesScanned: candidates.length }, sourceRevision: fixedSourceRevision ?? 'catalog-derived' };
  }

  function inspect({ capabilityId, includeInstructions = true } = {}) {
    const descriptor = descriptors.find((candidate) => candidate.capabilityId === capabilityId);
    if (!descriptor) return { schemaVersion: DESCRIPTOR_SCHEMA_VERSION, operation: 'capabilities_inspect', capabilityId, found: false, instructionsIncluded: false, instructions: null, source: null, telemetry: { ...stats } };
    const fullPath = path.join(root, descriptor.sourceRef);
    const instructions = includeInstructions && fs.existsSync(fullPath) ? readFullBody(fullPath, stats) : null;
    return { schemaVersion: DESCRIPTOR_SCHEMA_VERSION, operation: 'capabilities_inspect', capabilityId, found: true, descriptor: compactDescriptor(descriptor), instructionsIncluded: instructions !== null, instructions, source: { sourceRef: descriptor.sourceRef, exactPath: fullPath }, telemetry: { ...stats } };
  }

  return {
    schemaVersion: DESCRIPTOR_SCHEMA_VERSION,
    repoRoot: root,
    descriptors: clone(descriptors),
    profiles: clone(profiles),
    profileHealth: clone(reconciliation.profileHealth),
    reconciliation,
    list,
    inspect,
    metrics: () => ({ ...stats, descriptorCount: descriptors.length, skillDescriptorCount: sourceDescriptors.length, supplementalDescriptorCount: supplementalDescriptors.length, cliDescriptorCount: cliDescriptors.length, runbookDescriptorCount: runbookDescriptors.length }),
  };
}

export function buildCapabilityCatalog(options = {}) {
  return createCapabilityCatalog(options);
}

export function validateCapabilityDescriptors(descriptors) {
  const errors = [];
  const seen = new Set();
  for (const descriptor of descriptors) {
    if (seen.has(descriptor.capabilityId)) errors.push(`${descriptor.capabilityId}: duplicate capability ID`);
    seen.add(descriptor.capabilityId);
    errors.push(...validateDescriptor(descriptor).map((error) => `${descriptor.capabilityId}: ${error}`));
  }
  return errors;
}

export function getCapabilityCatalogDefaults() {
  return { schemaVersion: DESCRIPTOR_SCHEMA_VERSION, defaultProfile: DEFAULT_ACTIVE_PROFILE, routeFamilies: ['code', 'design', 'web', 'research', 'bible-research', 'memory', 'review', 'qa', 'handoff', 'careful', 'video', 'mixed'] };
}
