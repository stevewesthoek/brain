import {
  evaluateFreshness,
  stableJsonHash,
  validateAtomAuthority,
  validateJsonSchema
} from './context-learning-core.mjs';

const LIFECYCLE_VERSION = '1.0.0';
const FRESHNESS_FINDINGS = new Set(['review_due', 'stale', 'superseded', 'contradicted', 'unknown']);
const PRIVACY_CLASSES = new Set(['public', 'internal', 'sensitive', 'restricted']);

function refs(value = []) {
  return [...new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.length > 0) : [])].sort();
}

function confidence(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5;
}

function impact(atom, category) {
  if (atom.canonicalOwner === 'mind') return { impact: 'mind', mind_impact: 'requires_review' };
  if (category === 'contradiction' || category === 'outdated_reference') return { impact: 'brain', mind_impact: 'possible' };
  return { impact: 'operational', mind_impact: 'none' };
}

function finding(category, atom, evidence, reason, extra = {}) {
  const sourceRefs = refs([atom.canonicalRef, ...(atom.sourceEvidenceRefs ?? []), ...(extra.source_refs ?? [])]);
  const relationRefs = refs([...(atom.relatedTo ?? []), ...(extra.relationship_refs ?? [])]);
  const impactState = impact(atom, category);
  const payload = {
    category,
    atom_id: atom.atomId,
    source_refs: sourceRefs,
    evidence,
    reason,
    freshness: extra.freshness ?? 'unknown',
    confidence: confidence(extra.confidence ?? (atom.authority === 'human' ? 0.9 : 0.7)),
    impact_classification: impactState.impact,
    mind_impact: impactState.mind_impact,
    relationship_refs: relationRefs,
    privacy_class: atom.sensitivity,
    action: 'review_only'
  };
  return {
    finding_id: `lifecycle-${stableJsonHash(payload).slice(0, 24)}`,
    ...payload
  };
}

function validateInputs(atoms, relations, { contractSchema, authorityRegistry } = {}) {
  if (!Array.isArray(atoms) || !Array.isArray(relations)) throw new Error('atoms_and_relations_required');
  if (!contractSchema?.$defs?.knowledgeAtom || !contractSchema?.$defs?.relation || !authorityRegistry) throw new Error('lifecycle_contracts_required');
  const errors = [];
  for (const atom of atoms) {
    errors.push(...validateJsonSchema(contractSchema.$defs.knowledgeAtom, atom, contractSchema).map((error) => `${atom.atomId ?? 'atom'}: ${error}`));
    errors.push(...validateAtomAuthority(atom, authorityRegistry));
    if (!PRIVACY_CLASSES.has(atom.sensitivity)) errors.push(`${atom.atomId ?? 'atom'}: invalid privacy class`);
  }
  for (const relation of relations) errors.push(...validateJsonSchema(contractSchema.$defs.relation, relation, contractSchema).map((error) => `${relation.relationId ?? 'relation'}: ${error}`));
  if (errors.length > 0) throw new Error(`invalid_lifecycle_inputs:${errors.join('; ')}`);
}

export function analyzeKnowledgeLifecycle({
  atoms,
  relations,
  sourceRefs = [],
  now = new Date(),
  contractSchema,
  authorityRegistry
} = {}) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('valid_now_required');
  validateInputs(atoms, relations, { contractSchema, authorityRegistry });
  const atomMap = new Map(atoms.map((atom) => [atom.atomId, atom]));
  const knownSources = new Set(sourceRefs.filter((source) => typeof source === 'string'));
  const relationByAtom = new Map(atoms.map((atom) => [atom.atomId, []]));
  for (const relation of relations) {
    if (relationByAtom.has(relation.fromAtomId)) relationByAtom.get(relation.fromAtomId).push(relation.relationId);
    if (relationByAtom.has(relation.toAtomId)) relationByAtom.get(relation.toAtomId).push(relation.relationId);
  }

  const findings = [];
  const contentGroups = new Map();
  for (const atom of atoms) {
    const freshness = evaluateFreshness(atom, now);
    if (FRESHNESS_FINDINGS.has(freshness)) {
      findings.push(finding(freshness === 'contradicted' ? 'contradiction' : 'stale_information', atom, ['freshness_evaluator'], `freshness is ${freshness}`, { freshness }));
    }
    const group = contentGroups.get(atom.contentHash) ?? [];
    group.push(atom);
    contentGroups.set(atom.contentHash, group);

    const missingEvidence = (atom.sourceEvidenceRefs ?? []).filter((ref) => knownSources.size > 0 && !knownSources.has(ref));
    if (missingEvidence.length > 0) {
      findings.push(finding('outdated_reference', atom, missingEvidence, 'evidence reference is not present in the supplied source inventory', { source_refs: missingEvidence, freshness }));
    }
    if ((atom.sourceEvidenceRefs ?? []).length === 0) {
      findings.push(finding('retrieval_gap', atom, ['knowledge_atom'], 'atom has no evidence reference', { freshness, confidence: 0.8 }));
    }
    if ((atom.relatedTo ?? []).length === 0 && relationByAtom.get(atom.atomId).length === 0) {
      findings.push(finding('missing_relationship', atom, ['relation_index'], 'atom has no known relationship edge', { freshness, confidence: 0.65 }));
    }
  }

  for (const group of contentGroups.values()) {
    if (group.length < 2) continue;
    for (const atom of group) {
      findings.push(finding('duplicate_information', atom, group.map((item) => item.atomId), `content hash is shared by ${group.length} atoms`, { freshness: evaluateFreshness(atom, now), confidence: 0.98 }));
    }
  }

  for (const atom of atoms) {
    for (const targetId of atom.contradicts ?? []) {
      const target = atomMap.get(targetId);
      findings.push(finding('contradiction', atom, [targetId, ...(target?.sourceEvidenceRefs ?? [])], `atom explicitly contradicts ${targetId}`, {
        freshness: evaluateFreshness(atom, now), relationship_refs: relationByAtom.get(atom.atomId), confidence: target ? 0.95 : 0.75
      }));
    }
  }

  const sortedFindings = findings
    .sort((left, right) => left.finding_id.localeCompare(right.finding_id));
  return {
    schema_version: LIFECYCLE_VERSION,
    mode: 'REPORT_ONLY',
    generated_at: now.toISOString(),
    source: { atom_count: atoms.length, relation_count: relations.length, source_ref_count: knownSources.size },
    findings: sortedFindings,
    summary: {
      finding_count: sortedFindings.length,
      categories: [...new Set(sortedFindings.map((item) => item.category))].sort(),
      mind_review_count: sortedFindings.filter((item) => item.mind_impact === 'requires_review').length,
      canonical_updates: 0,
      writes_performed: 0,
      approvals_requested: 0
    }
  };
}
