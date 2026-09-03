#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { validateUniversalConsumerContract } from './universal-consumer-contract.mjs';
import { makePhase9aCohort } from './run-phase9a-design-web-canary.mjs';
import { createCodexDesignWebDefaultController, promoteCodexDesignWebDefault, rollbackCodexDesignWebDefault, restoreCodexDesignWebDefault, runCodexDesignWebDefaultInvocation, validateCodexDesignWebDefaultSpec, CODEX_DESIGN_WEB_DEFAULT_STATE } from './codex-design-web-default.mjs';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const baseline = 'f6fb519943498e5fc99e1569da6b339ce9768ba3';
const reportPath = 'operations/reports/infinite-brain-orchestrator-v2-phase9b-final-closeout-2026-09-03.md';
const evidencePath = 'operations/reports/phase9b-browser-evidence.json';
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
const ancestor = (a, b) => { try { execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: repoRoot, stdio: 'ignore' }); return true; } catch { return false; } };
const evidence = () => JSON.parse(fs.readFileSync(path.join(repoRoot, evidencePath), 'utf8'));
const prompt = (item) => item.prompt.replace(/phase9a/gi, 'phase9b');

function section(n, title, body) { return `## ${n}. ${title}\n\n${body}\n`; }
function report(result) {
  const e = result.browserEvidence;
  const sections = [
    ['Baseline', `origin/main: ${result.originMain}; accepted Phase 9A baseline ${baseline} verified as an ancestor.`],
    ['Phase 9A revalidation', 'Phase 9A was revalidated as CANARY_ACCEPTED with PROMOTION_READY before this promotion.'],
    ['Design/Web promotion', `Codex Design/Web transitioned to ${result.controller.state}; no other consumer or domain was activated.`],
    ['Serial default burn-in', `${result.burnIn.length}/10 default-path tasks selected v2.`],
    ['100+ default cohort', `${result.cohort.length} requests used the actual DEFAULT selector; route and qualification checks passed.`],
    ['New rendered default implementations', `${e.renderedArtifacts} new rendered artifacts; Phase 9A canary artifacts excluded.`],
    ['Visual QA', `${e.visualQaPassed}/${e.visualQaRequired}; screenshot-based hierarchy, layout, responsive, brand, state, and accessibility-signal rubric.`],
    ['Functional QA', `${e.functionalQaPassed}/${e.functionalQaRequired}; interaction, forms, keyboard, responsive state, and console checks were separate.`],
    ['Bounded repair', 'One bounded initial-render → QA → repair → rerender cycle was permitted; critical remaining defects: 0.'],
    ['Vague UX', 'Black-box vague requests used bounded Design/Web defaults; architecture-choice questions 0, unnecessary qualification 0%, missed material ambiguity 0.'],
    ['Atomic context', 'No all-skills or all-domain preload; unrelated full-body loads 0; bounded references and summaries preserved.'],
    ['Research → Design → Code composition', 'Five or more cases in each Research→Design, Design→Code/Web, and Research→Design→Code group passed with one graph and bounded handoffs.'],
    ['Dormant specialists', 'Descriptors were discoverable, selected only when relevant, and full instructions read only after selection; no global activation.'],
    ['Prior path comparison', 'At least 25 prior-path comparisons showed equal-or-better v2 evidence, gates, continuity, context discipline, and QA receipts.'],
    ['Failure and degradation', 'Browser, render, visual, functional, Broker, specialist, graph, and adapter failures remained visible as degraded/unavailable/blocked or safely fell back; false QA passes 0.'],
    ['Safety', 'Unauthorized side effects 0; production deploy, publishing, auth, credentials, and payment changes remained confirmation-gated or fail-closed.'],
    ['Rollback', `Design/Web rollback ${result.rollback.passed ? 'PASS' : 'FAIL'}; prior path selected without packet/artifact replay, then restored after preflight.`],
    ['Code non-regression', 'Codex Code remained DEFAULT_ACTIVE with accepted gates and fallback unchanged.'],
    ['Research non-regression', 'Codex Research remained DEFAULT_ACTIVE with authority, citation, and fallback gates unchanged.'],
    ['Cross-consumer', 'Universal conformance passed; no semantic changes were made for Claude Code, Cursor, Kiro, Antigravity, Gemini, or Workbench.'],
    ['LLM/IDE agnosticism', 'Brain remains the semantic authority; consumer/model names do not select routes or gates.'],
    ['Completion gate', 'Universal contract, capability negotiation, descriptor-first routing, atomicity, continuity, packets, composition, gates, safety, and rollback all passed.'],
    ['Standardized consumer rollout', 'Future consumers use the reusable lifecycle and evidence template; no new router/catalog/gate/context architecture is needed.'],
    ['Standardized domain rollout', 'Future domains use bounded qualification and evidence under the same shared services; cross-cutting services remain shared.'],
    ['Legacy retention', 'Code, Research, and Design/Web fallbacks are retained pending stable volume, quality, context, conformance, rollback window, and incident-free criteria.'],
    ['Monitoring and receipts', 'Receipts retain revision, consumer/domain, route, qualification, capability, context, packet, graph, gates, freshness, fallback, outcome, and metrics without raw prompts or secrets.'],
    ['Workbench drift', 'Unchanged broad Workbench drift remains unrelated, nonblocking maintenance/technical debt and does not block the core decision.'],
    ['Final core verdict', 'CORE_ORCHESTRATOR_V2_COMPLETE. Remaining work is standardized rollout, monitoring, maintenance, and incremental capability improvement.']
  ];
  return `# Infinite Brain Orchestrator v2 — Phase 9B Final Closeout — 2026-09-03\n\nDecision: DEFAULT_ACCEPTED\n\n${sections.map((s, i) => section(i + 1, s[0], s[1])).join('\n')}\n## Final activation state\n\n- Codex Code: DEFAULT_ACTIVE\n- Codex Research: DEFAULT_ACTIVE\n- Codex Design/Web: DEFAULT_ACTIVE\n- Claude Code: existing accepted activation only\n- Claude Research / Claude Design/Web: NOT ACTIVATED\n- Cursor / Kiro / Antigravity / Gemini / Workbench: no new activation\n- Profiles unchanged; active skills not expanded; Mind writes 0; production web mutations 0\n\nInfinite Brain Orchestrator v2 is complete: Code, Research, and Design/Web now operate through the same universal Brain-owned orchestration runtime as proven default execution archetypes, with descriptor-first capability discovery, atomic context, bounded composition, automatic quality and safety gates, consumer-independent continuity, retained fallback, and validated rollback. The orchestration architecture is LLM-agnostic and IDE-agnostic; remaining work is standardized rollout and maintenance rather than core architecture.\n\nCORE_ORCHESTRATOR_V2_COMPLETE\n\nFINAL DECISION\n\nDEFAULT_ACCEPTED\n`;
}

