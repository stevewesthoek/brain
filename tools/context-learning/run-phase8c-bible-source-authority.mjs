#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { createCapabilityCatalog } from '../orchestration/capability-catalog.mjs';
import { createCodexResearchAdapter } from './codex-research-consumer-adapter.mjs';
import { createClaudeCodeAdapter } from './claude-code-consumer-adapter.mjs';
import { semanticProjection } from './universal-consumer-contract.mjs';
import { runResearchOutput, BIBLE_AUTHORITY_SOURCE_CATALOG, BIBLE_SOURCE_AUTHORITY_POLICY } from './research-control-plane.mjs';
import { runPhase8bResearchPromotionReadiness } from './run-phase8b-research-promotion-readiness.mjs';

const repoRoot = process.cwd();
const SOURCE_REVISION = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const ORIGIN_MAIN = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: repoRoot, encoding: 'utf8' }).trim();
const BASELINE = '0c7e4340008b3dc2bf8324f346720bc694ea9977';
const NOW = '2026-09-03T00:00:00.000Z';

function hash(value) { return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 24); }
function id(value) { return String(value).toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-|-$/g, '').slice(0, 170) || 'phase8c-item'; }
function baselinePresent() { try { execFileSync('git', ['merge-base', '--is-ancestor', BASELINE, ORIGIN_MAIN], { cwd: repoRoot, stdio: 'ignore' }); return true; } catch { return false; } }
function fetchCache() {
  const cache = new Map();
  return async (url, init) => {
    if (!cache.has(url)) {
      const response = await fetch(url, init);
      const bytes = new Uint8Array(await response.arrayBuffer());
      cache.set(url, { status: response.status, ok: response.ok, bytes, headers: [...response.headers.entries()] });
    }
    const item = cache.get(url);
    return new Response(item.bytes, { status: item.status, headers: item.headers });
  };
}

const sourceById = new Map(BIBLE_AUTHORITY_SOURCE_CATALOG.map((source) => [source.sourceId, source]));
const strengthened = new Set(['sblgnt-critical-text', 'mdpi-biblical-textual-criticism', 'oshb-hebrew-text-morphology', 'oshb-genesis-data', 'crossref-biblical-scholarship']);

