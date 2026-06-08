#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Entity Classifier Dry-Run
 * Analyzes Mind vault files for entity type classification
 * Report-only: no writes, no metadata changes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { readdir } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const MIND_VAULT_PATH = process.env.MIND_VAULT_PATH ||
  (process.env.HOME ? path.resolve(process.env.HOME, 'Repos/stevewesthoek/mind') :
   path.resolve(__dirname, '../../mind'));
const OUTPUT_DIR = path.resolve(__dirname, '../../runtime/local/infinite-brain');

// 16-type entity vocabulary (NotebookLM standard)
const ENTITY_TYPES = [
  'Pillar',
  'Decision',
  'Concept',
  'Question',
  'Playbook',
  'Task',
  'Event',
  'Pattern',
  'Hypothesis',
  'Fact',
  'Source',
  'Bookmark',
  'Note',
  'Contact',
  'Reference',
  'Custom',
];

// Folder-to-type heuristics
const FOLDER_TO_TYPE = {
  '04-tasks': 'Task',
  '02-strategy': 'Decision',
  '03-projects': 'Reference',
  '07-wiki': 'Concept',
  '06-resources': 'Source',
  '05-areas': 'Pillar',
  '08-live': 'Note',
  '01-inbox': 'Note',
  '09-router': 'Concept',
  '10-system': 'Reference',
};

// Keyword-based classifier
function classifyByKeywords(content, filePath, existingType) {
  if (existingType) return existingType; // Preserve existing type

  const contentLower = content.toLowerCase();
  const relPath = filePath.toLowerCase();

  // Task indicators
  if (/\btask\b|@todo|@done|\[x\]|\[ \]/.test(contentLower)) return 'Task';

  // Decision indicators
  if (/\bdecision\b|concluded|chose|decided|recommendation/.test(contentLower)) return 'Decision';

  // Question indicators
  if (/\bquestion\b|\?|\bhow\b|\bwhy\b|\bwhat\b/.test(contentLower.slice(0, 200))) return 'Question';

  // Pattern indicators
  if (/\bpattern\b|observed|tendency|trend|consistently/.test(contentLower)) return 'Pattern';

  // Hypothesis indicators
  if (/\bhypothesis\b|predict|assume|suppose|theory/.test(contentLower)) return 'Hypothesis';

  // Source indicators
  if (/\bsource\b|paper|book|article|research|study|reference|url|http/.test(contentLower)) return 'Source';

  // Contact indicators
  if (/\bperson\b|contact|person|@|email|phone/.test(contentLower)) return 'Contact';

  // Event indicators
  if (/\bevent\b|happened|occurred|date|when/.test(contentLower)) return 'Event';

  // Default to Concept or Note based on content length
  const lines = content.split('\n').length;
  return lines > 300 ? 'Concept' : 'Note';
}

/**
 * Extract entity metadata from frontmatter
 */
async function extractMetadata(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    const metadata = {
      hasTitle: false,
      hasType: false,
      hasStatus: false,
      title: null,
      existingType: null,
      status: null,
    };

    if (!frontmatterMatch) return { ...metadata, content };

    const frontmatterText = frontmatterMatch[1];

    const titleMatch = frontmatterText.match(/^title:\s*(.+)$/m);
    if (titleMatch) {
      metadata.title = titleMatch[1].trim().replace(/^["']|["']$/g, '');
      metadata.hasTitle = true;
    }

    const typeMatch = frontmatterText.match(/^type:\s*(.+)$/m);
    if (typeMatch) {
      metadata.existingType = typeMatch[1].trim();
      metadata.hasType = true;
    }

    const statusMatch = frontmatterText.match(/^status:\s*(.+)$/m);
    if (statusMatch) {
      metadata.status = statusMatch[1].trim();
      metadata.hasStatus = true;
    }

    return { ...metadata, content };
  } catch {
    return {
      hasTitle: false,
      hasType: false,
      hasStatus: false,
      title: null,
      existingType: null,
      status: null,
      content: '',
    };
  }
}

/**
 * Classify a single file
 */
async function classifyFile(filePath, relPath) {
  try {
    const metadata = await extractMetadata(filePath);
    const content = metadata.content;

    // Extract title if not in frontmatter
    let title = metadata.title;
    if (!title) {
      const firstLine = content.split('\n').find((line) => line.trim() && !line.startsWith('#'));
      title = firstLine?.substring(0, 50) || path.basename(filePath, '.md');
    }

    // Extract one-sentence summary (first sentence of content)
    const contentLines = content.split('\n').slice(5); // Skip frontmatter
    let summary = '';
    for (const line of contentLines) {
      if (line.trim() && !line.startsWith('#')) {
        summary = line.substring(0, 100);
        break;
      }
    }

    // Classify entity type
    const inferredType = classifyByKeywords(content, relPath, metadata.existingType);

    // Estimate confidence (0.0–1.0)
    let confidence = 0.6; // Default
    if (metadata.existingType) {
      confidence = 0.95; // High confidence if already classified
    } else if (/^04-tasks/.test(relPath) || /\[x\]/.test(content)) {
      confidence = 0.9;
    } else if (/^02-strategy/.test(relPath)) {
      confidence = 0.85;
    } else if (/^07-wiki/.test(relPath)) {
      confidence = 0.8;
    }

    // Check if atomization needed
    const lines = content.split('\n').length;
    const needsAtomization = lines > 300;

    return {
      path: relPath,
      fileName: path.basename(filePath),
      title: title || '(untitled)',
      summary: summary || '(no summary available)',
      existingType: metadata.existingType,
      inferredType,
      confidence,
      needsAtomization,
      lines,
      hasStatus: metadata.hasStatus,
      status: metadata.status,
      suggestions: {
        setType: !metadata.hasType ? inferredType : null,
        setStatus: !metadata.hasStatus ? 'active' : null,
      },
    };
  } catch {
    return null;
  }
}

/**
 * Recursively scan vault
 */
async function scanVault(dir, baseDir = '', results = []) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      const relPath = path.join(baseDir, entry.name);

      if (entry.isDirectory()) {
        await scanVault(fullPath, relPath, results);
      } else if (entry.name.endsWith('.md') && !entry.name.startsWith('_')) {
        const classification = await classifyFile(fullPath, relPath);
        if (classification) {
          results.push(classification);
        }
      }
    }
  } catch (err) {
    console.error(`Scan error in ${dir}:`, err.message);
  }

  return results;
}

