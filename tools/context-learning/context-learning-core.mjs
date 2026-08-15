import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const CLR_SCHEMA_VERSION = '1.0.0';

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function stableJsonHash(value) {
  const normalized = JSON.stringify(sortValue(value));
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])])
    );
  }
  return value;
}

export function buildAuthorityMap(registry) {
  return new Map((registry.entries ?? []).map((entry) => [entry.kind, entry]));
}

export function validateAuthorityRegistry(registry) {
  const errors = [];
  const seen = new Set();

  if (registry.schemaVersion !== CLR_SCHEMA_VERSION) {
    errors.push(`authority registry schemaVersion must be ${CLR_SCHEMA_VERSION}`);
  }

  for (const entry of registry.entries ?? []) {
    if (seen.has(entry.kind)) errors.push(`duplicate authority kind: ${entry.kind}`);
    seen.add(entry.kind);

    const shouldBeCanonical = entry.owner === 'mind' || entry.owner === 'brain';
    if (entry.canonical !== shouldBeCanonical) {
      errors.push(`${entry.kind}: canonical=${entry.canonical} conflicts with owner=${entry.owner}`);
    }
  }

  return errors;
}

export function validateAtomAuthority(atom, registry) {
  const entry = buildAuthorityMap(registry).get(atom.kind);
  if (!entry) return [`${atom.atomId ?? 'atom'}: unknown authority kind ${atom.kind}`];

  const errors = [];
  if (atom.canonicalOwner !== entry.owner) {
    errors.push(`${atom.atomId ?? 'atom'}: ${atom.kind} must belong to ${entry.owner}, not ${atom.canonicalOwner}`);
  }

  if ((entry.owner === 'mind' || entry.owner === 'brain') && !atom.canonicalRef) {
    errors.push(`${atom.atomId ?? 'atom'}: canonical ${entry.owner} atom requires canonicalRef`);
  }

  if (entry.owner === 'evidence' && atom.authority !== 'evidence') {
    errors.push(`${atom.atomId ?? 'atom'}: evidence-owned atom must use authority=evidence`);
  }

  if ((entry.owner === 'derived' || entry.owner === 'ephemeral') && atom.authority !== 'derived') {
    errors.push(`${atom.atomId ?? 'atom'}: ${entry.owner}-owned atom must use authority=derived`);
  }

  return errors;
}

export function evaluateFreshness(atom, nowInput = new Date()) {
  const now = nowInput instanceof Date ? nowInput : new Date(nowInput);
  if (Number.isNaN(now.getTime())) throw new Error('evaluateFreshness requires a valid now value');

  if (Array.isArray(atom.supersededBy) && atom.supersededBy.length > 0) return 'superseded';
  if (Array.isArray(atom.contradicts) && atom.contradicts.length > 0) return 'contradicted';

  if (atom.validTo) {
    const validTo = new Date(atom.validTo);
    if (!Number.isNaN(validTo.getTime()) && validTo.getTime() <= now.getTime()) return 'stale';
  }

  if (atom.reviewAfter) {
    const reviewAfter = new Date(atom.reviewAfter);
    if (!Number.isNaN(reviewAfter.getTime()) && reviewAfter.getTime() <= now.getTime()) return 'review_due';
  }

  if (atom.freshnessClass === 'unknown') return 'unknown';
  return 'fresh';
}

export function validateRetentionInvariants(profile) {
  const errors = [];
  const seen = new Set();

  if (profile.schemaVersion !== CLR_SCHEMA_VERSION) {
    errors.push(`retention profile schemaVersion must be ${CLR_SCHEMA_VERSION}`);
  }

  for (const storageClass of profile.storageClasses ?? []) {
    const id = storageClass.classId;
    if (seen.has(id)) errors.push(`duplicate retention storage class: ${id}`);
    seen.add(id);

    if (storageClass.canonical) {
      if (storageClass.retentionMode !== 'durable') {
        errors.push(`${id}: canonical storage must use retentionMode=durable`);
      }
      continue;
    }

    if (storageClass.boundedGrowthRequired !== true) {
      errors.push(`${id}: non-canonical storage must require bounded growth`);
    }
    if (storageClass.retentionMode === 'durable') {
      errors.push(`${id}: non-canonical storage cannot be durable forever`);
    }
    if (storageClass.compactionStrategy === 'none') {
      errors.push(`${id}: non-canonical storage requires a compaction/source policy`);
    }

    const hasExplicitBound = Number.isFinite(storageClass.maxBytes)
      || Number.isFinite(storageClass.maxItems)
      || Number.isFinite(storageClass.ttlHours);
    const externallyBounded = storageClass.retentionMode === 'source-owned';
    const lifecycleBounded = storageClass.retentionMode === 'until-resolved';
    const rebuildBounded = storageClass.retentionMode === 'rebuild';

    if (!hasExplicitBound && !externallyBounded && !lifecycleBounded && !rebuildBounded) {
      errors.push(`${id}: non-canonical storage has no explicit or lifecycle bound`);
    }
  }

  return errors;
}

