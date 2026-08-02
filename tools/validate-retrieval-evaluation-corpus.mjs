import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateEvaluationCorpus} from '../projects/mind-context/src/evals/corpus.mjs';

function defaultCorpusPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../operations/fixtures/retrieval-evaluation-corpus-v1.json');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const corpusPath = process.argv[2] ?? defaultCorpusPath();
  const corpus = JSON.parse(fs.readFileSync(corpusPath, 'utf8'));
  const errors = validateEvaluationCorpus(corpus);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`retrieval-corpus=pass cases=${corpus.cases.length}`);
}
