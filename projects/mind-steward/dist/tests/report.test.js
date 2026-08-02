import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createMindStewardDryRunReport } from '../report.js';
import { joinMindPath, resolveCanonicalMindPath } from '../path-registry.js';
function snapshot(paths) {
    return {
        paths,
        saveToMindTarget: 'inbox-new',
        liveDeploymentVerified: true,
        failureBufferStatus: 'real-error-verified',
    };
}
test('mind-steward dry-run report includes all loops and safe flags', () => {
    const report = createMindStewardDryRunReport(snapshot([]));
    assert.equal(report.mode, 'dry-run-report-only');
    assert.equal(report.writesToMind, false);
    assert.equal(report.executableActions, false);
    assert.equal(report.loopPlans.length, 4);
    assert.equal(report.loopPlans.some((plan) => plan.jobId === 'mind-drift-error-loop'), true);
    assert.equal(report.validationStatus, 'blocked');
});
test('mind-steward dry-run report computes counts and blockers', () => {
    const previousRoot = process.env.MIND_STEWARD_MIND_ROOT;
    const missingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-missing-root-'));
    fs.rmSync(missingRoot, { recursive: true, force: true });
    process.env.MIND_STEWARD_MIND_ROOT = missingRoot;
    try {
        const report = createMindStewardDryRunReport(snapshot([
            { path: `${resolveCanonicalMindPath('inbox-new')}a.md`, kind: 'file', exists: true, modifiedAt: '2026-05-15T00:00:00.000Z' },
            { path: `${resolveCanonicalMindPath('inbox-failed')}b.md`, kind: 'file', exists: true },
            { path: joinMindPath(resolveCanonicalMindPath('agent-context'), '00-current-context.md'), kind: 'file', exists: true, lineCount: 151 },
        ]), new Date('2026-05-17T00:00:00.000Z'));
        assert.equal(report.snapshotStats.failedCaptureCount, 1);
        assert.equal(report.snapshotStats.captureInboxCount, 1);
        assert.ok(report.snapshotStats.oldestCaptureInboxAgeDays !== undefined);
        assert.equal(report.snapshotStats.oldestCaptureInboxAgeDays, 2);
        assert.equal(Object.values(report.actionCountsByKind).length > 0, true);
        const blockers = report.blockersByLoop['mind-compile-loop'];
        assert.ok(blockers);
        assert.equal(blockers.length > 0, true);
        assert.equal(report.wikiHealth.status, 'unavailable');
        assert.equal(report.wikiHealth.ok, false);
    }
    finally {
        if (previousRoot === undefined) {
            delete process.env.MIND_STEWARD_MIND_ROOT;
        }
        else {
            process.env.MIND_STEWARD_MIND_ROOT = previousRoot;
        }
    }
});
