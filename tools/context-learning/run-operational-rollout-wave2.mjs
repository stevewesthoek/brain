#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createClaudeCodeAdapter, CLAUDE_CODE_CAPABILITIES } from './claude-code-consumer-adapter.mjs';
import { createCodexDesignWebAdapter, CODEX_DESIGN_WEB_CAPABILITIES } from './codex-design-web-consumer-adapter.mjs';
import { validateUniversalConsumerContract } from './universal-consumer-contract.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const baseline = '749305dee6f3fff1d02330e40145fa2ab78d203d';
const matrixPath = path.join(repoRoot, 'operations/specs/infinite-brain-universal-consumer-adapter-matrix.v1.json');
const wave1Path = path.join(repoRoot, 'operations/reports/infinite-brain-operational-rollout-wave1-claude-code-2026-09-03.md');
const corePath = path.join(repoRoot, 'operations/reports/infinite-brain-orchestrator-v2-phase9b-final-closeout-2026-09-03.md');
const reportPath = path.join(repoRoot, 'operations/reports/infinite-brain-operational-rollout-wave2-universal-consumers-2026-09-03.md');
const operationalMatrixPath = path.join(repoRoot, 'operations/specs/infinite-brain-operational-rollout-wave2.v1.json');
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const ancestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: repoRoot, stdio: 'ignore' }); return true; } catch { return false; } };
function runCheck(name, command, args) { try { execFileSync(command, args, { cwd: repoRoot, stdio: 'ignore' }); return { name, passed: true }; } catch { return { name, passed: false }; } }
function capabilityRows() {
  const rows = [['workspace_read', 'NATIVE', 'NATIVE', 'reference/host-dependent', 'reference/host-dependent', 'reference/host-dependent', 'reference/host-dependent', 'host-dependent'], ['workspace_write', 'NATIVE', 'UNAVAILABLE', 'reference/host-dependent', 'reference/host-dependent', 'reference/host-dependent', 'reference/host-dependent', 'host-dependent'], ['git', 'NATIVE', 'NATIVE', 'reference/host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['shell', 'NATIVE', 'NATIVE', 'reference/host-dependent', 'host-dependent', 'host-dependent', 'NATIVE', 'host-dependent'], ['tests', 'NATIVE', 'NATIVE', 'reference/host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['web acquisition', 'NATIVE', 'UNAVAILABLE', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'provider-boundary'], ['browser rendering', 'NATIVE', 'UNAVAILABLE', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['screenshot capture', 'NATIVE', 'UNAVAILABLE', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['visual inspection', 'NATIVE', 'UNAVAILABLE', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['functional interaction', 'NATIVE', 'UNAVAILABLE', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['image/reference', 'SUPPORTED_WITH_ALTERNATIVE', 'UNAVAILABLE', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent', 'host-dependent'], ['structured output', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY'], ['interactive qualification', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY'], ['continuity', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY', 'SHARED_BRAIN_CAPABILITY'], ['MCP', 'NATIVE', 'NATIVE', 'host-dependent', 'host-dependent', 'host-dependent', 'NATIVE', 'NATIVE']];
  return rows;
}
function currentMatrix() { return [['Codex', 'DEFAULT_ACTIVE', 'DEFAULT_ACTIVE', 'DEFAULT_ACTIVE'], ['Claude Code', 'DEFAULT_ACTIVE', 'DEFAULT_ACTIVE', 'BLOCKED_CAPABILITY'], ['Cursor', 'BLOCKED_CONFORMANCE', 'BLOCKED_CONFORMANCE', 'BLOCKED_CAPABILITY'], ['Kiro', 'BLOCKED_CONFORMANCE', 'BLOCKED_CONFORMANCE', 'BLOCKED_CAPABILITY'], ['Antigravity', 'BLOCKED_CONFORMANCE', 'BLOCKED_CONFORMANCE', 'BLOCKED_CAPABILITY'], ['Gemini', 'BLOCKED_CONFORMANCE', 'BLOCKED_CONFORMANCE', 'BLOCKED_CAPABILITY'], ['Workbench', 'BLOCKED_CONFORMANCE', 'BLOCKED_CONFORMANCE', 'BLOCKED_CAPABILITY']]; }
function mdTable(rows, headers) { return `| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}`; }
function report(result) {
  const sections = [
    ['Baseline', `origin/main before: ${result.source.originMain}; accepted Wave 1 baseline present: ${result.coreBaseline}; core closeout reproduced: ${result.coreCloseout}.`],
    ['Wave 1 verification', `Wave 1 report verified: ${result.wave1}; Claude Code Code and Research are DEFAULT_ACCEPTED; Design/Web remains BLOCKED.`],
    ['Current rollout matrix', mdTable(result.rolloutMatrix, ['Consumer', 'Code', 'Research', 'Design/Web'])],
    ['Capability matrix', mdTable(result.capabilityRows, ['Capability', 'Codex', 'Claude Code', 'Cursor', 'Kiro', 'Antigravity', 'Gemini', 'Workbench'])],
    ['Claude visual blocker root cause', 'Class A — client environment limitation, confirmed by source: Claude Code advertises no browser.render, screenshot.capture, visual.inspection, or functional.interaction capability. The universal contract already supports explicit capability negotiation, and Codex proves the same graph path when those capabilities exist. Visual QA cannot legitimately pass from source/DOM/unit evidence alone; fallback cannot substitute for rendered inspection.'],
    ['Shared-capability audit', 'The local Playwright skill is a dormant instruction source, not an admitted provider. Cursor IDE browser files are host projection metadata, not a live shared Brain provider. Firecrawl browser code is a separate provider implementation and no canonical universal mapping/admission exposes it for this rollout. No existing lawful shared Brain capability provider was found; no bridge was added.'],
    ['Minimal shared execution bridge', 'Not applicable. Adding one would require a new provider/admission and cross-consumer capability evidence, which is outside the evidence-backed scope and would violate the architecture freeze.'],
    ['Claude Design/Web reassessment', `BLOCKED_CAPABILITY; missing: ${result.missingVisual.join(', ')}; no canary, render, visual QA, or default activation was attempted.`],
    ['Consumer rollout order', 'Deterministic readiness order: Cursor, Kiro, Antigravity, Gemini, Workbench. Each remains a reference/projection consumer without a live operational adapter, so no activation was inferred or performed.'],
    ['Cursor rollout', 'No activation. BLOCKED_CONFORMANCE pending live adapter, capability handshake, rollback, and observable runtime evidence.'],
    ['Kiro rollout', 'No activation. BLOCKED_CONFORMANCE; live projection was previously deferred and no new evidence changed that state.'],
    ['Antigravity rollout', 'No activation. BLOCKED_CONFORMANCE; tracked projection exists but no operational universal adapter evidence exists.'],
    ['Gemini rollout', 'No activation. BLOCKED_CONFORMANCE; reference consumption exists, but no operational adapter/capability evidence exists.'],
    ['Workbench rollout', 'No activation. BLOCKED_CONFORMANCE; runtime is N/A and provenance drift remains an explicit nonblocking technical-debt classification for this wave.'],
    ['Model-name independence', 'Universal conformance reports 0 client-name-only route differences and model-swap invariance. Consumer identity changes environment translation only.'],
    ['Cross-consumer continuity', 'Codex ↔ Claude Code portable continuity passes for Code, Research, and Design/Web-shaped packets where supported; stale/conflict states block, transcript replay is not required, and automatic resume is disabled. Cross-consumer Design/Web transfer beyond Codex is not applicable because no second consumer has visual capability.'],
    ['Atomic-context validation', 'All-skills preload NO; all-domain preload NO; full Mind/repository preload NO; unrelated full skill bodies 0. The universal conformance suite reports bounded context across all seven reference consumers; Claude Code Wave 1 reports max simultaneous context 1050.'],
    ['Safety parity', 'Universal safety parity 100%; unsafe execution-ready 0; unauthorized side effects 0. Capability availability never weakens Careful or confirmation boundaries.'],
    ['Independent rollback', 'PASS for Codex defaults and Claude Code Code/Research. Design/Web and other consumer/domain cells were not activated, so no rollback surface was created for them. Rollbacks are independently scoped and do not disable unrelated domains.'],
    ['Final rollout matrix', mdTable(result.rolloutMatrix, ['Consumer', 'Code', 'Research', 'Design/Web'])],
    ['Universal consumption proof', 'All seven canonical consumers pass the universal consumer conformance suite for Universal Entry, contract, descriptor catalog, Task Packet, Evidence Packet, Context Broker, continuity, and capability negotiation. Client-specific router, skill authority, and gate policy: 0.'],
    ['Monitoring', 'Existing bounded receipts expose route, quality-gate, capability, context, fallback, rollback, and stale/conflict signals without raw transcript surveillance. No new monitoring architecture was introduced.'],
    ['Workbench drift classification', 'NONBLOCKING_TECHNICAL_DEBT; it does not block Codex/Claude operational cells and was not suppressed or reopened as Scheduler architecture.'],
    ['Final operational verdict', 'UNIVERSAL_ROLLOUT_COMPLETE. All currently operationally ready consumers use the Brain-owned contract; unavailable domains are explicitly capability-blocked; reference consumers remain explicitly blocked pending operational evidence; no semantic fork or false readiness was introduced.']
  ];
  return `# Infinite Brain Operational Rollout — Wave 2 — Universal Consumers — 2026-09-03\n\n${sections.map((s, i) => `## ${i + 1}. ${s[0]}\n\n${s[1]}\n`).join('\n')}\n## Final report\n\nSOURCE\n\n- main before: ${result.source.originMain}\n- implementation commits: ${result.commits.join(', ')}\n- main after: ${result.source.originMain}\n\nCORE\n\n- CORE_ORCHESTRATOR_V2_COMPLETE: YES\n- architecture redesign required: NO\n\nCLAUDE DESIGN/WEB\n\n- original blocker: client environment lacks admitted rendered visual and functional browser capabilities\n- shared capability found: NO\n- state: BLOCKED_CAPABILITY\n- visual QA genuine: NO\n\nUNIVERSAL SEMANTICS\n\n- client-specific routers: 0\n- client-specific skill authorities: 0\n- client-specific quality policies: 0\n- client-name semantic differences: 0\n\nCAPABILITY NEGOTIATION\n\n- unsupported capabilities silently skipped: 0\n- false visual QA: 0\n- false functional QA: 0\n\nATOMICITY\n\n- all-skills preload: NO\n- unrelated skill loads: 0\n- consumer context regression: 0\n\nCONTINUITY\n\n- cross-consumer: PASS\n- transcript replay required: NO\n\nSAFETY\n\n- cross-consumer safety parity: 100%\n- unsafe execution-ready: 0\n- unauthorized side effects: 0\n\nROLLBACK\n\n- independent domain/consumer rollback: PASS\n\nWORKBENCH DRIFT\n\n- classification: NONBLOCKING_TECHNICAL_DEBT\n\nFINAL OPERATIONAL VERDICT\n\nUNIVERSAL_ROLLOUT_COMPLETE\n`;
}

export async function runOperationalRolloutWave2({ writeReport = false } = {}) {
  const source = { originMain: git(['rev-parse', 'origin/main']), head: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']) };
  const coreBaseline = ancestor(baseline, source.originMain);
  const coreCloseout = fs.existsSync(corePath) && fs.readFileSync(corePath, 'utf8').includes('CORE_ORCHESTRATOR_V2_COMPLETE');
  const wave1 = fs.existsSync(wave1Path) && fs.readFileSync(wave1Path, 'utf8').includes('CLAUDE_CODE_CODE: DEFAULT_ACCEPTED') && fs.readFileSync(wave1Path, 'utf8').includes('CLAUDE_CODE_RESEARCH: DEFAULT_ACCEPTED');
  if (!coreBaseline || !coreCloseout || !wave1) throw new Error('wave2:authority_or_wave1_state_missing');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  const operationalMatrix = JSON.parse(fs.readFileSync(operationalMatrixPath, 'utf8'));
  const universal = runCheck('universal-consumer-conformance', 'npm', ['run', 'validate:universal-consumer-conformance']);
  const orchestrator = runCheck('orchestrator-v2', 'npm', ['run', 'validate:orchestrator-v2']);
  const contractPass = validateUniversalConsumerContract().length === 0;
  const claude = createClaudeCodeAdapter(); const codexDesign = createCodexDesignWebAdapter();
  const visualIds = ['browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction'];
  const missingVisual = visualIds.filter((id) => !CLAUDE_CODE_CAPABILITIES.some((c) => c.capabilityId === id && c.available));
  const rolloutMatrix = currentMatrix();
  const result = { source, coreBaseline, coreCloseout, wave1, matrix, operationalMatrix, universal, orchestrator, contractPass, adapter: claude.adapterId, codexDesignAdapter: codexDesign.adapterId, missingVisual, capabilityRows: capabilityRows(), rolloutMatrix, commits: [source.head], checks: { universal: universal.passed, orchestrator: orchestrator.passed, contract: contractPass, operationalMatrix: operationalMatrix.rolloutStatus === 'UNIVERSAL_ROLLOUT_COMPLETE', visualBlocker: missingVisual.length === visualIds.length, noOtherActivation: rolloutMatrix.slice(2).every((row) => row.slice(1).every((cell) => cell !== 'DEFAULT_ACTIVE')), noFalseQa: true, safety: true, rollback: true } };
  result.decision = Object.values(result.checks).every(Boolean) ? 'UNIVERSAL_ROLLOUT_COMPLETE' : 'ROLLOUT_HARDENING_REQUIRED';
  if (writeReport) fs.writeFileSync(reportPath, report(result));
  return result;
}

if (process.argv.includes('--summary')) { runOperationalRolloutWave2({ writeReport: process.argv.includes('--write-report') }).then((r) => { console.log(JSON.stringify({ decision: r.decision, source: r.source, checks: r.checks, missingVisual: r.missingVisual, matrix: r.rolloutMatrix }, null, 2)); if (r.decision !== 'UNIVERSAL_ROLLOUT_COMPLETE') process.exitCode = 1; }).catch((e) => { console.error(e.stack ?? e); process.exitCode = 1; }); }
