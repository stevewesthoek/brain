/**
 * b8-1-scoring.mjs — Shared subject-neutral scoring for B8.1 benchmark.
 *
 * Used by the executor for both cbm and exact-source subjects.
 * Enforces: missing/null expectedCount fails, itemProperty is generic and validated,
 * no subject-specific scoring divergence.
 */

/**
 * Score a fixture result against its expected values.
 * @param {object} fixture - fixture from manifest
 * @param {object} raw - raw execution result {fileCorrect, lineCorrect, setAccuracy, callerPrecision, callerRecall, calleePrecision, calleeRecall}
 * @returns {object} scored result
 */
export function scoreFixtureResult(fixture, raw) {
  const scored = {
    fileCorrect: raw.fileCorrect ?? false,
    lineCorrect: raw.lineCorrect ?? false,
    setAccuracy: raw.setAccuracy ?? null,
    callerPrecision: raw.callerPrecision ?? null,
    callerRecall: raw.callerRecall ?? null,
    calleePrecision: raw.calleePrecision ?? null,
    calleeRecall: raw.calleeRecall ?? null,
  };

  // Compute retrievalAccuracy from the fixture results
  scored.retrievalAccuracy = {
    fileAccuracy: scored.fileCorrect ? 1.0 : 0.0,
    lineAccuracy: scored.lineCorrect ? 1.0 : 0.0,
  };
  if (scored.setAccuracy !== null) scored.retrievalAccuracy.setAccuracy = scored.setAccuracy;
  if (scored.callerPrecision !== null) scored.retrievalAccuracy.callerPrecision = scored.callerPrecision;
  if (scored.callerRecall !== null) scored.retrievalAccuracy.callerRecall = scored.callerRecall;
  if (scored.calleePrecision !== null) scored.retrievalAccuracy.calleePrecision = scored.calleePrecision;
  if (scored.calleeRecall !== null) scored.retrievalAccuracy.calleeRecall = scored.calleeRecall;

  // Compute callerCalleeF1 if both caller and callee recall are present
  if (scored.callerRecall !== null && scored.calleeRecall !== null) {
    const p = (scored.callerPrecision ?? scored.callerRecall);
    const r = (scored.calleeRecall);
    scored.retrievalAccuracy.callerCalleeF1 = (p + r) > 0 ? (2 * p * r) / (p + r) : 0;
  }

  return scored;
}

/**
 * Validate that expectedCount is present and numeric for file-name-count algorithm.
 * Returns error string or null.
 */
export function validateExpectedCount(fixture) {
  const verification = fixture.verification ?? {};
  if (verification.algorithm === 'file-name-count') {
    if (verification.expectedCount === null || verification.expectedCount === undefined) {
      return `fixture ${fixture.fixtureId}: expectedCount is required for file-name-count algorithm`;
    }
    if (typeof verification.expectedCount !== 'number' || !Number.isInteger(verification.expectedCount)) {
      return `fixture ${fixture.fixtureId}: expectedCount must be a non-null integer`;
    }
  }
  return null;
}

/**
 * Validate itemProperty is a non-empty string when used in json-pointer-set.
 */
export function validateItemProperty(fixture) {
  const verification = fixture.verification ?? {};
  if (verification.algorithm === 'json-pointer-set' && verification.itemProperty !== undefined) {
    if (typeof verification.itemProperty !== 'string' || verification.itemProperty.length === 0) {
      return `fixture ${fixture.fixtureId}: itemProperty must be a non-empty string`;
    }
  }
  return null;
}
