import test from 'node:test';
import assert from 'node:assert/strict';
import { createMindRouterLoopPlan } from '../plans.js';
const now = new Date('2026-05-17T12:00:00.000Z');
function snapshot(paths) {
    return {
        paths,
        saveToMindTarget: 'capture-inbox',
        liveDeploymentVerified: true,
        failureBufferStatus: 'real-error-verified',
    };
}
test('compile loop plans capture inbox routing without writes', () => {
    const plan = createMindRouterLoopPlan('mind-compile-loop', snapshot([
        {
            path: 'capture/inbox/2026-05-16-business-note.md',
            kind: 'file',
            exists: true,
            modifiedAt: '2026-05-16T08:00:00.000Z',
        },
    ]), now);
    assert.equal(plan.ok, false);
    assert.equal(plan.mode, 'dry-run');
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0]?.kind, 'compile-capture');
    assert.equal(plan.actions[0]?.targetPath, 'wiki/business.md');
    assert.equal(plan.blockedBy.includes('This planner is dry-run only; apply/write execution is not implemented.'), true);
});
test('memory loop plans short-term memory promotion and daily compaction', () => {
    const plan = createMindRouterLoopPlan('mind-memory-loop', snapshot([
        {
            path: 'router/current.md',
            kind: 'file',
            exists: true,
            lineCount: 151,
        },
        {
            path: 'TODAY.md',
            kind: 'file',
            exists: true,
            lineCount: 201,
        },
    ]), now);
    assert.equal(plan.actions.length, 2);
    assert.equal(plan.actions[0]?.kind, 'promote-memory');
    assert.equal(plan.actions[1]?.kind, 'summarize-file');
});
test('hygiene loop plans anti-clutter actions for large and stale files', () => {
    const plan = createMindRouterLoopPlan('mind-hygiene-loop', snapshot([
        {
            path: 'live/tasks.md',
            kind: 'file',
            exists: true,
            lineCount: 301,
        },
        {
            path: 'wiki/business.md',
            kind: 'file',
            exists: true,
            lineCount: 501,
        },
        {
            path: 'capture/inbox/old.md',
            kind: 'file',
            exists: true,
            modifiedAt: '2026-05-01T00:00:00.000Z',
        },
        {
            path: 'capture/failed/old.md',
            kind: 'file',
            exists: true,
            modifiedAt: '2026-05-10T00:00:00.000Z',
        },
    ]), now);
    assert.equal(plan.actions.length, 4);
    assert.equal(plan.actions.some((action) => action.kind === 'split-file'), true);
    assert.equal(plan.actions.some((action) => action.kind === 'archive-stale-capture'), true);
    assert.equal(plan.actions.some((action) => action.kind === 'review-failed-capture'), true);
    assert.equal(plan.warnings.some((warning) => warning.includes('High-risk actions')), true);
});
test('drift loop produces a contract verification action', () => {
    const plan = createMindRouterLoopPlan('mind-drift-error-loop', snapshot([]), now);
    assert.equal(plan.actions.length, 1);
    assert.equal(plan.actions[0]?.kind, 'verify-contract');
    assert.equal(plan.actions[0]?.risk, 'low');
});
