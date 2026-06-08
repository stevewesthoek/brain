/**
 * Infinite Brain Frontmatter Patch Engine Tests
 * Tests for pure in-memory frontmatter patch preview generation
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseMarkdownFrontmatterPreview,
  buildFrontmatterPatchPreview,
  applyFrontmatterPatchInMemory,
  validateFrontmatterPatchInput,
  getFrontmatterPatchEngineSafety,
  type FrontmatterPatchInput,
} from '../adapters/infinite-brain-frontmatter-patch-engine.js';

test('parseMarkdownFrontmatterPreview parses markdown with existing frontmatter', () => {
  const markdown = `---
id: test-123
name: Test Entity
type: entity
---

# Body content
Some text here.`;

  const result = parseMarkdownFrontmatterPreview(markdown);

  assert.equal(result.hasFrontmatter, true, 'should detect frontmatter');
  assert.equal(result.frontmatter.id, 'test-123', 'should parse id field');
  assert.equal(result.frontmatter.name, 'Test Entity', 'should parse name field');
  assert.equal(result.frontmatter.type, 'entity', 'should parse type field');
  assert(result.body.includes('# Body content'), 'should preserve body content');
});

test('parseMarkdownFrontmatterPreview parses markdown without frontmatter', () => {
  const markdown = `# No Frontmatter
Just body content here.`;

  const result = parseMarkdownFrontmatterPreview(markdown);

  assert.equal(result.hasFrontmatter, false, 'should detect no frontmatter');
  assert.deepEqual(result.frontmatter, {}, 'should return empty frontmatter');
  assert.equal(result.body, markdown, 'should return full markdown as body');
});

test('buildFrontmatterPatchPreview setField adds field to new frontmatter', () => {
  const markdown = `# No Frontmatter
Body content.`;

  const patch: FrontmatterPatchInput = {
    operations: [
      { type: 'setField', fieldName: 'id', value: 'new-id-123' },
      { type: 'setField', fieldName: 'status', value: 'active' },
    ],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert.equal(preview.hasFrontmatter, true, 'should create frontmatter');
  assert.equal(preview.frontmatter.id, 'new-id-123', 'should set id field');
  assert.equal(preview.frontmatter.status, 'active', 'should set status field');
  assert(preview.markdown.startsWith('---'), 'should start with frontmatter delimiter');
  assert(preview.markdown.includes('# No Frontmatter'), 'should preserve body content');
});

test('buildFrontmatterPatchPreview setField modifies existing frontmatter', () => {
  const markdown = `---
id: old-id
status: inactive
---

Body content.`;

  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'setField', fieldName: 'status', value: 'active' }],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert.equal(preview.frontmatter.id, 'old-id', 'should preserve existing id field');
  assert.equal(preview.frontmatter.status, 'active', 'should update status field');
  assert.equal(preview.fieldChanges.length, 1, 'should have one field change');
  assert(preview.fieldChanges[0], 'should have first change');
  assert.equal(preview.fieldChanges[0]!.type, 'modified', 'should mark as modified');
});

test('buildFrontmatterPatchPreview preserves body content', () => {
  const bodyContent = `# Title
## Subtitle

Long body text here
with multiple lines.

- List item 1
- List item 2`;

  const markdown = `---
id: test
---

${bodyContent}`;

  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'setField', fieldName: 'name', value: 'Updated Name' }],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert(preview.markdown.includes(bodyContent), 'should preserve exact body content');
  assert(preview.fieldChanges[0], 'should have first change');
  assert.equal(preview.fieldChanges[0]!.type, 'added', 'should mark name as added');
});

test('buildFrontmatterPatchPreview removeFieldPreview is blocked by default', () => {
  const markdown = `---
id: test-id
name: Test Name
---

Body.`;

  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'removeFieldPreview', fieldName: 'id' }],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert(preview.fieldChanges.some(c => c.type === 'removed-preview' && c.blocked), 'should mark removal as blocked');
});

test('applyFrontmatterPatchInMemory rejects removeFieldPreview', () => {
  const markdown = `---
id: test
---
Body.`;

  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'removeFieldPreview', fieldName: 'id' }],
  };

  const result = applyFrontmatterPatchInMemory(markdown, patch);

  assert.equal(result.success, false, 'should fail');
  assert(result.error?.includes('blocked'), 'error should mention blocking');
});

test('applyFrontmatterPatchInMemory accepts valid setField operations', () => {
  const markdown = `---
id: test
---
Body.`;

  const patch: FrontmatterPatchInput = {
    operations: [
      { type: 'setField', fieldName: 'status', value: 'active' },
      { type: 'setField', fieldName: 'priority', value: 5 },
    ],
  };

  const result = applyFrontmatterPatchInMemory(markdown, patch);

  assert.equal(result.success, true, 'should succeed');
  assert(!result.error, 'should have no error');
});

test('validateFrontmatterPatchInput rejects invalid fieldName', () => {
  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'setField', fieldName: 'invalid_field_xyz', value: 'test' }],
  };

  const result = validateFrontmatterPatchInput(patch);

  assert.equal(result.valid, false, 'should be invalid');
  assert(result.errors.some(e => e.includes('invalid_field_xyz')), 'error should mention invalid field');
});

test('validateFrontmatterPatchInput accepts valid fieldNames', () => {
  const patch: FrontmatterPatchInput = {
    operations: [
      { type: 'setField', fieldName: 'id', value: 'test-1' },
      { type: 'setField', fieldName: 'name', value: 'Test' },
      { type: 'setField', fieldName: 'tags', value: ['tag1', 'tag2'] },
    ],
  };

  const result = validateFrontmatterPatchInput(patch);

  assert.equal(result.valid, true, 'should be valid');
  assert.equal(result.errors.length, 0, 'should have no errors');
});

test('validateFrontmatterPatchInput rejects removeFieldPreview operations', () => {
  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'removeFieldPreview', fieldName: 'id' }],
  };

  const result = validateFrontmatterPatchInput(patch);

  assert.equal(result.valid, false, 'should be invalid');
  assert(result.errors.some(e => e.includes('blocked')), 'error should mention blocking');
});

test('getFrontmatterPatchEngineSafety returns all safety blocks', () => {
  const safety = getFrontmatterPatchEngineSafety();

  assert.equal(safety.writesToMind, false, 'writesToMind must be false');
  assert.equal(safety.modifiesMind, false, 'modifiesMind must be false');
  assert.equal(safety.canWrite, false, 'canWrite must be false');
  assert.equal(safety.canWriteToMind, false, 'canWriteToMind must be false');
  assert.equal(safety.previewOnly, true, 'previewOnly must be true');
  assert.equal(safety.inMemoryOnly, true, 'inMemoryOnly must be true');
  assert.equal(safety.usesShell, false, 'usesShell must be false');
  assert.equal(safety.modelCalls, false, 'modelCalls must be false');
  assert.equal(safety.continuousRuntime, false, 'continuousRuntime must be false');
});

test('buildFrontmatterPatchPreview produces deterministic output for same input', () => {
  const markdown = `---
id: test-123
---
Body content.`;

  const patch: FrontmatterPatchInput = {
    operations: [
      { type: 'setField', fieldName: 'name', value: 'Test Name' },
      { type: 'setField', fieldName: 'status', value: 'active' },
    ],
  };

  const preview1 = buildFrontmatterPatchPreview(markdown, patch);
  const preview2 = buildFrontmatterPatchPreview(markdown, patch);

  assert.deepEqual(preview1.frontmatter, preview2.frontmatter, 'frontmatter should match');
  assert.equal(preview1.markdown, preview2.markdown, 'markdown should match');
  assert.equal(preview1.diffSummary, preview2.diffSummary, 'diff summary should match');
});

test('parseMarkdownFrontmatterPreview does not require filesystem paths', () => {
  const markdown = `---
path: /some/path/to/file
type: test
---
Content`;

  // No fs access — just memory
  const result = parseMarkdownFrontmatterPreview(markdown);

  assert.equal(result.frontmatter.path, '/some/path/to/file', 'should parse path field');
  assert.equal(result.frontmatter.type, 'test', 'should parse type field');
  // No fs.readFileSync, no fs.writeFileSync, no fs.statSync
});

test('buildFrontmatterPatchPreview handles numeric values', () => {
  const markdown = `---
id: test
---
Body`;

  const patch: FrontmatterPatchInput = {
    operations: [
      { type: 'setField', fieldName: 'priority', value: 42 },
      { type: 'setField', fieldName: 'version', value: 2.5 },
    ],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert.equal(preview.frontmatter.priority, 42, 'should store integer');
  assert.equal(preview.frontmatter.version, 2.5, 'should store float');
});

test('buildFrontmatterPatchPreview handles boolean values', () => {
  const markdown = `---
id: test
---
Body`;

  const patch: FrontmatterPatchInput = {
    operations: [
      { type: 'setField', fieldName: 'published', value: true },
      { type: 'setField', fieldName: 'archived', value: false },
    ],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert.equal(preview.frontmatter.published, true, 'should store true');
  assert.equal(preview.frontmatter.archived, false, 'should store false');
});

test('buildFrontmatterPatchPreview handles complex object values', () => {
  const markdown = `---
id: test
---
Body`;

  const metadata = { nested: { field: 'value' }, count: 3 };
  const patch: FrontmatterPatchInput = {
    operations: [{ type: 'setField', fieldName: 'metadata', value: metadata }],
  };

  const preview = buildFrontmatterPatchPreview(markdown, patch);

  assert.deepEqual(preview.frontmatter.metadata, metadata, 'should store complex object');
});
