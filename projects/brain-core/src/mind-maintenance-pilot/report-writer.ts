import { mkdir, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { renderMindMaintenanceReportMarkdown } from './markdown-report-renderer.js';
import {
  MIND_MAINTENANCE_REPORT_OUTPUTS,
  type LoadedMindMaintenancePilotDataset,
} from './pilot-file-loader.js';
import { assertValidMaintenanceReport } from './report-schema-validator.js';
import type { MaintenanceReport } from './types.js';

export interface MindMaintenanceReportWriteInput {
  dataset: LoadedMindMaintenancePilotDataset;
  report: MaintenanceReport;
}

export interface MindMaintenanceReportWriteResult {
  jsonPath: string;
  markdownPath: string;
  reportId: string;
  bytesWritten: {
    json: number;
    markdown: number;
  };
}

function assertOutputPath(mindRoot: string, relativePath: string): string {
  if (!MIND_MAINTENANCE_REPORT_OUTPUTS.includes(relativePath as never)) {
    throw new Error(`Mind maintenance writer rejected output path: ${relativePath}`);
  }

  const absolutePath = path.resolve(mindRoot, relativePath);
  const relativeFromRoot = path.relative(mindRoot, absolutePath);

  if (
    relativeFromRoot.startsWith('..')
    || path.isAbsolute(relativeFromRoot)
    || relativeFromRoot.split(path.sep).includes('..')
  ) {
    throw new Error(`Mind maintenance output escapes the repository root: ${relativePath}`);
  }

  return absolutePath;
}

async function writeAtomic(targetPath: string, content: string): Promise<number> {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  const handle = await open(temporaryPath, 'wx');

  try {
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, targetPath);
    return Buffer.byteLength(content, 'utf8');
  } catch (error) {
    await handle.close().catch(() => undefined);
    await rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

function assertReportMatchesDataset(
  dataset: LoadedMindMaintenancePilotDataset,
  report: MaintenanceReport,
): void {
  const datasetPaths = dataset.files.map((file) => file.path).sort();
  const reportPaths = [...report.filesConsidered].sort();

  if (datasetPaths.length !== reportPaths.length) {
    throw new Error('Mind maintenance report file count does not match the loaded dataset.');
  }

  for (let index = 0; index < datasetPaths.length; index += 1) {
    if (datasetPaths[index] !== reportPaths[index]) {
      throw new Error('Mind maintenance report paths do not match the loaded dataset.');
    }
  }
}

export async function writeMindMaintenanceLatestReports(
  input: MindMaintenanceReportWriteInput,
): Promise<MindMaintenanceReportWriteResult> {
  assertValidMaintenanceReport(input.report);
  assertReportMatchesDataset(input.dataset, input.report);

  const [jsonRelativePath, markdownRelativePath] = MIND_MAINTENANCE_REPORT_OUTPUTS;
  const jsonPath = assertOutputPath(input.dataset.mindRoot, jsonRelativePath);
  const markdownPath = assertOutputPath(input.dataset.mindRoot, markdownRelativePath);

  const jsonContent = `${JSON.stringify(input.report, null, 2)}\n`;
  const markdownContent = renderMindMaintenanceReportMarkdown(input.report);

  const jsonBytes = await writeAtomic(jsonPath, jsonContent);

  try {
    const markdownBytes = await writeAtomic(markdownPath, markdownContent);

    return {
      jsonPath,
      markdownPath,
      reportId: input.report.reportId,
      bytesWritten: {
        json: jsonBytes,
        markdown: markdownBytes,
      },
    };
  } catch (error) {
    throw new Error(
      `Mind maintenance report write incomplete after JSON replacement: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}
