import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEvaluationCorpus} from '../projects/mind-context/src/evals/corpus.mjs';

const corpus = JSON.parse(fs.readFileSync('operations/fixtures/retrieval-evaluation-corpus-v1.json', 'utf8'));

test('valid corpus passes', () => assert.deepEqual(validateEvaluationCorpus(corpus), []));

test('duplicate ids fail', () => {
  const cloned = structuredClone(corpus);
  cloned.cases[1].caseId = cloned.cases[0].caseId;
  assert(validateEvaluationCorpus(cloned).some((entry) => entry.startsWith('duplicate:')));
});

test('missing metadata fails', () => {
  const cloned = structuredClone(corpus);
  delete cloned.cases[0].citationBehavior;
  assert(validateEvaluationCorpus(cloned).some((entry) => entry.includes('missing:citationBehavior')));
});

test('invalid budget fails', () => {
  const cloned = structuredClone(corpus);
  cloned.cases[0].budgetBehavior.maxItems = 0;
  assert(validateEvaluationCorpus(cloned).some((entry) => entry.includes('maxItems')));
});
