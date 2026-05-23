import { MIND_ANTI_CLUTTER_LIMITS } from './contracts.js';
const DAY_MS = 24 * 60 * 60 * 1000;
export function createMindRouterLoopPlan(jobId, snapshot, now = new Date()) {
    const actions = createActions(jobId, snapshot.paths, now);
    const blockedBy = createBlockers(jobId, snapshot);
    const warnings = createWarnings(jobId, snapshot, actions, blockedBy);
    return {
        jobId,
        mode: 'dry-run',
        ok: blockedBy.length === 0,
        checkedPaths: snapshot.paths.map((pathStatus) => pathStatus.path),
        plannedWrites: actions.map((action) => action.targetPath ?? action.path),
        warnings,
        errors: [],
        actions,
        blockedBy,
    };
}
function createActions(jobId, paths, now) {
    switch (jobId) {
        case 'mind-compile-loop':
            return planCompileLoop(paths, now);
        case 'mind-memory-loop':
            return planMemoryLoop(paths);
        case 'mind-hygiene-loop':
            return planHygieneLoop(paths, now);
        case 'mind-drift-error-loop':
            return [
                {
                    kind: 'verify-contract',
                    path: 'router/mind-steward.md',
                    reason: 'Verify Mind OS folder contract, Save-to-Mind target, failure buffer, and Brain Core availability.',
                    risk: 'low',
                },
            ];
    }
}
function planCompileLoop(paths, now) {
    return paths
        .filter((pathStatus) => isCaptureInboxFile(pathStatus) && pathStatus.exists)
        .map((pathStatus) => ({
        kind: 'compile-capture',
        path: pathStatus.path,
        reason: isOlderThan(pathStatus, now, 1)
            ? 'Capture is ready for routing into live/wiki/sources/archive after review.'
            : 'New capture is available for classification and routing.',
        targetPath: inferCompileTarget(pathStatus.path),
        risk: 'medium',
    }));
}
function planMemoryLoop(paths) {
    return paths.flatMap((pathStatus) => {
        if (!pathStatus.exists || pathStatus.kind !== 'file') {
            return [];
        }
        if (pathStatus.path === 'router/current.md' && exceedsLines(pathStatus, MIND_ANTI_CLUTTER_LIMITS['router/current.md'].maxLines)) {
            return [
                {
                    kind: 'promote-memory',
                    path: pathStatus.path,
                    reason: 'router/current.md is above the short-term memory line limit and should be summarized/promoted.',
                    targetPath: 'wiki/index.md',
                    risk: 'medium',
                },
            ];
        }
        if (pathStatus.path === 'TODAY.md' && exceedsLines(pathStatus, MIND_ANTI_CLUTTER_LIMITS['TODAY.md'].maxLines)) {
            return [
                {
                    kind: 'summarize-file',
                    path: pathStatus.path,
                    reason: 'TODAY.md is above the daily focus line limit and should be compacted.',
                    risk: 'low',
                },
            ];
        }
        return [];
    });
}
function planHygieneLoop(paths, now) {
    return paths.flatMap((pathStatus) => {
        const actions = [];
        if (!pathStatus.exists) {
            return actions;
        }
        if (pathStatus.path === 'live/tasks.md' && exceedsLines(pathStatus, MIND_ANTI_CLUTTER_LIMITS['live/tasks.md'].maxLines)) {
            actions.push({
                kind: 'summarize-file',
                path: pathStatus.path,
                reason: 'live/tasks.md is above the task surface line limit and should be compacted.',
                risk: 'medium',
            });
        }
        if (pathStatus.path === 'live/projects.md' && exceedsLines(pathStatus, MIND_ANTI_CLUTTER_LIMITS['live/projects.md'].maxLines)) {
            actions.push({
                kind: 'summarize-file',
                path: pathStatus.path,
                reason: 'live/projects.md is above the project surface line limit and should be compacted.',
                risk: 'medium',
            });
        }
        if (isWikiFile(pathStatus) && exceedsLines(pathStatus, MIND_ANTI_CLUTTER_LIMITS['wiki/*.md'].maxLines)) {
            actions.push({
                kind: 'split-file',
                path: pathStatus.path,
                reason: 'Wiki file is above the target line limit and should be split or summarized.',
                risk: 'medium',
            });
        }
        if (isCaptureInboxFile(pathStatus) && isOlderThan(pathStatus, now, MIND_ANTI_CLUTTER_LIMITS['capture/inbox/'].maxAgeDays)) {
            actions.push({
                kind: 'archive-stale-capture',
                path: pathStatus.path,
                reason: 'capture/inbox item is older than the seven-day anti-clutter limit.',
                targetPath: 'archive/old/',
                risk: 'high',
            });
        }
        if (isFailedCaptureFile(pathStatus) && isOlderThan(pathStatus, now, MIND_ANTI_CLUTTER_LIMITS['capture/failed/'].maxAgeDays)) {
            actions.push({
                kind: 'review-failed-capture',
                path: pathStatus.path,
                reason: 'capture/failed item is older than the three-day review limit.',
                risk: 'medium',
            });
        }
        return actions;
    });
}
function createBlockers(jobId, snapshot) {
    const blockers = [];
    if (jobId !== 'mind-drift-error-loop' && snapshot.liveDeploymentVerified !== true) {
        blockers.push('Live Save-to-Mind deployment must be verified before loop writes are allowed.');
    }
    if ((jobId === 'mind-compile-loop' || jobId === 'mind-hygiene-loop') && snapshot.failureBufferStatus !== 'real-error-verified') {
        blockers.push('Failure buffer must be real-error verified before compile/hygiene writes are allowed.');
    }
    blockers.push('This planner is dry-run only; apply/write execution is not implemented.');
    return blockers;
}
function createWarnings(jobId, snapshot, actions, blockedBy) {
    const warnings = [
        'Dry-run plan only; no files are written, moved, deleted, archived, or rewritten.',
    ];
    if (actions.some((action) => action.risk === 'high')) {
        warnings.push('High-risk actions require explicit user approval and a verified rollback plan.');
    }
    if (blockedBy.length > 0) {
        warnings.push(`${jobId} is blocked from execution: ${blockedBy.join(' ')}`);
    }
    if (snapshot.saveToMindTarget !== 'capture-inbox') {
        warnings.push('Save-to-Mind target is not verified as capture/inbox for this snapshot.');
    }
    return warnings;
}
function isCaptureInboxFile(pathStatus) {
    return pathStatus.kind === 'file' && pathStatus.path.startsWith('capture/inbox/') && pathStatus.path.endsWith('.md');
}
function isFailedCaptureFile(pathStatus) {
    return pathStatus.kind === 'file' && pathStatus.path.startsWith('capture/failed/') && pathStatus.path.endsWith('.md');
}
function isWikiFile(pathStatus) {
    return pathStatus.kind === 'file' && pathStatus.path.startsWith('wiki/') && pathStatus.path.endsWith('.md');
}
function exceedsLines(pathStatus, maxLines) {
    return typeof pathStatus.lineCount === 'number' && pathStatus.lineCount > maxLines;
}
function isOlderThan(pathStatus, now, days) {
    if (!pathStatus.modifiedAt) {
        return false;
    }
    const modifiedAt = new Date(pathStatus.modifiedAt).getTime();
    if (!Number.isFinite(modifiedAt)) {
        return false;
    }
    return now.getTime() - modifiedAt > days * DAY_MS;
}
function inferCompileTarget(path) {
    if (path.includes('business'))
        return 'wiki/business.md';
    if (path.includes('faith') || path.includes('bible'))
        return 'wiki/faith.md';
    if (path.includes('task') || path.includes('todo'))
        return 'live/tasks.md';
    if (path.includes('project'))
        return 'live/projects.md';
    return 'wiki/index.md';
}