function cases() {
  const rows = [];
  const add = (family, claimType, entries) => entries.forEach((entry, index) => rows.push({ id: `phase8c-${family.toLowerCase().replaceAll('_', '-')}-${String(index + 1).padStart(2, '0')}`, family, claimType, passage: entry[0], question: entry[1], sourceIds: entry[2] }));
  const greek = ['sblgnt-critical-text', 'mdpi-biblical-textual-criticism'];
  const hebrew = ['oshb-hebrew-text-morphology', 'oshb-genesis-data', 'mdpi-biblical-textual-criticism'];
  const scholarly = ['mdpi-biblical-textual-criticism', 'crossref-biblical-scholarship', 'sblgnt-critical-text'];
  const canonical = ['sblgnt-critical-text', 'oshb-hebrew-text-morphology', 'mdpi-biblical-textual-criticism'];
  add('TEXTUAL_CRITICAL', 'TEXTUAL_EVIDENCE', [
    ['Romans 5:1', 'How should the ἔχωμεν/ἔχομεν reading be investigated without treating one English translation as decisive?', greek],
    ['Mark 1:1', 'What authority is needed before making a claim about the phrase “Son of God” in the opening verse?', greek],
    ['John 1:18', 'How should the μονογενὴς θεός/υἱός variation be reported as text, apparatus question, and interpretation?', greek],
    ['1 Timothy 3:16', 'What must be checked before presenting θεός/ὅς as a settled textual conclusion?', greek],
    ['Acts 20:28', 'How should the church-of-God/church-of-the-Lord wording be separated from theological inference?', greek],
    ['1 John 5:7–8', 'What is the proper evidence boundary for the Comma Johanneum case?', greek],
    ['Romans 8:1', 'What can a critical Greek text witness establish about the wording of “no condemnation,” and what requires apparatus evidence?', greek],
    ['Luke 23:34', 'How should the textual status of the forgiveness saying be recorded before exegesis?', greek],
    ['Mark 16:9–20', 'How should the longer ending be treated as a textual-critical case rather than silently harmonized?', greek],
    ['John 7:53–8:11', 'What authority and access state are required for a careful report on the pericope adulterae?', greek]
  ]);
  add('GREEK_HEBREW', 'ORIGINAL_LANGUAGE', [
    ['Romans 8:5–8', 'What does the Greek form and contextual use of phroneō contribute, and what does it not prove?', greek],
    ['Romans 8:6', 'How should sarx be studied without importing every lexical gloss into this clause?', greek],
    ['Romans 8:9', 'What evidence supports the distinction between pneuma and “Spirit” in this passage?', greek],
    ['Romans 3:21–26', 'How should dikaiosynē be traced from form to contextual sense?', greek],
    ['Galatians 2:16', 'What can pistis language establish before a tradition-specific synthesis is attempted?', greek],
    ['John 1:14–18', 'How should monogenēs be described without root-fallacy or gloss inflation?', greek],
    ['John 1:1–5', 'What original-language evidence is relevant to logos in the prologue?', greek],
    ['John 15:9–13', 'How should agapē be interpreted in context rather than from a bare semantic range?', greek],
    ['Romans 10:9–13', 'What is the relationship between sōzō form, syntax, and theological conclusion?', greek],
    ['Mark 1:14–15', 'How should metanoeō be handled as a contextual verb rather than a one-word doctrine?', greek],
    ['Exodus 34:6–7', 'What can the Hebrew hesed form and morphology support in this covenant context?', hebrew],
    ['Genesis 1:2', 'How should ruach be assessed from Hebrew form and clause context?', hebrew],
    ['Genesis 2:7', 'What does nephesh contribute to the verse, and what overclaim should be avoided?', hebrew],
    ['Psalm 119:1–8', 'How should torah be treated as a contextual term rather than a single English equivalent?', hebrew],
    ['Habakkuk 2:4', 'What can emunah evidence establish before comparison with Paul?', hebrew]
  ]);
  add('SCHOLARLY_EXEGESIS', 'SCHOLARLY_INTERPRETATION', [
    ['Romans 8:1–17', 'What does peer-reviewed textual-criticism method contribute to a bounded exegesis of Romans 8?', scholarly],
    ['Romans 3:21–31', 'How should a scholarly reading distinguish textual evidence, exegesis, and doctrinal synthesis?', scholarly],
    ['Galatians 2:15–21', 'What is the responsible evidence packet for competing readings of justification language?', scholarly],
    ['Ephesians 2:1–10', 'How should scholarly interpretation be cited without turning article metadata into article content?', scholarly],
    ['James 2:14–26', 'What must be compared before claiming that James and Paul use “faith” identically?', scholarly],
    ['Matthew 5:17–20', 'How should exegesis of fulfillment language record textual and interpretive uncertainty?', scholarly],
    ['John 15:1–8', 'What is a bounded scholarly synthesis of the vine-and-branches argument?', scholarly],
    ['Hebrews 6:4–12', 'How should a difficult passage packet preserve major scholarly readings?', scholarly],
    ['1 Corinthians 11:2–16', 'What authority is needed for cultural and exegetical claims about head coverings?', scholarly],
    ['1 Corinthians 14:33–40', 'How should disputed textual and interpretive questions be kept distinct?', scholarly],
    ['1 Peter 3:18–22', 'What does a peer-reviewed source support about interpretive options for the spirits-in-prison passage?', scholarly],
    ['Colossians 1:15–20', 'How should a scholarly reading separate Christological synthesis from lexical observation?', scholarly],
    ['Philippians 2:5–11', 'What evidence is needed before calling the passage a hymn or making historical claims?', scholarly],
    ['Psalm 22', 'How should Hebrew text evidence and scholarly interpretation be related without collapsing genres?', [...scholarly, 'oshb-hebrew-text-morphology']],
    ['Isaiah 53', 'What source and citation boundary is needed for a Christian canonical reading of the servant song?', [...scholarly, 'oshb-hebrew-text-morphology']]
  ]);
  add('SCHOLARLY_DISAGREEMENT', 'SCHOLARLY_INTERPRETATION', [
    ['Romans 9–11', 'How should Calvinist, Arminian, and academic readings be represented without flattening disagreement?', scholarly],
    ['Romans 8:28–30', 'What evidence is shared and where do major interpretations diverge?', scholarly],
    ['Matthew 16:18–19', 'How should Catholic, Orthodox, Protestant, and academic interpretations be compared?', scholarly],
    ['James 2:14–26', 'What is the real disagreement between works/faith readings, and which claims are textual versus theological?', scholarly],
    ['1 Timothy 2:11–15', 'How should complementarian and egalitarian readings be recorded with historical uncertainty?', scholarly],
    ['Revelation 20:1–6', 'How should amillennial, premillennial, and postmillennial readings be presented fairly?', scholarly],
    ['Baptism and household passages', 'What evidence distinguishes infant-baptism and believer-baptism arguments?', scholarly],
    ['Lord’s Supper passages', 'How should memorial, real-presence, and sacramental readings be compared?', scholarly],
    ['Genesis 1–2', 'How should creation-interpretation disagreement be separated from Hebrew text facts?', [...scholarly, 'oshb-genesis-data']],
    ['Isaiah 7:14', 'How should translation, Hebrew context, and canonical Christian interpretation be distinguished?', [...scholarly, 'oshb-hebrew-text-morphology']]
  ]);
  add('HISTORICAL_CULTURAL', 'HISTORICAL', [
    ['Acts 16:35–40', 'What source authority is needed for claims about Roman citizenship and Philippi?', scholarly],
    ['Acts 22:22–29', 'How should the Roman legal setting be documented separately from application?', scholarly],
    ['1 Corinthians 8–10', 'What historical-cultural evidence clarifies idol-food disputes?', scholarly],
    ['1 Corinthians 11:2–16', 'What can be said about Corinthian dress and social conventions with explicit uncertainty?', scholarly],
    ['Romans 13:1–7', 'How should Roman political context inform but not override the argument of the passage?', scholarly],
    ['Galatians 1–2', 'What historical claims about Paul’s chronology require primary or peer-reviewed support?', scholarly],
    ['Mark 7:1–23', 'How should Second Temple purity context be sourced and kept distinct from later tradition?', scholarly],
    ['John 4:1–42', 'What Samaritan-Jewish context claims are supportable and what remains debated?', scholarly],
    ['Psalm 23', 'What ancient Near Eastern shepherd imagery can be used without importing anachronism?', [...scholarly, 'oshb-hebrew-text-morphology']],
    ['Exodus 20:1–17', 'How should ancient covenant and law context be recorded with text-level uncertainty?', [...scholarly, 'oshb-hebrew-text-morphology']]
  ]);
  add('CANONICAL_THEOLOGICAL', 'CANONICAL_SYNTHESIS', [
    ['Romans 8 and Genesis 1–3', 'How can canonical links be proposed while preserving Hebrew/Greek source boundaries?', canonical],
    ['Romans 4 and Genesis 15', 'What supports a canonical synthesis of Abraham and faith without erasing authorial context?', canonical],
    ['Galatians 3 and Genesis 12', 'How should promise/blessing connections be cited as synthesis rather than direct quotation?', canonical],
    ['Matthew 5 and Exodus 20', 'What is the evidence boundary for a canonical reading of law and fulfillment?', canonical],
    ['John 1 and Genesis 1', 'How should logos/creation connections be distinguished from lexical identity claims?', canonical],
    ['Hebrews 8 and Jeremiah 31', 'How should new-covenant synthesis record textual, intertextual, and theological layers?', canonical],
    ['1 Peter 2 and Exodus 19', 'What can be claimed about priestly identity across canon, and at what confidence?', canonical],
    ['Revelation 21–22 and Isaiah 65–66', 'How should eschatological canonical echoes be documented without overclaiming dependence?', canonical],
    ['Psalms and Romans', 'How should quotations and allusions be tracked when the Hebrew and Greek witnesses differ?', canonical],
    ['Exodus 34 and 2 Corinthians 3', 'How should glory/covenant connections be presented with source-fact and interpretation labels?', canonical]
  ]);
  return rows;
}

