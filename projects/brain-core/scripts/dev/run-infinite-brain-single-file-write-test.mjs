#!/usr/bin/env node
/**
 * Run the first controlled Infinite Brain single-file metadata write test through the API.
 *
 * This script does not edit the Mind file directly. It calls Brain Core API routes only:
 * 1. operator approval record
 * 2. iOS sync safety report generation
 * 3. single-file allowlisted metadata writer test write
 * 4. latest write report fetch
 */

import fs from 'node:fs';
import process from 'node:process';

const BASE = process.env.BRAIN_CORE_API_BASE ?? 'http://127.0.0.1:4877';
const TARGET_PATH =
  process.env.IBR_SINGLE_FILE_WRITE_TARGET ??
  '/Users/Office/Repos/stevewesthoek/mind/00_System/InfiniteBrainWriteTest.md';
const OPERATOR = process.env.IBR_OPERATOR ?? 'Steve';
const FIELD_NAME = process.env.IBR_WRITE_FIELD ?? 'status';
const VALUE = process.env.IBR_WRITE_VALUE ?? 'verified';

function fail(message, details) {
  console.error(`\n[write-test] FAILED: ${message}`);
  if (details !== undefined) {
    console.error(JSON.stringify(details, null, 2));
  }
  process.exit(1);
}

async function request(path, options = {}) {
  const url = `${BASE}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  return { response, body };
}

function assertReportIsSafe(report) {
  const required = {
    status: 'test-write-applied',
    wroteToMind: true,
    modifiedMind: true,
    testWriteApplied: true,
    applied: false,
    autonomousExecution: false,
    singleFileOnly: true,
    allowlistedOnly: true,
  };

  for (const [key, expected] of Object.entries(required)) {
    if (report?.[key] !== expected) {
      fail(`report.${key} expected ${String(expected)} but received ${String(report?.[key])}`, report);
    }
  }

  if (!report.rollbackId) {
    fail('rollbackId is missing from successful write report', report);
  }

  if (!report.beforeContentHash || !report.afterContentHash) {
    fail('beforeContentHash or afterContentHash is missing', report);
  }

  if (report.beforeContentHash === report.afterContentHash) {
    fail('beforeContentHash and afterContentHash are equal; no content change was detected', report);
  }
}

async function main() {
  console.log(`[write-test] Brain Core API: ${BASE}`);
  console.log(`[write-test] Target file: ${TARGET_PATH}`);

  if (!fs.existsSync(TARGET_PATH)) {
    fail('target file does not exist; create it manually before running this test', { TARGET_PATH });
  }

  const beforeContent = fs.readFileSync(TARGET_PATH, 'utf8');

  console.log('[write-test] Checking health...');
  const health = await request('/status');
  if (!health.response.ok) {
    fail('Brain Core /status did not return OK', health.body);
  }

  console.log('[write-test] Recording operator approval...');
  const approval = await request('/api/infinite-brain/operator-approval/record', {
    method: 'POST',
    body: JSON.stringify({
      operator: OPERATOR,
      decision: 'approved',
      reason:
        'Approved one controlled single-file metadata write test against the allowlisted InfiniteBrainWriteTest.md file only.',
    }),
  });
  if (!approval.response.ok || approval.body?.ok !== true) {
    fail('operator approval record failed', approval.body);
  }

  console.log('[write-test] Generating iOS sync safety report...');
  const iosSafety = await request('/api/infinite-brain/ios-sync-safety/generate', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  if (!iosSafety.response.ok || iosSafety.body?.ok !== true) {
    fail('iOS sync safety report generation failed', iosSafety.body);
  }

  console.log('[write-test] Running single-file metadata write through API...');
  const write = await request('/api/infinite-brain/metadata-writer/write/single-file-test', {
    method: 'POST',
    body: JSON.stringify({
      manualSingleWriteConfirm: true,
      operator: OPERATOR,
      reason: 'Run first controlled Infinite Brain metadata write test on the single allowlisted Mind test file only.',
      targetPath: TARGET_PATH,
      fieldName: FIELD_NAME,
      value: VALUE,
    }),
  });

  if (!write.response.ok || write.body?.ok !== true) {
    fail('single-file metadata write API returned non-OK', write.body);
  }

  const report = write.body.report;
  assertReportIsSafe(report);

  const afterContent = fs.readFileSync(TARGET_PATH, 'utf8');
  if (beforeContent === afterContent) {
    fail('target file content did not change after successful write report', report);
  }

  const expectedUnquoted = `${FIELD_NAME}: ${VALUE}`;
  const expectedDoubleQuoted = `${FIELD_NAME}: \"${VALUE}\"`;
  const expectedSingleQuoted = `${FIELD_NAME}: '${VALUE}'`;
  if (
    !afterContent.includes(expectedUnquoted) &&
    !afterContent.includes(expectedDoubleQuoted) &&
    !afterContent.includes(expectedSingleQuoted)
  ) {
    fail(`target file does not contain expected frontmatter value ${FIELD_NAME}: ${VALUE}`, {
      acceptedForms: [expectedUnquoted, expectedDoubleQuoted, expectedSingleQuoted],
      preview: afterContent.slice(0, 500),
      report,
    });
  }

  console.log('[write-test] Fetching latest write report...');
  const latest = await request('/api/infinite-brain/metadata-writer/write');
  if (!latest.response.ok || latest.body?.ok !== true) {
    fail('latest write report fetch failed', latest.body);
  }

  console.log('\n[write-test] SUCCESS');
  console.log(JSON.stringify({
    status: report.status,
    wroteToMind: report.wroteToMind,
    modifiedMind: report.modifiedMind,
    testWriteApplied: report.testWriteApplied,
    applied: report.applied,
    autonomousExecution: report.autonomousExecution,
    singleFileOnly: report.singleFileOnly,
    allowlistedOnly: report.allowlistedOnly,
    rollbackId: report.rollbackId,
    beforeContentHash: report.beforeContentHash,
    afterContentHash: report.afterContentHash,
    targetPath: report.targetPath,
  }, null, 2));
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
