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
  const lineApplicable = isLineMetricApplicable(fixture);
  const scored = {
    fileCorrect: raw.fileCorrect ?? false,
    lineCorrect: lineApplicable ? (raw.lineCorrect ?? false) : null,
    setAccuracy: raw.setAccuracy ?? null,
    callerPrecision: raw.callerPrecision ?? null,
    callerRecall: raw.callerRecall ?? null,
    calleePrecision: raw.calleePrecision ?? null,
    calleeRecall: raw.calleeRecall ?? null,
  };

  // Compute retrievalAccuracy from the fixture results
  scored.retrievalAccuracy = {
    fileAccuracy: scored.fileCorrect ? 1.0 : 0.0,
  };
  if (lineApplicable) scored.retrievalAccuracy.lineAccuracy = scored.lineCorrect ? 1.0 : 0.0;
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
 * Whether the fixture makes a source-line claim. File, count, and set fixtures
 * intentionally have no line metric and must not be scored as line failures.
 */
export function isLineMetricApplicable(fixture) {
  const algorithm = fixture?.verification?.algorithm ?? 'file-exists';
  return algorithm === 'line-contains' || algorithm === 'symbol-at-line';
}

/**
 * Exact set-match scoring with a Jaccard diagnostic. Duplicate values are
 * collapsed because the manifest contract describes a set, not a multiset.
 */
export function scoreSetValues(expectedValues, actualValues) {
  const expected = new Set(Array.isArray(expectedValues) ? expectedValues : []);
  const actual = new Set(Array.isArray(actualValues) ? actualValues : []);
  const union = new Set([...expected, ...actual]);
  let intersectionSize = 0;
  for (const value of expected) {
    if (actual.has(value)) intersectionSize += 1;
  }
  const setAccuracy = union.size === 0 ? 1 : intersectionSize / union.size;
  const setsMatch = expected.size === actual.size && intersectionSize === expected.size;
  return { setAccuracy, setsMatch, expected: [...expected], actual: [...actual] };
}

/**
 * Score a provider-predicted set against the manifest truth set. Empty/empty
 * is a perfect result; an empty prediction for non-empty truth scores zero.
 */
export function scorePredictedSet(expectedValues, predictedValues, matches = (predicted, expected) => predicted === expected) {
  const expected = [...new Set(Array.isArray(expectedValues) ? expectedValues : [])];
  const predicted = [...new Set(Array.isArray(predictedValues) ? predictedValues : [])];

  // Use one-to-one maximum-cardinality matching. A permissive comparator (for
  // example, qualified-name suffix matching) must not let one prediction count
  // as multiple true positives.
  const predictedByExpected = new Array(expected.length).fill(-1);
  function assignPrediction(predictedIndex, visitedExpected) {
    for (let expectedIndex = 0; expectedIndex < expected.length; expectedIndex += 1) {
      if (visitedExpected.has(expectedIndex) || !matches(predicted[predictedIndex], expected[expectedIndex])) continue;
      visitedExpected.add(expectedIndex);
      if (predictedByExpected[expectedIndex] === -1
        || assignPrediction(predictedByExpected[expectedIndex], visitedExpected)) {
        predictedByExpected[expectedIndex] = predictedIndex;
        return true;
      }
    }
    return false;
  }
  let truePositives = 0;
  for (let predictedIndex = 0; predictedIndex < predicted.length; predictedIndex += 1) {
    if (assignPrediction(predictedIndex, new Set())) truePositives += 1;
  }

  return {
    precision: predicted.length === 0 ? (expected.length === 0 ? 1 : 0) : truePositives / predicted.length,
    recall: expected.length === 0 ? 1 : truePositives / expected.length,
  };
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