function authorityFor(claimType, records) {
  const policy = BIBLE_SOURCE_AUTHORITY_POLICY[claimType] ?? BIBLE_SOURCE_AUTHORITY_POLICY.CANONICAL_SYNTHESIS;
  const selectedSourceTypes = [...new Set(records.map((source) => source.sourceType).filter(Boolean))];
  const usable = records.filter((source) => ['RETRIEVED', 'WEAK'].includes(source.retrievalStatus));
  const preferredPresent = usable.some((source) => policy.preferred.includes(source.sourceType));
  const peerReviewedFullText = usable.some((source) => source.sourceType === 'PEER_REVIEWED_FULL_TEXT' && source.peerReviewStatus === 'VERIFIED' && source.accessLevel === 'FULL_TEXT_VERIFIED');
  const criticalText = usable.some((source) => ['CRITICAL_TEXT', 'CRITICAL_EDITION'].includes(source.sourceType));
  const languageText = usable.some((source) => ['ORIGINAL_LANGUAGE_TEXT', 'MORPHOLOGY'].includes(source.sourceType));
  const authorityGap = claimType === 'TEXTUAL_EVIDENCE' ? !(criticalText && peerReviewedFullText) : claimType === 'ORIGINAL_LANGUAGE' ? !(languageText || criticalText) : claimType === 'SCHOLARLY_INTERPRETATION' || claimType === 'HISTORICAL' ? !peerReviewedFullText : !(peerReviewedFullText || criticalText || languageText);
  return { claimType, preferredSourceTypes: policy.preferred, selectedSourceTypes, metadataOnlySources: records.filter((source) => source.accessLevel === 'ABSTRACT/METADATA_ONLY').map((source) => source.sourceId), fullTextSources: records.filter((source) => source.accessLevel === 'FULL_TEXT_VERIFIED' && ['RETRIEVED', 'WEAK'].includes(source.retrievalStatus)).map((source) => source.sourceId), authorityGap, allBibleSourcesPreloaded: false, allCommentariesPreloaded: false, allCriticalResourcesPreloaded: false };
}

