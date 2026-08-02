#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const reportPath = path.join(root, 'operations/reports/b7-6-performance-budgets-2026-07-17.json');

function main() {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  const errors = [];
  if (report.reportVersion !== '1.0.0') errors.push('reportVersion must be 1.0.0');
  if (!Array.isArray(report.metrics) || report.metrics.length < 5) errors.push('metrics must be non-empty');
  for (const [index, metric] of (report.metrics ?? []).entries()) {
    for (const field of ['metricId', 'actual', 'budget', 'status', 'unit', 'source']) {
      if (!(field in metric)) errors.push(`metric:${index}:missing:${field}`);
    }
    if (typeof metric.metricId !== 'string' || metric.metricId.length === 0) errors.push(`metric:${index}:invalid:metricId`);
    if (typeof metric.status !== 'string' || metric.status.length === 0) errors.push(`metric:${index}:invalid:status`);
    if (typeof metric.unit !== 'string' || metric.unit.length === 0) errors.push(`metric:${index}:invalid:unit`);
    if (metric.status === 'baseline-only') {
      if (metric.budget !== null) errors.push(`metric:${index}:baseline-only-budget-must-be-null`);
    } else if (metric.status === 'documented-budget') {
      if (metric.budget === null) errors.push(`metric:${index}:documented-budget-needs-budget`);
    }
  }
  if (errors.length > 0) {
    process.stdout.write(`budgets=fail\nerrors=${errors.length}\n`);
    for (const error of errors) process.stdout.write(`error=${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(`budgets=pass\nmetrics=${report.metrics.length}\nresult=pass\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
