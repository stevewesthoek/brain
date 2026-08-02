import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function defaultCorpusPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../operations/fixtures/retrieval-evaluation-corpus-v1.json');
}

export function validateEvaluationCorpus(corpus) {
  const errors = [];
  if (corpus?.version !== '1.0.0') errors.push('version');
  if (!Array.isArray(corpus?.cases) || corpus.cases.length < 12) errors.push('cases');
  const ids = new Set();
  for (const [index, item] of (corpus?.cases ?? []).entries()) {
    for (const key of ['caseId', 'version', 'category', 'question', 'allowedScopes', 'forbiddenScopes', 'expectedSources', 'forbiddenSources', 'authorityClass', 'freshnessRequirement', 'expectedConflicts', 'expectedUnknowns', 'privacyClassification', 'citationBehavior', 'budgetBehavior']) {
      if (!(key in item)) errors.push(`case:${index}:missing:${key}`);
    }
    if (ids.has(item.caseId)) errors.push(`duplicate:${item.caseId}`);
    ids.add(item.caseId);
    if (item.version !== '1.0.0') errors.push(`case:${index}:version`);
    if (!Number.isInteger(item.budgetBehavior?.maxItems) || item.budgetBehavior.maxItems < 1) errors.push(`case:${index}:maxItems`);
    if (!Number.isInteger(item.budgetBehavior?.maxTokens) || item.budgetBehavior.maxTokens < 1) errors.push(`case:${index}:maxTokens`);
  }
  return [...new Set(errors)];
}

export function loadEvaluationCorpus(corpusPath = defaultCorpusPath()) {
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const errors = validateEvaluationCorpus(corpus);
  if (errors.length) throw new Error(`invalid_corpus:${errors.join(',')}`);
  return corpus;
}
