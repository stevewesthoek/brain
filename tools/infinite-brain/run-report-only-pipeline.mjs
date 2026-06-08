#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Report-Only Pipeline Runner
 * Executes all dry-run phases in sequence: atomizer → classifier → edges → audit → insights
 * Deterministic, report-only, no mutations, no Mind writes, no model calls
 * Safe execution model: all phases are imported and called directly
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runAtomizerDryRun } from './atomizer-dry-run.mjs';
import { runEntityClassifierDryRun } from './entity-classifier-dry-run.mjs';
import { runEdgeInferenceDryRun } from './edge-inference-dry-run.mjs';
import { runRelationshipAuditDryRun } from './relationship-audit-dry-run.mjs';
import { runInsightGenerationDryRun } from './insight-generation-dry-run.mjs';
import { runProposalGenerationDryRun } from './proposal-generation-dry-run.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNTIME_DIR = path.resolve(__dirname, '../../runtime/local/infinite-brain');

// Phases to execute in order
const PHASES = [
  {
    name: 'atomizer',
    displayName: 'Atomizer Dry-Run',
    fn: runAtomizerDryRun,
    outputFile: 'atomizer-latest.json',
  },
  {
    name: 'classifier',
    displayName: 'Entity Classifier Dry-Run',
    fn: runEntityClassifierDryRun,
    outputFile: 'entity-classifier-latest.json',
  },
  {
    name: 'edges',
    displayName: 'Edge Inference Dry-Run',
    fn: runEdgeInferenceDryRun,
    outputFile: 'edge-inference-latest.json',
  },
  {
    name: 'relationships',
    displayName: 'Relationship Audit',
    fn: runRelationshipAuditDryRun,
    outputFile: 'relationship-audit-latest.json',
  },
  {
    name: 'insights',
    displayName: 'Insight Generation Dry-Run',
    fn: runInsightGenerationDryRun,
    outputFile: 'insights-latest.json',
  },
  {
    name: 'proposals',
    displayName: 'Proposal Generation Dry-Run',
    fn: runProposalGenerationDryRun,
    outputFile: 'proposals-latest.json',
  },
];

/**
 * Execute a single phase by calling its function directly
 */
async function executePhase(phaseFn) {
  const startTime = Date.now();
  let exitCode = 0;
  let success = true;

  try {
    await phaseFn();
  } catch (error) {
    exitCode = 1;
    success = false;
  }

  const durationMs = Date.now() - startTime;
  return {
    exitCode,
    durationMs,
    success,
  };
}

/**
 * Load JSON report safely
 */
