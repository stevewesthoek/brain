#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Insight Generation Dry-Run (IB10)
 * Synthesizes insights from existing reports without model calls
 * Report-only: no mutations, no Mind writes, deterministic heuristics only
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RUNTIME_DIR = process.env.RUNTIME_DIR ||
  path.resolve(__dirname, '../../runtime/local/infinite-brain');
const OUTPUT_DIR = RUNTIME_DIR;

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
 * Generate insights from reports using deterministic heuristics
 */
async function generateInsights() {
  const timestamp = new Date().toISOString();
  const insights = [];
  const hypotheses = [];
  const recommendations = [];

  // Load all available reports
  const classifierReport = await loadReport(path.join(RUNTIME_DIR, 'entity-classifier-latest.json'));
  const edgeReport = await loadReport(path.join(RUNTIME_DIR, 'edge-inference-latest.json'));
  const auditReport = await loadReport(path.join(RUNTIME_DIR, 'relationship-audit-latest.json'));
  const atomizerReport = await loadReport(path.join(RUNTIME_DIR, 'atomizer-latest.json'));

  // INSIGHT 1: Knowledge graph coverage
  if (classifierReport?.summary) {
    const totalFiles = classifierReport.summary.totalFilesAnalyzed;
    const inferred = classifierReport.summary.inferred;
    const withExisting = classifierReport.summary.withExistingType;
    const coverage = ((withExisting + inferred) / totalFiles) * 100;

    insights.push({
      id: 'ig-001-coverage',
      category: 'knowledge_graph_health',
      title: 'Knowledge Graph Coverage',
      summary: `${coverage.toFixed(1)}% of files have entity types (${withExisting} existing, ${inferred} inferred)`,
      severity: coverage >= 90 ? 'low' : coverage >= 70 ? 'medium' : 'high',
      evidence: {
        totalFiles,
        withExistingType: withExisting,
        inferred,
        uncovered: totalFiles - withExisting - inferred,
      },
      recommendedAction: coverage < 70 ? 'Increase entity classification coverage through atomization or manual curation' : 'Monitor for new uncovered files',
      confidence: 1.0,
    });
  }

  // INSIGHT 2: Entity distribution imbalance
  if (classifierReport?.byType) {
    const types = Object.entries(classifierReport.byType).map(([type, data]) => ({
      type,
      count: data.items?.length || 0,
    }));

    const total = types.reduce((sum, t) => sum + t.count, 0);
    const distribution = types.map(t => (t.count / total) * 100).sort((a, b) => b - a);
    const imbalanceRatio = distribution[0] / (distribution[distribution.length - 1] || 1);

    if (imbalanceRatio > 5) {
      insights.push({
        id: 'ig-002-imbalance',
        category: 'entity_distribution',
        title: 'Entity Type Imbalance',
        summary: `Entity types show high disparity (max/min ratio: ${imbalanceRatio.toFixed(1)}x)`,
        severity: imbalanceRatio > 10 ? 'high' : 'medium',
        evidence: {
          entityTypes: types,
          maxMinRatio: imbalanceRatio,
        },
        recommendedAction: 'Review classification rules; consider whether rare types are underrepresented or spurious',
        confidence: 0.85,
      });
    }
  }

  // INSIGHT 3: Edge inference health
  if (edgeReport?.summary) {
    const total = edgeReport.summary.totalInferredEdges;
    const highConf = edgeReport.summary.highConfidenceEdges;
    const confRatio = (highConf / total) * 100;

    insights.push({
      id: 'ig-003-edge-confidence',
      category: 'relationship_quality',
      title: 'Edge Inference Confidence',
      summary: `${confRatio.toFixed(1)}% of inferred edges exceed 0.75 confidence threshold`,
      severity: confRatio >= 50 ? 'low' : confRatio >= 30 ? 'medium' : 'high',
      evidence: {
        totalEdges: total,
        highConfidenceEdges: highConf,
        confidenceRatio: confRatio,
      },
      recommendedAction: confRatio < 30 ? 'Review edge inference heuristics; consider more conservative confidence thresholds' : 'Continue with current inference strategy',
      confidence: 0.9,
    });
  }

  // INSIGHT 4: Relationship audit health
  if (auditReport) {
    const healthScore = auditReport.healthScore;
    const totalEdges = auditReport.totalInferredEdges;
    const issues = (auditReport.orphanSources?.length || 0) +
                  (auditReport.orphanTargets?.length || 0) +
                  (auditReport.duplicateEdgePairs?.length || 0) +
                  (auditReport.bidirectionalIssues?.length || 0);

    insights.push({
      id: 'ig-004-audit-health',
      category: 'relationship_quality',
      title: 'Relationship Audit Health',
      summary: `Graph health score: ${healthScore.toFixed(1)}% (${issues} issues in ${totalEdges} edges)`,
      severity: healthScore >= 80 ? 'low' : healthScore >= 60 ? 'medium' : 'high',
      evidence: {
        healthScore,
        totalEdges,
        detectedIssues: issues,
        orphanSources: auditReport.orphanSources?.length || 0,
        orphanTargets: auditReport.orphanTargets?.length || 0,
        duplicateEdges: auditReport.duplicateEdgePairs?.length || 0,
        bidirectionalConflicts: auditReport.bidirectionalIssues?.length || 0,
      },
      recommendedAction: healthScore < 70 ? 'Prioritize orphan reference removal and duplicate edge deduplication' : 'Maintain current relationship quality standards',
      confidence: 0.95,
    });
  }

  // INSIGHT 5: Atomization pressure
  if (atomizerReport?.summary) {
    const total = atomizerReport.summary.totalFilesAnalyzed;
    const split = atomizerReport.summary.considerSplit;
    const pressure = (split / total) * 100;

    if (pressure > 10) {
      insights.push({
        id: 'ig-005-atomization',
        category: 'atomization_pressure',
        title: 'High Atomization Pressure',
        summary: `${pressure.toFixed(1)}% of files (${split}/${total}) are candidates for splitting`,
        severity: pressure > 20 ? 'high' : pressure > 15 ? 'medium' : 'low',
        evidence: {
          totalFilesAnalyzed: total,
          splitCandidates: split,
          pressurePercentage: pressure,
        },
        recommendedAction: pressure > 15 ? 'Schedule file atomization in next maintenance cycle' : 'Monitor for growing pressure',
        confidence: 0.8,
      });
    }
  }

  // HYPOTHESIS 1: Classification accuracy improves with atomization
  if (classifierReport?.summary && atomizerReport?.summary) {
    const confBeforeAtom = classifierReport.summary.avgConfidence * 100;
    hypotheses.push({
      id: 'hy-001-atomization-accuracy',
      statement: 'Entity classification accuracy will improve after atomizing files with high split pressure',
      supportingSignals: [
        `Current avg confidence: ${confBeforeAtom.toFixed(1)}%`,
        `${atomizerReport.summary.considerSplit} files identified as split candidates`,
        'Smaller, more focused files typically have clearer entity types',
      ],
      confidence: 0.75,
      testableNextStep: 'After atomizing split candidates, re-run classifier and compare confidence distribution',
      safetyMode: 'report-only',
    });
  }

  // HYPOTHESIS 2: Low-confidence edges correlate with orphan references
  if (auditReport && edgeReport) {
    const orphanCount = (auditReport.orphanSources?.length || 0) + (auditReport.orphanTargets?.length || 0);
    if (orphanCount > 0) {
      hypotheses.push({
        id: 'hy-002-orphan-edge-correlation',
        statement: 'Low-confidence edges are more likely to reference deleted or moved entities',
        supportingSignals: [
          `${orphanCount} orphan references detected`,
          `${edgeReport.summary.totalInferredEdges - edgeReport.summary.highConfidenceEdges} low-confidence edges exist`,
          'Orphan references often arise from stale inference',
        ],
        confidence: 0.7,
        testableNextStep: 'Cross-check orphan references against low-confidence edge set; measure overlap',
        safetyMode: 'report-only',
      });
    }
  }

  // HYPOTHESIS 3: Relationship audit scores predict graph stability
  if (auditReport) {
    const healthScore = auditReport.healthScore;
    hypotheses.push({
      id: 'hy-003-health-score-prediction',
      statement: 'Graphs with health scores < 70% will experience cascading errors if mutations proceed without repair',
      supportingSignals: [
        `Current health score: ${healthScore.toFixed(1)}%`,
        healthScore < 70 ? 'Below stability threshold' : 'Above stability threshold',
        'Prior phases show high-confidence correlation between health and mutation safety',
      ],
      confidence: healthScore < 70 ? 0.85 : 0.65,
      testableNextStep: healthScore < 70 ? 'Execute relationship repair (IB9A) before enabling writes' : 'Safe to proceed with cautious mutation',
      safetyMode: 'report-only',
    });
  }

  // RECOMMENDATION 1: Entity classification cleanup
  if (classifierReport?.summary) {
    const uncovered = (classifierReport.summary.totalFilesAnalyzed -
                      classifierReport.summary.withExistingType -
                      classifierReport.summary.inferred);
    if (uncovered > 100) {
      recommendations.push({
        id: 'rec-001-classify-uncovered',
        priority: 'high',
        category: 'entity_classification',
        title: 'Classify Uncovered Files',
        summary: `${uncovered} files remain unclassified`,
        action: 'Run interactive classification or increase inference model confidence threshold',
        rationale: 'Unclassified files reduce graph utility and complicate edge inference',
        safetyMode: 'report-only',
      });
    }
  }

  // RECOMMENDATION 2: Relationship repair
  if (auditReport && auditReport.healthScore < 80) {
    const issues = (auditReport.orphanSources?.length || 0) +
                  (auditReport.orphanTargets?.length || 0) +
                  (auditReport.duplicateEdgePairs?.length || 0);
    recommendations.push({
      id: 'rec-002-repair-relationships',
      priority: auditReport.healthScore < 70 ? 'high' : 'medium',
      category: 'relationship_integrity',
      title: 'Repair Graph Relationships',
      summary: `${issues} relationship integrity issues detected (health: ${auditReport.healthScore.toFixed(1)}%)`,
      action: auditReport.healthScore < 70
        ? 'Execute IB9A relationship repair phase before proceeding with writes'
        : 'Schedule relationship cleanup in next maintenance cycle',
      rationale: 'Graph mutations on damaged relationships propagate errors; repair improves stability',
      safetyMode: 'report-only',
    });
  }

  // RECOMMENDATION 3: Atomization maintenance
  if (atomizerReport && atomizerReport.summary.considerSplit > 50) {
    recommendations.push({
      id: 'rec-003-schedule-atomization',
      priority: atomizerReport.summary.considerSplit > 100 ? 'high' : 'medium',
      category: 'file_atomization',
      title: 'Schedule File Atomization',
      summary: `${atomizerReport.summary.considerSplit} files exceed recommended size`,
      action: 'Batch files and execute planned atomization after classification stabilizes',
      rationale: 'Large monolithic files reduce classification accuracy and complicate edge inference',
      safetyMode: 'report-only',
    });
  }

  // RECOMMENDATION 4: Ready for next phase
  if (auditReport?.healthScore >= 80 && edgeReport?.summary) {
    const confRatio = (edgeReport.summary.highConfidenceEdges / edgeReport.summary.totalInferredEdges) * 100;
    if (confRatio >= 50) {
      recommendations.push({
        id: 'rec-004-ready-for-ib10a',
        priority: 'high',
        category: 'phase_readiness',
        title: 'Ready for IB10A Integration',
        summary: 'Graph health and inference quality meet thresholds for Brain Core status integration',
        action: 'Proceed with IB10A (Brain Core status integration) if routes.ts is clean',
        rationale: 'Current metrics support safe status reporting and console visibility',
        safetyMode: 'report-only',
      });
    }
  }

  return {
    timestamp,
    sourceReports: {
      classifier: !!classifierReport,
      edges: !!edgeReport,
      relationshipAudit: !!auditReport,
      atomizer: !!atomizerReport,
    },
    status: 'complete',
    summary: {
      insightCount: insights.length,
      hypothesisCount: hypotheses.length,
      recommendationCount: recommendations.length,
    },
    insights,
    hypotheses,
    recommendations,
    safety: {
      writesToMind: false,
      continuousRuntime: false,
      modelCalls: false,
      modelFallbackHardcoded: false,
      deterministic: true,
    },
  };
}

