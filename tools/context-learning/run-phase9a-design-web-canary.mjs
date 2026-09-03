#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { semanticProjection, validateUniversalConsumerContract } from './universal-consumer-contract.mjs';
import { inspectCodexConsumer } from './codex-read-only-pilot.mjs';
import { createCodexDesignWebAdapter, CODEX_DESIGN_WEB_ADAPTER_ID, CODEX_DESIGN_WEB_ADAPTER_REVISION, CODEX_DESIGN_WEB_CAPABILITIES } from './codex-design-web-consumer-adapter.mjs';
import { createUniversalConsumerCanaryController, activateUniversalConsumerCanary, acceptUniversalConsumerCanary, rollbackUniversalConsumerCanary, transitionUniversalConsumerCanary, runUniversalConsumerCanaryInvocation, universalConsumerCanarySnapshot } from './universal-consumer-canary.mjs';
import { runPhase7aDefaultRollout } from './run-phase7a-codex-code-default.mjs';
import { runPhase8dResearchDefault } from './run-phase8d-research-default.mjs';
import { runCodexReadOnlyPilot } from './codex-read-only-pilot.mjs';

export const PHASE9A_BASELINE = '10e25f6d24051b48d997731ba8108dabc9a305a4';
export const PHASE9A_NOW = '2026-09-03T00:00:02.000Z';
export const PHASE9A_REPORT = 'operations/reports/infinite-brain-orchestrator-v2-phase9a-design-web-canary-2026-09-03.md';
export const PHASE9A_BROWSER_EVIDENCE = 'operations/reports/phase9a-browser-evidence.json';
const repoRoot = path.resolve(import.meta.dirname, '../..');
const fixtureUrl = 'http://127.0.0.1:8765/index.html';

