import { canonicalJson, sha256 } from './jev-contract.mjs';

export const JEV_PRICING_SCHEMA_VERSION = 'brain-jev.pricing.v1';
export const JEV_PRICING_EFFECTIVE_DATE = '2026-09-21';
export const JEV_PRICING_SOURCE = 'operator-supplied TypeSafe pricing documentation';
export const JEV_INPUT_USD_PER_MILLION_TOKENS = 0.042;
export const JEV_OUTPUT_USD_PER_MILLION_TOKENS = 0;
export const JEV_RESERVATION_MAX_OUTPUT_TOKENS = 512;
export const JEV_RESERVATION_SAFETY_MULTIPLIER = 4;
export const JEV_MIN_RESERVATION_USD = 0.0001;

export const JEV_PRICING_CATALOG = Object.freeze([
  Object.freeze({
    schemaVersion: JEV_PRICING_SCHEMA_VERSION,
    providerId: 'typesafe',
    modelRef: 'jev-1.13.0',
    effectiveDate: JEV_PRICING_EFFECTIVE_DATE,
    source: JEV_PRICING_SOURCE,
    inputUsdPerMillionTokens: JEV_INPUT_USD_PER_MILLION_TOKENS,
    outputUsdPerMillionTokens: JEV_OUTPUT_USD_PER_MILLION_TOKENS,
  }),
]);

function roundUsd(value) {
  return Number(value.toFixed(6));
}

export function resolveJevPricing(modelRef = 'jev-1.13.0') {
  return JEV_PRICING_CATALOG.find((entry) => entry.modelRef === modelRef)
    ?? (modelRef === 'jev-latest' ? JEV_PRICING_CATALOG[0] : null);
}

export function calculateJevTokenCost({ modelRef, inputTokens, outputTokens }) {
  const pricing = resolveJevPricing(modelRef);
  if (!pricing || !Number.isInteger(inputTokens) || inputTokens < 0 || !Number.isInteger(outputTokens) || outputTokens < 0) return null;
  return {
    amountUsd: roundUsd((inputTokens * pricing.inputUsdPerMillionTokens + outputTokens * pricing.outputUsdPerMillionTokens) / 1_000_000),
    basis: 'token_calculated',
    pricing,
  };
}

export function estimateJevReservation({ request, modelRef = 'jev-1.13.0' }) {
  const pricing = resolveJevPricing(modelRef);
  if (!pricing) return null;
  const boundedInputTokens = Math.max(1, Math.ceil(Buffer.byteLength(canonicalJson(request), 'utf8') / 4));
  const estimated = ((boundedInputTokens * pricing.inputUsdPerMillionTokens + JEV_RESERVATION_MAX_OUTPUT_TOKENS * pricing.outputUsdPerMillionTokens) / 1_000_000) * JEV_RESERVATION_SAFETY_MULTIPLIER;
  return {
    amountUsd: Math.max(JEV_MIN_RESERVATION_USD, roundUsd(estimated)),
    basis: 'bounded_token_reservation',
    estimatedInputTokens: boundedInputTokens,
    maxOutputTokens: JEV_RESERVATION_MAX_OUTPUT_TOKENS,
    safetyMultiplier: JEV_RESERVATION_SAFETY_MULTIPLIER,
    pricing,
  };
}

export function deriveCostCorrectionId({ utcMonth, modelRef, callIds, reason }) {
  return `jev-cost-correction:${sha256({ schemaVersion: JEV_PRICING_SCHEMA_VERSION, utcMonth, modelRef, callIds: [...callIds].sort(), reason })}`;
}
