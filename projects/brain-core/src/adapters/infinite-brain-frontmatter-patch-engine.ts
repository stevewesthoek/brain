/**
 * Infinite Brain Frontmatter Patch Preview Engine
 * Pure in-memory utility for calculating frontmatter patch previews
 * Never reads or writes files. No filesystem access. No Mind access.
 * Preview-only, all operations blocked by default.
 */

export interface FrontmatterPatchOperation {
  type: 'setField' | 'removeFieldPreview';
  fieldName: string;
  value?: string | number | boolean | Record<string, unknown> | unknown[];
}

export interface FrontmatterPatchInput {
  operations: FrontmatterPatchOperation[];
  reason?: string;
}

export interface FrontmatterFieldChange {
  fieldName: string;
  before?: string | undefined;
  after?: string | undefined;
  type: 'added' | 'modified' | 'removed-preview';
  blocked?: boolean | undefined;
}

export interface FrontmatterPatchPreview {
  markdown: string;
  frontmatter: Record<string, unknown>;
  hasFrontmatter: boolean;
  fieldChanges: FrontmatterFieldChange[];
  diffSummary: string;
}

export interface FrontmatterPatchSafety {
  writesToMind: boolean;
  modifiesMind: boolean;
  canWrite: boolean;
  canWriteToMind: boolean;
  previewOnly: boolean;
  inMemoryOnly: boolean;
  usesShell: boolean;
  modelCalls: boolean;
  continuousRuntime: boolean;
}

const VALID_FIELD_NAMES = new Set([
  'id',
  'name',
  'description',
  'type',
  'tags',
  'category',
  'status',
  'priority',
  'created',
  'modified',
  'author',
  'version',
  'metadata',
  'source',
  'published',
  'archived',
]);

function parseFrontmatterFromMarkdown(markdown: string): {
  frontmatter: Record<string, unknown>;
  bodyStart: number;
  bodyContent: string;
  hasFrontmatter: boolean;
} {
  const trimmed = markdown.trimStart();

  if (!trimmed.startsWith('---')) {
    return {
      frontmatter: {},
      bodyStart: 0,
      bodyContent: markdown,
      hasFrontmatter: false,
    };
  }

  const endDelimiterIndex = trimmed.indexOf('\n---\n', 3);
  if (endDelimiterIndex === -1) {
    return {
      frontmatter: {},
      bodyStart: 0,
      bodyContent: markdown,
      hasFrontmatter: false,
    };
  }

  const frontmatterStr = trimmed.substring(3, endDelimiterIndex).trim();
  const bodyStart = trimmed.indexOf('\n---\n', 3) + 5;
  const bodyContent = trimmed.substring(bodyStart);

  const frontmatter: Record<string, unknown> = {};
  const lines = frontmatterStr.split('\n');

  for (const line of lines) {
    const trimLine = line.trim();
    if (!trimLine || trimLine.startsWith('#')) continue;

    const colonIndex = trimLine.indexOf(':');
    if (colonIndex === -1) continue;

    const key = trimLine.substring(0, colonIndex).trim();
    const value = trimLine.substring(colonIndex + 1).trim();

    if (!value) {
      frontmatter[key] = null;
    } else if (value === 'true') {
      frontmatter[key] = true;
    } else if (value === 'false') {
      frontmatter[key] = false;
    } else if (/^\d+$/.test(value)) {
      frontmatter[key] = parseInt(value, 10);
    } else if (/^\d+\.\d+$/.test(value)) {
      frontmatter[key] = parseFloat(value);
    } else if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      frontmatter[key] = value.slice(1, -1);
    } else if (value.startsWith('[') && value.endsWith(']')) {
      try {
        frontmatter[key] = JSON.parse(value);
      } catch {
        frontmatter[key] = value;
      }
    } else if (value.startsWith('{') && value.endsWith('}')) {
      try {
        frontmatter[key] = JSON.parse(value);
      } catch {
        frontmatter[key] = value;
      }
    } else {
      frontmatter[key] = value;
    }
  }

  return {
    frontmatter,
    bodyStart,
    bodyContent,
    hasFrontmatter: true,
  };
}

function formatFrontmatterToMarkdown(frontmatter: Record<string, unknown>): string {
  const lines: string[] = ['---'];

  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === null || value === undefined) {
      lines.push(`${key}:`);
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'number') {
      lines.push(`${key}: ${value}`);
    } else if (typeof value === 'string') {
      lines.push(`${key}: "${value}"`);
    } else if (typeof value === 'object') {
      try {
        const jsonStr = JSON.stringify(value);
        lines.push(`${key}: ${jsonStr}`);
      } catch {
        lines.push(`${key}: "${String(value)}"`);
      }
    } else {
      lines.push(`${key}: "${String(value)}"`);
    }
  }

  lines.push('---');
  return lines.join('\n');
}

