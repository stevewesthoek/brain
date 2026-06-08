#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Relationship Audit Dry-Run (IB9)
 * Evaluates the quality and health of inferred edges
 * Report-only: no repairs, no mutations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CLASSIFIER_REPORT_PATH = process.env.CLASSIFIER_REPORT_PATH ||
  path.resolve(__dirname, '../../runtime/local/infinite-brain/entity-classifier-latest.json');
const EDGE_INFERENCE_REPORT_PATH = process.env.EDGE_INFERENCE_REPORT_PATH ||
  path.resolve(__dirname, '../../runtime/local/infinite-brain/edge-inference-latest.json');
const OUTPUT_DIR = path.resolve(__dirname, '../../runtime/local/infinite-brain');

// Valid edge types
const EDGE_TYPES = [
  'supports',
  'contradicts',
  'depends_on',
  'derived_from',
  'related_to',
  'part_of',
  'preceded_by',
  'followed_by',
  'authored',
  'tagging',
];

/**
 * Load JSON report safely
 */
async function loadReport(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load report from ${filePath}: ${error.message}`);
    return null;
  }
}

/**
 * Audit relationship integrity
 */
function auditRelationships(entities, edges) {
  const audit = {
    timestamp: new Date().toISOString(),
    totalInferredEdges: edges.length,
    totalReviewCandidates: 0,
    edgesByType: {},
    confidenceDistribution: {
      veryHigh: 0, // >= 0.9
      high: 0,     // >= 0.75
      medium: 0,   // >= 0.6
      low: 0,      // >= 0.4
      veryLow: 0,  // < 0.4
    },
    highConfidenceCount: 0,
    lowConfidenceCount: 0,
    orphanSources: [],
    orphanTargets: [],
    duplicateEdgePairs: [],
    bidirectionalIssues: [],
    missingEvidenceFields: [],
    suspiciousPatterns: [],
    topRiskyEdges: [],
    healthScore: 0,
    recommendations: [],
  };

  // Build entity map for reference checking (use path as key since edges use sourceId/targetId)
  const entityMap = new Map();
  entities.forEach((e) => {
    entityMap.set(e.path, e);
  });

  // Initialize edge type counts
  EDGE_TYPES.forEach((type) => {
    audit.edgesByType[type] = 0;
  });

  // Track edges for duplicate detection
  const edgeSignatures = new Map(); // "source->target->type" -> edge

  // Audit each edge
  edges.forEach((edge, index) => {
    // Edges use 'source' and 'target' (file paths)
    const sourceId = edge.sourceId || edge.source;
    const targetId = edge.targetId || edge.target;

    // Track edge type
    if (EDGE_TYPES.includes(edge.edgeType)) {
      audit.edgesByType[edge.edgeType]++;
    }

    // Check confidence distribution
    const confidence = edge.confidence || 0;
    if (confidence >= 0.9) {
      audit.confidenceDistribution.veryHigh++;
      audit.highConfidenceCount++;
    } else if (confidence >= 0.75) {
      audit.confidenceDistribution.high++;
      audit.highConfidenceCount++;
    } else if (confidence >= 0.6) {
      audit.confidenceDistribution.medium++;
    } else if (confidence >= 0.4) {
      audit.confidenceDistribution.low++;
      audit.lowConfidenceCount++;
    } else {
      audit.confidenceDistribution.veryLow++;
      audit.lowConfidenceCount++;
      audit.totalReviewCandidates++;
    }

    // Check for missing evidence fields
    if (!edge.reasoning || edge.reasoning.trim().length === 0) {
      audit.missingEvidenceFields.push({
        index,
        edgeId: `${sourceId}:${edge.edgeType}:${targetId}`,
        reason: 'missing reasoning',
      });
    }

    // Check source entity exists
    if (!entityMap.has(sourceId)) {
      audit.orphanSources.push({
        edgeId: `${sourceId}:${edge.edgeType}:${targetId}`,
        entityId: sourceId,
        confidence,
      });
    }

    // Check target entity exists
    if (!entityMap.has(targetId)) {
      audit.orphanTargets.push({
        edgeId: `${sourceId}:${edge.edgeType}:${targetId}`,
        entityId: targetId,
        confidence,
      });
    }

    // Check for duplicate edges (same source, target, type)
    const signature = `${sourceId}->${targetId}:${edge.edgeType}`;
    if (edgeSignatures.has(signature)) {
      const existing = edgeSignatures.get(signature);
      audit.duplicateEdgePairs.push({
        edgeA: `${sourceId}:${edge.edgeType}:${targetId}`,
        edgeB: `${existing.source || existing.sourceId}:${existing.edgeType}:${existing.target || existing.targetId}`,
        confidenceA: confidence,
        confidenceB: existing.confidence,
      });
    } else {
      edgeSignatures.set(signature, edge);
    }

    // Check for inappropriate bidirectional duplicates
    const oppositeType = edge.edgeType === 'supports' ? 'contradicts' :
                       edge.edgeType === 'contradicts' ? 'supports' : null;
    if (oppositeType) {
      const oppositeSignature = `${targetId}->${sourceId}:${oppositeType}`;
      if (edgeSignatures.has(oppositeSignature)) {
        audit.bidirectionalIssues.push({
          sourceEntity: sourceId,
          targetEntity: targetId,
          edgeType1: edge.edgeType,
          edgeType2: oppositeType,
          confidence1: confidence,
          confidence2: edgeSignatures.get(oppositeSignature).confidence,
          recommendation: 'Manual review required: conflicting edge types',
        });
      }
    }

    // Detect suspicious patterns
    if (confidence < 0.5 && !edge.reasoning) {
      audit.suspiciousPatterns.push({
        edgeId: `${sourceId}:${edge.edgeType}:${targetId}`,
        pattern: 'very low confidence with no reasoning',
        confidence,
      });
    }

    // Track risky edges (for top list)
    if (confidence < 0.6) {
      audit.topRiskyEdges.push({
        sourceEntityId: sourceId,
        targetEntityId: targetId,
        edgeType: edge.edgeType,
        confidence,
        reasoning: edge.reasoning || 'none provided',
      });
    }
  });

  // Sort risky edges by confidence (lowest first)
  audit.topRiskyEdges.sort((a, b) => a.confidence - b.confidence);
  audit.topRiskyEdges = audit.topRiskyEdges.slice(0, 10); // Top 10 riskiest

  // Compute health score
  const totalIssues =
    audit.orphanSources.length +
    audit.orphanTargets.length +
    audit.duplicateEdgePairs.length +
    audit.bidirectionalIssues.length +
    audit.missingEvidenceFields.length +
    audit.suspiciousPatterns.length;

  const maxIssues = audit.totalInferredEdges + 1; // Avoid division by zero
  audit.healthScore = Math.max(0, (1 - totalIssues / maxIssues) * 100);

  // Generate recommendations
  if (audit.orphanSources.length > 0) {
    audit.recommendations.push({
      priority: 'high',
      category: 'orphan_sources',
      count: audit.orphanSources.length,
      action: 'Remove edges with missing source entities',
      rationale: 'Source entities no longer exist in vault',
    });
  }

  if (audit.orphanTargets.length > 0) {
    audit.recommendations.push({
      priority: 'high',
      category: 'orphan_targets',
      count: audit.orphanTargets.length,
      action: 'Remove edges with missing target entities',
      rationale: 'Target entities no longer exist in vault',
    });
  }

  if (audit.duplicateEdgePairs.length > 0) {
    audit.recommendations.push({
      priority: 'medium',
      category: 'duplicate_edges',
      count: audit.duplicateEdgePairs.length,
      action: 'Merge or remove duplicate edges',
      rationale: 'Multiple edges between same entities with same type',
    });
  }

  if (audit.bidirectionalIssues.length > 0) {
    audit.recommendations.push({
      priority: 'high',
      category: 'bidirectional_conflicts',
      count: audit.bidirectionalIssues.length,
      action: 'Manually review and resolve conflicting edge types',
      rationale: 'Contradictory edge types between same entity pair',
    });
  }

  if (audit.missingEvidenceFields.length > 0) {
    audit.recommendations.push({
      priority: 'medium',
      category: 'missing_evidence',
      count: audit.missingEvidenceFields.length,
      action: 'Add evidence fields to edges',
      rationale: 'Edges lack evidence or reasoning documentation',
    });
  }

  if (audit.lowConfidenceCount > audit.totalInferredEdges * 0.2) {
    audit.recommendations.push({
      priority: 'medium',
      category: 'low_confidence_prevalence',
      count: audit.lowConfidenceCount,
      action: 'Review and adjust confidence scoring thresholds',
      rationale: `${((audit.lowConfidenceCount / audit.totalInferredEdges) * 100).toFixed(1)}% of edges have low confidence`,
    });
  }

  if (audit.healthScore < 70) {
    audit.recommendations.push({
      priority: 'high',
      category: 'overall_health',
      count: 1,
      action: 'Schedule comprehensive relationship repair in next phase (IB9A)',
      rationale: `Health score is ${audit.healthScore.toFixed(1)}% (< 70%)`,
    });
  }

  return audit;
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(audit, entities, edges) {
  let md = '# Infinite Brain Runtime — Relationship Audit Report\n\n';

  md += `**Generated:** ${new Date(audit.timestamp).toLocaleString()}\n\n`;

  // Summary section
  md += '## Executive Summary\n\n';
  md += `- **Total Inferred Edges:** ${audit.totalInferredEdges}\n`;
  md += `- **Total Review Candidates:** ${audit.totalReviewCandidates}\n`;
  md += `- **Health Score:** ${audit.healthScore.toFixed(1)}%\n`;
  md += `- **High-Confidence Edges:** ${audit.highConfidenceCount}\n`;
  md += `- **Low-Confidence Edges:** ${audit.lowConfidenceCount}\n`;
  md += `- **Issues Found:** ${audit.orphanSources.length + audit.orphanTargets.length + audit.duplicateEdgePairs.length + audit.bidirectionalIssues.length + audit.missingEvidenceFields.length + audit.suspiciousPatterns.length}\n\n`;

  // Edges by type
  md += '## Edges by Type\n\n';
  EDGE_TYPES.forEach((type) => {
    md += `- ${type}: ${audit.edgesByType[type]}\n`;
  });
  md += '\n';

  // Confidence distribution
  md += '## Confidence Distribution\n\n';
  md += `- Very High (≥ 0.9): ${audit.confidenceDistribution.veryHigh}\n`;
  md += `- High (≥ 0.75): ${audit.confidenceDistribution.high}\n`;
  md += `- Medium (≥ 0.6): ${audit.confidenceDistribution.medium}\n`;
  md += `- Low (≥ 0.4): ${audit.confidenceDistribution.low}\n`;
  md += `- Very Low (< 0.4): ${audit.confidenceDistribution.veryLow}\n\n`;

  // Issues section
  md += '## Issues Detected\n\n';

  if (audit.orphanSources.length > 0) {
    md += `### Orphan Source References (${audit.orphanSources.length})\n\n`;
    md += 'Edges with missing source entities:\n\n';
    audit.orphanSources.slice(0, 5).forEach((issue) => {
      md += `- ${issue.edgeId} (confidence: ${issue.confidence.toFixed(2)})\n`;
    });
    if (audit.orphanSources.length > 5) {
      md += `- ... and ${audit.orphanSources.length - 5} more\n`;
    }
    md += '\n';
  }

  if (audit.orphanTargets.length > 0) {
    md += `### Orphan Target References (${audit.orphanTargets.length})\n\n`;
    md += 'Edges with missing target entities:\n\n';
    audit.orphanTargets.slice(0, 5).forEach((issue) => {
      md += `- ${issue.edgeId} (confidence: ${issue.confidence.toFixed(2)})\n`;
    });
    if (audit.orphanTargets.length > 5) {
      md += `- ... and ${audit.orphanTargets.length - 5} more\n`;
    }
    md += '\n';
  }

  if (audit.duplicateEdgePairs.length > 0) {
    md += `### Duplicate Edge Pairs (${audit.duplicateEdgePairs.length})\n\n`;
    md += 'Multiple edges between same entities:\n\n';
    audit.duplicateEdgePairs.slice(0, 5).forEach((issue) => {
      md += `- ${issue.edgeA} vs ${issue.edgeB}\n`;
      md += `  - Confidence A: ${issue.confidenceA.toFixed(2)}, Confidence B: ${issue.confidenceB.toFixed(2)}\n`;
    });
    if (audit.duplicateEdgePairs.length > 5) {
      md += `- ... and ${audit.duplicateEdgePairs.length - 5} more\n`;
    }
    md += '\n';
  }

  if (audit.bidirectionalIssues.length > 0) {
    md += `### Bidirectional Conflicts (${audit.bidirectionalIssues.length})\n\n`;
    md += 'Contradictory edge types between entity pairs:\n\n';
    audit.bidirectionalIssues.slice(0, 5).forEach((issue) => {
      md += `- ${issue.sourceEntity} <--> ${issue.targetEntity}\n`;
      md += `  - ${issue.edgeType1} (${issue.confidence1.toFixed(2)}) vs ${issue.edgeType2} (${issue.confidence2.toFixed(2)})\n`;
    });
    if (audit.bidirectionalIssues.length > 5) {
      md += `- ... and ${audit.bidirectionalIssues.length - 5} more\n`;
    }
    md += '\n';
  }

  if (audit.missingEvidenceFields.length > 0) {
    md += `### Missing Evidence Fields (${audit.missingEvidenceFields.length})\n\n`;
    md += 'Edges without evidence or reasoning:\n\n';
    audit.missingEvidenceFields.slice(0, 5).forEach((issue) => {
      md += `- ${issue.edgeId}: ${issue.reason}\n`;
    });
    if (audit.missingEvidenceFields.length > 5) {
      md += `- ... and ${audit.missingEvidenceFields.length - 5} more\n`;
    }
    md += '\n';
  }

  if (audit.suspiciousPatterns.length > 0) {
    md += `### Suspicious Patterns (${audit.suspiciousPatterns.length})\n\n`;
    md += 'Edges with unusual characteristics:\n\n';
    audit.suspiciousPatterns.slice(0, 5).forEach((pattern) => {
      md += `- ${pattern.edgeId}: ${pattern.pattern} (confidence: ${pattern.confidence.toFixed(2)})\n`;
    });
    if (audit.suspiciousPatterns.length > 5) {
      md += `- ... and ${audit.suspiciousPatterns.length - 5} more\n`;
    }
    md += '\n';
  }

  // Top risky edges
  if (audit.topRiskyEdges.length > 0) {
    md += '## Top 10 Riskiest Edges\n\n';
    md += 'Lowest confidence edges requiring review:\n\n';
    audit.topRiskyEdges.forEach((edge, i) => {
      md += `${i + 1}. ${edge.sourceEntityId} → ${edge.targetEntityId} (${edge.edgeType})\n`;
      md += `   - Confidence: ${edge.confidence.toFixed(2)}\n`;
      md += `   - Reasoning: ${edge.reasoning.substring(0, 60)}...\n`;
    });
    md += '\n';
  }

  // Recommendations
  md += '## Recommendations\n\n';
  audit.recommendations.forEach((rec) => {
    md += `### [${rec.priority.toUpperCase()}] ${rec.category}\n\n`;
    md += `- **Count:** ${rec.count}\n`;
    md += `- **Action:** ${rec.action}\n`;
    md += `- **Rationale:** ${rec.rationale}\n\n`;
  });

  md += '## Next Steps\n\n';
  md += '1. Review this report for accuracy\n';
  md += '2. If health score < 70%, proceed to IB9A (relationship repair phase)\n';
  md += '3. Schedule manual review of high-priority recommendations\n';
  md += '4. Consider adjusting confidence thresholds if distribution is skewed\n';

  return md;
}

