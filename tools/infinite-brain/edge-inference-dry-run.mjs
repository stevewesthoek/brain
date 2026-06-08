#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Edge Inference Dry-Run
 * Analyzes entities for typed relationship inference
 * Report-only: no edges written, no graph mutations
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CLASSIFIER_REPORT_PATH = process.env.CLASSIFIER_REPORT_PATH ||
  path.resolve(__dirname, '../../runtime/local/infinite-brain/entity-classifier-latest.json');
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
 * Load classifier report
 */
async function loadClassifierReport() {
  try {
    const content = await fs.readFile(CLASSIFIER_REPORT_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load classifier report from ${CLASSIFIER_REPORT_PATH}`);
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Normalize text into a deterministic set of tokens
 */
function tokenSet(text) {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s\-_./\\]+/)
      .filter(t => t.length > 2)
  );
}

/**
 * Calculate Jaccard similarity between two token sets
 */
function jaccardSimilarity(setA, setB) {
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Infer edges between entities (deterministic heuristics, no model calls)
 */
function inferEdges(entities) {
  const edges = [];
  const entityMap = new Map();

  // Build entity map by type for fast lookup
  entities.forEach((e) => {
    if (!entityMap.has(e.inferredType)) {
      entityMap.set(e.inferredType, []);
    }
    entityMap.get(e.inferredType).push(e);
  });

  // Rule 1: Concepts in same path segment may be related_to
  const pathSegmentMap = new Map();
  entities.forEach((e) => {
    const segment = e.path.split('/')[0];
    if (!pathSegmentMap.has(segment)) {
      pathSegmentMap.set(segment, []);
    }
    pathSegmentMap.get(segment).push(e);
  });

  pathSegmentMap.forEach((sameSegmentEntities) => {
    for (let i = 0; i < sameSegmentEntities.length; i++) {
      for (let j = i + 1; j < sameSegmentEntities.length; j++) {
        const e1 = sameSegmentEntities[i];
        const e2 = sameSegmentEntities[j];

        // Only infer between Concepts/Notes in same folder
        if ((e1.inferredType === 'Concept' || e1.inferredType === 'Note') &&
            (e2.inferredType === 'Concept' || e2.inferredType === 'Note')) {
          edges.push({
            sourceId: e1.path,
            targetId: e2.path,
            edgeType: 'related_to',
            confidence: 0.4,
            reasoning: 'Same folder proximity',
          });
        }
      }
    }
  });

  // Rule 2: Tasks depend_on Projects or Decisions
  const projects = entityMap.get('Reference') || [];
  const decisions = entityMap.get('Decision') || [];
  const tasks = entityMap.get('Task') || [];

  tasks.forEach((task) => {
    projects.forEach((proj) => {
      edges.push({
        sourceId: task.path,
        targetId: proj.path,
        edgeType: 'depends_on',
        confidence: 0.6,
        reasoning: 'Task likely depends on project context',
      });
    });

    decisions.forEach((decision) => {
      if (task.path !== decision.path) {
        edges.push({
          sourceId: task.path,
          targetId: decision.path,
          edgeType: 'depends_on',
          confidence: 0.5,
          reasoning: 'Task possibly informed by prior decision',
        });
      }
    });
  });

  // Rule 3: Sources can be derived_from when file paths or summaries overlap.
  // Keep this deterministic: dry-run reports must be reproducible and must not
  // sample random edges.
  const sources = entityMap.get('Source') || [];
  sources.forEach((source) => {
    const sourceTokens = tokenSet(`${source.path} ${source.summary || ''}`);
    entities
      .filter((e) => e.inferredType !== 'Source' && e !== source)
      .forEach((other) => {
        const otherTokens = tokenSet(`${other.path} ${other.summary || ''}`);
        const overlap = jaccardSimilarity(sourceTokens, otherTokens);
        if (overlap >= 0.15) {
          edges.push({
            sourceId: other.path,
            targetId: source.path,
            edgeType: 'derived_from',
            confidence: Math.min(0.75, 0.45 + overlap),
            reasoning: 'Deterministic source/entity token overlap',
          });
        }
      });
  });

  // Rule 4: Questions derive from Concepts or Decisions
  const questions = entityMap.get('Question') || [];
  const concepts = entityMap.get('Concept') || [];
  questions.forEach((question) => {
    [...concepts, ...decisions].forEach((entity) => {
      edges.push({
        sourceId: question.path,
        targetId: entity.path,
        edgeType: 'derived_from',
        confidence: 0.55,
        reasoning: 'Question motivated by concept or decision',
      });
    });
  });

  // Remove duplicates (same source/target/type)
  const seen = new Set();
  const uniqueEdges = [];
  edges.forEach((edge) => {
    const key = `${edge.sourceId}--${edge.edgeType}--${edge.targetId}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEdges.push(edge);
    }
  });

  return uniqueEdges;
}

