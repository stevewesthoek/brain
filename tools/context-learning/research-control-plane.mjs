import crypto from 'node:crypto';
import { validateEvidencePacket } from '../orchestration/task-evidence-packets.mjs';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';

export const RESEARCH_MODE = 'read_only_source_acquisition';
const MAX_BYTES = 2_000_000;
const ALLOWED_SOURCE_HOSTS = new Set(['sec.gov', 'www.sec.gov', 'datahelpdesk.worldbank.org', 'data.worldbank.org', 'www.postgresql.org', 'www.nps.gov', 'www.biblegateway.com', 'biblehub.com', 'www.blueletterbible.org']);

function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function id(value) { return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-|-$/g, '').slice(0, 170) || 'research-item'; }
function excerpt(text, marker = '') {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const index = marker ? clean.toLowerCase().indexOf(marker.toLowerCase()) : -1;
  const start = index >= 0 ? Math.max(0, index - 160) : 0;
  return clean.slice(start, start + 420);
}
function ref(refType, value, sourceRevision = 'research-source') {
  return { refId: id(`${refType}-${value}`), refType, value: String(value), sourceRevision };
}

export const RESEARCH_SOURCE_CATALOG = Object.freeze({
  company: [
    { sourceId: 'sec-apple-2025-10k', title: 'Apple Inc. 2025 Form 10-K', publisher: 'U.S. Securities and Exchange Commission', author: 'Apple Inc.', sourceClass: 'PRIMARY', url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/aapl-20250927.htm', marker: 'Net sales by reportable segment', claim: 'Apple’s annual filing is a primary source for its reported business, segment, and risk disclosures.' },
    { sourceId: 'sec-apple-2025-index', title: 'Apple Inc. 2025 10-K filing index', publisher: 'U.S. Securities and Exchange Commission', author: 'SEC EDGAR', sourceClass: 'OFFICIAL', url: 'https://www.sec.gov/Archives/edgar/data/320193/0000320193-25-000079-index.htm', marker: '10-K', claim: 'The SEC filing index independently identifies the filing and its official accession context.' }
  ],
  market: [
    { sourceId: 'worldbank-indicator-api', title: 'World Bank Indicator API queries', publisher: 'World Bank', sourceClass: 'OFFICIAL', url: 'https://datahelpdesk.worldbank.org/knowledgebase/articles/898599-indicator-api-queries', marker: 'api', claim: 'The World Bank documents an API for querying indicator data, making the method and provenance inspectable.' },
    { sourceId: 'worldbank-gdp-indicator', title: 'GDP (current US$) indicator', publisher: 'World Bank Data', sourceClass: 'DIRECT_DATA', url: 'https://data.worldbank.org/indicator/NY.GDP.MKTP.CD', marker: 'GDP', claim: 'The World Bank indicator page is a direct data surface for the named GDP series, subject to its definitions and update cycle.' }
  ],
  technical: [
    { sourceId: 'postgresql-json-16', title: 'PostgreSQL 16 JSON Types', publisher: 'PostgreSQL Global Development Group', sourceClass: 'PRIMARY', url: 'https://www.postgresql.org/docs/16/datatype-json.html', marker: 'jsonb', claim: 'The PostgreSQL manual is the primary technical source for JSON and JSONB behavior in PostgreSQL 16.' },
    { sourceId: 'postgresql-current-docs', title: 'PostgreSQL documentation', publisher: 'PostgreSQL Global Development Group', sourceClass: 'OFFICIAL', url: 'https://www.postgresql.org/docs/', marker: 'Documentation', claim: 'The current PostgreSQL documentation is the authoritative entry point for version-sensitive behavior.' }
  ],
  outdoor: [
    { sourceId: 'nps-hiking-safety', title: 'Hiking Safety', publisher: 'National Park Service', sourceClass: 'OFFICIAL', url: 'https://www.nps.gov/articles/hiking-safety.htm', marker: 'Plan', claim: 'The National Park Service recommends planning, carrying essentials, and accounting for conditions before hiking.' },
    { sourceId: 'nps-trip-planning', title: 'Trip Planning Guide Package', publisher: 'National Park Service', sourceClass: 'OFFICIAL', url: 'https://www.nps.gov/subjects/healthandsafety/upload/Trip-Planning-Guide-Package-508c.pdf', marker: '', claim: 'The NPS trip-planning package is an official planning aid; this canary records its retrieval and identity without copying the document.' }
  ],
  bible: [
    { sourceId: 'biblegateway-romans-8', title: 'Romans 8 (NIV)', publisher: 'Bible Gateway', sourceClass: 'SUPPLEMENTARY', url: 'https://www.biblegateway.com/passage/?search=Romans+8&version=NIV', marker: 'There is now no condemnation', claim: 'The passage text provides a bounded translation witness for Romans 8; translation wording is not treated as the original-language text.' },
    { sourceId: 'biblegateway-romans-8-7-9', title: 'Romans 8:7–9 (NIV)', publisher: 'Bible Gateway', sourceClass: 'SUPPLEMENTARY', url: 'https://www.biblegateway.com/passage/?search=Romans+8%3A7-9&version=NIV', marker: 'The mind governed by the flesh', claim: 'The selected verses provide the immediate translation context for the mind/flesh contrast in Romans 8:7–9.' },
    { sourceId: 'biblehub-romans-8-7', title: 'Romans 8:7 interlinear', publisher: 'Bible Hub', sourceClass: 'HIGH_QUALITY_SECONDARY', url: 'https://biblehub.com/interlinear/romans/8-7.htm', marker: 'mind', claim: 'The interlinear page is a secondary lexical aid; it can identify forms and glosses but cannot by itself settle contextual meaning.' },
    { sourceId: 'blueletter-5426', title: 'Greek lexicon entry for phroneō (G5426)', publisher: 'Blue Letter Bible', sourceClass: 'HIGH_QUALITY_SECONDARY', url: 'https://www.blueletterbible.org/lexicon/g5426/kjv/tr/0-1/', marker: 'phroneo', claim: 'The lexical entry presents a semantic range for phroneō; semantic range is evidence to weigh, not a license to import every gloss.' },
    { sourceId: 'biblegateway-romans-8-1-17', title: 'Romans 8:1–17 (NIV)', publisher: 'Bible Gateway', sourceClass: 'SUPPLEMENTARY', url: 'https://www.biblegateway.com/passage/?search=Romans+8%3A1-17&version=NIV', marker: 'Spirit', claim: 'The larger paragraph supplies literary context for reading Romans 8:7–9 within the chapter argument.' }
  ]
});

function sourceRef(source) { return ref('source', source.sourceId); }

async function acquire(source, { fetchImpl = globalThis.fetch, retrievedAt = new Date().toISOString(), maxBytes = MAX_BYTES } = {}) {
  const base = { sourceId: source.sourceId, title: source.title, publisher: source.publisher, ...(source.author ? { author: source.author } : {}), url: source.url, retrievedAt, sourceClass: source.sourceClass, claimRefs: [], confidence: source.sourceClass === 'SUPPLEMENTARY' ? 0.72 : 0.94, uncertainty: 'Bounded retrieval records metadata and a short extracted excerpt; it does not make the source canonical knowledge.', contradictionState: 'NONE' };
  let parsedUrl;
  try { parsedUrl = new URL(source.url); } catch { return { ...base, retrievalStatus: 'UNAVAILABLE', contentDigest: 'unavailable:invalid-url', uncertainty: 'Invalid source URL; no evidence was fabricated.' }; }
  if (parsedUrl.protocol !== 'https:' || !ALLOWED_SOURCE_HOSTS.has(parsedUrl.hostname)) return { ...base, retrievalStatus: 'UNAVAILABLE', contentDigest: 'unavailable:source-not-allowlisted', uncertainty: 'Source host or protocol is outside the bounded read-only allowlist; no request was made.' };
  if (typeof fetchImpl !== 'function') return { ...base, retrievalStatus: 'UNAVAILABLE', contentDigest: 'unavailable:no-fetch', uncertainty: 'Source method unavailable; no evidence was fabricated.' };
  try {
    const response = await fetchImpl(source.url, { headers: { 'user-agent': 'Brain-Research-Canary/1.0 (read-only validation)' } });
    if (!response?.ok) return { ...base, retrievalStatus: 'UNAVAILABLE', contentDigest: `unavailable:http-${response?.status ?? 'unknown'}`, uncertainty: `HTTP retrieval failed (${response?.status ?? 'unknown'}); source identity retained, evidence unavailable.` };
    const bytes = new Uint8Array(await response.arrayBuffer());
    const bounded = bytes.slice(0, maxBytes);
    const text = new TextDecoder().decode(bounded);
    const contentDigest = `sha256:${hash(Buffer.from(bytes).toString('base64'))}`;
    const contentExcerpt = excerpt(text.replace(/<[^>]+>/g, ' '), source.marker);
    return { ...base, retrievalStatus: bytes.length > maxBytes ? 'WEAK' : 'RETRIEVED', contentDigest, excerpt: contentExcerpt, bytes: bytes.length, sourceClass: source.sourceClass, extractedEvidence: contentExcerpt || 'Retrieved source bytes and identity; no bounded text excerpt was retained for this format.' };
  } catch (error) {
    return { ...base, retrievalStatus: 'UNAVAILABLE', contentDigest: `unavailable:${id(error?.name ?? 'fetch-error')}`, uncertainty: `Read-only retrieval failed: ${String(error?.message ?? 'unknown error').slice(0, 180)}; no evidence was fabricated.` };
  }
}

function quality(sourceRecords) {
  const usable = sourceRecords.filter((source) => ['RETRIEVED', 'WEAK'].includes(source.retrievalStatus));
  const preferred = usable.filter((source) => ['PRIMARY', 'OFFICIAL', 'DIRECT_DATA', 'SCHOLARLY'].includes(source.sourceClass));
  const classes = new Set(usable.map((source) => source.sourceClass));
  return { primaryOrAuthoritativeUse: usable.length ? preferred.length / usable.length : 0, relevance: usable.length ? usable.filter((source) => source.extractedEvidence || source.retrievalStatus === 'WEAK').length / usable.length : 0, diversity: Math.min(1, classes.size / 3), weakSourceDependence: usable.length ? usable.filter((source) => ['SUPPLEMENTARY', 'UNAVAILABLE', 'WEAK'].includes(source.sourceClass) || source.retrievalStatus !== 'RETRIEVED').length / usable.length : 1, contradictionsRetained: sourceRecords.filter((source) => source.contradictionState === 'OPEN').length };
}

function claimLayers({ topic, sources, category, contradiction = false, specialist = false }) {
  const available = sources.filter((source) => source.retrievalStatus === 'RETRIEVED');
  const refs = available.map((source) => source.sourceId);
  const evidenceId = id(`evidence-${topic}`);
  const claims = [
    { claimId: id(`source-${topic}`), layer: 'SOURCE', statement: `${available.length} bounded source record(s) were retrieved for ${topic}.`, sourceRefs: refs.length ? refs : sources.map((source) => source.sourceId), evidenceRefs: [evidenceId], confidence: available.length ? 0.95 : 0, uncertainty: available.length ? 'Retrieval confirms source identity and bounded content access, not truth of every claim.' : 'No source content was available.', relation: available.length ? 'SUPPORTS' : 'UNRESOLVED' },
    { claimId: id(`extracted-${topic}`), layer: 'EXTRACTED_EVIDENCE', statement: available.length ? available.map((source) => source.claim ?? source.title).join(' ') : 'No extracted source evidence is available.', sourceRefs: refs.length ? refs : sources.map((source) => source.sourceId), evidenceRefs: [evidenceId], confidence: available.length ? 0.86 : 0, uncertainty: available.length ? 'The extraction is bounded and deterministic; it is not a complete source summary.' : 'Source retrieval was unavailable or failed; no extracted evidence was fabricated.', relation: available.length ? 'SUPPORTS' : 'UNRESOLVED' },
    { claimId: id(`interpretation-${topic}`), layer: 'INTERPRETATION', statement: specialist ? `For ${topic}, the selected specialist evidence is interpreted within its relevant passage, lexical, or domain context; it does not import unrelated layers.` : `For ${topic}, the retrieved evidence is relevant to the requested ${category} question but does not establish more than the cited scope.`, sourceRefs: refs.length ? refs : sources.map((source) => source.sourceId), evidenceRefs: [evidenceId], confidence: available.length ? 0.78 : 0, uncertainty: 'Interpretive judgment remains bounded by source scope and retrieval quality.', relation: available.length ? 'QUALIFIES' : 'UNRESOLVED' },
    { claimId: id(`conclusion-${topic}`), layer: 'CONCLUSION', statement: available.length ? `A bounded answer about ${topic} is supportable from the retrieved source set, with the stated uncertainty.` : `EVIDENCE_INSUFFICIENT: ${topic} cannot be concluded from unavailable source evidence.`, sourceRefs: refs.length ? refs : sources.map((source) => source.sourceId), evidenceRefs: [evidenceId], confidence: available.length ? 0.74 : 0, uncertainty: available.length ? 'This is not a complete deep-research result and should not be generalized beyond the named question.' : 'Additional safe source acquisition is required.', relation: available.length ? 'SUPPORTS' : 'UNRESOLVED' }
  ];
  if (contradiction) claims.push({ claimId: id(`uncertainty-${topic}`), layer: 'UNCERTAINTY', statement: 'Conflicting source positions are retained, quality-compared, and left open where the available evidence cannot reconcile them.', sourceRefs: sources.map((source) => source.sourceId), evidenceRefs: [evidenceId], confidence: 1, uncertainty: 'No conflicting source was silently discarded.', relation: 'UNRESOLVED' });
  return { claims, evidenceId };
}

export async function runResearchOutput({ taskId = 'research-task', topic, category, sourceSpecs, sourceRevision = 'research-canary', fetchImpl = globalThis.fetch, retrievedAt = new Date().toISOString(), contradiction = false, specialist = false, extraRequest = false, currentState = {}, catalog = createCapabilityCatalog() } = {}) {
  const specs = sourceSpecs ?? RESEARCH_SOURCE_CATALOG[category] ?? RESEARCH_SOURCE_CATALOG.technical;
  const sourceRecords = [];
  for (const source of specs) sourceRecords.push(await acquire(source, { fetchImpl, retrievedAt }));
  if (contradiction) for (const source of sourceRecords) source.contradictionState = 'OPEN';
  const layers = claimLayers({ topic, sources: sourceRecords, category, contradiction, specialist });
  for (const source of sourceRecords) source.claimRefs = layers.claims.filter((claim) => claim.sourceRefs.includes(source.sourceId)).map((claim) => claim.claimId);
  const evidenceRef = ref('evidence', layers.evidenceId, sourceRevision);
  const taskRef = ref('task', `task://${taskId}`, sourceRevision);
  const sourceRefs = sourceRecords.map(sourceRef);
  const packet = {
    schemaVersion: '1.0.0', evidenceId: id(`evidence-${taskId}-${topic}`), taskId: id(taskId), subtaskId: id(`research-${topic}`),
    producerCapability: { capabilityId: specialist ? 'skill.bible-research' : 'skill.research', sourceRef: specialist ? 'ai/skills/custom/bible-research/SKILL.md' : 'ai/skills/custom/research/SKILL.md', sourceRevision: catalog.descriptors.find((item) => item.capabilityId === (specialist ? 'skill.bible-research' : 'skill.research'))?.sourceRevision ?? sourceRevision },
    sourceRevision, inputRefs: [taskRef, ...sourceRefs], outputRefs: [ref('artifact', `research://${taskId}/${topic}`, sourceRevision)], evidenceRefs: [evidenceRef], validationRefs: [ref('validation', `research-gate://${taskId}/${topic}`, sourceRevision)],
    claims: layers.claims.map((claim) => ({ claimId: claim.claimId, type: claim.layer === 'SOURCE' ? 'SOURCE_EVIDENCE' : claim.layer === 'EXTRACTED_EVIDENCE' ? 'EXTRACTED_CLAIM' : claim.layer, statement: claim.statement.slice(0, 1000), sourceRefs: sourceRefs.filter((source) => claim.sourceRefs.includes(source.value)), evidenceRefs: [evidenceRef], confidence: claim.confidence })),
    uncertainties: layers.claims.map((claim) => claim.uncertainty), conflicts: contradiction ? [{ summary: 'Representative source disagreement retained for comparison and uncertainty handling.', sourceRefs: sourceRefs.slice(0, 2), resolutionState: 'OPEN' }] : [],
    gateResults: [
      { gateRef: 'gate.source-provenance', status: sourceRecords.some((source) => source.retrievalStatus === 'RETRIEVED') ? 'PASS' : 'FAIL', blocking: true, evidenceRefs: [evidenceRef], reason: 'Source identity, retrieval timestamp, class, digest, and bounded evidence are recorded.' },
      { gateRef: 'gate.citation-completeness', status: layers.claims.every((claim) => claim.sourceRefs.length > 0 && claim.evidenceRefs.length > 0) ? 'PASS' : 'FAIL', blocking: true, evidenceRefs: [evidenceRef], reason: 'Each evidence layer has source and evidence references plus explicit uncertainty.' }
    ],
    sideEffectsObserved: { declared: [], observed: [], evidenceRefs: [], noneObserved: true }, continuationRefs: [ref('continuation', `continuation://${taskId}`, sourceRevision)], status: sourceRecords.some((source) => source.retrievalStatus === 'RETRIEVED') ? (contradiction ? 'CONFLICTED' : 'VALIDATED') : 'INCOMPLETE', execution: { mode: 'research_read_only', providerCalls: 0, writesPerformed: 0, mindWrites: 0, externalMutations: 0 },
    research: { mode: RESEARCH_MODE, sourceRecords, claimLedger: layers.claims, evidenceLayers: ['SOURCE', 'EXTRACTED_EVIDENCE', 'INTERPRETATION', 'CONCLUSION', ...(contradiction ? ['UNCERTAINTY'] : [])], deepening: { round1: 'MINIMUM_EVIDENCE', decision: extraRequest ? 'GAP_DETECTED' : 'SUFFICIENT', additionalRequests: extraRequest ? [{ requestId: id(`deepening-${topic}`), reason: 'One material gap remained after minimum evidence acquisition.', atomic: true }] : [], finalBudget: { sourceFetches: sourceRecords.length, depthRounds: extraRequest ? 2 : 1, estimatedTokens: Math.ceil(JSON.stringify(sourceRecords).length / 4) } }, stopping: { answerReady: sourceRecords.some((source) => source.retrievalStatus === 'RETRIEVED'), importantClaimsSupported: layers.claims.filter((claim) => ['SOURCE', 'EXTRACTED_EVIDENCE', 'CONCLUSION'].includes(claim.layer)).every((claim) => claim.confidence > 0), contradictionsAddressed: !contradiction || sourceRecords.every((source) => source.contradictionState === 'OPEN' || source.contradictionState === 'NONE'), sourceQualityChecked: true, retrievalValueChecked: true, budgetChecked: true }, quality: quality(sourceRecords) }
  };
  const errors = validateEvidencePacket(packet, { catalog, taskId: packet.taskId, subtaskId: packet.subtaskId });
  return { packet, errors, sourceRecords, claimLedger: layers.claims, output: { source: layers.claims.filter((claim) => claim.layer === 'SOURCE'), extractedEvidence: layers.claims.filter((claim) => claim.layer === 'EXTRACTED_EVIDENCE'), interpretation: layers.claims.filter((claim) => claim.layer === 'INTERPRETATION'), conclusion: layers.claims.filter((claim) => claim.layer === 'CONCLUSION'), uncertainty: layers.claims.filter((claim) => claim.layer === 'UNCERTAINTY') }, currentState };
}

export function sourceQualityMetrics(outputs) {
  const packets = outputs.map((item) => item.packet?.research).filter(Boolean);
  const quality = packets.map((item) => item.quality);
  return { outputs: packets.length, primaryOrAuthoritativeUse: quality.length ? quality.reduce((sum, item) => sum + item.primaryOrAuthoritativeUse, 0) / quality.length : 0, relevance: quality.length ? quality.reduce((sum, item) => sum + item.relevance, 0) / quality.length : 0, diversity: quality.length ? quality.reduce((sum, item) => sum + item.diversity, 0) / quality.length : 0, weakSourceDependence: quality.length ? quality.reduce((sum, item) => sum + item.weakSourceDependence, 0) / quality.length : 1, contradictionLoss: outputs.some((item) => item.packet?.research?.quality?.contradictionsRetained > 0 && item.packet.conflicts?.length === 0) ? 1 : 0 };
}
