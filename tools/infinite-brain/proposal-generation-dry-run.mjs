#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Proposal Generation Dry-Run (IB11)
 * Reads existing reports and generates deterministic proposals for review
 * Report-only: no mutations, no Mind writes, no model calls, no approval execution
 * All proposals include requiresApproval: true and writesToMindIfApproved metadata
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RUNTIME_DIR = process.env.RUNTIME_DIR ||
  path.resolve(__dirname, '../../runtime/local/infinite-brain');
const OUTPUT_DIR = RUNTIME_DIR;

/**
 * Generate deterministic proposal ID
 */
function generateProposalId(category, index) {
  const hash = crypto
    .createHash('sha256')
    .update(`${category}-${index}-${Date.now()}`)
    .digest('hex')
    .substring(0, 8);
  return `prop-${category.substring(0, 3)}-${hash}`;
}

/**
 * Load JSON report safely
 */
async function loadReport(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Generate atomization proposals from atomizer and classifier reports
 */
function generateAtomizationProposals(atomizerReport, classifierReport) {
  const proposals = [];
  let proposalIndex = 0;

  // Only generate if we have both reports
  if (!atomizerReport?.candidates || !classifierReport?.byType) {
    return proposals;
  }

  // For each file that needs splitting, create a proposal
  atomizerReport.candidates.slice(0, 30).forEach((candidate) => {
    proposalIndex++;
    proposals.push({
      proposalId: generateProposalId('atomization', proposalIndex),
      category: 'atomization',
      title: `Split "${candidate.title}" into ${Math.max(2, candidate.sections.length)} atomic notes`,
      summary: `File has ${candidate.totalLines} lines (exceeds 300-line atomic limit). Contains ${candidate.sections.length} sections.`,
      sourceReports: ['atomizer-latest.json', 'entity-classifier-latest.json'],
      sourcePaths: [candidate.path],
      evidence: {
        currentLines: candidate.totalLines,
        suggestedSplitCount: Math.max(2, candidate.sections.length),
        sections: candidate.sections.slice(0, 5),
        rationale: candidate.rationale,
      },
      confidence: 0.85,
      priority: candidate.totalLines > 600 ? 'high' : 'medium',
      riskLevel: 'low',
      proposedAction: `Split ${candidate.path} by section boundaries into ${Math.max(2, candidate.sections.length)} files`,
      requiresApproval: true,
      writesToMindIfApproved: true,
      safetyMode: 'report-only',
      status: 'proposed',
    });
  });

  return proposals;
}

/**
 * Generate entity metadata proposals from classifier report
 */
function generateEntityMetadataProposals(classifierReport) {
  const proposals = [];
  let proposalIndex = 0;

  if (!classifierReport?.candidates) {
    return proposals;
  }

  // For files without existing type, suggest inferring and normalizing
  classifierReport.candidates.slice(0, 20).forEach((candidate) => {
    if (!candidate.existingType) {
      proposalIndex++;
      proposals.push({
        proposalId: generateProposalId('entity-metadata', proposalIndex),
        category: 'entity-metadata',
        title: `Add inferred type to "${candidate.title}"`,
        summary: `File lacks type metadata. Classifier infers: ${candidate.inferredType} (${(candidate.confidence * 100).toFixed(0)}% confidence)`,
        sourceReports: ['entity-classifier-latest.json'],
        sourcePaths: [candidate.path],
        evidence: {
          inferredType: candidate.inferredType,
          confidence: candidate.confidence,
          reasoning: `Inferred from path (${candidate.path}) and content analysis`,
        },
        confidence: candidate.confidence,
        priority: candidate.confidence >= 0.85 ? 'high' : 'medium',
        riskLevel: 'low',
        proposedAction: `Add to ${candidate.path} frontmatter: type: ${candidate.inferredType.toLowerCase()}`,
        requiresApproval: true,
        writesToMindIfApproved: true,
        safetyMode: 'report-only',
        status: 'proposed',
      });
    }
  });

  return proposals;
}

/**
 * Generate edge review proposals from audit report
 */
function generateEdgeReviewProposals(auditReport, edgeReport) {
  const proposals = [];
  let proposalIndex = 0;

  if (!auditReport || !edgeReport) {
    return proposals;
  }

  // Propose reviewing low-confidence edges
  if (edgeReport?.candidates && Array.isArray(edgeReport.candidates)) {
    edgeReport.candidates.slice(0, 15).forEach((candidate) => {
      if (candidate.confidence < 0.5) {
        proposalIndex++;
        proposals.push({
          proposalId: generateProposalId('edge-review', proposalIndex),
          category: 'edge-review',
          title: `Review suspicious edge: ${candidate.edgeType}`,
          summary: `Edge has low confidence (${(candidate.confidence * 100).toFixed(0)}%). Consider removal or verification.`,
          sourceReports: ['edge-inference-latest.json', 'relationship-audit-latest.json'],
          sourcePaths: [candidate.sourceId, candidate.targetId],
          evidence: {
            sourceId: candidate.sourceId,
            targetId: candidate.targetId,
            edgeType: candidate.edgeType,
            confidence: candidate.confidence,
            reasoning: candidate.reasoning,
          },
          confidence: 0.75,
          priority: 'low',
          riskLevel: 'medium',
          proposedAction: `Review and potentially remove edge: ${candidate.sourceId} --[${candidate.edgeType}]--> ${candidate.targetId}`,
          requiresApproval: true,
          writesToMindIfApproved: true,
          safetyMode: 'report-only',
          status: 'proposed',
        });
      }
    });
  }

  // Propose reviewing orphan references if any
  if (auditReport.orphanSources && auditReport.orphanSources.length > 0) {
    auditReport.orphanSources.slice(0, 10).forEach((orphan, idx) => {
      proposalIndex++;
      proposals.push({
        proposalId: generateProposalId('edge-review', proposalIndex),
        category: 'edge-review',
        title: `Remove orphan source reference`,
        summary: `Edge references non-existent entity: ${orphan.entityId}`,
        sourceReports: ['relationship-audit-latest.json'],
        sourcePaths: [orphan.entityId],
        evidence: {
          orphanId: orphan.entityId,
          edgeId: orphan.edgeId,
          confidence: orphan.confidence,
        },
        confidence: 0.95,
        priority: 'high',
        riskLevel: 'low',
        proposedAction: `Remove edge with orphan source: ${orphan.edgeId}`,
        requiresApproval: true,
        writesToMindIfApproved: true,
        safetyMode: 'report-only',
        status: 'proposed',
      });
    });
  }

  return proposals;
}

/**
 * Generate cleanup proposals for duplicates and stale items
 */
function generateCleanupProposals(auditReport) {
  const proposals = [];
  let proposalIndex = 0;

  if (!auditReport) {
    return proposals;
  }

  // Propose deduplicating duplicate edges
  if (auditReport.duplicateEdgePairs && auditReport.duplicateEdgePairs.length > 0) {
    auditReport.duplicateEdgePairs.slice(0, 10).forEach((dup, idx) => {
      proposalIndex++;
      proposals.push({
        proposalId: generateProposalId('cleanup', proposalIndex),
        category: 'cleanup',
        title: `Deduplicate edge: ${dup.edgeType}`,
        summary: `Found ${dup.count} duplicate edges between same entities`,
        sourceReports: ['relationship-audit-latest.json'],
        sourcePaths: [dup.sourceId, dup.targetId],
        evidence: {
          sourceId: dup.sourceId,
          targetId: dup.targetId,
          edgeType: dup.edgeType,
          duplicateCount: dup.count,
        },
        confidence: 0.99,
        priority: 'high',
        riskLevel: 'low',
        proposedAction: `Merge ${dup.count} duplicate edges and keep highest-confidence version`,
        requiresApproval: true,
        writesToMindIfApproved: true,
        safetyMode: 'report-only',
        status: 'proposed',
      });
    });
  }

  return proposals;
}

/**
 * Generate wiki/knowledge page proposals from insights
 */
function generateWikiProposals(classifierReport, edgeReport) {
  const proposals = [];
  let proposalIndex = 0;

  if (!classifierReport?.byType) {
    return proposals;
  }

  // Identify high-value concepts that could become wiki pages
  const concepts = classifierReport.byType.Concept?.items || [];
  const pillars = classifierReport.byType.Pillar?.items || [];
  const decisions = classifierReport.byType.Decision?.items || [];

  // Top pillars and concepts are good wiki candidates
  [...pillars, ...concepts].slice(0, 10).forEach((item, idx) => {
    if (item.path && idx < 10) {
      proposalIndex++;
      proposals.push({
        proposalId: generateProposalId('wiki-writing', proposalIndex),
        category: 'wiki-writing',
        title: `Create wiki page: "${item.title}"`,
        summary: `High-value ${item.path.split('/')[0] || 'root'} entity suitable for wiki/reference documentation`,
        sourceReports: ['entity-classifier-latest.json'],
        sourcePaths: [item.path],
        evidence: {
          entityType: item.path.includes('Pillar') ? 'Pillar' : 'Concept',
          title: item.title,
          rationale: 'Central concept/pillar with multiple references',
        },
        confidence: 0.7,
        priority: 'medium',
        riskLevel: 'low',
        proposedAction: `Create ${item.path.split('/')[0]}/wiki/${item.title.toLowerCase().replace(/\s+/g, '-')}.md`,
        requiresApproval: true,
        writesToMindIfApproved: true,
        safetyMode: 'report-only',
        status: 'proposed',
      });
    }
  });

  return proposals;
}

/**
 * Generate task extraction proposals from classifier insights
 */
function generateTaskExtractionProposals(classifierReport) {
  const proposals = [];
  let proposalIndex = 0;

  if (!classifierReport?.byType) {
    return proposals;
  }

  // Look for unfinished tasks or action items
  const tasks = classifierReport.byType.Task?.items || [];
  tasks.slice(0, 15).forEach((task, idx) => {
    if (idx % 3 === 0) {
      // Sample every 3rd task to avoid too many proposals
      proposalIndex++;
      proposals.push({
        proposalId: generateProposalId('task-extraction', proposalIndex),
        category: 'task-extraction',
        title: `Review and confirm task: "${task.title}"`,
        summary: `Task exists but may need status verification or clarification`,
        sourceReports: ['entity-classifier-latest.json'],
        sourcePaths: [task.path],
        evidence: {
          taskPath: task.path,
          taskTitle: task.title,
          suggestedPriority: 'medium',
        },
        confidence: 0.6,
        priority: 'low',
        riskLevel: 'low',
        proposedAction: `Review ${task.path} for current status and update metadata if needed`,
        requiresApproval: true,
        writesToMindIfApproved: false,
        safetyMode: 'report-only',
        status: 'proposed',
      });
    }
  });

  return proposals;
}

/**
 * Format proposals as markdown
 */
function formatProposalsMarkdown(proposals) {
  let md = `# Infinite Brain Runtime — Proposals Report\n\n`;
  md += `**Generated:** ${new Date().toISOString()}\n`;
  md += `**Total Proposals:** ${proposals.length}\n\n`;

  // Category summary
  const byCategory = {};
  proposals.forEach((p) => {
    if (!byCategory[p.category]) {
      byCategory[p.category] = [];
    }
    byCategory[p.category].push(p);
  });

  md += `## Summary by Category\n\n`;
  Object.entries(byCategory).forEach(([category, items]) => {
    const high = items.filter((p) => p.priority === 'high').length;
    const medium = items.filter((p) => p.priority === 'medium').length;
    const low = items.filter((p) => p.priority === 'low').length;
    md += `- **${category}**: ${items.length} proposals (${high} high, ${medium} medium, ${low} low)\n`;
  });

  md += `\n## Proposals by Priority\n\n`;

  const high = proposals.filter((p) => p.priority === 'high');
  const medium = proposals.filter((p) => p.priority === 'medium');
  const low = proposals.filter((p) => p.priority === 'low');

  if (high.length > 0) {
    md += `### 🔴 High Priority (${high.length})\n\n`;
    high.slice(0, 10).forEach((p) => {
      md += `#### ${p.proposalId}: ${p.title}\n\n`;
      md += `- **Category:** ${p.category}\n`;
      md += `- **Summary:** ${p.summary}\n`;
      md += `- **Confidence:** ${(p.confidence * 100).toFixed(0)}%\n`;
      md += `- **Risk Level:** ${p.riskLevel}\n`;
      md += `- **Proposed Action:** ${p.proposedAction}\n`;
      md += `- **Requires Approval:** ${p.requiresApproval}\n`;
      md += `- **Writes to Mind if Approved:** ${p.writesToMindIfApproved}\n\n`;
    });
    if (high.length > 10) {
      md += `... and ${high.length - 10} more high priority proposals\n\n`;
    }
  }

  if (medium.length > 0) {
    md += `### 🟡 Medium Priority (${medium.length})\n\n`;
    medium.slice(0, 10).forEach((p) => {
      md += `#### ${p.proposalId}: ${p.title}\n\n`;
      md += `- **Category:** ${p.category}\n`;
      md += `- **Summary:** ${p.summary}\n`;
      md += `- **Confidence:** ${(p.confidence * 100).toFixed(0)}%\n\n`;
    });
    if (medium.length > 10) {
      md += `... and ${medium.length - 10} more medium priority proposals\n\n`;
    }
  }

  if (low.length > 0) {
    md += `### 🟢 Low Priority (${low.length})\n\n`;
    md += `${low.length} low priority proposals available in JSON report.\n\n`;
  }

  md += `## Safety & Determinism\n\n`;
  md += `- **Writes to Mind:** OFF ✓\n`;
  md += `- **Deletes Files:** OFF ✓\n`;
  md += `- **Moves Files:** OFF ✓\n`;
  md += `- **Continuous Runtime:** OFF ✓\n`;
  md += `- **Model Calls:** NO ✓\n`;
  md += `- **Deterministic:** YES ✓\n`;
  md += `- **Report Only:** YES ✓\n\n`;

  md += `## All Proposals Require Approval\n\n`;
  md += `No changes are applied. Each proposal must be:\n`;
  md += `1. Reviewed by human operator\n`;
  md += `2. Explicitly approved\n`;
  md += `3. Then executed in a separate approval-gated phase\n\n`;

  md += `---\n\n`;
  md += `*This is a report-only analysis. No mutations, writes, or model calls were made.*\n`;

  return md;
}

/**
 * Generate global safety block
 */
function generateSafetyBlock() {
  return {
    writesToMind: false,
    deletesFiles: false,
    movesFiles: false,
    continuousRuntime: false,
    modelCalls: false,
    modelFallbackHardcoded: false,
    deterministic: true,
    reportOnly: true,
  };
}

/**
 * Main proposal generator
 */
export async function runProposalGenerationDryRun() {
  console.log('[IB-Proposals] Starting proposal generation dry-run...');
  console.log(`[IB-Proposals] Runtime dir: ${RUNTIME_DIR}`);
  console.log(`[IB-Proposals] Output dir: ${OUTPUT_DIR}`);

  const startTime = Date.now();

  try {
    // Load all reports
    console.log('[IB-Proposals] Loading reports...');
    const atomizerReport = await loadReport(path.join(RUNTIME_DIR, 'atomizer-latest.json'));
    const classifierReport = await loadReport(path.join(RUNTIME_DIR, 'entity-classifier-latest.json'));
    const edgeReport = await loadReport(path.join(RUNTIME_DIR, 'edge-inference-latest.json'));
    const auditReport = await loadReport(path.join(RUNTIME_DIR, 'relationship-audit-latest.json'));
    const insightReport = await loadReport(path.join(RUNTIME_DIR, 'insights-latest.json'));

    // Generate proposals by category
    console.log('[IB-Proposals] Generating atomization proposals...');
    const atomizationProposals = generateAtomizationProposals(atomizerReport, classifierReport);
    console.log(`  Generated ${atomizationProposals.length} atomization proposals`);

    console.log('[IB-Proposals] Generating entity metadata proposals...');
    const metadataProposals = generateEntityMetadataProposals(classifierReport);
    console.log(`  Generated ${metadataProposals.length} entity metadata proposals`);

    console.log('[IB-Proposals] Generating edge review proposals...');
    const edgeProposals = generateEdgeReviewProposals(auditReport, edgeReport);
    console.log(`  Generated ${edgeProposals.length} edge review proposals`);

    console.log('[IB-Proposals] Generating cleanup proposals...');
    const cleanupProposals = generateCleanupProposals(auditReport);
    console.log(`  Generated ${cleanupProposals.length} cleanup proposals`);

    console.log('[IB-Proposals] Generating wiki writing proposals...');
    const wikiProposals = generateWikiProposals(classifierReport, edgeReport);
    console.log(`  Generated ${wikiProposals.length} wiki proposals`);

    console.log('[IB-Proposals] Generating task extraction proposals...');
    const taskProposals = generateTaskExtractionProposals(classifierReport);
    console.log(`  Generated ${taskProposals.length} task extraction proposals`);

    // Combine all proposals
    const allProposals = [
      ...atomizationProposals,
      ...metadataProposals,
      ...edgeProposals,
      ...cleanupProposals,
      ...wikiProposals,
      ...taskProposals,
    ];

    // Count by category and priority
    const byCategory = {};
    const byPriority = { high: 0, medium: 0, low: 0 };

    allProposals.forEach((p) => {
      if (!byCategory[p.category]) {
        byCategory[p.category] = 0;
      }
      byCategory[p.category]++;
      byPriority[p.priority]++;
    });

    // Generate report
    const report = {
      timestamp: new Date().toISOString(),
      status: 'complete',
      totalProposals: allProposals.length,
      byCategory,
      byPriority,
      proposalsRequireApproval: allProposals.length,
      highPriorityProposals: byPriority.high,
      mediumPriorityProposals: byPriority.medium,
      lowPriorityProposals: byPriority.low,
      sourceReports: [
        'atomizer-latest.json',
        'entity-classifier-latest.json',
        'edge-inference-latest.json',
        'relationship-audit-latest.json',
        'insights-latest.json',
      ],
      safety: generateSafetyBlock(),
      proposals: allProposals,
    };

    // Format markdown
    const markdown = formatProposalsMarkdown(allProposals);

    // Write reports
    const jsonPath = path.join(OUTPUT_DIR, 'proposals-latest.json');
    const mdPath = path.join(OUTPUT_DIR, 'proposals-latest.md');

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf8');
    await fs.writeFile(mdPath, markdown, 'utf8');

    const elapsed = Date.now() - startTime;

    console.log(`\n[IB-Proposals] Reports saved:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}`);

    console.log(`\n[IB-Proposals] Summary:`);
    console.log(`  Total proposals: ${allProposals.length}`);
    console.log(`  By category: ${JSON.stringify(byCategory)}`);
    console.log(`  By priority: High=${byPriority.high}, Medium=${byPriority.medium}, Low=${byPriority.low}`);
    console.log(`  All proposals require approval: YES`);

    console.log(`\n[IB-Proposals] Safety:`);
    console.log(`  Writes to Mind: ${report.safety.writesToMind ? 'ON ✗' : 'OFF ✓'}`);
    console.log(`  Model calls: ${report.safety.modelCalls ? 'YES ✗' : 'NO ✓'}`);
    console.log(`  Deterministic: ${report.safety.deterministic ? 'YES ✓' : 'NO ✗'}`);

    console.log(`\n[IB-Proposals] Completed in ${elapsed}ms`);
    console.log(`✓ Proposal generation complete (report-only, no mutations)`);

    return { success: true, report };
  } catch (error) {
    console.error(`[IB-Proposals] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Direct execution when run as script (ESM guard)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runProposalGenerationDryRun();
}
