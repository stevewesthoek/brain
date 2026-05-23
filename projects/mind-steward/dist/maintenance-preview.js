import { createHash } from 'node:crypto';
const BLOCKED_PATHS_PREFIXES = [
    '.obsidian/',
    '.git/',
    'node_modules/',
    'dist/',
    'build/',
    'runtime/',
    'logs/',
    'coverage/',
    '01-inbox/',
    '02-strategy/',
    '03-projects/',
    '04-tasks/',
    '05-areas/',
    '06-resources/',
    '07-templates/',
    '08-archive/',
    'archive/old/',
];
const BLOCKED_PATHS_EXACT = ['.env'];
function isPathBlocked(targetPath) {
    // Check exact paths
    if (BLOCKED_PATHS_EXACT.includes(targetPath)) {
        return true;
    }
    // Check suffixes
    if (targetPath.endsWith('.env') || targetPath.includes('.env.')) {
        return true;
    }
    // Check traversal
    if (targetPath.includes('..') || targetPath.startsWith('/')) {
        return true;
    }
    // Check prefixes
    for (const prefix of BLOCKED_PATHS_PREFIXES) {
        if (targetPath.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function createActionId(kind, targetPath, findingId) {
    const input = `${kind}:${targetPath}:${findingId}`;
    const hash = createHash('sha256').update(input).digest('hex').slice(0, 12);
    return `action-${hash}`;
}
function mapFindingToAction(finding) {
    // Block unsafe paths
    if (isPathBlocked(finding.path)) {
        return null;
    }
    let kind;
    let title;
    let summary;
    let recommendation;
    let risk;
    let operation;
    let requiresApproval;
    let blockedBy = [];
    switch (finding.id) {
        case 'missing-required-file': {
            if (finding.path === 'wiki/log.md') {
                kind = 'create-missing-wiki-log';
                title = 'Create missing wiki/log.md';
                summary = 'The wiki/log.md append-only knowledge maintenance ledger is missing.';
                recommendation = 'Create wiki/log.md with a header and initial entry. This is a safe, low-risk action.';
                risk = 'low';
                operation = 'create';
                requiresApproval = true;
            }
            else if (finding.path === 'wiki/index.md') {
                kind = 'update-wiki-index-link';
                title = 'Create missing wiki/index.md';
                summary = 'The wiki/index.md index file is missing or empty.';
                recommendation = 'Create wiki/index.md with links to wiki pages. This is a safe, foundational action.';
                risk = 'low';
                operation = 'create';
                requiresApproval = true;
            }
            else if (finding.path === 'sources/index.md') {
                kind = 'update-wiki-index-link';
                title = 'Create missing sources/index.md';
                summary = 'The sources/index.md catalog file is missing.';
                recommendation = 'Create sources/index.md with a list of knowledge sources. This helps trace compiled content back to evidence.';
                risk = 'low';
                operation = 'create';
                requiresApproval = true;
            }
            else {
                return null;
            }
            break;
        }
        case 'empty-sources-index': {
            kind = 'update-wiki-index-link';
            title = 'Review empty sources/index.md';
            summary = 'The sources/index.md catalog file exists but is empty.';
            recommendation = 'Review or populate sources/index.md so compiled pages can trace back to sources.';
            risk = 'low';
            operation = 'review';
            requiresApproval = false;
            break;
        }
        case 'stale-capture-inbox': {
            kind = 'review-stale-capture';
            title = `Review stale capture: ${finding.path}`;
            summary = `Capture at ${finding.path} is older than 7 days.`;
            recommendation = 'Review the capture to determine if it should be routed to live, archived, or deleted.';
            risk = 'medium';
            operation = 'review';
            requiresApproval = false;
            break;
        }
        case 'stale-failed-capture': {
            kind = 'review-failed-capture';
            title = `Review failed capture: ${finding.path}`;
            summary = `Failed capture at ${finding.path} is older than 3 days.`;
            recommendation = 'Review whether to retry the capture, fix the root cause, or discard it.';
            risk = 'medium';
            operation = 'review';
            requiresApproval = false;
            break;
        }
        case 'oversized-wiki-page': {
            kind = 'review-oversized-wiki-page';
            title = `Review oversized wiki page: ${finding.path}`;
            summary = `${finding.path} exceeds the 500-line wiki page target.`;
            recommendation = 'Split the page into smaller, linked pages or move subtopics to separate wiki files for better discoverability.';
            risk = 'medium';
            operation = 'review';
            requiresApproval = false;
            break;
        }
        case 'orphan-wiki-page': {
            kind = 'review-orphan-wiki-page';
            title = `Review orphan wiki page: ${finding.path}`;
            summary = `${finding.path} is not referenced from wiki/index.md.`;
            recommendation = 'Add the page to wiki/index.md if it is meant to be discoverable, or move it to archive if it is outdated.';
            risk = 'low';
            operation = 'review';
            requiresApproval = false;
            break;
        }
        case 'missing-source-trace': {
            kind = 'add-source-trace-placeholder';
            title = `Add source trace to: ${finding.path}`;
            summary = `${finding.path} does not contain a source trace marker.`;
            recommendation = 'Add a brief source or capture link when the page is compiled from evidence. This helps with attribution and validation.';
            risk = 'low';
            operation = 'patch';
            requiresApproval = true;
            break;
        }
        default:
            // Unknown finding type -> no-op info
            kind = 'no-op-info';
            title = `Info: ${finding.message}`;
            summary = finding.message;
            recommendation = finding.recommendation;
            risk = 'low';
            operation = 'none';
            requiresApproval = false;
            break;
    }
    const id = createActionId(kind, finding.path, finding.id);
    return {
        id,
        kind,
        targetPath: finding.path,
        sourceFindingId: finding.id,
        title,
        summary,
        recommendation,
        risk,
        proposedOperation: operation,
        requiresApproval,
        blockedBy,
        writesToMind: false,
        externalSideEffects: false,
    };
}
export function createMindMaintenancePreviewQueueFromFindings(findings, now = new Date()) {
    const actions = [];
    for (const finding of findings) {
        const action = mapFindingToAction(finding);
        if (action) {
            actions.push(action);
        }
    }
    const summary = {
        total: actions.length,
        lowRiskCount: actions.filter((a) => a.risk === 'low').length,
        mediumRiskCount: actions.filter((a) => a.risk === 'medium').length,
        highRiskCount: actions.filter((a) => a.risk === 'high').length,
        approvalRequiredCount: actions.filter((a) => a.requiresApproval).length,
        blockedCount: actions.filter((a) => a.blockedBy.length > 0).length,
    };
    return {
        kind: 'mind-maintenance-preview-queue',
        createdAt: now.toISOString(),
        source: 'wiki-health',
        actions,
        summary,
        writesToMind: false,
        externalSideEffects: false,
    };
}
