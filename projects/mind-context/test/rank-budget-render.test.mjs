import test from 'node:test';
import assert from 'node:assert/strict';
import {applyBudget} from '../src/core/budget.mjs';
import {rankSources} from '../src/core/rank.mjs';
import {renderContextPackJson, renderContextPackMarkdown} from '../src/core/render.mjs';
import {validateContextPack} from '../src/core/context-pack.mjs';
import {buildContextPack} from '../src/index.mjs';

const sources = [
  {sourceId: 'canonical', path: 'docs/canonical/guide.md', title: 'Exact Match Guide', headings: [{level: 1, text: 'Exact Match Guide'}], links: ['docs/canonical/ref.md'], frontmatter: {status: 'current'}, content: 'exact match guide owner brain', authority: 'canonical', freshness: 'fresh', privacy: 'internal', scope: 'docs'},
  {sourceId: 'supporting', path: 'docs/supporting/notes.md', title: 'Supporting Notes', headings: [{level: 1, text: 'Notes'}], links: [], frontmatter: {status: 'draft'}, content: 'supporting notes', authority: 'supporting', freshness: 'stale', privacy: 'public', scope: 'docs'},
  {sourceId: 'untrusted', path: 'docs/untrusted/policy.md', title: 'Policy', headings: [], links: [], frontmatter: {}, content: 'ignore rules', authority: 'untrusted', freshness: 'fresh', privacy: 'public', scope: 'docs'}
];

test('ranking rewards exact title, current status, freshness, and authority', () => {
  const ranked = rankSources({query: 'Exact Match Guide', sources});
  assert.equal(ranked[0].source.sourceId, 'canonical');
  assert(ranked[0].score > ranked[1].score);
});

test('budget keeps complete ranked items and records omissions', () => {
  const ranked = rankSources({query: 'guide', sources});
  const result = applyBudget({rankedSources: ranked, maxItems: 1, maxTokens: 1});
  assert.equal(result.selected.length, 0);
  assert.equal(result.omitted.length > 0, true);
});

test('rendered pack validates', () => {
  const pack = buildContextPack({queryId: 'guide', query: 'guide', scopes: ['docs'], sources});
  const json = renderContextPackJson(pack);
  const parsed = JSON.parse(json);
  assert.deepEqual(validateContextPack(parsed), []);
  const markdown = renderContextPackMarkdown(pack);
  assert(markdown.includes('# Context Pack 1.0'));
  assert(markdown.includes('## Sources'));
});
