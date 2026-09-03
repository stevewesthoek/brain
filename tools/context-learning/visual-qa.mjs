import fs from 'node:fs';

export const VISUAL_QA_RUBRIC_VERSION = 'brain-visual-qa@1.0.0';
export const VISUAL_QA_RUBRIC = Object.freeze([
  'hierarchy', 'layout', 'spacing', 'typography', 'color-contrast',
  'responsive-behavior', 'affordance-state-clarity', 'visual-accessibility-signals'
]);

export function inspectRenderedScreenshot(renderEvidence) {
  const screenshotPath = renderEvidence?.screenshot?.path;
  const screenshotExists = typeof screenshotPath === 'string' && fs.existsSync(screenshotPath);
  const screenshotBytes = screenshotExists ? fs.statSync(screenshotPath).size : 0;
  const layout = renderEvidence?.layout ?? {};
  const checks = {
    renderedArtifact: renderEvidence?.status === 'RENDERED',
    screenshotCaptured: screenshotExists && screenshotBytes > 0,
    viewportRecorded: Number(layout.viewport?.width) > 0 && Number(layout.viewport?.height) > 0,
    noHorizontalOverflow: layout.horizontalOverflow === false,
    contentPresent: Number(layout.bodyTextLength) > 0
  };
  return {
    status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL',
    method: 'rendered-screenshot-inspector',
    rubricVersion: VISUAL_QA_RUBRIC_VERSION,
    rubric: [...VISUAL_QA_RUBRIC],
    checks,
    screenshotBytes
  };
}

export function evaluateVisualQa(renderEvidence) {
  const inspection = renderEvidence?.visualInspection ?? inspectRenderedScreenshot(renderEvidence);
  const evidenceRefs = [renderEvidence?.screenshot?.ref, renderEvidence?.artifact?.ref].filter(Boolean);
  const passed = renderEvidence?.status === 'RENDERED'
    && inspection.status === 'PASS'
    && inspection.rubricVersion === VISUAL_QA_RUBRIC_VERSION
    && VISUAL_QA_RUBRIC.every((item) => inspection.rubric?.includes(item))
    && evidenceRefs.length === 2;
  return {
    gateRef: 'gate.visual-qa',
    status: passed ? 'PASS' : 'FAIL',
    blocking: true,
    evidenceRefs,
    reason: passed ? 'Rendered screenshot was captured and inspected against the Brain visual QA rubric.' : 'Genuine rendered screenshot inspection evidence is missing or failed.',
    inspection
  };
}

export function evaluateFunctionalQa(renderEvidence) {
  const actions = Array.isArray(renderEvidence?.interactions) ? renderEvidence.interactions : [];
  const allActionsPassed = actions.length > 0 && actions.every((item) => item.status === 'PASS');
  const passed = renderEvidence?.status === 'RENDERED'
    && allActionsPassed
    && (renderEvidence.consoleErrors?.length ?? 0) === 0
    && (renderEvidence.requestFailures?.length ?? 0) === 0;
  const evidenceRefs = [...actions.map((item) => item.ref).filter(Boolean), renderEvidence?.artifact?.ref].filter(Boolean);
  return {
    gateRef: 'gate.qa',
    status: passed ? 'PASS' : 'FAIL',
    blocking: true,
    evidenceRefs,
    reason: passed ? 'Browser interactions, console, and network checks passed.' : 'Functional browser evidence is missing or failed.',
    checks: { actionCount: actions.length, allActionsPassed, consoleErrors: renderEvidence?.consoleErrors?.length ?? 0, requestFailures: renderEvidence?.requestFailures?.length ?? 0 }
  };
}