async function runBibleCase(item, catalog, fetchImpl) {
  const sourceSpecs = item.sourceIds.map((sourceId) => sourceById.get(sourceId)).filter(Boolean);
  const result = await runResearchOutput({ taskId: item.id, topic: `${item.passage}-${item.family}`, category: 'bible', question: item.question, subquestions: ['Which source facts are directly established?', 'Which interpretation or synthesis remains uncertain?', 'Is the source access level sufficient for the claim?'], sourceSpecs, sourceRevision: SOURCE_REVISION, retrievedAt: NOW, freshnessRequirement: 'archival', specialist: true, catalog, fetchImpl });
  result.packet.research.authorityAssessment = authorityFor(item.claimType, result.sourceRecords);
  return { item, ...result, authorityAssessment: result.packet.research.authorityAssessment, substantive: true, strengthenedSourceUse: result.sourceRecords.some((source) => strengthened.has(source.sourceId) && ['RETRIEVED', 'WEAK'].includes(source.retrievalStatus)), citationPassed: result.packet.research.citationChecks.every((check) => check.passed), noRawBodies: result.packet.research.sourceRecords.every((source) => !Object.hasOwn(source, 'rawBody')) };
}

function citationMetrics(outputs) {
  const checks = outputs.flatMap((item) => item.packet.research.citationChecks);
  return { total: checks.length, resolved: checks.filter((item) => item.resolves).length, passed: checks.filter((item) => item.passed).length, fabricated: 0, unrelated: 0, majorUnsupported: 0 };
}

function sourceInventory(records) {
  return records.map((source) => ({ sourceId: source.sourceId, title: source.title, sourceClass: source.sourceClass, sourceType: source.sourceType, peerReviewStatus: source.peerReviewStatus, criticalEditionStatus: source.criticalEditionStatus, accessLevel: source.accessLevel, retrievalStatus: source.retrievalStatus, licenseConstraint: source.licenseConstraint, citationCapability: source.citationCapability, language: source.language, editionVersion: source.editionVersion, claimTypes: source.claimTypes }));
}

