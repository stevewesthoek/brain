import test from 'node:test';
import assert from 'node:assert/strict';
import { createMindMaintenancePreviewQueueFromFindings, } from '../maintenance-preview.js';
test('maintenance-preview: creates an empty queue for empty findings', () => {
    const queue = createMindMaintenancePreviewQueueFromFindings([]);
    assert.strictEqual(queue.kind, 'mind-maintenance-preview-queue');
    assert.strictEqual(queue.actions.length, 0);
    assert.strictEqual(queue.writesToMind, false);
    assert.strictEqual(queue.externalSideEffects, false);
});
test('maintenance-preview: keeps wiki/log.md as a read-only compatibility ledger', () => {
    const finding = {
        id: 'missing-required-file',
        severity: 'error',
        path: 'wiki/log.md',
        message: 'Missing required wiki contract file: wiki/log.md',
        recommendation: 'Create wiki/log.md with the required Mind OS contract content.',
        writesToMind: false,
    };
    const queue = createMindMaintenancePreviewQueueFromFindings([finding]);
    assert.strictEqual(queue.actions.length, 1);
    const action = queue.actions[0];
    assert.strictEqual(action.kind, 'no-op-info');
    assert.strictEqual(action.targetPath, 'wiki/log.md');
    assert.strictEqual(action.risk, 'low');
    assert.strictEqual(action.proposedOperation, 'review');
    assert.strictEqual(action.requiresApproval, false);
    assert.strictEqual(action.writesToMind, false);
    assert.strictEqual(action.blockedBy.length, 0);
});
test('maintenance-preview: maps stale failed capture to review action', () => {
    const finding = {
        id: 'stale-failed-capture',
        severity: 'warning',
        path: 'inbox/failed/2026-05-10-webhook-capture.md',
        message: 'inbox/failed/2026-05-10-webhook-capture.md is older than 3 days.',
        recommendation: 'Review whether to retry the capture, fix the root cause, or discard it.',
        writesToMind: false,
    };
    const queue = createMindMaintenancePreviewQueueFromFindings([finding]);
    assert.strictEqual(queue.actions.length, 1);
    const action = queue.actions[0];
    assert.strictEqual(action.kind, 'review-failed-capture');
    assert.strictEqual(action.risk, 'medium');
    assert.strictEqual(action.proposedOperation, 'review');
    assert.strictEqual(action.requiresApproval, false);
});
test('maintenance-preview: maps missing source trace to patch preview action with approval required', () => {
    const finding = {
        id: 'missing-source-trace',
        severity: 'warning',
        path: 'knowledge/some-topic.md',
        message: 'knowledge/some-topic.md does not contain an obvious source trace marker.',
        recommendation: 'Add a brief source or capture link when the page is compiled from evidence.',
        writesToMind: false,
    };
    const queue = createMindMaintenancePreviewQueueFromFindings([finding]);
    assert.strictEqual(queue.actions.length, 1);
    const action = queue.actions[0];
    assert.strictEqual(action.kind, 'add-source-trace-placeholder');
    assert.strictEqual(action.proposedOperation, 'patch');
    assert.strictEqual(action.requiresApproval, true);
    assert.strictEqual(action.writesToMind, false);
});
test('maintenance-preview: blocks actions targeting .obsidian/', () => {
    const finding = {
        id: 'missing-required-file',
        severity: 'error',
        path: '.obsidian/some-config.json',
        message: 'Missing config',
        recommendation: 'Add config',
        writesToMind: false,
    };
    const queue = createMindMaintenancePreviewQueueFromFindings([finding]);
    assert.strictEqual(queue.actions.length, 0);
});
test('maintenance-preview: blocks actions targeting legacy numbered folders', () => {
    const findings = [
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '01-inbox/some-file.md',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '04-tasks/task.md',
            message: 'Missing task',
            recommendation: 'Add task',
            writesToMind: false,
        },
    ];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    assert.strictEqual(queue.actions.length, 0);
});
test('maintenance-preview: blocks actions targeting .git, node_modules, dist, build, runtime, logs', () => {
    const findings = [
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '.git/hooks/pre-commit',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'node_modules/package/index.js',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'dist/bundle.js',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'build/output.o',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'runtime/local/output.json',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'logs/app.log',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
    ];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    assert.strictEqual(queue.actions.length, 0);
});
test('maintenance-preview: blocks traversal paths and absolute paths', () => {
    const findings = [
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '../../../etc/passwd',
            message: 'Traversal attempt',
            recommendation: 'Block',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '/etc/passwd',
            message: 'Absolute path',
            recommendation: 'Block',
            writesToMind: false,
        },
    ];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    assert.strictEqual(queue.actions.length, 0);
});
test('maintenance-preview: blocks .env and .env.* files', () => {
    const findings = [
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '.env',
            message: 'Missing env',
            recommendation: 'Add env',
            writesToMind: false,
        },
        {
            id: 'missing-required-file',
            severity: 'error',
            path: '.env.local',
            message: 'Missing env',
            recommendation: 'Add env',
            writesToMind: false,
        },
    ];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    assert.strictEqual(queue.actions.length, 0);
});
test('maintenance-preview: generates deterministic action IDs', () => {
    const finding = {
        id: 'missing-required-file',
        severity: 'error',
        path: 'wiki/log.md',
        message: 'Missing required wiki contract file: wiki/log.md',
        recommendation: 'Create wiki/log.md with the required Mind OS contract content.',
        writesToMind: false,
    };
    const queue1 = createMindMaintenancePreviewQueueFromFindings([finding]);
    const queue2 = createMindMaintenancePreviewQueueFromFindings([finding]);
    assert.strictEqual(queue1.actions[0].id, queue2.actions[0].id);
    assert.match(queue1.actions[0].id, /^action-[a-f0-9]{12}$/);
});
test('maintenance-preview: counts actions by risk level correctly', () => {
    const findings = [
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'wiki/log.md',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'stale-capture-inbox',
            severity: 'warning',
            path: 'inbox/new/old-capture.md',
            message: 'Stale capture',
            recommendation: 'Review capture',
            writesToMind: false,
        },
        {
            id: 'orphan-wiki-page',
            severity: 'warning',
            path: 'knowledge/orphan.md',
            message: 'Orphan page',
            recommendation: 'Add to index',
            writesToMind: false,
        },
    ];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    assert.strictEqual(queue.summary.total, 3);
    assert.strictEqual(queue.summary.lowRiskCount, 2);
    assert.strictEqual(queue.summary.mediumRiskCount, 1); // stale capture
    assert.strictEqual(queue.summary.highRiskCount, 0);
    assert.strictEqual(queue.summary.approvalRequiredCount, 0);
    assert.strictEqual(queue.summary.blockedCount, 0);
});
test('maintenance-preview: never sets writesToMind=true for any action', () => {
    const findings = [
        {
            id: 'missing-required-file',
            severity: 'error',
            path: 'wiki/log.md',
            message: 'Missing file',
            recommendation: 'Add file',
            writesToMind: false,
        },
        {
            id: 'missing-source-trace',
            severity: 'warning',
            path: 'knowledge/page.md',
            message: 'Missing trace',
            recommendation: 'Add trace',
            writesToMind: false,
        },
    ];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    for (const action of queue.actions) {
        assert.strictEqual(action.writesToMind, false);
        assert.strictEqual(action.externalSideEffects, false);
    }
    assert.strictEqual(queue.writesToMind, false);
    assert.strictEqual(queue.externalSideEffects, false);
});
test('maintenance-preview: returns empty queue for healthy wiki health result', () => {
    const findings = [];
    const queue = createMindMaintenancePreviewQueueFromFindings(findings);
    assert.strictEqual(queue.actions.length, 0);
    assert.strictEqual(queue.summary.total, 0);
    assert.strictEqual(queue.kind, 'mind-maintenance-preview-queue');
});
test('maintenance-preview: includes createdAt timestamp in ISO format', () => {
    const now = new Date('2026-05-17T19:30:00Z');
    const queue = createMindMaintenancePreviewQueueFromFindings([], now);
    assert.strictEqual(queue.createdAt, '2026-05-17T19:30:00.000Z');
});