async function loadReport(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Extract summary metrics from a phase report
 */
async function extractPhaseMetrics(phase) {
  const reportPath = path.join(RUNTIME_DIR, phase.outputFile);
  const report = await loadReport(reportPath);

  if (!report) {
    return null;
  }

  // Extract relevant metrics by phase
  switch (phase.name) {
    case 'atomizer':
      return {
        totalFilesAnalyzed: report.summary?.totalFilesAnalyzed,
        keepAtomic: report.summary?.keepAtomic,
        considerSplit: report.summary?.considerSplit,
      };

    case 'classifier':
      return {
        totalFilesAnalyzed: report.summary?.totalFilesAnalyzed,
        withExistingType: report.summary?.withExistingType,
        inferred: report.summary?.inferred,
        avgConfidence: report.summary?.avgConfidence,
      };

    case 'edges':
      return {
        totalEntities: report.summary?.totalEntities,
        totalInferredEdges: report.summary?.totalInferredEdges,
        highConfidenceEdges: report.summary?.highConfidenceEdges,
      };

    case 'relationships':
      return {
        totalInferredEdges: report.totalInferredEdges,
        healthScore: report.healthScore,
        duplicateEdges: report.duplicateEdgePairs?.length || 0,
        orphanReferences:
          (report.orphanSources?.length || 0) + (report.orphanTargets?.length || 0),
      };

    case 'insights':
      return {
        insightCount: report.summary?.insightCount,
        hypothesisCount: report.summary?.hypothesisCount,
        recommendationCount: report.summary?.recommendationCount,
      };

    case 'proposals':
      return {
        proposalsGenerated: report.totalProposals,
        proposalsByCategory: report.byCategory,
        highPriorityProposals: report.byPriority?.high || 0,
        mediumPriorityProposals: report.byPriority?.medium || 0,
        lowPriorityProposals: report.byPriority?.low || 0,
        proposalsRequireApproval: report.proposalsRequireApproval,
      };

    default:
      return null;
  }
}

/**
 * Generate pipeline report markdown
 */
function formatPipelineMarkdown(report) {
  let md = `# Infinite Brain Runtime — Pipeline Report\n\n`;
  md += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n`;
  md += `**Status:** ${report.status}\n\n`;

  md += `## Executive Summary\n\n`;
  md += `- **Timestamp:** ${report.timestamp}\n`;
  md += `- **Status:** ${report.status}\n`;
  md += `- **Total Duration:** ${report.durationMs}ms\n`;
  md += `- **Steps Completed:** ${report.steps.length}\n`;
  md += `- **Failed Steps:** ${report.failedSteps.length}\n\n`;

  if (report.failedSteps.length > 0) {
    md += `### ⚠ Failed Steps\n\n`;
    report.failedSteps.forEach((step) => {
      md += `- **${step.displayName}**: Exit code ${step.exitCode}\n`;
    });
    md += '\n';
  }

  md += `## Pipeline Steps\n\n`;
  report.steps.forEach((step, i) => {
    const status = step.success ? '✓' : '✗';
    md += `### ${i + 1}. ${status} ${step.displayName}\n\n`;
    md += `- **Duration:** ${step.durationMs}ms\n`;
    md += `- **Exit Code:** ${step.exitCode}\n`;
    md += `- **Status:** ${step.success ? 'SUCCESS' : 'FAILED'}\n`;
    md += `- **Report Generated:** ${step.reportGenerated ? 'Yes' : 'No'}\n`;

    if (step.metrics) {
      md += `\n**Metrics:**\n`;
      Object.entries(step.metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          md += `- ${key}: ${value}\n`;
        } else {
          md += `- ${key}: ${JSON.stringify(value)}\n`;
        }
      });
    }

    md += '\n';
  });

  md += `## Generated Reports\n\n`;
  report.generatedReportPaths.forEach((reportPath) => {
    const fileName = path.basename(reportPath);
    md += `- \`${fileName}\`\n`;
  });
  md += '\n';

  md += `## Summary Metrics\n\n`;
  md += `- **Atomizer:** ${report.summaryMetrics.atomizer.totalFilesAnalyzed} files analyzed\n`;
  md += `- **Classifier:** ${report.summaryMetrics.classifier.totalFilesAnalyzed} files classified (${report.summaryMetrics.classifier.avgConfidence}% avg confidence)\n`;
  md += `- **Edges:** ${report.summaryMetrics.edges.totalInferredEdges} edges inferred\n`;
  md += `- **Audit:** Health score ${report.summaryMetrics.relationships.healthScore}%\n`;
  md += `- **Insights:** ${report.summaryMetrics.insights.insightCount} insights generated\n`;
  md += `- **Proposals:** ${report.summaryMetrics.proposals.proposalsGenerated} generated (${report.summaryMetrics.proposals.highPriorityProposals} high priority)\n\n`;

  md += `## Safety & Determinism\n\n`;
  md += `- **Writes to Mind:** ${report.safety.writesToMind ? 'ON' : 'OFF'} ✓\n`;
  md += `- **Continuous Runtime:** ${report.safety.continuousRuntime ? 'ON' : 'OFF'} ✓\n`;
  md += `- **Model Calls:** ${report.safety.modelCalls ? 'YES' : 'NO'} ✓\n`;
  md += `- **Deterministic:** ${report.safety.deterministic ? 'YES' : 'NO'} ✓\n`;
  md += `- **Report Only:** ${report.safety.reportOnly ? 'YES' : 'NO'} ✓\n\n`;

  if (report.failedSteps.length > 0) {
    md += `## Failures\n\n`;
    report.failedSteps.forEach((step) => {
      md += `### ${step.displayName}\n\n`;
      md += `**Exit Code:** ${step.exitCode}\n\n`;
      if (step.stderr) {
        md += `**Error Output:**\n\`\`\`\n${step.stderr}\n\`\`\`\n\n`;
      }
    });
  }

  md += `## Next Recommended Action\n\n`;
  if (report.status === 'complete' && report.failedSteps.length === 0) {
    md += `All phases completed successfully. Next steps:\n`;
    md += `1. Review proposals in proposals-latest.json and proposals-latest.md\n`;
    md += `2. Update Brain Core status integration for proposals visibility\n`;
    md += `3. Update Console dashboard to show proposal summary\n`;
    md += `4. Create approval workflow for proposal execution\n`;
  } else if (report.failedSteps.length > 0) {
    md += `Fix failed phases before proceeding:\n`;
    report.failedSteps.forEach((step) => {
      md += `- ${step.displayName}\n`;
    });
  }

  md += '\n---\n\n';
  md += `*This is a report-only pipeline execution. No mutations, writes, or model calls were made.*\n`;

  return md;
}

/**
 * Main pipeline executor
 */
