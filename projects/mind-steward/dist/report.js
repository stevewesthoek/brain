import { createMindContractDryRunResult } from './jobs.js';
import { createMindRouterLoopPlan } from './plans.js';
import { createMindWikiHealthResultFromRoot } from './wiki-health.js';
import { createMindMaintenancePreviewQueueFromFindings } from './maintenance-preview.js';
import fs from 'node:fs';
import { resolveCanonicalMindPath } from './path-registry.js';
const INBOX_NEW = resolveCanonicalMindPath('inbox-new');
const INBOX_FAILED = resolveCanonicalMindPath('inbox-failed');
export function createMindStewardDryRunReport(snapshot, now = new Date()) {
    const contract = createMindContractDryRunResult(snapshot);
    const loopPlans = [
        createMindRouterLoopPlan('mind-drift-error-loop', snapshot, now),
        createMindRouterLoopPlan('mind-compile-loop', snapshot, now),
        createMindRouterLoopPlan('mind-memory-loop', snapshot, now),
        createMindRouterLoopPlan('mind-hygiene-loop', snapshot, now),
    ];
    const actionCountsByKind = {};
    for (const plan of loopPlans) {
        for (const action of plan.actions) {
            actionCountsByKind[action.kind] = (actionCountsByKind[action.kind] ?? 0) + 1;
        }
    }
    const pathStats = snapshot.paths.reduce((acc, item) => {
        acc.pathCount += 1;
        if (item.exists)
            acc.existingPathCount += 1;
        else
            acc.missingPathCount += 1;
        if (item.path.startsWith(INBOX_FAILED) && item.exists)
            acc.failedCaptureCount += 1;
        if (item.path.startsWith(INBOX_NEW) && item.exists) {
            acc.captureInboxCount += 1;
            const ageDays = calculateAgeDays(item.modifiedAt, now);
            if (typeof ageDays === 'number') {
                acc.oldestCaptureInboxAgeDays =
                    typeof acc.oldestCaptureInboxAgeDays === 'number'
                        ? Math.max(acc.oldestCaptureInboxAgeDays, ageDays)
                        : ageDays;
            }
        }
        return acc;
    }, {
        pathCount: 0,
        existingPathCount: 0,
        missingPathCount: 0,
        failedCaptureCount: 0,
        captureInboxCount: 0,
    });
    const wikiHealth = createWikiHealthReport(now);
    const maintenancePreview = createMaintenancePreviewMetadata(wikiHealth);
    return {
        generatedAt: now.toISOString(),
        mode: 'dry-run-report-only',
        writesToMind: false,
        executableActions: false,
        validationStatus: contract.ok ? 'ok' : 'blocked',
        contractSummary: {
            ok: contract.ok,
            missingRequiredPathCount: contract.missingRequiredPaths.length,
            missingRouterContractFileCount: contract.missingRouterContractFiles.length,
            missingLiveFileCount: contract.missingLiveFiles.length,
            missingIndexFileCount: contract.missingIndexFiles.length,
            failureBufferStatus: contract.failureBufferStatus,
            failureBufferReadyForArchivePhase: contract.failureBufferReadyForArchivePhase,
        },
        loopPlans,
        actionCountsByKind,
        blockersByLoop: Object.fromEntries(loopPlans.map((plan) => [plan.jobId, plan.blockedBy])),
        warningsByLoop: Object.fromEntries(loopPlans.map((plan) => [plan.jobId, plan.warnings])),
        snapshotStats: pathStats,
        wikiHealth,
        maintenancePreview,
    };
}
function createWikiHealthReport(now) {
    const configuredRoot = process.env.MIND_STEWARD_MIND_ROOT;
    const root = configuredRoot;
    try {
        if (!root || !fs.existsSync(root)) {
            return {
                status: 'unavailable',
                ok: false,
                summary: emptyWikiHealthSummary(),
                findings: [],
            };
        }
        const health = createMindWikiHealthResultFromRoot(root, now);
        return {
            status: 'available',
            checkedAt: health.checkedAt,
            ok: health.ok,
            summary: health.summary,
            findings: health.findings.slice(0, 5).map(({ id, severity, path, message, recommendation }) => ({
                id,
                severity,
                path,
                message,
                recommendation,
            })),
        };
    }
    catch {
        return {
            status: 'unavailable',
            ok: false,
            summary: emptyWikiHealthSummary(),
            findings: [],
        };
    }
}
function emptyWikiHealthSummary() {
    return {
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        staleCaptureCount: 0,
        failedCaptureCount: 0,
        oversizedWikiPageCount: 0,
        missingSourceTraceCount: 0,
    };
}
function createMaintenancePreviewMetadata(wikiHealth) {
    if (wikiHealth.status === 'unavailable') {
        return {
            status: 'unavailable',
            actionCount: 0,
            lowRiskCount: 0,
            mediumRiskCount: 0,
            highRiskCount: 0,
            approvalRequiredCount: 0,
            topActions: [],
            writesToMind: false,
            externalSideEffects: false,
        };
    }
    try {
        const queue = createMindMaintenancePreviewQueueFromFindings(wikiHealth.findings);
        return {
            status: 'available',
            actionCount: queue.summary.total,
            lowRiskCount: queue.summary.lowRiskCount,
            mediumRiskCount: queue.summary.mediumRiskCount,
            highRiskCount: queue.summary.highRiskCount,
            approvalRequiredCount: queue.summary.approvalRequiredCount,
            topActions: queue.actions.slice(0, 3).map((action) => ({
                kind: action.kind,
                title: action.title,
                risk: action.risk,
            })),
            writesToMind: false,
            externalSideEffects: false,
        };
    }
    catch {
        return {
            status: 'unavailable',
            actionCount: 0,
            lowRiskCount: 0,
            mediumRiskCount: 0,
            highRiskCount: 0,
            approvalRequiredCount: 0,
            topActions: [],
            writesToMind: false,
            externalSideEffects: false,
        };
    }
}
function calculateAgeDays(modifiedAt, now) {
    if (!modifiedAt)
        return undefined;
    const value = new Date(modifiedAt).getTime();
    if (!Number.isFinite(value))
        return undefined;
    const diffDays = Math.floor((now.getTime() - value) / (24 * 60 * 60 * 1000));
    return diffDays >= 0 ? diffDays : undefined;
}