export function validateFrontmatterPatchInput(patch: FrontmatterPatchInput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(patch.operations)) {
    errors.push('operations must be an array');
    return { valid: false, errors };
  }

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i];
    if (!op) {
      errors.push(`operation ${i}: undefined`);
      continue;
    }

    if (!op.type) {
      errors.push(`operation ${i}: missing type`);
    }

    if (op.type !== 'setField' && op.type !== 'removeFieldPreview') {
      errors.push(`operation ${i}: invalid type "${op.type}"`);
    }

    if (!op.fieldName || typeof op.fieldName !== 'string') {
      errors.push(`operation ${i}: fieldName must be a non-empty string`);
    }

    if (!VALID_FIELD_NAMES.has(op.fieldName)) {
      errors.push(`operation ${i}: fieldName "${op.fieldName}" not in safe list`);
    }

    if (op.type === 'removeFieldPreview') {
      errors.push(`operation ${i}: removeFieldPreview is blocked by default`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function parseMarkdownFrontmatterPreview(markdown: string): {
  frontmatter: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
} {
  const parsed = parseFrontmatterFromMarkdown(markdown);
  return {
    frontmatter: parsed.frontmatter,
    body: parsed.bodyContent,
    hasFrontmatter: parsed.hasFrontmatter,
  };
}

export function applyFrontmatterPatchInMemory(
  markdown: string,
  patch: FrontmatterPatchInput
): { success: boolean; error?: string } {
  const validation = validateFrontmatterPatchInput(patch);
  if (!validation.valid) {
    return { success: false, error: `Invalid patch: ${validation.errors.join('; ')}` };
  }

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i];
    if (!op) continue;
    if (op.type === 'removeFieldPreview') {
      return { success: false, error: 'removeFieldPreview operations are blocked by default' };
    }
  }

  return { success: true };
}

export function buildFrontmatterPatchPreview(
  markdown: string,
  patch: FrontmatterPatchInput
): FrontmatterPatchPreview {
  const validation = validateFrontmatterPatchInput(patch);
  // For removeFieldPreview, we allow the preview to continue (will mark as blocked)
  const hasRemoveOps = patch.operations.some(op => op && op.type === 'removeFieldPreview');
  const isFatalError = !validation.valid && !hasRemoveOps;

  if (isFatalError) {
    return {
      markdown,
      frontmatter: {},
      hasFrontmatter: false,
      fieldChanges: [],
      diffSummary: `Cannot preview patch: ${validation.errors[0]}`,
    };
  }

  const parsed = parseFrontmatterFromMarkdown(markdown);
  const updatedFrontmatter = { ...parsed.frontmatter };
  const fieldChanges: FrontmatterFieldChange[] = [];

  for (let i = 0; i < patch.operations.length; i++) {
    const op = patch.operations[i];
    if (!op) continue;

    if (op.type === 'setField') {
      const before = updatedFrontmatter[op.fieldName];
      const beforeStr = before !== undefined ? String(before) : undefined;
      const afterStr = String(op.value);

      updatedFrontmatter[op.fieldName] = op.value;

      fieldChanges.push({
        fieldName: op.fieldName,
        before: beforeStr,
        after: afterStr,
        type: before !== undefined ? 'modified' : 'added',
      });
    } else if (op.type === 'removeFieldPreview') {
      fieldChanges.push({
        fieldName: op.fieldName,
        before: String(updatedFrontmatter[op.fieldName] || ''),
        type: 'removed-preview',
        blocked: true,
      });
    }
  }

  const frontmatterMarkdown = formatFrontmatterToMarkdown(updatedFrontmatter);
  const previewMarkdown = parsed.hasFrontmatter || Object.keys(updatedFrontmatter).length > 0
    ? `${frontmatterMarkdown}\n${parsed.bodyContent}`
    : markdown;

  const diffSummary = fieldChanges
    .map(c => {
      if (c.type === 'added') return `+ ${c.fieldName}: ${c.after}`;
      if (c.type === 'modified') return `~ ${c.fieldName}: ${c.before} → ${c.after}`;
      if (c.type === 'removed-preview') return `× ${c.fieldName} (blocked)`;
      return `? ${c.fieldName}`;
    })
    .join('\n');

  return {
    markdown: previewMarkdown,
    frontmatter: updatedFrontmatter,
    hasFrontmatter: parsed.hasFrontmatter || Object.keys(updatedFrontmatter).length > 0,
    fieldChanges,
    diffSummary,
  };
}

export function getFrontmatterPatchEngineSafety(): FrontmatterPatchSafety {
  return {
    writesToMind: false,
    modifiesMind: false,
    canWrite: false,
    canWriteToMind: false,
    previewOnly: true,
    inMemoryOnly: true,
    usesShell: false,
    modelCalls: false,
    continuousRuntime: false,
  };
}