async function runPipeline() {
  const pipelineStart = Date.now();
  console.log('[IBR-Pipeline] Starting report-only pipeline execution...');
  console.log(`[IBR-Pipeline] Runtime dir: ${RUNTIME_DIR}`);
  console.log(`[IBR-Pipeline] Executing ${PHASES.length} phases (no shell execution)...\n`);

  await fs.mkdir(RUNTIME_DIR, { recursive: true });

  const steps = [];
  const failedSteps = [];
  const generatedReportPaths = [];

  for (let i = 0; i < PHASES.length; i++) {
    const phase = PHASES[i];
    console.log(`[IBR-Pipeline] [${i + 1}/${PHASES.length}] Executing ${phase.displayName}...`);

    const result = await executePhase(phase.fn);
    const stepDuration = result.durationMs;

    // Extract metrics if phase succeeded
    let metrics = null;
    let reportGenerated = false;
    if (result.success) {
      metrics = await extractPhaseMetrics(phase);
      reportGenerated = await loadReport(path.join(RUNTIME_DIR, phase.outputFile)) !== null;
      if (reportGenerated) {
        generatedReportPaths.push(path.join(RUNTIME_DIR, phase.outputFile));
        generatedReportPaths.push(path.join(RUNTIME_DIR, phase.outputFile.replace('.json', '.md')));
      }
    }

    const step = {
      name: phase.name,
      displayName: phase.displayName,
      success: result.success,
      exitCode: result.exitCode,
      durationMs: stepDuration,
      metrics,
      reportGenerated,
    };

    steps.push(step);

    if (!result.success) {
      failedSteps.push({
        ...step,
        stderr: '(error occurred in direct function call)',
      });
      console.error(`[IBR-Pipeline] ✗ ${phase.displayName} failed with exit code ${result.exitCode}`);
    } else {
      console.log(`[IBR-Pipeline] ✓ ${phase.displayName} completed in ${stepDuration}ms`);
    }
  }

  const pipelineDuration = Date.now() - pipelineStart;

  // Compile summary metrics
  const summaryMetrics = {
    atomizer: steps[0]?.metrics || {},
    classifier: steps[1]?.metrics || {},
    edges: steps[2]?.metrics || {},
    relationships: steps[3]?.metrics || {},
    insights: steps[4]?.metrics || {},
    proposals: steps[5]?.metrics || {},
  };

  // Generate pipeline report
  const pipelineReport = {
    timestamp: new Date().toISOString(),
    status: failedSteps.length === 0 ? 'complete' : 'partial',
    durationMs: pipelineDuration,
    steps,
    failedSteps,
    generatedReportPaths,
    summaryMetrics,
    safety: {
      writesToMind: false,
      continuousRuntime: false,
      modelCalls: false,
      deterministic: true,
      reportOnly: true,
    },
  };

  // Format and write reports
  const markdown = formatPipelineMarkdown(pipelineReport);

  const jsonPath = path.join(RUNTIME_DIR, 'pipeline-latest.json');
  const mdPath = path.join(RUNTIME_DIR, 'pipeline-latest.md');

  await fs.writeFile(jsonPath, JSON.stringify(pipelineReport, null, 2), 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');

  console.log(`\n[IBR-Pipeline] Pipeline execution complete!`);
  console.log(`[IBR-Pipeline] Total duration: ${pipelineDuration}ms`);
  console.log(`[IBR-Pipeline] Steps completed: ${steps.length}`);
  console.log(`[IBR-Pipeline] Failed steps: ${failedSteps.length}`);
  console.log(`[IBR-Pipeline] Status: ${pipelineReport.status}`);

  console.log(`\n[IBR-Pipeline] Reports saved:`);
  console.log(`  JSON: ${jsonPath}`);
  console.log(`  Markdown: ${mdPath}`);

  console.log(`\n[IBR-Pipeline] Summary:`);
  console.log(`  Atomizer: ${summaryMetrics.atomizer.totalFilesAnalyzed || 'N/A'} files analyzed`);
  console.log(`  Classifier: ${summaryMetrics.classifier.totalFilesAnalyzed || 'N/A'} files classified`);
  console.log(`  Edges: ${summaryMetrics.edges.totalInferredEdges || 'N/A'} edges inferred`);
  console.log(`  Audit Health: ${summaryMetrics.relationships.healthScore || 'N/A'}%`);
  console.log(`  Insights: ${summaryMetrics.insights.insightCount || 'N/A'} generated`);
  console.log(`  Proposals: ${summaryMetrics.proposals.proposalsGenerated || 'N/A'} generated (${summaryMetrics.proposals.highPriorityProposals || 0} high priority)`);

  if (failedSteps.length === 0) {
    console.log(`\n✓ Report-only pipeline execution succeeded`);
    return { success: true, report: pipelineReport };
  } else {
    console.error(`\n✗ Pipeline had ${failedSteps.length} failed step(s)`);
    return { success: false, report: pipelineReport };
  }
}

// Execute
runPipeline().then((result) => {
  process.exit(result.success ? 0 : 1);
});
