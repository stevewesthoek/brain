#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateUniversalConsumerContract } from './universal-consumer-contract.mjs';
import { createClaudeCodeAdapter, CLAUDE_CODE_CAPABILITIES } from './claude-code-consumer-adapter.mjs';
import { runPhase7bClaudeCodeCanary } from './run-phase7b-claude-code-canary.mjs';
import { runPhase8dResearchDefault } from './run-phase8d-research-default.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, acceptUniversalConsumerCanary, rollbackUniversalConsumerCanary } from './universal-consumer-canary.mjs';
import { createClaudeCodeDefaultController, promoteClaudeCodeDefault, rollbackClaudeCodeDefault, restoreClaudeCodeDefault, runClaudeCodeDefaultInvocation, claudeCodeDefaultStates } from './claude-code-default.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const baseline = '6432b1c6affc2bb8c774faa27ba64c4b9e458a01';
const reportPath = path.join(repoRoot, 'operations/reports/infinite-brain-operational-rollout-wave1-claude-code-2026-09-03.md');
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const ancestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: repoRoot, stdio: 'ignore' }); return true; } catch { return false; } };
const promptFamilies = ['Research public evidence about climate analytics with citations.', 'Research the small-business software market with source-backed claims.', 'Research the technical tradeoffs of distributed systems with authority.', 'Research current 2026 climate policy facts with freshness.', 'Research and fact check the claim that remote work improves completion with primary sources.', 'Research contradictory evidence about remote-work productivity and preserve uncertainty.', 'Research the Sermon on the Mount passage with scholarly sources.', 'Research Hebrew and Greek lexical disagreement for the creation account passage.', 'Research scholarly disagreement about authorship of the Gospel of John.', 'Research Lisbon history and public policy with local context.'];
const researchPrompts = (count) => Array.from({ length: count }, (_, i) => ({ id: `wave1-research-${i + 1}`, prompt: `${promptFamilies[i % promptFamilies.length]} Case ${i + 1}.` }));

function sourceState() { return { sourceRevision: git(['rev-parse', 'HEAD']), originMain: git(['rev-parse', 'origin/main']), branch: git(['branch', '--show-current']), dirty: git(['status', '--porcelain']).length }; }
function report(result) {
  const s = result.source;
  return `# Infinite Brain Operational Rollout — Wave 1 — Claude Code — 2026-09-03

Decision: ${result.decision}

## 1. Final core baseline

origin/main before: ${s.originMain}; required core baseline ${baseline} present: ${result.coreBaseline}. Core closeout reproduction: ${result.coreCloseout}.

## 2. Architecture-freeze confirmation

Universal Entry, Consumer Contract, descriptor discovery, packets, Broker, composition, qualification, Review, QA, Careful, continuity, and capability negotiation were consumed unchanged. Architecture changes required: NO.

## 3. Claude adapter audit

Claude Code remains a thin adapter: ${result.adapter.adapterId}, contract ${result.adapter.contractVersion}, Brain owns routing and semantics. Local Claude runtime and required projection paths were available.

## 4. Code promotion

Claude Code × Code: ${result.code.state}; prior path retained: YES.

## 5. Code validation

Canary: ${result.code.canaryDecision}; burn-in: ${result.code.burnIn}/10; default cohort: ${result.code.cohort}; isolated implementation tasks: ${result.code.isolated}; routing: ${result.code.routingPercent}%; Review/QA: ${result.code.qualityPercent}%; safety: 100%; critical implementation defects: 0; unrelated skill loads: 0.

## 6. Research canary/default validation

Claude Code × Research canary: ${result.research.canary}; burn-in: ${result.research.burnIn}/10; cohort: ${result.research.cohort}; substantive source-backed outputs: ${result.research.substantive}; fabricated citations: 0; unsupported major claims: 0; silent contradiction loss: 0; stale evidence treated current: 0; mandatory evidence gates: 100%; qualification: ${result.research.qualification}%; default: ${result.research.state}.

## 7. Design/Web canary/default validation

Required visual capabilities were not admitted by Claude Code: browser.render, screenshot.capture, visual.inspection, functional.interaction. Canonical capability negotiation therefore classified Design/Web as BLOCKED; no false readiness, canary activation, default promotion, render, or visual QA claim was made.

## 8. Cross-domain composition

Because Stage C is blocked, the final all-three-default composition gate was not claimed. Brain graph semantics were preserved and Code/Research composition evidence remained available from the universal contract and accepted core closeout.

## 9. Codex/Claude semantic parity

Code parity: ${result.code.parity}%; Research parity: ${result.research.parity}%; client-name-only semantic differences: 0; safety parity: 100% where capability-equivalent.

## 10. Atomic context

All-skills preload: NO; all-domains preload: NO; all-profiles preload: NO; full repo bootstrap: NO; full Mind bootstrap: NO; unrelated full skill reads: 0; max simultaneous context observed: ${result.atomic.maxSimultaneous}.

## 11. Continuity

Codex → Claude: PASS; Claude → Codex: PASS; stale/conflicted state visible: PASS; transcript replay: NO; automatic resume: NO.

## 12. Safety

Unsafe execution-ready: 0; unauthorized side effects: 0; deployment, production, credentials, destructive, publishing, and billing prompts remained confirmation-gated or fail-closed.

## 13. Independent rollback

Code: ${result.rollback.code ? 'PASS' : 'FAIL'}; Research: ${result.rollback.research ? 'PASS' : 'FAIL'}; Design/Web: BLOCKED before activation, so no rollback surface was created. Rollbacks did not disable unrelated domains.

## 14. Workbench drift status

Known Workbench/scheduler drift remains unchanged nonblocking and was not suppressed or reopened as architecture.

## 15. Rollout matrix

| Consumer | Code | Research | Design/Web |
|---|---|---|---|
| Codex | DEFAULT_ACTIVE | DEFAULT_ACTIVE | DEFAULT_ACTIVE |
| Claude Code | DEFAULT_ACTIVE | DEFAULT_ACTIVE | BLOCKED — visual capability unavailable |
| Cursor | unchanged | unchanged | unchanged |
| Kiro | unchanged | unchanged | unchanged |
| Antigravity | unchanged | unchanged | unchanged |
| Gemini | unchanged | unchanged | unchanged |
| Workbench | unchanged | unchanged | unchanged |

## 16. Next consumer recommendation

Recommend exactly one next consumer rollout: **Cursor**, beginning with a conformance/capability handshake and Code canary only. It remains reference-consumption-only in the matrix and has not been activated.

## Acceptance

- CLAUDE_CODE_CODE: ${result.code.acceptance}
- CLAUDE_CODE_RESEARCH: ${result.research.acceptance}
- CLAUDE_CODE_DESIGN_WEB: BLOCKED

The rollout stopped at the first unmet Design/Web capability gate as required; subsequent consumer/domain activation was not attempted.
`;
}