/**
 * Generate classifier report
 */
async function generateReport(classifications) {
  const timestamp = new Date().toISOString();

  // Categorize by type
  const byType = {};
  ENTITY_TYPES.forEach((t) => {
    byType[t] = classifications.filter((c) => c.inferredType === t);
  });

  // Summary statistics
  const totalClassified = classifications.length;
  const withExistingType = classifications.filter((c) => c.existingType).length;
  const needsAtomization = classifications.filter((c) => c.needsAtomization).length;
  const avgConfidence = classifications.reduce((sum, c) => sum + c.confidence, 0) / totalClassified;

  const report = {
    timestamp,
    vaultPath: MIND_VAULT_PATH,
    summary: {
      totalFilesAnalyzed: totalClassified,
      withExistingType,
      inferred: totalClassified - withExistingType,
      needsAtomization,
      avgConfidence: parseFloat(avgConfidence.toFixed(3)),
    },
    byType: Object.entries(byType).reduce((acc, [type, items]) => {
      if (items.length > 0) {
        acc[type] = {
          count: items.length,
          items: items.map((c) => ({
            path: c.path,
            title: c.title,
            confidence: c.confidence,
          })),
        };
      }
      return acc;
    }, {}),
    candidates: classifications.filter((c) => !c.existingType).slice(0, 50),
  };

  return report;
}

/**
 * Format report as markdown
 */
function formatReportMarkdown(report) {
  let md = `# Infinite Brain Entity Classifier Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n`;
  md += `**Vault:** ${report.vaultPath}\n\n`;

  md += `## Summary\n\n`;
  md += `- Total files analyzed: **${report.summary.totalFilesAnalyzed}**\n`;
  md += `- With existing type: **${report.summary.withExistingType}**\n`;
  md += `- Inferred type: **${report.summary.inferred}**\n`;
  md += `- Needs atomization: **${report.summary.needsAtomization}**\n`;
  md += `- Average classification confidence: **${(report.summary.avgConfidence * 100).toFixed(1)}%**\n\n`;

  md += `## Distribution by Entity Type\n\n`;
  Object.entries(report.byType).forEach(([type, data]) => {
    md += `### ${type} (${data.count})\n\n`;
    data.items.slice(0, 3).forEach((item) => {
      md += `- ${item.path} — "${item.title}" (confidence: ${(item.confidence * 100).toFixed(0)}%)\n`;
    });
    if (data.items.length > 3) {
      md += `- ... and ${data.items.length - 3} more\n`;
    }
    md += `\n`;
  });

  if (report.candidates.length > 0) {
    md += `## Unclassified Candidates (First 50)\n\n`;
    md += `Files without existing type, suggested for classification:\n\n`;
    report.candidates.forEach((c) => {
      md += `- **${c.path}** → Suggest: **${c.inferredType}** (${(c.confidence * 100).toFixed(0)}% confidence)\n`;
      md += `  - Title: ${c.title}\n`;
      md += `  - Atomization: ${c.needsAtomization ? 'Yes' : 'No'}\n`;
    });
  }

  md += `\n---\n\n`;
  md += `*This is a report-only analysis. No files were modified or classified.*\n`;

  return md;
}

/**
 * Save reports
 */
async function saveReports(jsonReport, markdown) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const jsonPath = path.join(OUTPUT_DIR, 'entity-classifier-latest.json');
  const mdPath = path.join(OUTPUT_DIR, 'entity-classifier-latest.md');

  await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');

  return { jsonPath, mdPath };
}

/**
 * Main
 */
async function main() {
  console.log('[IB-Classifier] Starting dry-run analysis...');
  console.log(`[IB-Classifier] Vault path: ${MIND_VAULT_PATH}`);
  console.log(`[IB-Classifier] Output dir: ${OUTPUT_DIR}`);

  const startTime = Date.now();

  try {
    // Scan vault
    console.log('[IB-Classifier] Scanning files...');
    const classifications = await scanVault(MIND_VAULT_PATH);

    // Generate report
    console.log(`[IB-Classifier] Classified ${classifications.length} files`);
    const report = await generateReport(classifications);

    // Format markdown
    const markdown = formatReportMarkdown(report);

    // Save reports
    const { jsonPath, mdPath } = await saveReports(report, markdown);

    console.log(`[IB-Classifier] Reports saved:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}`);

    console.log(`[IB-Classifier] Summary:`);
    console.log(`  Total files: ${report.summary.totalFilesAnalyzed}`);
    console.log(`  With existing type: ${report.summary.withExistingType}`);
    console.log(`  Inferred: ${report.summary.inferred}`);
    console.log(`  Needs atomization: ${report.summary.needsAtomization}`);
    console.log(`  Avg confidence: ${(report.summary.avgConfidence * 100).toFixed(1)}%`);

    const elapsed = Date.now() - startTime;
    console.log(`[IB-Classifier] Completed in ${elapsed}ms`);

    return { success: true, report };
  } catch (error) {
    console.error(`[IB-Classifier] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
