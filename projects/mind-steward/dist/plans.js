import { MIND_ANTI_CLUTTER_LIMITS } from './contracts.js';
import { joinMindPath, resolveCanonicalMindPath } from './path-registry.js';
const DAY_MS = 24 * 60 * 60 * 1000;
const INBOX_NEW = resolveCanonicalMindPath('inbox-new');
const INBOX_FAILED = resolveCanonicalMindPath('inbox-failed');
const KNOWLEDGE = resolveCanonicalMindPath('knowledge');
const PROJECTS = resolveCanonicalMindPath('projects');
const AGENT_CURRENT = joinMindPath(resolveCanonicalMindPath('agent-context'), '00-current-context.md');
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
                    path: AGENT_CURRENT,
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
            ? 'Capture is ready for registry-governed routing after review.'
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
        if (pathStatus.path === AGENT_CURRENT && exceedsLines(pathStatus, MIND_ANTI_CLUTTER_LIMITS[AGENT_CURRENT]?.maxLines ?? 150)) {
            return [
                {
                    kind: 'promote-memory',
                    path: pathStatus.path,
                    reason: 'Current agent context is above the short-term memory line limit and should be summarized/promoted.',
                    targetPath: KNOWLEDGE,
                    risk: 'medium',
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
        if (isCaptureInboxFile(pathStatus) && isOlderThan(pathStatus, now, MIND_ANTI_CLUTTER_LIMITS[INBOX_NEW]?.maxAgeDays ?? 7)) {
            actions.push({
                kind: 'archive-stale-capture',
                path: pathStatus.path,
                reason: 'Canonical inbox item is older than the seven-day anti-clutter limit.',
                targetPath: resolveCanonicalMindPath('history'),
                risk: 'high',
            });
        }
        if (isFailedCaptureFile(pathStatus) && isOlderThan(pathStatus, now, MIND_ANTI_CLUTTER_LIMITS[INBOX_FAILED]?.maxAgeDays ?? 3)) {
            actions.push({
                kind: 'review-failed-capture',
                path: pathStatus.path,
                reason: 'Canonical failed inbox item is older than the three-day review limit.',
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
    if (snapshot.saveToMindTarget !== 'inbox-new') {
        warnings.push('Save-to-Mind target is not verified as canonical inbox/new for this snapshot.');
    }
    return warnings;
}
function isCaptureInboxFile(pathStatus) {
    return pathStatus.kind === 'file' && pathStatus.path.startsWith(INBOX_NEW) && pathStatus.path.endsWith('.md');
}
function isFailedCaptureFile(pathStatus) {
    return pathStatus.kind === 'file' && pathStatus.path.startsWith(INBOX_FAILED) && pathStatus.path.endsWith('.md');
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
    if (path.includes('faith') || path.includes('bible'))
        return resolveCanonicalMindPath('faith');
    if (path.includes('project'))
        return PROJECTS;
    return KNOWLEDGE;
}
