#!/usr/bin/env node

/**
 * Infinite Brain Runtime — Atomizer Dry-Run
 * Analyzes files in Mind vault for atomization candidates
 * Report-only: no writes, no file moves
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
const MAX_LINES_FOR_ATOMIC = 300;
const MIN_LINES_FOR_SPLIT = 500;

// Entity types vocabulary (16 NotebookLM types)
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

/**
 * Extract entity metadata from frontmatter
 */
async function extractFrontmatter(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

    if (!frontmatterMatch) return null;

    const frontmatterText = frontmatterMatch[1];
    const metadata = {};

    const titleMatch = frontmatterText.match(/^title:\s*(.+)$/m);
    if (titleMatch) metadata.title = titleMatch[1].trim().replace(/^["']|["']$/g, '');

    const typeMatch = frontmatterText.match(/^type:\s*(.+)$/m);
    if (typeMatch) metadata.type = typeMatch[1].trim().toLowerCase();

    const statusMatch = frontmatterText.match(/^status:\s*(.+)$/m);
    if (statusMatch) metadata.status = statusMatch[1].trim();

    return metadata;
  } catch {
    return null;
  }
}

/**
 * Analyze a single file for atomization
 */
async function analyzeFile(filePath, relPath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    const totalLines = lines.length;

    // Skip if too short to split
    if (totalLines < MIN_LINES_FOR_SPLIT) {
      return null;
    }

    const metadata = await extractFrontmatter(filePath);
    if (!metadata) return null;

    // Extract one-sentence summary (first non-empty line after frontmatter)
    const contentStart = content.indexOf('\n---\n') + 5;
    const contentAfterFm = content.substring(contentStart).trim();
    const firstSentence = contentAfterFm.split('\n')[0] || '';

    // Estimate split boundaries by looking for heading markers
    const headingLines = lines
      .map((line, i) => (line.match(/^#{1,6}\s/) ? i : null))
      .filter((i) => i !== null);

    // Group sections between headings
    const sections = [];
    for (let i = 0; i < headingLines.length; i++) {
      const start = headingLines[i];
      const end = i + 1 < headingLines.length ? headingLines[i + 1] : lines.length;
      const heading = lines[start].replace(/^#+\s/, '').trim();
      const sectionLength = end - start;

      sections.push({
        heading,
        startLine: start,
        endLine: end,
        length: sectionLength,
      });
    }

    // Determine atomization recommendation
    let recommendation = 'keep_atomic';
    if (totalLines > MAX_LINES_FOR_ATOMIC) {
      recommendation = 'consider_split';
    }

    return {
      path: relPath,
      fileName: path.basename(filePath),
      totalLines,
      metadata,
      firstSentence: firstSentence.substring(0, 100),
      sections: sections.map((s) => ({
        heading: s.heading,
        lines: s.length,
      })),
      recommendation,
      rationale:
        totalLines > MAX_LINES_FOR_ATOMIC
          ? `File has ${totalLines} lines (exceeds ${MAX_LINES_FOR_ATOMIC} max for atomic). Consider splitting by section or concept.`
          : `File is within atomic note limits (${totalLines} lines).`,
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
        const analysis = await analyzeFile(fullPath, relPath);
        if (analysis) {
          results.push(analysis);
        }
      }
    }
  } catch (err) {
    console.error(`Scan error in ${dir}:`, err.message);
  }

  return results;
}

/**
 * Generate atomizer report
 */async function generateReport(analyses) {
  const timestamp = new Date().toISOString();

  // Categorize by recommendation
  const keepAtomic = analyses.filter((a) => a.recommendation === 'keep_atomic');
  const considerSplit = analyses.filter((a) => a.recommendation === 'consider_split');

  const report = {
    timestamp,
    vaultPath: MIND_VAULT_PATH,
    summary: {
      totalFilesAnalyzed: analyses.length,
      keepAtomic: keepAtomic.length,
      considerSplit: considerSplit.length,
    },
    candidates: considerSplit.map((a) => ({
      path: a.path,
      fileName: a.fileName,
      totalLines: a.totalLines,
      type: a.metadata.type || 'note',
      title: a.metadata.title || '(untitled)',
      sections: a.sections,
      recommendation: a.recommendation,
      rationale: a.rationale,
    })),
    statistics: {
      avgLinesPerFile: Math.round(analyses.reduce((sum, a) => sum + a.totalLines, 0) / analyses.length),
      maxLines: Math.max(...analyses.map((a) => a.totalLines)),
      minLines: Math.min(...analyses.map((a) => a.totalLines)),
    },
  };

  return report;
}

/**
 * Format report as markdown
 */
function formatReportMarkdown(report) {
  let md = `# Infinite Brain Atomizer Report\n\n`;
  md += `**Generated:** ${report.timestamp}\n`;
  md += `**Vault:** ${report.vaultPath}\n\n`;

  md += `## Summary\n\n`;
  md += `- Total files analyzed: **${report.summary.totalFilesAnalyzed}**\n`;
  md += `- Atomic (≤${MAX_LINES_FOR_ATOMIC} lines): **${report.summary.keepAtomic}**\n`;
  md += `- Candidates for splitting (>${MAX_LINES_FOR_ATOMIC} lines): **${report.summary.considerSplit}**\n\n`;

  if (report.candidates.length > 0) {
    md += `## Atomization Candidates\n\n`;
    md += `Files that exceed ${MAX_LINES_FOR_ATOMIC} lines and should be considered for splitting:\n\n`;

    report.candidates.forEach((c) => {
      md += `### ${c.path}\n\n`;
      md += `- **Type:** ${c.type}\n`;
      md += `- **Title:** ${c.title}\n`;
      md += `- **Lines:** ${c.totalLines}\n`;
      md += `- **Sections:** ${c.sections.length}\n`;
      md += `- **Rationale:** ${c.rationale}\n\n`;

      if (c.sections.length > 0) {
        md += `**Sections:**\n`;
        c.sections.forEach((s) => {
          md += `- ${s.heading} (${s.lines} lines)\n`;
        });
        md += `\n`;
      }
    });
  } else {
    md += `## ✓ No candidates for splitting\n\n`;
    md += `All analyzed files are within atomic note guidelines.\n`;
  }

  md += `## Statistics\n\n`;
  md += `- Average lines per file: ${report.statistics.avgLinesPerFile}\n`;
  md += `- Largest file: ${report.statistics.maxLines} lines\n`;
  md += `- Smallest file: ${report.statistics.minLines} lines\n\n`;

  md += `---\n\n`;
  md += `*This is a report-only analysis. No files were modified or moved.*\n`;

  return md;
}

/**
 * Save reports
 */
async function saveReports(jsonReport, markdown) {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const jsonPath = path.join(OUTPUT_DIR, 'atomizer-latest.json');
  const mdPath = path.join(OUTPUT_DIR, 'atomizer-latest.md');

  await fs.writeFile(jsonPath, JSON.stringify(jsonReport, null, 2), 'utf8');
  await fs.writeFile(mdPath, markdown, 'utf8');

  return { jsonPath, mdPath };
}

/**
 * Main
 */
async function main() {
  console.log('[IB-Atomizer] Starting dry-run analysis...');
  console.log(`[IB-Atomizer] Vault path: ${MIND_VAULT_PATH}`);
  console.log(`[IB-Atomizer] Output dir: ${OUTPUT_DIR}`);

  const startTime = Date.now();

  try {
    // Scan vault
    console.log('[IB-Atomizer] Scanning files...');
    const analyses = await scanVault(MIND_VAULT_PATH);

    // Generate report
    console.log(`[IB-Atomizer] Analyzed ${analyses.length} files`);
    const report = await generateReport(analyses);

    // Format markdown
    const markdown = formatReportMarkdown(report);

    // Save reports
    const { jsonPath, mdPath } = await saveReports(report, markdown);

    console.log(`[IB-Atomizer] Reports saved:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${mdPath}`);

    console.log(`[IB-Atomizer] Summary:`);
    console.log(`  Total files: ${report.summary.totalFilesAnalyzed}`);
    console.log(`  Keep atomic: ${report.summary.keepAtomic}`);
    console.log(`  Split candidates: ${report.summary.considerSplit}`);

    const elapsed = Date.now() - startTime;
    console.log(`[IB-Atomizer] Completed in ${elapsed}ms`);

    return { success: true, report };
  } catch (error) {
    console.error(`[IB-Atomizer] Fatal error: ${error.message}`);
    process.exit(1);
  }
}

main();
