import crypto from 'node:crypto';

export const JEV_SCHEMA_VERSION = 'brain-jev.request.v1';
export const JEV_KEYCHAIN_REFERENCE = 'keychain-ref://com.brain.typesafe/jev.api-key.v1';
export const JEV_MONTHLY_LIMIT_USD = 10;
export const JEV_PILOT_LIMIT_USD = 0.25;
export const JEV_SOFT_WARNING_USD = 5;
export const JEV_CRITICAL_WARNING_USD = 9;
export const JEV_MAX_REQUEST_BYTES = 8 * 1024;
export const JEV_MAX_STATE_BYTES = 4 * 1024;
export const JEV_MAX_QUESTION_BYTES = 2 * 1024;
export const JEV_MAX_OPTIONS = 8;
// System-One preflight uses a bounded set of independent decisions. Keep the
// limit finite while allowing the full Brain-owned turn-decision envelope to
// travel through the bridge in one request.
export const JEV_MAX_QUESTIONS = 16;

const IDENTIFIER_RE = /^[a-z][a-z0-9._-]{0,63}$/;
const SURFACES = new Set(['codex-cli', 'codex-desktop', 'claude-code', 'brain', 'test']);

function invalid(reasonCode, message) {
  return Object.freeze({ ok: false, reasonCode, message });
}

function jsonBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8');
}

function boundedText(value, max, field) {
  if (typeof value !== 'string' || value.length === 0 || value.length > max || /[\u0000-\u001f\u007f]/.test(value)) {
    return invalid('INVALID_REQUEST', `${field} is not bounded text.`);
  }
  return value;
}

function boundedJson(value, max, field) {
  try {
    if (jsonBytes(value) > max) return invalid('INVALID_REQUEST', `${field} exceeds the bounded request size.`);
  } catch {
    return invalid('INVALID_REQUEST', `${field} is not JSON-compatible.`);
  }
  return value;
}

function normalizeQuestion(question, field = 'question') {
  if (!question || typeof question !== 'object' || Array.isArray(question)) return invalid('INVALID_REQUEST', `${field} is required.`);
  const type = question.type ?? 'choice';
  if (!['choice', 'noul', 'score'].includes(type)) return invalid('INVALID_REQUEST', `${field}.type is unsupported.`);
  const instructions = boundedText(question.instructions, 512, `${field}.instructions`);
  if (instructions?.ok === false) return instructions;
  if (type === 'choice') {
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > JEV_MAX_OPTIONS) return invalid('INVALID_REQUEST', `${field}.options must contain 2-8 entries.`);
    const options = question.options.map((option) => boundedText(option, 64, `${field}.options`));
    if (options.some((option) => option?.ok === false)) return invalid('INVALID_REQUEST', `${field}.options are not bounded text.`);
    if (new Set(options).size !== options.length) return invalid('INVALID_REQUEST', `${field}.options must be unique.`);
    return { type, instructions, options };
  }
  if (type === 'noul') return { type, instructions };
  if (!Array.isArray(question.criteria) || question.criteria.length < 2 || question.criteria.length > JEV_MAX_OPTIONS) return invalid('INVALID_REQUEST', `${field}.criteria must contain 2-8 entries.`);
  const criteria = question.criteria.map((entry) => boundedText(entry, 128, `${field}.criteria`));
  if (criteria.some((entry) => entry?.ok === false)) return invalid('INVALID_REQUEST', `${field}.criteria are not bounded text.`);
  return { type, instructions, criteria };
}

export function validateJevRequest(input, { callingSurface = 'brain' } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('INVALID_REQUEST', 'Request must be an object.');
  if (input.schemaVersion !== undefined && input.schemaVersion !== JEV_SCHEMA_VERSION) return invalid('INVALID_REQUEST', 'Unsupported request schema.');
  if (!SURFACES.has(callingSurface)) return invalid('INVALID_SURFACE', 'Calling surface is not admitted.');
  const state = input.state;
  if (state === undefined || (typeof state !== 'string' && (!state || typeof state !== 'object'))) return invalid('INVALID_REQUEST', 'state is required.');
  const stateCheck = boundedJson(state, JEV_MAX_STATE_BYTES, 'state');
  if (stateCheck?.ok === false) return stateCheck;
  if (input.question !== undefined && input.questions !== undefined) return invalid('INVALID_REQUEST', 'Use question or questions, not both.');
  const normalizedQuestions = input.questions !== undefined
    ? (() => {
      if (!input.questions || typeof input.questions !== 'object' || Array.isArray(input.questions)) return invalid('INVALID_REQUEST', 'questions is required.');
      const entries = Object.entries(input.questions);
      if (entries.length < 1 || entries.length > JEV_MAX_QUESTIONS) return invalid('INVALID_REQUEST', `questions must contain 1-${JEV_MAX_QUESTIONS} entries.`);
      const result = {};
      for (const [id, question] of entries) {
        if (!/^[a-z][a-z0-9._-]{0,63}$/.test(id)) return invalid('INVALID_REQUEST', 'question IDs are not bounded identifiers.');
        const normalizedQuestion = normalizeQuestion(question, `questions.${id}`);
        if (normalizedQuestion?.ok === false) return normalizedQuestion;
        result[id] = normalizedQuestion;
      }
      return result;
    })()
    : (() => {
      const normalizedQuestion = normalizeQuestion(input.question, 'question');
      return normalizedQuestion?.ok === false ? normalizedQuestion : { decision: normalizedQuestion };
    })();
  if (normalizedQuestions?.ok === false) return normalizedQuestions;
  const normalized = { schemaVersion: JEV_SCHEMA_VERSION, state, ...(input.questions !== undefined ? { questions: normalizedQuestions } : { question: normalizedQuestions.decision }) };
  if (jsonBytes(normalized) > JEV_MAX_REQUEST_BYTES || Object.values(normalizedQuestions).some((question) => jsonBytes(question) > JEV_MAX_QUESTION_BYTES)) return invalid('INVALID_REQUEST', 'request exceeds the bounded size.');
  return Object.freeze({ ok: true, request: Object.freeze(normalized) });
}