/**
 * Main execution
 */
async function main() {
  console.log('Infinite Brain Runtime — Relationship Audit (IB9)');
  console.log('Report-only: no repairs or mutations\n');

  // Load reports
  console.log('Loading entity classifier report...');
  const classifierReport = await loadReport(CLASSIFIER_REPORT_PATH);
  if (!classifierReport) {
    console.error('ERROR: Could not load classifier report. Run ibr:classify:dry-run first.');
    process.exit(1);
  }

  console.log('Loading edge inference report...');
  const edgeReport = await loadReport(EDGE_INFERENCE_REPORT_PATH);
  if (!edgeReport) {
    console.error('ERROR: Could not load edge inference report. Run ibr:edges:dry-run first.');
    process.exit(1);
  }

  // Extract entities from classifier report (stored in byType and candidates)
  const entities = [];
  const byType = classifierReport.byType || {};
  Object.entries(byType).forEach(([type, data]) => {
    if (data.items) {
      data.items.forEach((item) => {
        entities.push({
          path: item.path,
          title: item.title,
          inferredType: type,
          confidence: item.confidence,
        });
      });
    }
  });

  // Add unclassified candidates
  if (classifierReport.candidates) {
    classifierReport.candidates.forEach((candidate) => {
      entities.push({
        path: candidate.path,
        title: candidate.title,
        inferredType: candidate.inferredType,
        confidence: candidate.confidence,
      });
    });
  }

  // Extract edges from edge inference report
  const edges = edgeReport.candidates || [];

  console.log(`Found ${entities.length} entities and ${edges.length} edges\n`);

  // Run audit
  console.log('Running relationship audit...');
  const audit = auditRelationships(entities, edges);

  // Generate reports
  const jsonReport = {
    ...audit,
    entityCount: entities.length,
    edgeCount: edges.length,
  };

  const markdownReport = generateMarkdownReport(audit, entities, edges);

  // Write outputs
  console.log('Writing JSON report...');
  const jsonPath = path.join(OUTPUT_DIR, 'relationship-audit-latest.json');
  await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2));
  console.log(`✓ ${jsonPath}`);

  console.log('Writing Markdown report...');
  const mdPath = path.join(OUTPUT_DIR, 'relationship-audit-latest.md');
  await fs.writeFile(mdPath, markdownReport);
  console.log(`✓ ${mdPath}`);

  // Summary output
  console.log('\n=== AUDIT SUMMARY ===');
  console.log(`Health Score: ${audit.healthScore.toFixed(1)}%`);
  console.log(`Total Edges: ${audit.totalInferredEdges}`);
  console.log(`Review Candidates: ${audit.totalReviewCandidates}`);
  console.log(`Issues Found: ${jsonReport.entityCount + jsonReport.edgeCount - audit.healthScore}`);
  console.log(`Recommendations: ${audit.recommendations.length}`);
  console.log('');
  console.log('Status: ✓ Audit complete (report-only, no repairs)');
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