/**
 * Generate edge inference report
 */
async function generateReport(classifierReport) {
  const timestamp = new Date().toISOString();

  // Extract entities from classifier report
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

  // Infer edges
  console.log(`[IB-Inference] Inferring edges from ${entities.length} entities...`);
  const edges = inferEdges(entities);

  // Categorize edges by type
  const byEdgeType = {};
  EDGE_TYPES.forEach((t) => {
    byEdgeType[t] = edges.filter((e) => e.edgeType === t);
  });

  // Filter high-confidence edges for candidates
  const candidates = edges
    .filter((e) => e.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 100);

  const report = {
    timestamp,
    summary: {
      totalEntities: entities.length,
      totalInferredEdges: edges.length,
      highConfidenceEdges: edges.filter((e) => e.confidence >= 0.75).length,
      candidates: candidates.length,
    },
    byEdgeType: Object.entries(byEdgeType).reduce((acc, [type, items]) => {
      if (items.length > 0) {
        acc[type] = {
          count: items.length,
          avgConfidence: parseFloat(
            (items.reduce((sum, e) => sum + e.confidence, 0) / items.length).toFixed(3)
          ),
        };
      }
      return acc;
    }, {}),
    candidates: candidates.map((e) => ({
      source: e.sourceId,
      target: e.targetId,
      edgeType: e.edgeType,
      confidence: e.confidence,
      reasoning: e.reasoning,
    })),
  };

  return { report, allEdges: edges };
}

/**
 * Format report as markdown
 */
function formatReportMarkdown(report, allEdges) {
  let md = `# Infinite Brain Edge Inference Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n\n`;

  md += `## Summary\n\n`;
  md += `- Total entities analyzed: **${report.summary.totalEntities}**\n`;
  md += `- Total inferred edges: **${report.summary.totalInferredEdges}**\n`;
  md += `- High-confidence edges (≥0.75): **${report.summary.highConfidenceEdges}**\n`;
  md += `- Candidates for review (≥0.50): **${report.summary.candidates}**\n\n`;

  md += `## Edge Type Distribution\n\n`;
  Object.entries(report.byEdgeType).forEach(([type, data]) => {
    md += `- **${type}**: ${data.count} edges (avg confidence: ${(data.avgConfidence * 100).toFixed(0)}%)\n`;
  });

  md += `\n## Top Candidates for Edge Creation\n\n`;
  md += `*These edges are above the confidence threshold and ready for review.*\n`;
  md += `*No edges have been created; this is a report-only recommendation.*\n\n`;

  report.candidates.slice(0, 50).forEach((edge, i) => {
    md += `${i + 1}. **${edge.edgeType}**: "${edge.source}" → "${edge.target}"\n`;
    md += `   - Confidence: ${(edge.confidence * 100).toFixed(0)}%\n`;
    md += `   - Reasoning: ${edge.reasoning}\n\n`;
  });

  if (report.candidates.length > 50) {
    md += `*... and ${report.candidates.length - 50} more candidates*\n\n`;
  }

  md += `---\n\n`;
  md += `*This is a report-only analysis. No edges have been created or stored.*\n`;

  return md;
}

/**
 * Save reports
 */
async function saveReports(jsonReport, markdown) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const jsonPath = path.join(OUTPUT_DIR, 'edge-inference-latest.json');
  const mdPath = path.join(OUTPUT_DIR, 'edge-inference-latest.md');

  await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');

  return { jsonPath, mdPath };
}

/**
 * Main
 */
async function main() {
  console.log('[IB-Inference] Starting edge inference dry-run...');
  console.log(`[IB-Inference] Classifier report: ${CLASSIFIER_REPORT_PATH}`);
  console.log(`[IB-Inference] Output dir: ${OUTPUT_DIR}`);

  const startTime = Date.now();

  try {
    // Load classifier report
    console.log('[IB-Inference] Loading classifier report...');
    const classifierReport = await loadClassifierReport();

    // Generate inferences
    const { report, allEdges } = await generateReport(classifierReport);

    // Format markdown
    const markdown = formatReportMarkdown(report, allEdges);

    // Save reports
    const { jsonPath, mdPath } = await saveReports(report, markdown);

    console.log(`[IB-Inference] Reports saved:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}`);

    console.log(`[IB-Inference] Summary:`);
    console.log(`  Total entities: ${report.summary.totalEntities}`);
    console.log(`  Total inferred edges: ${report.summary.totalInferredEdges}`);
    console.log(`  High-confidence: ${report.summary.highConfidenceEdges}`);
    console.log(`  Candidates: ${report.summary.candidates}`);

    const elapsed = Date.now() - startTime;
    console.log(`[IB-Inference] Completed in ${elapsed}ms`);

    return { success: true, report };
  } catch (error) {
    console.error(`[IB-Inference] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
