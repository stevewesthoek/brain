'use strict';

const VIEW_TYPE = 'brain-console-view';
const DEFAULT_BRAIN_CORE_URL = 'http://127.0.0.1:4877';
const DEFAULT_NOTIFICATION_POLL_MS = 5 * 60 * 1000;

const PRIORITY_ORDER = Object.freeze({ critical: 0, high: 1, normal: 2, low: 3 });
const STATUS_ORDER = Object.freeze({ pending: 0, superseded: 1, deferred: 2, approved: 3, rejected: 4 });

function normalizeBaseUrl(input) {
  const raw = String(input || DEFAULT_BRAIN_CORE_URL).trim();
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) return DEFAULT_BRAIN_CORE_URL;
    parsed.pathname = '';
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return DEFAULT_BRAIN_CORE_URL;
  }
}

function normalizeQueue(queue) {
  const items = Array.isArray(queue?.items) ? queue.items : [];
  return items.map((item) => ({
    decisionId: String(item?.decisionId || ''),
    proposalId: String(item?.proposalId || ''),
    proposalHash: String(item?.proposalHash || ''),
    category: String(item?.category || 'unknown'),
    title: String(item?.title || 'Untitled decision'),
    summary: String(item?.summary || ''),
    whyNow: String(item?.whyNow || ''),
    recommendedAction: String(item?.recommendedAction || ''),
    alternatives: Array.isArray(item?.alternatives) ? item.alternatives.map(String) : [],
    consequenceOfDelay: String(item?.consequenceOfDelay || ''),
    priority: ['critical', 'high', 'normal', 'low'].includes(item?.priority) ? item.priority : 'normal',
    risk: ['critical', 'high', 'medium', 'low'].includes(item?.risk) ? item.risk : 'medium',
    evidenceRefs: Array.isArray(item?.evidenceRefs) ? item.evidenceRefs.map(String) : [],
    writesToMindIfApproved: item?.writesToMindIfApproved === true,
    status: ['pending', 'approved', 'rejected', 'deferred', 'superseded'].includes(item?.status) ? item.status : 'pending',
    pending: item?.pending === true,
    deferUntil: typeof item?.deferUntil === 'string' ? item.deferUntil : null,
  })).sort((a, b) => {
    const statusDelta = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    if (statusDelta !== 0) return statusDelta;
    const priorityDelta = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
    if (priorityDelta !== 0) return priorityDelta;
    return a.title.localeCompare(b.title);
  });
}

function decisionCounts(queue) {
  const items = normalizeQueue(queue);
  return {
    total: items.length,
    pending: items.filter((item) => item.pending).length,
    highPriorityPending: items.filter((item) => item.pending && ['critical', 'high'].includes(item.priority)).length,
  };
}

function buildDecisionPayload(item, decision, decidedBy, options = {}) {
  if (!item?.proposalId || !item?.proposalHash) throw new Error('decision item requires proposalId and proposalHash');
  if (!['approved', 'rejected', 'needs-review', 'deferred'].includes(decision)) throw new Error('invalid decision');
  const payload = {
    proposalHash: item.proposalHash,
    decision,
    decidedBy: String(decidedBy || 'obsidian-owner'),
  };
  if (options.reason) payload.reason = String(options.reason).slice(0, 1000);
  if (decision === 'deferred') {
    const deferUntil = options.deferUntil instanceof Date ? options.deferUntil : new Date(options.deferUntil);
    if (Number.isNaN(deferUntil.getTime())) throw new Error('deferred decision requires valid deferUntil');
    payload.deferUntil = deferUntil.toISOString();
  }
  return payload;
}

function genericNotificationText(notification) {
  const pendingCount = Number.isInteger(notification?.pendingCount) ? Math.max(0, notification.pendingCount) : 0;
  const highCount = Number.isInteger(notification?.highPriorityPendingCount) ? Math.max(0, notification.highPriorityPendingCount) : 0;
  if (notification?.kind === 'daily-digest') {
    return `Decision Center daily digest: ${pendingCount} pending item${pendingCount === 1 ? '' : 's'}.`;
  }
  if (highCount > 0) {
    return `Decision Center: ${pendingCount} pending, ${highCount} high-priority.`;
  }
  return `Decision Center: ${pendingCount} item${pendingCount === 1 ? '' : 's'} need attention.`;
}

function safeEvidenceRefs(item, max = 8) {
  return (Array.isArray(item?.evidenceRefs) ? item.evidenceRefs : [])
    .filter((value) => typeof value === 'string' && value.trim().length > 0)
    .slice(0, max)
    .map((value) => value.trim());
}

module.exports = {
  VIEW_TYPE,
  DEFAULT_BRAIN_CORE_URL,
  DEFAULT_NOTIFICATION_POLL_MS,
  normalizeBaseUrl,
  normalizeQueue,
  decisionCounts,
  buildDecisionPayload,
  genericNotificationText,
  safeEvidenceRefs,
};
