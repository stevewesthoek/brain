const DISPOSITIONS = ['investigate_further', 'potentially_useful', 'likely_overlap', 'likely_low_value', 'insufficient_evidence'];

function tokens(values) {
  return new Set(values.join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length >= 4));
}

function fieldValue(metadata, name) {
  return metadata?.[name]?.value ?? null;
}

function evidenceRefs(evidence) {
  return [evidence.source_reference, evidence.source_hash, evidence.provenance?.source_reference].filter(Boolean);
}

export function buildBrainCapabilityProjection(capabilityManifest) {
  return (capabilityManifest?.capabilities ?? []).map((capability) => ({
    capability_id: capability.capabilityId,
    display_name: capability.displayName,
    description: capability.description,
    terms: [capability.capabilityId, capability.displayName, capability.description].filter(Boolean),
    evidence_references: capability.evidenceReferences ?? capability.evidenceReferences ?? capability.evidencePaths ?? [],
    repository_ids: capability.repositoryIds ?? [],
  }));
}

function maintenanceAssessment(metadata) {
  const signals = [];
  const recent = fieldValue(metadata, 'recent_activity');
  const updated = fieldValue(metadata, 'last_update');
  if (recent?.length) signals.push(...recent);
  if (updated) signals.push(`updated:${updated}`);
  if (!signals.length) signals.push('maintenance activity unavailable');
  return signals;
}

function evidenceSignals(metadata, evidence) {
  const description = fieldValue(metadata, 'description') ?? evidence.description ?? null;
  const topics = fieldValue(metadata, 'topics') ?? [];
  const language = fieldValue(metadata, 'primary_language');
  const ecosystem = fieldValue(metadata, 'ecosystem') ?? [];
  const license = fieldValue(metadata, 'license');
  const release = fieldValue(metadata, 'last_release');
  const activity = fieldValue(metadata, 'recent_activity') ?? [];
  const positive = [];
  const negative = [];
  const missing = [];
  if (description) positive.push(`description:${description}`); else negative.push('repository description unavailable');
  if (topics.length) positive.push(`topics:${topics.join(',')}`); else missing.push('repository topics');
  if (language || ecosystem.length) positive.push(`technology:${language ?? ecosystem.join(',')}`); else missing.push('primary language/ecosystem');
  if (license) positive.push('license metadata available'); else missing.push('license metadata');
  if (release) positive.push('latest release metadata available'); else missing.push('latest release metadata');
  if (activity.length) positive.push(...activity); else negative.push('recent activity unavailable');
  missing.push('README and documentation content', 'pull-request activity', 'dependency and architecture evidence');
  return { positive, negative, missing, meaningful_description: typeof description === 'string' && description.trim().length >= 15, corroborating_signal_count: [topics.length > 0, Boolean(language || ecosystem.length), Boolean(license), Boolean(release)].filter(Boolean).length };
}