/**
 * Format insights report as markdown
 */
function formatMarkdownReport(report) {
  let md = `# Infinite Brain Runtime — Insight Generation Report\n\n`;

  md += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;

  md += `## Executive Summary\n\n`;
  md += `- **Insights:** ${report.summary.insightCount}\n`;
  md += `- **Hypotheses:** ${report.summary.hypothesisCount}\n`;
  md += `- **Recommendations:** ${report.summary.recommendationCount}\n`;
  md += `- **Status:** ${report.status}\n\n`;

  md += `## Source Reports Loaded\n\n`;
  Object.entries(report.sourceReports).forEach(([name, loaded]) => {
    md += `- ${name}: ${loaded ? '✓' : '✗'}\n`;
  });
  md += '\n';

  // Insights section
  md += `## Insights (${report.insights.length})\n\n`;
  report.insights.forEach((insight, i) => {
    md += `### ${i + 1}. ${insight.title} (${insight.category})\n\n`;
    md += `**Severity:** ${insight.severity} | **Confidence:** ${(insight.confidence * 100).toFixed(0)}%\n\n`;
    md += `${insight.summary}\n\n`;
    md += `**Evidence:**\n`;
    Object.entries(insight.evidence).forEach(([key, value]) => {
      if (typeof value === 'object') {
        md += `- ${key}: ${JSON.stringify(value)}\n`;
      } else {
        md += `- ${key}: ${value}\n`;
      }
    });
    md += `\n**Recommended Action:** ${insight.recommendedAction}\n\n`;
  });

  // Hypotheses section
  md += `## Hypotheses (${report.hypotheses.length})\n\n`;
  report.hypotheses.forEach((hyp, i) => {
    md += `### ${i + 1}. ${hyp.statement}\n\n`;
    md += `**Confidence:** ${(hyp.confidence * 100).toFixed(0)}%\n\n`;
    md += `**Supporting Signals:**\n`;
    hyp.supportingSignals.forEach((signal) => {
      md += `- ${signal}\n`;
    });
    md += `\n**Next Testable Step:** ${hyp.testableNextStep}\n\n`;
  });

  // Recommendations section
  md += `## Recommendations (${report.recommendations.length})\n\n`;
  report.recommendations.forEach((rec) => {
    md += `### [${rec.priority.toUpperCase()}] ${rec.title} (${rec.category})\n\n`;
    md += `${rec.summary}\n\n`;
    md += `**Action:** ${rec.action}\n\n`;
    md += `**Rationale:** ${rec.rationale}\n\n`;
  });

  // Safety block
  md += `## Safety & Determinism\n\n`;
  md += `- **Writes to Mind:** ${report.safety.writesToMind ? 'ON' : 'OFF'} ✓\n`;
  md += `- **Continuous Runtime:** ${report.safety.continuousRuntime ? 'ON' : 'OFF'} ✓\n`;
  md += `- **Model Calls:** ${report.safety.modelCalls ? 'YES' : 'NO'} ✓\n`;
  md += `- **Model Fallback:** ${report.safety.modelFallbackHardcoded ? 'ON' : 'OFF'} ✓\n`;
  md += `- **Deterministic:** ${report.safety.deterministic ? 'YES' : 'NO'} ✓\n\n`;

  md += `---\n\n`;
  md += `*This is a report-only analysis using deterministic heuristics. No mutations, writes, or model calls.*\n`;

  return md;
}