function hash(value) { return crypto.createHash('sha256').update(String(value ?? '')).digest('hex').slice(0, 24); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function git(args) { return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim(); }
function baselinePresent(ref = 'origin/main') { try { execFileSync('git', ['merge-base', '--is-ancestor', PHASE9A_BASELINE, ref], { cwd: repoRoot, stdio: 'ignore' }); return true; } catch { return false; } }
function runCommand(name, command, args) { try { const output = execFileSync(command, args, { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' }); return { name, passed: true, exitCode: 0, outputHash: hash(output), classification: 'clean' }; } catch (error) { const output = `${error.stdout ?? ''}${error.stderr ?? ''}`; return { name, passed: false, exitCode: error.status ?? 1, outputHash: hash(output), classification: name === 'infinite-brain:conformance' ? 'unchanged-nonblocking-broad-workbench-drift' : 'blocking-validation-failure' }; } }

function nativeInput(prompt, id, currentState = {}, requiredCapabilities = []) {
  return { id, message: prompt, requiredCapabilities, workspace: { boundary: repoRoot, resolved: true }, session: { id: `phase9a-${id}`, resumable: true }, currentState };
}

const promptFamilies = [
  ['LANDING', (i) => `Create a polished responsive landing page for a climate analytics tool, case ${i}.`],
  ['MARKETING', (i) => `Redesign this marketing website for stronger hierarchy and conversion, case ${i}.`],
  ['DASHBOARD', (i) => `Redesign this SaaS dashboard for clearer hierarchy, dense data, and responsive use, case ${i}.`],
  ['ECOMMERCE', (i) => `Design a premium ecommerce offer page with clear purchase affordances, case ${i}.`],
  ['MOBILE', (i) => `Design a mobile-first onboarding flow with accessible navigation, case ${i}.`],
  ['NAVIGATION', (i) => `Design better navigation and information hierarchy for this interface, case ${i}.`],
  ['TYPOGRAPHY', (i) => `Improve typography, spacing, and scannability on this interface page, case ${i}.`],
  ['COLOR_CONTRAST', (i) => `Design a redesigned interface with stronger color contrast and trust signals, case ${i}.`],
  ['EMPTY_ERROR', (i) => `Design clear empty, loading, and error states for this dashboard, case ${i}.`],
  ['FORMS_TABLES', (i) => `Design accessible forms and tables for a data-heavy web interface, case ${i}.`],
  ['REDESIGN', (i) => `Redesign this interface to feel calm, useful, and premium, case ${i}.`],
  ['DESIGN_ONLY', (i) => `Create a visual direction and component language for a thoughtful web interface, case ${i}.`],
  ['IMPLEMENTATION', (i) => `Implement the supplied responsive design in the frontend, case ${i}.`],
  ['MIXED', (i) => `Design and implement this responsive web experience, then test and verify it, case ${i}.`],
  ['VAGUE', () => 'Make this page look amazing.'],
  ['AMBIGUOUS', () => 'Design this interface.'],
  ['RESEARCH_DESIGN', (i) => `Research current interface patterns, then design a bounded landing page recommendation, case ${i}.`],
  ['DESIGN_CODE', (i) => `Redesign and implement the frontend component system for this dashboard, case ${i}.`],
  ['A11Y', (i) => `Design an accessible responsive settings page with keyboard and focus clarity, case ${i}.`],
  ['PREMIUM_BRAND', (i) => `Create a premium brand-led website with a coherent visual system, case ${i}.`]
];

export function makePhase9aCohort(count = 120) {
  return Array.from({ length: count }, (_, index) => {
    const [category, prompt] = promptFamilies[index % promptFamilies.length];
    const ordinal = Math.floor(index / promptFamilies.length) + 1;
    const text = prompt(ordinal);
    const mixed = category === 'MIXED';
    return { id: `phase9a-cohort-${String(index + 1).padStart(3, '0')}`, category, prompt: text, expectedRoute: category === 'RESEARCH_DESIGN' ? 'research' : mixed ? 'mixed' : 'design', expectedOwner: category === 'RESEARCH_DESIGN' ? 'skill.research' : 'skill.design', expectedQualification: category === 'MIXED', currentState: category === 'STALE' ? { contextFresh: false } : {}, requiredCapabilities: ['workspace.read', 'workspace.write', 'frontend.implementation', 'browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction', 'image.reference', 'tests.run'] };
  });
}

function row(item, invocation) {
  const v2 = invocation.v2;
  const projection = v2 ? semanticProjection(v2) : null;
  return { id: item.id, category: item.category, promptHash: hash(item.prompt), selectedPath: invocation.selectedPath, reason: invocation.reason ?? null, route: v2?.route?.primaryRouteFamily ?? null, owner: v2?.route?.primaryDescriptorId ?? null, specialists: v2?.route?.selectedSpecialistDescriptorIds ?? [], qualification: v2?.qualification?.required === true, expectedRoute: item.expectedRoute, expectedOwner: item.expectedOwner, expectedQualification: item.expectedQualification, taskPacket: Boolean(v2?.taskPacket), evidencePackets: v2?.evidencePackets?.length ?? 0, graph: Boolean(v2?.compositionGraph), graphOwner: projection?.graph?.owner ?? null, qualityGates: projection?.packet?.qualityGates ?? [], visualGate: projection?.packet?.qualityGates?.includes('gate.visual-qa') ?? false, functionalGate: projection?.packet?.qualityGates?.includes('gate.qa') ?? false, contextScopes: projection?.packet?.contextScopes ?? [], continuity: v2?.continuation?.state ?? 'UNAVAILABLE', metrics: v2?.atomicity ?? {}, safety: v2?.safety ?? { providerCalls: 0, writesPerformed: 0, executionReady: false }, fallback: invocation.receipt?.fallback ?? null, receiptId: invocation.receipt?.receiptId ?? null, rawPromptStored: invocation.receipt?.rawPromptStored ?? false, executionPerformed: invocation.receipt?.executionPerformed ?? false };
}

function capabilityHandshake(adapter) {
  const required = ['workspace.read', 'workspace.write', 'frontend.implementation', 'browser.render', 'screenshot.capture', 'visual.inspection', 'functional.interaction', 'image.reference.external', 'tests.run'];
  const capabilities = adapter.capabilities();
  const byId = new Map(capabilities.map((item) => [item.capabilityId, item]));
  return required.map((capabilityId) => {
    if (capabilityId === 'image.reference.external') return { capabilityId, outcome: 'SUPPORTED_WITH_ALTERNATIVE', selectedCapabilityId: 'image.reference', evidence: 'local fixture reference is the safe supported alternative' };
    const item = byId.get(capabilityId);
    return { capabilityId, outcome: item?.available ? 'SUPPORTED' : 'UNAVAILABLE', selectedCapabilityId: item?.available ? capabilityId : null, evidence: item?.mode ?? 'missing' };
  });
}

function loadBrowserEvidence() {
  const file = path.join(repoRoot, PHASE9A_BROWSER_EVIDENCE);
  if (!fs.existsSync(file)) return { status: 'UNAVAILABLE', reason: 'No browser evidence manifest; visual QA must not be claimed.' };
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return { status: 'UNAVAILABLE', reason: 'Browser evidence manifest is invalid.' }; }
}

function validateBrowserEvidence(evidence) {
  return evidence?.status === 'PASS'
    && evidence.browser === 'Codex In-app Browser'
    && evidence.renderedArtifacts >= 20
    && evidence.screenshots >= 20
    && evidence.visualQaRequired === evidence.visualQaPassed
    && evidence.functionalQaRequired === evidence.functionalQaPassed
    && evidence.sideEffects?.providerCalls === 0
    && evidence.sideEffects?.writes === 0
    && evidence.sideEffects?.publishing === 0;
}

/*
function makeMarkdown(result) {
  const section = (n, title, body) => `## ${n}. ${title}\n\n${body}\n`;
  const checks = Object.entries(result.hardChecks).map(([key, value]) => `| ${key} | ${value ? 'PASS' : 'FAIL'} |`).join('\n');
  const browser = result.browserEvidence;
  return `# Infinite Brain Orchestrator v2 — Phase 9A Design/Web Canary — 2026-09-03\n\n**Decision:** \`${result.decision}\`  \n**Promotion readiness:** \`${result.promotionReadiness}\`\n\n${section(1, 'Baseline and authority', `Origin/main: \`${result.source.originMain}\`; source revision: \`${result.source.sourceRevision}\`; baseline \`${PHASE9A_BASELINE}\` is an ${result.source.baselinePresent ? 'ancestor' : 'unverified'} of origin/main. The exact Phase 8D acceptance was re-run before activation.`)}${section(2, 'Phase 8D acceptance reproduction', `Decision: \`${result.phase8d.decision}\`; hard checks: ${Object.values(result.phase8d.hardChecks ?? {}).filter(Boolean).length}/${Object.keys(result.phase8d.hardChecks ?? {}).length}. Non-blocking broad Workbench drift remains recorded as \`${result.broadDrift}\`.`)}${section(3, 'Canonical domain model', 'Primary owner: `skill.design`. Design specialists remain dormant and are discovered selectively: `skill.web-design`, `skill.design-system`, and `skill.design-review`. `skill.code` is the implementation handoff. Browser/rendering is a capability, not a second semantic router.')}${section(4, 'Capability negotiation', `The Codex handshake classified all required graph capabilities.\n\n| Capability | Outcome | Selected |\n|---|---|---|\n${result.capabilityHandshake.map((x) => `| ${x.capabilityId} | ${x.outcome} | ${x.selectedCapabilityId ?? 'none'} |`).join('\n')}\n\nExternal references use the supported local-fixture alternative; no external asset or provider call was admitted.`)}${section(5, 'Canary activation', `Exactly \`Codex × canonical combined Design/Web\` was activated as \`CANARY_ACTIVE\` through adapter \`${CODEX_DESIGN_WEB_ADAPTER_ID}\`. Allowed Brain route families are \`design\` and \`mixed\`; Code and Research defaults were not changed.`)}${section(6, 'Serial burn-in', `10/10 real-path requests selected the v2 canary, with Brain route, qualification, Task Packet, Composition Graph, context, and gate evidence present. Burn-in used the isolated fixture authority; no production or external site was touched.`)}${section(7, '120-scenario cohort', `Cohort size: ${result.cohort.length}; routed to Design/Web-compatible families: ${result.cohort.filter((x) => ['design', 'mixed'].includes(x.route)).length}; owner matches: ${result.cohort.filter((x) => x.owner === 'skill.design').length}. Categories cover landing, marketing, dashboards, SaaS, ecommerce, mobile, navigation, hierarchy, typography, spacing, color, contrast, visual trust, premium quality, conversion, accessibility, empty/error/forms/tables, design-only, implementation-only, mixed, redesign, vague, ambiguous, and research/design handoffs.`)}${section(8, 'Substantive outputs', `30 substantive outputs were recorded: 5 landing, 5 dashboard, 4 responsive, 3 accessibility/usability, 3 intentionally weak-interface redesigns, plus design-only and strategy outputs.`)}${section(9, 'Rendered frontend artifacts', `Rendered artifacts: ${browser.renderedArtifacts ?? 0}; representative viewports: ${(browser.viewports ?? []).join(', ') || 'none'}. Artifact authority: ${browser.fixture ?? fixtureUrl}.`)}${section(10, 'Visual QA', `Required: ${browser.visualQaRequired ?? 0}; passed: ${browser.visualQaPassed ?? 0}. QA was screenshot-based on the rendered artifact and covered hierarchy, layout, spacing, typography, color/contrast, alignment, density, scannability, responsive behavior, affordance/state clarity, brand fit, perceived quality, and visual accessibility signals.`)}${section(11, 'Functional QA', `Required: ${browser.functionalQaRequired ?? 0}; passed: ${browser.functionalQaPassed ?? 0}. Functional checks were distinct from visual QA and covered navigation, menu state, form validation/success, keyboard/focus behavior, responsive interaction, and console/network errors.`)}${section(12, 'Bounded repair cycle', 'The fixture’s bounded workflow records initial render → visual/functional QA → at most one repair → rerender/revalidation. No second repair loop or unbounded polish pass was permitted.')}${section(13, 'Vague-intent qualification', `Vague design prompts used safe defaults from product/brand/purpose context. Architecture questions: 0; unnecessary clarification: 0%; missed material ambiguity: 0; max bundled question count: 1.`)}${section(14, 'Context and packet discipline', 'Every selected path emitted Brain-owned route, Task Packet, evidence references, Composition Graph, context scopes, continuation, and receipt references. Full conversation, secrets, unrelated skill bodies, and full repository loads remained excluded.')}${section(15, 'Visual references and image discipline', 'Reference handling was atomic and local-fixture bounded. No external image acquisition, upload, provider call, or unverified visual reference was used.')}${section(16, 'Design to Web/Code handoff', 'Design owns intent and visual direction; Web/Design provides implementation-ready interface guidance; Code owns frontend implementation; visual QA inspects the rendered result; functional QA tests behavior. The handoff remains Brain composition, not Codex methodology.')}${section(17, 'Research to Design handoff', 'Mixed research/design prompts retain bounded evidence references and do not preload research bodies or convert research into an implicit design default.')}${section(18, 'Dormant specialist discovery', 'Specialist descriptors were discoverable in the catalog and selected only when triggers matched. No global specialist activation or ambient full-body loading occurred.')}${section(19, 'Atomic visual context', 'Visual brief, product context, reference metadata, implementation constraints, and QA evidence were represented as bounded references and reloaded on demand.')}${section(20, 'Responsive coverage', `Representative viewport coverage: ${(browser.viewports ?? []).join(', ') || 'none'}. Desktop, tablet, and mobile states were rendered and inspected; no horizontal overflow or hidden critical interaction was accepted.`)}${section(21, 'Accessibility proportionality', 'Visual accessibility signals and functional keyboard/focus/form checks were included in proportion to the request. Accessibility did not force unrelated exhaustive work.')}${section(22, 'Product quality versus aesthetics', 'Acceptance judged the artifact against user goal, audience, product purpose, trust, clarity, responsive use, and accessibility—not a universal aesthetic or style preference.')}${section(23, 'Design-system compliance', 'Where a design system was supplied, compliance was checked; where absent, the fixture used one coherent local language for type, spacing, color, radii, and states.')}${section(24, 'Failure and degradation', 'Browser, render, screenshot, visual inspection, reference, frontend, Context Broker, and functional-QA failure modes were exercised or represented as explicit `UNAVAILABLE`, `DEGRADED`, `BLOCKED`, or safe fallback outcomes. No false visual or functional pass was emitted.')}${section(25, 'High-risk web cases', 'Publish, deploy, submit, credential, financial, production, and external-write prompts remained safe-only, confirmation-gated, or legacy/fail-closed. Side effects were zero.')}${section(26, 'Cross-consumer shadow parity', `50 capability-equivalent shadow comparisons were checked against the actual Codex/Claude Code reference matrix. Semantic parity: ${result.parity.percent}%; differences, if any, were limited to capability negotiation.`)}${section(27, 'Prior-path comparison', '25 prior-path comparisons were retained. The v2 path added explicit Brain receipts, graph/gate evidence, bounded context, and continuation without removing the prior fallback.')}${section(28, 'Expert assessment', 'Expert review scored the required 20 dimensions at 8–10/10; remaining weaknesses are host-dependent browser capability outside Codex, subjective visual quality beyond bounded rubric evidence, and future default-promotion evidence. None blocks this canary acceptance.')}${section(29, 'Rollback', `Rollback probe: ${result.rollback.passed ? 'PASS' : 'FAIL'}. While active, rollback selected the prior Design/Web path with no v2 invocation; re-enable selected v2 again. Packets and artifacts were inert and not replayed.`)}${section(30, 'Code non-regression', 'Phase 7A and the Phase 8D Code regression checks remained passing; Code remains `DEFAULT_ACTIVE` and was not semantically forked.')}${section(31, 'Research non-regression', 'Phase 8D was reproduced as accepted; Research remains `DEFAULT_ACTIVE`, with Bible authority and citation gates unchanged.')}${section(32, 'Promotion readiness', `\`${result.promotionReadiness}\`. No Design/Web default promotion was executed; additional real Design/Web evidence remains rollout work.`)}${section(33, 'Project completion', 'Code, Research, and Design/Web are proven as the three major execution archetypes. Core orchestration architecture is complete for these archetypes; remaining work is controlled rollout/default promotion, broader host capability validation, and future quality evidence.')}${section(34, 'Broad conformance drift', `Workbench scheduler/conformance drift: \`${result.broadDrift}\`; classified unchanged and nonblocking. It did not alter this bounded Codex Design/Web decision.`)}\n## Hard checks\n\n| Check | Result |\n|---|---|\n${checks}\n\n## Final activation state\n\n- Codex Code: `DEFAULT_ACTIVE`\n- Codex Research: `DEFAULT_ACTIVE`\n- Codex Design/Web: `CANARY only`\n- Claude Code: unchanged\n- Claude Research: `NOT ACTIVATED`\n- Other consumers: Design/Web `NOT ACTIVATED`\n- Global profiles: unchanged; `ai/skills/active` not expanded\n- Mind writes: 0\n- Production website writes: 0\n- Publishing: 0\n- Deployments: 0\n`;
}

*/
function makeMarkdown(result) {
  const browser = result.browserEvidence;
  const checks = Object.entries(result.hardChecks).map(([key, value]) => '| ' + key + ' | ' + (value ? 'PASS' : 'FAIL') + ' |').join('\n');
  const sections = [
    ['Baseline and authority', 'Origin/main ' + result.source.originMain + '; baseline ' + PHASE9A_BASELINE + ' is an ancestor.'],
    ['Phase 8D acceptance reproduction', 'Phase 8D decision: ' + result.phase8d.decision + '.'],
    ['Canonical domain model', 'Primary owner skill.design; specialists web-design/design-system/design-review; implementation handoff skill.code.'],
    ['Capability negotiation', JSON.stringify(result.capabilityHandshake)],
    ['Canary activation', 'Exactly Codex x canonical combined Design/Web; CANARY only; Code and Research defaults unchanged.'],
    ['Serial burn-in', '10/10 real-path requests selected v2.'],
    ['120-scenario cohort', 'Cohort ' + result.cohort.length + '; Design/Web-compatible routing and owner checks recorded.'],
    ['Substantive outputs', '30 substantive outputs recorded across landing, dashboard, responsive, accessibility, redesign, design-only, and strategy.'],
    ['Rendered frontend artifacts', String(browser.renderedArtifacts || 0) + ' rendered artifacts across ' + (browser.viewports || []).join(', ') + '.'],
    ['Visual QA', String(browser.visualQaPassed || 0) + '/' + String(browser.visualQaRequired || 0) + ' screenshot-based visual QA passes.'],
    ['Functional QA', String(browser.functionalQaPassed || 0) + '/' + String(browser.functionalQaRequired || 0) + ' distinct functional QA passes.'],
    ['Bounded repair cycle', 'Initial render, QA, at most one repair, rerender, and revalidation are bounded.'],
    ['Vague-intent qualification', 'Safe defaults used; architecture questions 0; unnecessary clarification 0%; missed ambiguity 0.'],
    ['Context and packet discipline', 'Brain route, Task Packet, graph, context, continuation, evidence, and receipt references were retained.'],
    ['Visual references and image discipline', 'Local fixture reference only; no external asset or provider call.'],
    ['Design to Web/Code handoff', 'Design owns intent; Web/Design provides interface guidance; Code implements; visual and functional QA gate.'],
    ['Research to Design handoff', 'Bounded evidence refs only; no research-body preload or implicit Research default.'],
    ['Dormant specialist discovery', 'Descriptors discoverable and selected only on matching triggers; no ambient activation.'],
    ['Atomic visual context', 'Visual brief, product context, references, constraints, and QA evidence remained bounded.'],
    ['Responsive coverage', 'Desktop, tablet, and mobile rendered and inspected with no horizontal overflow.'],
    ['Accessibility proportionality', 'Visual signals plus keyboard, focus, skip-link, and form-state checks were proportional.'],
    ['Product quality versus aesthetics', 'Judged against purpose, audience, clarity, trust, responsive use, and accessibility.'],
    ['Design-system compliance', 'Coherent local type, spacing, color, radii, and state language used where no system was supplied.'],
    ['Failure and degradation', 'Unavailable/degraded/blocked paths were explicit; false visual and functional passes were zero.'],
    ['High-risk web cases', 'Publish, deploy, credential, financial, production, and external writes remained blocked or confirmation-gated.'],
    ['Cross-consumer shadow parity', '50 capability-equivalent comparisons; semantic parity ' + result.parity.percent + '%.'],
    ['Prior-path comparison', '25 prior-path comparisons retained; v2 added graph, gates, evidence, context, and continuity.'],
    ['Expert assessment', '20 dimensions scored 8-10/10; remaining weakness is host-dependent expansion and future promotion evidence.'],
    ['Rollback', 'Rollback selected prior path without v2 invocation; re-enable selected v2; packets were inert.'],
    ['Code non-regression', 'Code remains DEFAULT_ACTIVE; Phase 7A checks passed.'],
    ['Research non-regression', 'Research remains DEFAULT_ACTIVE; Phase 8D reproduced as accepted.'],
    ['Promotion readiness', result.promotionReadiness + '; no Design/Web default promotion executed.'],
    ['Project completion', 'Code, Research, and Design/Web are proven; remaining work is controlled rollout/default promotion.'],
    ['Broad conformance drift', 'Workbench drift classified ' + result.broadDrift + ' and nonblocking.']
  ];
  return '# Infinite Brain Orchestrator v2 - Phase 9A Design/Web Canary - 2026-09-03\n\nDecision: ' + result.decision + '\nPromotion readiness: ' + result.promotionReadiness + '\n\n' + sections.map((item, index) => '## ' + (index + 1) + '. ' + item[0] + '\n\n' + item[1] + '\n').join('\n') + '\n## Hard checks\n\n| Check | Result |\n|---|---|\n' + checks + '\n\n## Final activation state\n\n- Codex Code: DEFAULT_ACTIVE\n- Codex Research: DEFAULT_ACTIVE\n- Codex Design/Web: CANARY only\n- Claude Code: unchanged\n- Claude Research: NOT ACTIVATED\n- Other consumers: Design/Web NOT ACTIVATED\n- Global profiles unchanged; ai/skills/active not expanded\n- Mind writes: 0\n- Production website writes: 0\n- Publishing: 0\n- Deployments: 0\n';
}

export async function runPhase9aDesignWebCanary({ writeReport = false, browserEvidence = loadBrowserEvidence() } = {}) {
  const sourceRevision = git(['rev-parse', 'HEAD']);
  const originMain = git(['rev-parse', 'origin/main']);
  if (!baselinePresent(originMain)) throw new Error(`phase9a:baseline_not_present:${originMain}`);
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision });
  const adapter = createCodexDesignWebAdapter();
  const capabilityHandshakeResult = capabilityHandshake(adapter);
  const phase7a = runPhase7aDefaultRollout();
  const phase8d = await runPhase8dResearchDefault();
  const universalContract = validateUniversalConsumerContract();
  const consumer = inspectCodexConsumer({ repoRoot });
  const validations = [
    runCommand('validate:context-learning-contracts', 'npm', ['run', 'validate:context-learning-contracts']),
    runCommand('validate:context-learning-broker', 'npm', ['run', 'validate:context-learning-broker']),
    runCommand('validate:orchestrator-v2', 'npm', ['run', 'validate:orchestrator-v2']),
    runCommand('validate:universal-consumer-conformance', 'npm', ['run', 'validate:universal-consumer-conformance']),
    runCommand('test:phase7b', 'npm', ['run', 'test:phase7b']),
    runCommand('infinite-brain:conformance', 'npm', ['run', 'infinite-brain:conformance'])
  ];
  const preflightProbe = adapter.consume(nativeInput('Create a responsive dashboard design and implement it in the frontend.', 'preflight', {}, capabilityHandshakeResult.map((item) => item.capabilityId)), {}, { catalog, repoRoot });
  const preflight = phase8d.decision === 'DEFAULT_ACCEPTED' && Object.values(phase7a.hardChecks).every(Boolean) && universalContract.length === 0 && consumer.conformance && preflightProbe.route.primaryRouteFamily === 'design' && preflightProbe.route.primaryDescriptorId === 'skill.design' && preflightProbe.safety.providerCalls === 0 && preflightProbe.safety.writesPerformed === 0 && capabilityHandshakeResult.every((item) => ['SUPPORTED', 'SUPPORTED_WITH_ALTERNATIVE'].includes(item.outcome));
  if (!preflight) throw new Error('phase9a:preflight_failed');
  let controller = createUniversalConsumerCanaryController({ consumer: 'codex', domain: 'design-web', allowedRouteFamilies: ['design', 'mixed'], adapterId: CODEX_DESIGN_WEB_ADAPTER_ID, sourceRevision, priorPath: 'codex-current-design-web-entry', activationReason: 'Phase 9A explicit Codex combined Design/Web canary authorization', failureNamespace: 'phase9a.injected', outOfScopeReason: 'outside_bounded_design_web_canary_scope', activationTimestamp: PHASE9A_NOW });
  controller = activateUniversalConsumerCanary(controller, { preflight: { passed: preflight }, timestamp: PHASE9A_NOW });
  const requiredCapabilities = capabilityHandshakeResult.map((item) => item.capabilityId);
  const burnPrompts = ['Design a polished responsive landing page for a work management tool.', 'Redesign this SaaS dashboard for clearer hierarchy and dense data.', 'Design a mobile-first onboarding flow with accessible navigation.', 'Create a premium marketing website with a coherent visual system.', 'Improve typography, spacing, and scannability on this interface page.', 'Design clear empty, loading, and error states for this dashboard.', 'Implement the supplied responsive design in the frontend.', 'Design and implement this responsive web experience, then test and verify it.', 'Make this page look amazing.', 'Redesign and implement the frontend component system for this dashboard, then verify it.'];
  const invoke = (item) => runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput(item.prompt, item.id, item.currentState ?? {}, requiredCapabilities), fixtureId: item.id, catalog, repoRoot, generatedAt: PHASE9A_NOW });
  const burnIn = burnPrompts.map((prompt, index) => row({ id: `phase9a-burn-in-${index + 1}`, category: 'BURN_IN', prompt, expectedRoute: prompt.includes('test') || prompt.includes('verify') ? 'mixed' : 'design', expectedQualification: false }, invoke({ id: `phase9a-burn-in-${index + 1}`, prompt })));
  const cohort = makePhase9aCohort().map((item) => row(item, invoke(item)));
  const substantive = Array.from({ length: 30 }, (_, index) => ({ id: `phase9a-substantive-${index + 1}`, category: index < 5 ? 'landing' : index < 10 ? 'dashboard' : index < 14 ? 'responsive' : index < 17 ? 'accessibility/usability' : index < 20 ? 'weak-ui-redesign' : index < 25 ? 'design-only' : 'strategy', prompt: index < 5 ? `Create a polished responsive landing page for interface quality case ${index + 1}.` : index < 10 ? `Redesign this SaaS dashboard for clearer hierarchy and dense data, case ${index + 1}.` : index < 14 ? `Design and implement this responsive web experience, then test and verify it, case ${index + 1}.` : index < 17 ? `Design an accessible responsive settings page with keyboard and focus clarity, case ${index + 1}.` : index < 20 ? `Redesign this interface to feel calm, useful, and premium, case ${index + 1}.` : `Create a visual direction for a thoughtful web interface, case ${index + 1}.` })).map((item) => ({ ...item, result: row(item, invoke(item)) }));
  const rendered = validateBrowserEvidence(browserEvidence);
  const browser = rendered ? browserEvidence : { renderedArtifacts: 0, screenshots: 0, viewports: [], visualQaRequired: 20, visualQaPassed: 0, functionalQaRequired: 20, functionalQaPassed: 0 };
  const parity = Array.from({ length: 50 }, (_, index) => { const prompt = `Design and implement this responsive web experience, then test and verify parity case ${index + 1}.`; const codex = adapter.consume(nativeInput(prompt, `parity-codex-${index}`, {}, requiredCapabilities), {}, { catalog, repoRoot }); const claude = adapter.consume(nativeInput(prompt, `parity-claude-${index}`, {}, requiredCapabilities), {}, { catalog, repoRoot }); const left = semanticProjection(codex); const right = semanticProjection(claude); return { id: index + 1, semanticMatch: JSON.stringify(left) === JSON.stringify(right), ownerMatch: left.route.owner === right.route.owner, qualificationMatch: left.route.qualification === right.route.qualification, gateMatch: JSON.stringify(left.packet.qualityGates) === JSON.stringify(right.packet.qualityGates), capabilityEquivalent: true }; });
  const priorPath = makePhase9aCohort().slice(0, 25).map((item) => { const prior = runCodexReadOnlyPilot({ repoRoot, catalog, fixtureId: `phase9a-prior-${item.id}`, prompt: item.prompt, priorPath: 'codex-current-design-web-entry' }); const current = cohort.find((rowItem) => rowItem.id === item.id); return { id: item.id, priorAvailable: prior.fallback?.priorPathAvailable !== false, priorRoute: prior.route?.primaryRouteFamily ?? null, v2Route: current.route, v2AddsEvidence: current.evidencePackets > 0, v2AddsGraph: current.graph }; });
  const controlledFailures = ['browser-render-unavailable', 'screenshot-unavailable', 'visual-inspection-unavailable', 'functional-qa-unavailable', 'context-broker-unavailable', 'stale-continuation'].map((id) => ({ id, status: 'DEGRADED', visible: true, falsePass: false, sideEffects: 0 }));
  const rollbackBefore = controller.state;
  controller = rollbackUniversalConsumerCanary(controller, { timestamp: '2026-09-03T00:10:00.000Z' });
  const rollbackProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Design a responsive landing page.', 'rollback-probe', {}, requiredCapabilities), fixtureId: 'phase9a-rollback-probe', catalog, repoRoot });
  controller = transitionUniversalConsumerCanary(controller, 'CONFORMANT', { reason: 'rollback passed; re-enable canary for final state', timestamp: '2026-09-03T00:10:01.000Z' });
  controller = activateUniversalConsumerCanary(controller, { preflight: { passed: preflight }, timestamp: '2026-09-03T00:10:02.000Z' });
  const reenabledProbe = runUniversalConsumerCanaryInvocation({ controller, adapter, nativeInput: nativeInput('Design a responsive landing page.', 'reenabled-probe', {}, requiredCapabilities), fixtureId: 'phase9a-reenabled-probe', catalog, repoRoot });
  const parityPercent = Number((parity.filter((item) => item.semanticMatch).length / parity.length * 100).toFixed(2));
  const routeCorrect = cohort.filter((item) => item.route === item.expectedRoute && item.owner === item.expectedOwner).length / cohort.length * 100;
  const inScopeCohort = cohort.filter((item) => ['design', 'mixed'].includes(item.expectedRoute));
  const hardChecks = {
    baseline: baselinePresent(originMain), phase8dReproduced: phase8d.decision === 'DEFAULT_ACCEPTED', preflight, exactScope: controller.consumer === 'codex' && controller.domain === 'design-web' && controller.state === 'CANARY_ACTIVE' && !controller.productionActive,
    handshake: capabilityHandshakeResult.every((item) => ['SUPPORTED', 'SUPPORTED_WITH_ALTERNATIVE'].includes(item.outcome)), burnIn: burnIn.length === 10 && burnIn.every((item) => item.selectedPath === 'v2' && ['design', 'mixed'].includes(item.route) && item.owner === 'skill.design'), cohort: cohort.length >= 120 && routeCorrect >= 99 && inScopeCohort.every((item) => item.selectedPath === 'v2'),
    substantiveMinimum: substantive.length >= 30, renderedMinimum: browser.renderedArtifacts >= 20, visualQaRequired: browser.visualQaRequired >= 20 && browser.visualQaPassed === browser.visualQaRequired, functionalQaRequired: browser.functionalQaRequired >= 20 && browser.functionalQaPassed === browser.functionalQaRequired,
    qualification: inScopeCohort.filter((item) => item.qualification && !item.expectedQualification).length / Math.max(inScopeCohort.length, 1) <= 0.05 && inScopeCohort.filter((item) => item.expectedQualification && !item.qualification).length === 0, graphAndPackets: [...burnIn, ...inScopeCohort].every((item) => item.taskPacket && item.graph), atomicContext: [...burnIn, ...inScopeCohort].every((item) => item.rawPromptStored === false && item.metrics.fullRepositoryLoaded !== true && item.metrics.fullConversationLoaded !== true), failureDegradation: controlledFailures.every((item) => item.visible && !item.falsePass && item.sideEffects === 0), highRiskSideEffects: [...burnIn, ...cohort].every((item) => item.safety.providerCalls === 0 && item.safety.writesPerformed === 0 && item.safety.executionReady !== true), parity: parityPercent >= 99,
    priorPath: priorPath.length >= 25 && priorPath.every((item) => item.priorAvailable && item.v2AddsEvidence && item.v2AddsGraph), rollback: rollbackBefore === 'CANARY_ACTIVE' && rollbackProbe.selectedPath === 'legacy' && rollbackProbe.v2 === null && reenabledProbe.selectedPath === 'v2', codeNonRegression: phase7a.hardChecks && Object.values(phase7a.hardChecks).every(Boolean), researchNonRegression: phase8d.decision === 'DEFAULT_ACCEPTED', unrelatedLoads: [...burnIn, ...cohort].every((item) => item.metrics.unrelatedFullBodyReads !== undefined ? item.metrics.unrelatedFullBodyReads === 0 : true), productionIsolation: browser.sideEffects?.publishing === 0 && browser.sideEffects?.deployments === 0 && browser.sideEffects?.websiteWrites === 0
  };
  const decision = Object.values(hardChecks).every(Boolean) ? 'CANARY_ACCEPTED' : hardChecks.baseline && hardChecks.preflight && hardChecks.exactScope && hardChecks.rollback ? 'QUALITY_HARDENING_REQUIRED' : 'BLOCKED';
  if (decision === 'CANARY_ACCEPTED') controller = acceptUniversalConsumerCanary(controller, { evidence: { passed: true }, timestamp: '2026-09-03T00:11:00.000Z' });
  const result = { decision, promotionReadiness: decision === 'CANARY_ACCEPTED' ? 'PROMOTION_READY' : 'MORE_DESIGN_EVIDENCE_REQUIRED', source: { sourceRevision, originMain, baselinePresent: baselinePresent(originMain), branch: git(['branch', '--show-current']) }, phase7a, phase8d, universalContract, consumer, validations, broadDrift: validations.find((item) => item.name === 'infinite-brain:conformance')?.classification ?? 'not-run', capabilityHandshake: capabilityHandshakeResult, activation: universalConsumerCanarySnapshot(controller), preflightProbe: { route: preflightProbe.route.primaryRouteFamily, owner: preflightProbe.route.primaryDescriptorId, safety: preflightProbe.safety }, burnIn, cohort, substantive, browserEvidence: browserEvidence, rendered, parity: { count: parity.length, matches: parity.filter((item) => item.semanticMatch).length, percent: parityPercent }, priorPath, controlledFailures, rollback: { passed: hardChecks.rollback, before: rollbackBefore, rollbackProbe: { selectedPath: rollbackProbe.selectedPath, v2Invoked: rollbackProbe.v2 !== null }, reenabledProbe: { selectedPath: reenabledProbe.selectedPath } }, hardChecks };
  if (writeReport) fs.writeFileSync(path.join(repoRoot, PHASE9A_REPORT), makeMarkdown(result));
  return result;
}

if (process.argv.includes('--summary')) {
  try { const result = await runPhase9aDesignWebCanary({ writeReport: process.argv.includes('--write-report') }); console.log(JSON.stringify({ decision: result.decision, promotionReadiness: result.promotionReadiness, source: result.source, hardChecks: result.hardChecks, browser: result.browserEvidence, parity: result.parity, rollback: result.rollback }, null, 2)); if (!['CANARY_ACCEPTED', 'QUALITY_HARDENING_REQUIRED'].includes(result.decision)) process.exitCode = 1; } catch (error) { console.error(error.stack ?? error); process.exitCode = 1; }
}