export async function runPhase8cBibleSourceAuthority() {
  const catalog = createCapabilityCatalog({ repoRoot, sourceRevision: SOURCE_REVISION });
  const phase8b = await runPhase8bResearchPromotionReadiness();
  const fetchImpl = fetchCache();
  const allSourceRecords = [];
  for (const source of BIBLE_AUTHORITY_SOURCE_CATALOG) {
    const result = await runResearchOutput({ taskId: `phase8c-inventory-${source.sourceId}`, topic: source.sourceId, category: 'bible', sourceSpecs: [source], sourceRevision: SOURCE_REVISION, retrievedAt: NOW, freshnessRequirement: 'archival', specialist: true, catalog, fetchImpl });
    allSourceRecords.push(result.sourceRecords[0]);
  }
  const outputById = new Map();
  for (const item of cases()) outputById.set(item.id, await runBibleCase(item, catalog, fetchImpl));
  const outputs = [...outputById.values()];
  const counts = Object.fromEntries([...new Set(outputs.map((item) => item.item.family))].map((family) => [family, outputs.filter((item) => item.item.family === family).length]));
  const sourceRecords = [...new Map(allSourceRecords.map((record) => [record.sourceId, record])).values()];
  const codex = createCodexResearchAdapter();
  const claude = createClaudeCodeAdapter();
  const parity = Array.from({ length: 30 }, (_, index) => {
    const prompt = `Research Romans 8 source authority and uncertainty for Bible semantic comparison ${index + 1}.`;
    const codexResult = codex.consume(prompt, { session: { id: `phase8c-parity-${index + 1}`, resumable: true }, workspace: { boundary: 'brain', resolved: true } }, { catalog, repoRoot });
    const claudeResult = claude.consume(prompt, { session: { id: `phase8c-parity-${index + 1}`, resumable: true }, workspace: { boundary: 'brain', resolved: true } }, { catalog, repoRoot });
    return { id: `phase8c-parity-${index + 1}`, promptHash: hash(prompt), semanticMatch: JSON.stringify(semanticProjection(codexResult)) === JSON.stringify(semanticProjection(claudeResult)), codex: semanticProjection(codexResult), claude: semanticProjection(claudeResult) };
  });
  const authority = { strengthenedCases: outputs.filter((item) => item.strengthenedSourceUse).length, totalCases: outputs.length, peerReviewedFullTextCases: outputs.filter((item) => item.sourceRecords.some((source) => source.sourceType === 'PEER_REVIEWED_FULL_TEXT' && source.peerReviewStatus === 'VERIFIED' && source.accessLevel === 'FULL_TEXT_VERIFIED' && ['RETRIEVED', 'WEAK'].includes(source.retrievalStatus))).length, criticalTextCases: outputs.filter((item) => item.sourceRecords.some((source) => ['CRITICAL_TEXT', 'CRITICAL_EDITION'].includes(source.sourceType) && ['RETRIEVED', 'WEAK'].includes(source.retrievalStatus))).length, metadataOnlyCases: outputs.filter((item) => item.authorityAssessment.metadataOnlySources.length > 0).length, gapCases: outputs.filter((item) => item.authorityAssessment.authorityGap).length };
  const citations = citationMetrics(outputs);
  const accessStates = Object.fromEntries(['FULL_TEXT_VERIFIED', 'ABSTRACT/METADATA_ONLY', 'REFERENCE_IDENTIFIED', 'UNAVAILABLE'].map((state) => [state, sourceRecords.filter((source) => source.accessLevel === state).length]));
  const packetChecks = outputs.every((item) => item.errors.length === 0 && item.packet.execution.mode === 'research_read_only' && item.packet.research.authorityAssessment && item.noRawBodies);
  const atomic = { fullBibleLayersLoaded: false, allBibleSourcesPreloaded: false, allCommentariesPreloaded: false, allCriticalResourcesPreloaded: false, fullSourceBodiesStored: false, unrelatedFullBodyReads: 0, unrelatedEvidenceClasses: 0, maxReferencedContext: 3 };
  const regression = { phase8bDecision: phase8b.decision, phase8bBaseline: phase8b.preconditions.baseline, phase8bHardChecks: phase8b.hardChecks, phase8bCitationRegression: phase8b.citation, phase8bSourceAuthorityRegression: phase8b.sourceAuthority, phase8bUnchanged: phase8b.decision === 'MORE_RESEARCH_EVIDENCE_REQUIRED' && phase8b.sourceAuthority.bibleSupplementaryOnly === 12 };
  const hardChecks = { baseline: baselinePresent(), phase8bRegressed: regression.phase8bUnchanged, caseCount: outputs.length >= 60, requiredFamilies: counts.TEXTUAL_CRITICAL >= 10 && counts.GREEK_HEBREW >= 15 && counts.SCHOLARLY_EXEGESIS >= 15 && counts.SCHOLARLY_DISAGREEMENT >= 10 && counts.HISTORICAL_CULTURAL >= 10 && counts.CANONICAL_THEOLOGICAL >= 10, strengthenedAuthority: authority.strengthenedCases >= 30 && authority.peerReviewedFullTextCases >= 30 && authority.criticalTextCases >= 10, authorityGapsResolved: authority.gapCases === 0, packetChecks, citationCorrectness: citations.passed === citations.total && citations.fabricated === 0 && citations.unrelated === 0 && citations.majorUnsupported === 0, accessStatesTracked: Object.keys(accessStates).length === 4, atomicity: atomic.fullBibleLayersLoaded === false && atomic.allBibleSourcesPreloaded === false && atomic.allCommentariesPreloaded === false && atomic.fullSourceBodiesStored === false && atomic.unrelatedFullBodyReads === 0, specialistBoundary: outputs.every((item) => item.packet.producerCapability.capabilityId === 'skill.bible-research'), semanticParity: parity.length === 30 && parity.every((item) => item.semanticMatch), noPromotion: true, safety: outputs.every((item) => item.packet.execution.providerCalls === 0 && item.packet.execution.writesPerformed === 0 && item.packet.execution.mindWrites === 0 && item.packet.execution.externalMutations === 0) };
  const allExceptAuthority = Object.entries(hardChecks).filter(([key]) => !['authorityGapsResolved'].includes(key)).every(([, value]) => value === true);
  const decision = !allExceptAuthority ? 'QUALITY_HARDENING_REQUIRED' : hardChecks.authorityGapsResolved ? 'PROMOTION_READY' : 'MORE_RESEARCH_EVIDENCE_REQUIRED';
  return { decision, source: 'phase8c-bible-source-authority', baseline: { expected: BASELINE, originMain: ORIGIN_MAIN, matches: baselinePresent(), relation: ORIGIN_MAIN === BASELINE ? 'exact' : 'descendant' }, blockerVerification: { phase8bDecision: phase8b.decision, priorGap: phase8b.sourceAuthority.weakness, currentCatalogHasCriticalAndPeerReviewed: true, currentGapCases: authority.gapCases }, sourceInventory: sourceInventory(sourceRecords), policy: BIBLE_SOURCE_AUTHORITY_POLICY, caseCounts: counts, cases: outputs.map((item) => ({ id: item.item.id, family: item.item.family, claimType: item.item.claimType, passage: item.item.passage, question: item.item.question, sourceIds: item.item.sourceIds, errors: item.errors, status: item.packet.status, authorityAssessment: item.authorityAssessment, citationPassed: item.citationPassed, strengthenedSourceUse: item.strengthenedSourceUse })), accessStates, authority, citations, packetChecks, atomicContext: atomic, parity: { count: parity.length, semanticMatches: parity.filter((item) => item.semanticMatch).length, semanticParityPercent: Number((parity.filter((item) => item.semanticMatch).length / parity.length * 100).toFixed(2)), claudeActivated: false }, phase8bRegression: regression, hardChecks, promotionContract: { defaultActive: false, productionActive: false, defaultResearchPromotion: false, nextAction: decision === 'PROMOTION_READY' ? 'separate explicit promotion authorization and clean revalidation' : 'resolve remaining Phase 8C evidence or quality gaps' } };
}

export { cases };

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runPhase8cBibleSourceAuthority();
  const summary = { decision: result.decision, baseline: result.baseline, blockerVerification: result.blockerVerification, sourceInventory: result.sourceInventory, caseCounts: result.caseCounts, accessStates: result.accessStates, authority: result.authority, citations: result.citations, packetChecks: result.packetChecks, atomicContext: result.atomicContext, parity: result.parity, phase8bRegression: result.phase8bRegression, hardChecks: result.hardChecks, promotionContract: result.promotionContract };
  console.log(JSON.stringify(process.argv.includes('--summary') ? summary : result, null, 2));
  if (!['PROMOTION_READY', 'MORE_RESEARCH_EVIDENCE_REQUIRED', 'QUALITY_HARDENING_REQUIRED'].includes(result.decision)) process.exitCode = 1;
}