export function resolveClrPaths(repoRoot) {
  return {
    contracts: path.join(repoRoot, 'operations/specs/context-learning/contracts-v1.schema.json'),
    authorityRegistry: path.join(repoRoot, 'operations/specs/context-learning/authority-registry.v1.json'),
    retentionProfile: path.join(repoRoot, 'operations/specs/context-learning/retention-profile.personal-local.v1.json')
  };
}



export function validateJsonSchema(schema, value, rootSchema = schema, at = '$') {
  const errors = [];

  function resolveRef(ref) {
    if (!ref.startsWith('#/$defs/')) throw new Error(`unsupported schema ref: ${ref}`);
    const name = ref.slice('#/$defs/'.length);
    const resolved = rootSchema.$defs?.[name];
    if (!resolved) throw new Error(`missing schema ref: ${ref}`);
    return resolved;
  }

  function typeMatches(type, candidate) {
    switch (type) {
      case 'null': return candidate === null;
      case 'array': return Array.isArray(candidate);
      case 'object': return candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate);
      case 'integer': return Number.isInteger(candidate);
      case 'number': return typeof candidate === 'number' && Number.isFinite(candidate);
      case 'string': return typeof candidate === 'string';
      case 'boolean': return typeof candidate === 'boolean';
      default: throw new Error(`unsupported schema type: ${type}`);
    }
  }

  function check(node, candidate, location) {
    const local = [];
    if (node.$ref) return check(resolveRef(node.$ref), candidate, location);

    if (Array.isArray(node.anyOf)) {
      const valid = node.anyOf.some((option) => check(option, candidate, location).length === 0);
      if (!valid) local.push(`${location}: does not match anyOf`);
      return local;
    }

    if (Array.isArray(node.allOf)) {
      for (const option of node.allOf) local.push(...check(option, candidate, location));
    }

    if (node.if) {
      const conditionMatches = check(node.if, candidate, location).length === 0;
      if (conditionMatches && node.then) local.push(...check(node.then, candidate, location));
    }

    if (Object.hasOwn(node, 'const') && candidate !== node.const) {
      local.push(`${location}: must equal ${JSON.stringify(node.const)}`);
    }
    if (Array.isArray(node.enum) && !node.enum.some((item) => Object.is(item, candidate))) {
      local.push(`${location}: must be one of ${node.enum.map((item) => JSON.stringify(item)).join(', ')}`);
    }

    if (node.type) {
      const types = Array.isArray(node.type) ? node.type : [node.type];
      if (!types.some((type) => typeMatches(type, candidate))) {
        local.push(`${location}: expected type ${types.join('|')}`);
        return local;
      }
    }

    if (typeof candidate === 'string') {
      if (Number.isInteger(node.minLength) && candidate.length < node.minLength) local.push(`${location}: shorter than minLength`);
      if (Number.isInteger(node.maxLength) && candidate.length > node.maxLength) local.push(`${location}: longer than maxLength`);
      if (node.pattern && !new RegExp(node.pattern).test(candidate)) local.push(`${location}: does not match pattern ${node.pattern}`);
      if (node.format === 'date-time' && Number.isNaN(Date.parse(candidate))) local.push(`${location}: invalid date-time`);
    }

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      if (typeof node.minimum === 'number' && candidate < node.minimum) local.push(`${location}: below minimum`);
      if (typeof node.maximum === 'number' && candidate > node.maximum) local.push(`${location}: above maximum`);
      if (typeof node.exclusiveMinimum === 'number' && candidate <= node.exclusiveMinimum) local.push(`${location}: not above exclusiveMinimum`);
    }

    if (Array.isArray(candidate)) {
      if (Number.isInteger(node.minItems) && candidate.length < node.minItems) local.push(`${location}: fewer than minItems`);
      if (Number.isInteger(node.maxItems) && candidate.length > node.maxItems) local.push(`${location}: more than maxItems`);
      if (node.uniqueItems) {
        const seen = new Set(candidate.map((item) => JSON.stringify(sortValue(item))));
        if (seen.size !== candidate.length) local.push(`${location}: array items must be unique`);
      }
      if (node.items) candidate.forEach((item, index) => local.push(...check(node.items, item, `${location}[${index}]`)));
    }

    if (candidate !== null && typeof candidate === 'object' && !Array.isArray(candidate)) {
      for (const required of node.required ?? []) {
        if (!Object.hasOwn(candidate, required)) local.push(`${location}: missing required property ${required}`);
      }
      for (const [key, child] of Object.entries(node.properties ?? {})) {
        if (Object.hasOwn(candidate, key)) local.push(...check(child, candidate[key], `${location}.${key}`));
      }
      if (node.additionalProperties === false) {
        const allowed = new Set(Object.keys(node.properties ?? {}));
        for (const key of Object.keys(candidate)) if (!allowed.has(key)) local.push(`${location}: unexpected property ${key}`);
      }
    }

    return local;
  }

  errors.push(...check(schema, value, at));
  return errors;
}