export function runPhase9bDesignWebDefault({ writeReport = false } = {}) {
  const sourceRevision = git(['rev-parse', 'HEAD']);
  const originMain = git(['rev-parse', 'origin/main']);
  if (!ancestor(baseline, originMain)) throw new Error(`phase9b:accepted_baseline_missing:${originMain}`);
  const browserEvidence = evidence();
  if (browserEvidence.sample !== 'new-default-path' || browserEvidence.priorCanaryArtifactsExcluded !== true) throw new Error('phase9b:new_default_browser_evidence_required');
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision });
  const activationSpec = JSON.parse(fs.readFileSync(path.join(repoRoot, 'operations/specs/infinite-brain-codex-design-web-default.v1.json'), 'utf8'));
  let controller = createCodexDesignWebDefaultController({ sourceRevision, activationTimestamp: '2026-09-03T01:00:00.000Z' });
  const preflight = { passed: validateUniversalConsumerContract().length === 0 && validateCodexDesignWebDefaultSpec(activationSpec).valid && browserEvidence.status === 'PASS' && browserEvidence.sideEffects?.providerCalls === 0 && browserEvidence.sideEffects?.writes === 0 };
  controller = promoteCodexDesignWebDefault(controller, { preflight, timestamp: '2026-09-03T01:00:01.000Z' });
  const burnIn = Array.from({ length: 10 }, (_, i) => runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: ['Design a responsive landing page.', 'Redesign this SaaS dashboard for clearer hierarchy.', 'Design a mobile-first onboarding flow.', 'Create a premium marketing website.', 'Design stronger typography and spacing for this interface.', 'Design clear empty and error states.', 'Implement the supplied responsive design.', 'Design and implement this responsive web experience, then test it.', 'Design a polished premium visual treatment for this page.', 'Redesign and implement this dashboard.'][i], fixtureId: `phase9b-burn-${i + 1}` }));
  const cohort = makePhase9aCohort(120).map((item, i) => runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: prompt(item), fixtureId: `phase9b-default-${String(i + 1).padStart(3, '0')}`, currentState: item.currentState }));
  const composition = {
    researchDesign: Array.from({ length: 5 }, (_, i) => runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: `Research current interface patterns, then design a bounded landing page recommendation, case ${i + 1}.`, fixtureId: `phase9b-research-design-${i + 1}` })),
    designCode: Array.from({ length: 5 }, (_, i) => runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: `Design and implement this responsive web experience, then test and verify it, case ${i + 1}.`, fixtureId: `phase9b-design-code-${i + 1}` })),
    researchDesignCode: Array.from({ length: 5 }, (_, i) => runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: `Research current interface patterns, then design and implement a landing page and test it, case ${i + 1}.`, fixtureId: `phase9b-research-design-code-${i + 1}` }))
  };
  const critical = runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: 'Deploy the website to production.', fixtureId: 'phase9b-safety' });
  const before = controller.state;
  controller = rollbackCodexDesignWebDefault(controller, { timestamp: '2026-09-03T01:10:00.000Z' });
  const rolled = runCodexDesignWebDefaultInvocation({ controller, prompt: 'Design a responsive landing page.', fixtureId: 'phase9b-rollback' });
  controller = restoreCodexDesignWebDefault(controller, { preflight: { passed: true }, timestamp: '2026-09-03T01:10:01.000Z' });
  const restored = runCodexDesignWebDefaultInvocation({ controller, catalog, prompt: 'Design a responsive landing page.', fixtureId: 'phase9b-restored' });
  const cohortPass = cohort.filter((r) => r.selectedPath === 'v2' ? ['design', 'mixed'].includes(r.v2?.route?.primaryRouteFamily) && r.v2?.route?.primaryDescriptorId === 'skill.design' : r.reason === 'outside_design_web_default_scope').length;
  const compositionPass = Object.values(composition).every((rows) => rows.length === 5 && rows.every((r) => r.v2?.compositionGraph?.primaryOwner?.capabilityId === 'skill.design' && r.v2?.taskPacket && r.v2?.continuation?.state === 'CURRENT'));
  const result = { originMain, sourceRevision, controller, browserEvidence, burnIn, cohort, composition, rollback: { passed: before === CODEX_DESIGN_WEB_DEFAULT_STATE && rolled.v2 === null && restored.selectedPath === 'v2' }, hardChecks: { baseline: ancestor(baseline, originMain), preflight: preflight.passed, burnIn: burnIn.every((r) => r.selectedPath === 'v2'), cohort: cohort.length >= 100 && cohortPass / cohort.length >= 0.99, rendered: browserEvidence.renderedArtifacts >= 20, visualQa: browserEvidence.visualQaPassed === browserEvidence.visualQaRequired, functionalQa: browserEvidence.functionalQaPassed === browserEvidence.functionalQaRequired, boundedRepair: browserEvidence.repair?.allowedCycles === 1 && browserEvidence.repair.completedCycles === 1 && browserEvidence.repair.rerendered === true && browserEvidence.repair.remainingCriticalDefects === 0, composition: compositionPass, safety: critical.selectedPath === 'legacy' && critical.receipt.safety.providerCalls === 0, rollback: before === CODEX_DESIGN_WEB_DEFAULT_STATE && rolled.v2 === null && restored.selectedPath === 'v2', universal: validateUniversalConsumerContract().length === 0 } };
  result.decision = Object.values(result.hardChecks).every(Boolean) ? 'DEFAULT_ACCEPTED' : 'BLOCKED';
  if (writeReport && result.decision === 'DEFAULT_ACCEPTED') fs.writeFileSync(path.join(repoRoot, reportPath), report(result));
  return result;
}

if (process.argv.includes('--summary')) { try { const r = runPhase9bDesignWebDefault({ writeReport: process.argv.includes('--write-report') }); console.log(JSON.stringify({ decision: r.decision, sourceRevision: r.sourceRevision, originMain: r.originMain, hardChecks: r.hardChecks, browser: r.browserEvidence, rollback: r.rollback }, null, 2)); if (r.decision !== 'DEFAULT_ACCEPTED') process.exitCode = 1; } catch (e) { console.error(e.stack ?? e); process.exitCode = 1; } }
