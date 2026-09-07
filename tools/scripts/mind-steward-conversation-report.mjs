#!/usr/bin/env node

import path from 'node:path';
import { buildConversationEvidenceReport, readConversationEvidenceFile, writeConversationEvidenceReport } from './mind-steward-conversation-evidence.mjs';

const repoRoot = process.env.MIND_STEWARD_REPO_ROOT ?? process.cwd();
const input = process.argv[2];
if (!input) throw new Error('usage: node mind-steward-conversation-report.mjs <runtime-local-evidence-file>');

const evidence = readConversationEvidenceFile({ repoRoot, filePath: path.resolve(input) });
const report = buildConversationEvidenceReport({
  events: evidence.candidate_insights,
  generatedAt: process.env.CLR5_AS_OF ?? new Date().toISOString(),
});
const output = writeConversationEvidenceReport({ report, repoRoot });
process.stdout.write(`${JSON.stringify({ output, report }, null, 2)}\n`);