function toSystemOneQuestion(question) {
  if (question.type === 'choice') return { type: 'choice', instructions: question.instructions, criteria: Object.fromEntries(question.options.map((option) => [option, null])) };
  if (question.type === 'noul') return { type: 'noul', instructions: question.instructions };
  return { type: 'score', instructions: question.instructions, criteria: question.criteria };
}

export function toSystemOneRequest(request) {
  const questions = request.questions ?? { decision: request.question };
  return { state: request.state, questions: Object.fromEntries(Object.entries(questions).map(([id, question]) => [id, toSystemOneQuestion(question)])) };
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

export function sha256(value) {
  return crypto.createHash('sha256').update(typeof value === 'string' ? value : canonicalJson(value)).digest('hex');
}

export function monthUtc(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  if (!Number.isFinite(date.getTime())) throw new TypeError('invalid clock');
  return date.toISOString().slice(0, 7);
}

export function safeNumber(value, fallback = null) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

function boundedProbability(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : null;
}

export function sanitizeProviderResult(value, { expectedQuestion = null, expectedQuestions = null } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.transportCheck !== 'stdin_only') return null;
  const model = typeof value.model === 'string' && IDENTIFIER_RE.test(value.model) ? value.model : null;
  const answers = value.answers && typeof value.answers === 'object' && !Array.isArray(value.answers) ? value.answers : null;
  const questions = expectedQuestions ?? (expectedQuestion ? { decision: expectedQuestion } : null);
  const answerEntries = questions ? Object.entries(questions) : Object.entries(answers ?? {});
  if (!model || answerEntries.length < 1 || answerEntries.length > JEV_MAX_QUESTIONS) return null;
  const usage = value.usage && typeof value.usage === 'object' ? {
    input_tokens: Number.isInteger(value.usage.input_tokens) && value.usage.input_tokens >= 0 ? value.usage.input_tokens : 0,
    output_tokens: Number.isInteger(value.usage.output_tokens) && value.usage.output_tokens >= 0 ? value.usage.output_tokens : 0,
  } : { input_tokens: 0, output_tokens: 0 };
  const sanitizedAnswers = {};
  for (const [id, expectedQuestionForAnswer] of answerEntries) {
    const decision = answers?.[id] && typeof answers[id] === 'object' && !Array.isArray(answers[id]) ? answers[id] : null;
    if (!decision || !['choice', 'noul', 'score'].includes(decision.type) || decision.type !== expectedQuestionForAnswer.type) return null;
    const answer = decision.type === 'choice'
      ? {
        type: 'choice',
        choice: typeof decision.choice === 'string' && decision.choice.length <= 64 ? decision.choice : null,
        confidence: boundedProbability(decision.confidence),
        probabilities: decision.probabilities && typeof decision.probabilities === 'object' ? Object.fromEntries(Object.entries(decision.probabilities).filter(([key, item]) => key.length <= 64 && boundedProbability(item) !== null).slice(0, JEV_MAX_OPTIONS)) : {},
      }
      : decision.type === 'noul'
        ? { type: 'noul', noul: boundedProbability(decision.noul) }
        : { type: 'score', score: safeNumber(decision.score), confidence: boundedProbability(decision.confidence) };
    if (answer.choice === null && decision.type === 'choice') return null;
    if (decision.type === 'choice' && (answer.confidence === null || Object.keys(answer.probabilities).length === 0)) return null;
    if (expectedQuestionForAnswer.type === 'choice' && Array.isArray(expectedQuestionForAnswer.options) && !expectedQuestionForAnswer.options.includes(answer.choice)) return null;
    if (answer.noul === null && decision.type === 'noul') return null;
    if (answer.score === null && decision.type === 'score') return null;
    if (decision.type === 'score' && answer.confidence === null) return null;
    sanitizedAnswers[id] = answer;
  }
  return Object.freeze({ ok: true, model, answers: sanitizedAnswers, answer: sanitizedAnswers.decision ?? Object.values(sanitizedAnswers)[0], usage, providerCostUsd: safeNumber(value.providerCostUsd) });
}