export function assessGitHubRepositoryFit(evidence, { systemCapabilities = [] } = {}) {
  if (!evidence?.repository?.repository_id) throw new Error('github_repository_identity_required');
  const metadata = evidence.metadata;
  const repositoryId = evidence.repository.repository_id;
  const metadataStatus = evidence.metadata_status ?? 'identity_only';
  const signals = evidenceSignals(metadata, evidence);
  const repositoryTokens = tokens([
    fieldValue(metadata, 'description') ?? evidence.description ?? '',
    ...(fieldValue(metadata, 'topics') ?? []),
    fieldValue(metadata, 'primary_language') ?? '',
    ...(fieldValue(metadata, 'ecosystem') ?? []),
  ]);
  const matches = systemCapabilities.map((capability) => {
    const exact = (capability.repository_ids ?? []).some((id) => id.toLowerCase() === repositoryId.toLowerCase());
    const overlap = [...tokens(capability.terms ?? [])].filter((term) => repositoryTokens.has(term));
    return { capability_id: capability.capability_id, display_name: capability.display_name, exact, overlap, evidence_references: capability.evidence_references ?? [] };
  }).filter((match) => match.exact || match.overlap.length >= 2);
  const exactMatches = matches.filter((match) => match.exact);
  const possibleMatches = matches.filter((match) => !match.exact);
  const uncertainty = [...(evidence.uncertainty ?? [])];
  const alternatives = [];
  let disposition = 'insufficient_evidence';
  let confidence = 0;
  let reasoning = [];
  if (metadataStatus !== 'available') {
    uncertainty.push('repository metadata is unavailable; fit cannot be assessed reliably');
    reasoning.push('Identity evidence exists, but metadata needed for purpose and maintenance assessment is unavailable.');
  } else if (evidence.freshness === 'stale') {
    uncertainty.push('fit assessment relies on stale repository metadata');
    reasoning.push('Metadata is stale, so current purpose and maintenance cannot be established.');
  } else if (!systemCapabilities.length) {
    uncertainty.push('no canonical Brain capability projection was supplied for comparison');
    reasoning.push('Repository metadata is available, but overlap and gap analysis require the current Brain capability projection.');
  } else if (exactMatches.length) {
    disposition = 'likely_overlap';
    confidence = 1;
    reasoning.push('The repository identity is explicitly present in the supplied canonical capability projection.');
  } else if (possibleMatches.length) {
    disposition = 'likely_overlap';
    confidence = 0.65;
    reasoning.push('Repository terms overlap with existing capability descriptions, but this is a possible overlap rather than confirmed equivalence.');
    uncertainty.push('term overlap does not prove equivalent implementation or capability parity');
    alternatives.push('The repository may address a distinct gap despite similar terminology.');
  } else if (signals.meaningful_description && signals.corroborating_signal_count >= 1) {
    disposition = 'potentially_useful';
    confidence = 0.55;
    reasoning.push('Repository purpose is substantive and at least one corroborating public signal is present; no overlap was found in the supplied capability projection.');
    uncertainty.push('absence of term overlap is not proof that the repository fills a system gap');
    alternatives.push('Deeper inspection may reveal overlap or incompatible assumptions.');
  } else if (/first repository|hello world|hello-world/i.test(String(fieldValue(metadata, 'description') ?? evidence.description ?? '')) && signals.corroborating_signal_count === 0) {
    disposition = 'likely_low_value';
    confidence = 0.4;
    reasoning.push('The repository has a recognized low-signal description and no corroborating public metadata.');
    uncertainty.push('low-value appearance is based only on sparse public metadata; repository purpose may still be specialized');
    alternatives.push('A human may retain it as a control, example, or intentionally minimal project.');
  } else {
    disposition = 'investigate_further';
    confidence = 0.3;
    reasoning.push('Metadata is available, but substantive purpose or corroborating signals are too limited for a stronger usefulness disposition.');
    uncertainty.push('meaningful purpose and maturity cannot be established from the available metadata');
  }
  if (metadataStatus === 'available' && evidence.freshness !== 'stale' && !systemCapabilities.length) disposition = 'insufficient_evidence';
  if (metadataStatus === 'available' && evidence.freshness !== 'stale' && systemCapabilities.length && !reasoning.length) disposition = 'investigate_further';
  const description = fieldValue(metadata, 'description') ?? evidence.description ?? null;
  const language = fieldValue(metadata, 'primary_language');
  const topics = fieldValue(metadata, 'topics') ?? [];
  return {
    schema_version: '1.0.0',
    assessment_type: 'github_repository_relevance_fit',
    repository_id: repositoryId,
    generated_at: evidence.metadata_retrieved_at ?? evidence.retrieved_at ?? null,
    purpose: { apparent_purpose: description, principal_capabilities: topics, technology: { primary_language: language, ecosystem: fieldValue(metadata, 'ecosystem') ?? [] }, maintenance_signals: maintenanceAssessment(metadata) },
    system_relevance: { possible_capability_matches: matches, confirmed_overlap: exactMatches.map((match) => match.capability_id), possible_overlap: possibleMatches.map((match) => match.capability_id), potential_gaps: systemCapabilities.length && !matches.length ? ['No matching capability evidence was found; a gap is possible but not established.'] : [], mind_review_required: true, brain_review_required: true },
    integration_considerations: { likely_surface: 'human-reviewed evidence and bounded future analysis only', dependencies: fieldValue(metadata, 'ecosystem') ?? [], operational_complexity: 'unknown_without_repository_inspection', maintenance_burden: 'unknown_without_repository_inspection', security_privacy: ['No repository code or dependencies were inspected.', 'External repository trust and privacy require human review.'], licensing: fieldValue(metadata, 'license'), },
    evidence_quality: { source_references: evidenceRefs(evidence), freshness: evidence.freshness ?? 'unknown', confidence: evidence.confidence ?? 0, uncertainty, metadata_status: metadataStatus, positive_evidence: signals.positive, negative_evidence: signals.negative, missing_evidence: signals.missing },
    disposition: { value: DISPOSITIONS.includes(disposition) ? disposition : 'insufficient_evidence', advisory_only: true, reasoning, confidence, uncertainty, alternatives },
    safety: { read_only: true, human_review_required: true, automatic_recommendation: false, automatic_adoption: false, repository_execution: false, dependency_installation: false, canonical_writes: false },
  };
}