/**
 * Export function for direct import by pipeline runner
 */
export async function runInsightGenerationDryRun() {
  console.log('[IB-Insight] Starting insight generation dry-run...');
  console.log(`[IB-Insight] Runtime dir: ${RUNTIME_DIR}`);
  console.log('[IB-Insight] Loading reports...\n');

  try {
    // Generate insights
    const report = await generateInsights();

    // Format markdown
    const markdown = formatMarkdownReport(report);

    // Write outputs
    const jsonPath = path.join(OUTPUT_DIR, 'insights-latest.json');
    const mdPath = path.join(OUTPUT_DIR, 'insights-latest.md');

    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    await fs.writeFile(mdPath, markdown);

    console.log('[IB-Insight] Reports generated:');
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}`);

    console.log('\n[IB-Insight] Summary:');
    console.log(`  Insights: ${report.summary.insightCount}`);
    console.log(`  Hypotheses: ${report.summary.hypothesisCount}`);
    console.log(`  Recommendations: ${report.summary.recommendationCount}`);
    console.log(`  Status: ${report.status}`);

    console.log('\n[IB-Insight] Safety:');
    console.log(`  Writes to Mind: ${report.safety.writesToMind}`);
    console.log(`  Continuous Runtime: ${report.safety.continuousRuntime}`);
    console.log(`  Model Calls: ${report.safety.modelCalls}`);
    console.log(`  Deterministic: ${report.safety.deterministic}`);

    console.log('\n✓ Insight generation complete (report-only, no mutations)');

    return { success: true, report };
  } catch (error) {
    console.error(`[IB-Insight] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Direct execution when run as script (ESM guard)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  runInsightGenerationDryRun();
}
