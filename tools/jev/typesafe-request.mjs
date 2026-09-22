#!/usr/bin/env node

import fs from 'node:fs';
import { choice, noul, score, TypeSafeClient } from '@typesafe-ai/sdk';

function emit(payload, code = 0) {
  process.stdout.write(`${JSON.stringify({ ...payload, transportCheck: 'stdin_only' })}\n`);
  process.exitCode = code;
}

function fail(reasonCode) {
  emit({ ok: false, reasonCode, containsSecrets: false }, 1);
  process.exit(1);
}

const requestJson = process.argv[2];
if (typeof requestJson !== 'string' || requestJson.length > 8192) fail('invalid_request');
let request;
try { request = JSON.parse(requestJson); } catch { fail('invalid_request'); }
const key = fs.readFileSync(0, 'utf8');
if (!key || key.length > 4096 || /[\u0000-\u001f\u007f]/.test(key)) fail('credential_invalid');

const questions = request?.questions ?? (request?.question ? { decision: request.question } : null);
if (!questions || typeof questions !== 'object' || Array.isArray(questions) || Object.keys(questions).length < 1) fail('invalid_request');
const typedQuestions = {};
for (const [id, question] of Object.entries(questions)) {
  if (question?.type === 'choice') typedQuestions[id] = choice(question.instructions, Object.fromEntries(question.options.map((option) => [option, null])));
  else if (question?.type === 'noul') typedQuestions[id] = noul(question.instructions);
  else if (question?.type === 'score') typedQuestions[id] = score(question.instructions, question.criteria);
  else fail('invalid_request');
}

try {
  const client = new TypeSafeClient({ apiKey: key, logLevel: 'off', retry: { maxRetries: 0 } });
  const response = await client.systemOne({ state: request.state, questions: typedQuestions });
  emit({
    ok: true,
    model: response.model,
    answers: response.answers,
    usage: response.usage,
    containsSecrets: false,
  });
} catch (error) {
  const status = Number.isInteger(error?.status) ? error.status : null;
  const reasonCode = status === 401 ? 'provider_authentication_failed' : status === 403 ? 'provider_forbidden' : status === 429 ? 'provider_rate_limited' : 'provider_request_failed';
  emit({ ok: false, reasonCode, status }, 1);
}