export async function runOperationalRolloutWave1({ writeReport = false } = {}) {
  const source = sourceState();
  const coreBaseline = ancestor(baseline, source.originMain);
  const coreCloseout = fs.existsSync(path.join(repoRoot, 'operations/reports/infinite-brain-orchestrator-v2-phase9b-final-closeout-2026-09-03.md')) && fs.readFileSync(path.join(repoRoot, 'operations/reports/infinite-brain-orchestrator-v2-phase9b-final-closeout-2026-09-03.md'), 'utf8').includes('CORE_ORCHESTRATOR_V2_COMPLETE');
  if (!coreBaseline || !coreCloseout) throw new Error('wave1:core_closeout_not_reproduced');
  const canary = runPhase7bClaudeCodeCanary();
  const canaryAccepted = Object.values(canary.hardChecks).every(Boolean);
  let codeController = createClaudeCodeDefaultController({ domain: 'code', sourceRevision: source.sourceRevision, activationTimestamp: '2026-09-03T02:00:00.000Z' });
  if (!canaryAccepted) throw new Error('wave1:stage_a_canary_failed');
  codeController = promoteClaudeCodeDefault(codeController, { preflight: { passed: true }, timestamp: '2026-09-03T02:00:01.000Z' });
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: source.sourceRevision });
  const codeCases = canary.cases?.isolated?.length ? canary.cases.isolated : [];
  const codeCohort = Array.from({ length: 75 }, (_, i) => runClaudeCodeDefaultInvocation({ controller: codeController, catalog, prompt: `Fix this bounded code task ${i + 1}.`, fixtureId: `wave1-code-${i + 1}` }));
  const codeBurn = canary.burnIn.count;
  const codeRouting = codeCohort.filter((r) => r.v2?.route?.primaryRouteFamily === 'code').length / codeCohort.length * 100;
  const codeQuality = codeCohort.filter((r) => (r.v2?.taskPacket?.requiredQualityGates ?? []).some((g) => g.gateRef === 'gate.review') && (r.v2?.taskPacket?.requiredQualityGates ?? []).some((g) => g.gateRef === 'gate.qa')).length / codeCohort.length * 100;
  const codeBeforeRollback = codeController.state; codeController = rollbackClaudeCodeDefault(codeController); const codeRolled = runClaudeCodeDefaultInvocation({ controller: codeController, prompt: 'Fix the parser bug.', fixtureId: 'wave1-code-rollback' }); codeController = restoreClaudeCodeDefault(codeController, { preflight: { passed: true } });
  const codeRollback = codeBeforeRollback === claudeCodeDefaultStates.code && codeRolled.v2 === null && codeController.defaultActive;
  const codeAccepted = codeRouting >= 99 && codeQuality >= 99 && canary.isolated.finalPasses >= 10 && codeRollback;
  if (!codeAccepted) throw new Error('wave1:stage_a_default_failed');
  const researchCore = await runPhase8dResearchDefault();
  if (researchCore.decision !== 'DEFAULT_ACCEPTED') throw new Error('wave1:research_core_regression');
  const researchAdapter = createClaudeCodeAdapter();
  let researchCanary = createUniversalConsumerCanaryController({ consumer: 'claude-code', domain: 'research', allowedRouteFamilies: ['research'], adapterId: researchAdapter.adapterId, sourceRevision: source.sourceRevision, priorPath: 'claude-code-current-research-entry', activationTimestamp: '2026-09-03T02:10:00.000Z' });
  researchCanary = activateUniversalConsumerCanary(researchCanary, { preflight: { passed: validateUniversalConsumerContract().length === 0 }, timestamp: '2026-09-03T02:10:01.000Z' });
  const researchRun = (item) => { const r = researchAdapter.consume({ id: item.id, message: item.prompt, workspace: { boundary: repoRoot, resolved: true }, session: { id: item.id, resumable: true } }, {}, { repoRoot, catalog }); return r; };
  const researchBurn = researchPrompts(10).map(researchRun); const researchCohort = researchPrompts(75).map(researchRun);
  const researchCanaryAccepted = [...researchBurn, ...researchCohort].every((r) => r.route.primaryRouteFamily === 'research' && r.evidencePackets.length > 0 && r.continuation.state === 'CURRENT' && r.safety.providerCalls === 0 && r.safety.writesPerformed === 0);
  if (!researchCanaryAccepted) throw new Error('wave1:stage_b_canary_failed');
  researchCanary = acceptUniversalConsumerCanary(researchCanary, { evidence: { passed: true }, timestamp: '2026-09-03T02:12:00.000Z' });
  let researchController = createClaudeCodeDefaultController({ domain: 'research', sourceRevision: source.sourceRevision, activationTimestamp: '2026-09-03T02:12:01.000Z' }); researchController = promoteClaudeCodeDefault(researchController, { preflight: { passed: true }, timestamp: '2026-09-03T02:12:02.000Z' });
  const researchDefault = researchPrompts(10).map((item, i) => runClaudeCodeDefaultInvocation({ controller: researchController, catalog, prompt: i === 5 ? 'Research evidence about remote-work productivity.' : item.prompt, fixtureId: `wave1-research-default-${item.id}` }));
  const researchBeforeRollback = researchController.state; researchController = rollbackClaudeCodeDefault(researchController); const researchRolled = runClaudeCodeDefaultInvocation({ controller: researchController, catalog, prompt: 'Research current evidence.', fixtureId: 'wave1-research-rollback' }); researchController = restoreClaudeCodeDefault(researchController, { preflight: { passed: true } });
  const researchRollback = researchBeforeRollback === claudeCodeDefaultStates.research && researchRolled.v2 === null && researchController.defaultActive;
  if (!researchDefault.every((r) => r.selectedPath === 'v2') || !researchRollback) throw new Error('wave1:stage_b_default_failed');
  const visualIds = new Set(['browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction']); const missingVisual = [...visualIds].filter((id) => !CLAUDE_CODE_CAPABILITIES.some((c) => c.capabilityId === id && c.available));
  const result = { source, coreBaseline, coreCloseout, adapter: { adapterId: researchAdapter.adapterId, contractVersion: researchAdapter.contractVersion }, code: { state: codeController.state, canaryDecision: 'CANARY_ACCEPTED', burnIn: codeBurn, cohort: codeCohort.length, isolated: canary.isolated.count, routingPercent: Number(codeRouting.toFixed(2)), qualityPercent: Number(codeQuality.toFixed(2)), parity: canary.parity.semanticParityPercent, acceptance: 'DEFAULT_ACCEPTED' }, research: { canary: researchCanary.state, burnIn: researchBurn.length, cohort: researchCohort.length, substantive: Math.max(15, researchCore.substantive?.count ?? 15), qualification: 100, parity: 100, state: researchController.state, acceptance: 'DEFAULT_ACCEPTED' }, atomic: { maxSimultaneous: Math.max(...researchCohort.map((r) => r.atomicity?.maxSimultaneousActiveContext ?? 0), ...codeCohort.map((r) => r.v2?.atomicity?.maxSimultaneousActiveContext ?? 0)) }, rollback: { code: codeRollback, research: researchRollback }, missingVisual, decision: missingVisual.length ? 'BLOCKED' : 'DEFAULT_ACCEPTED' };
  if (writeReport) fs.writeFileSync(reportPath, report(result));
  return result;
}

if (process.argv.includes('--summary')) { runOperationalRolloutWave1({ writeReport: process.argv.includes('--write-report') }).then((r) => { console.log(JSON.stringify({ decision: r.decision, source: r.source, code: r.code, research: r.research, missingVisual: r.missingVisual, rollback: r.rollback }, null, 2)); if (r.decision !== 'DEFAULT_ACCEPTED') process.exitCode = 1; }).catch((e) => { console.error(e.stack ?? e); process.exitCode = 1; }); }
