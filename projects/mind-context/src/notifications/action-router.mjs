import {approveReviewCapture, rejectReviewCapture} from '../review/review.mjs';
import {
  assertDecisionActionAllowed,
  isOneClickApprovable,
} from '../review/decision-request.mjs';

function safeFailureCode(error) {
  const candidate = typeof error?.code === 'string' ? error.code : typeof error?.message === 'string' ? error.message : '';
  return /^[A-Za-z0-9_.:-]{1,128}$/.test(candidate) ? candidate : 'decision_action_failed';
}

function defaultOpenDeepLink(deepLink, {emit = (line) => process.stdout.write(`${line}\n`)} = {}) {
  if (typeof deepLink !== 'string' || !deepLink.startsWith('evermind://')) throw new Error('invalid_decision_deep_link');
  emit(JSON.stringify({status: 'deep-link', deepLink}));
  return {opened: false, deepLink, fallback: 'stdout'};
}

function verifyStoredProposal(record) {
  const request = record.request;
  if (request.kind !== 'approve-reject-proposal' || !isOneClickApprovable(request)) throw new Error('approve_requires_immutable_proposal');
  if (record.identity?.proposalId !== request.proposalId
    || record.identity?.proposalVersion !== request.proposal.version
    || record.identity?.proposalHash !== request.proposal.hash
    || record.identity?.deepLink !== request.deepLink) {
    throw new Error('request_identity_mismatch');
  }
  return request;
}

function defaultExecutor({root, action, request}) {
  if (!request.captureId) throw new Error('missing_review_capture_id');
  if (action === 'reject') return rejectReviewCapture({root, captureId: request.captureId, reason: 'Rejected from Evermind notification'});
  if (action === 'approve') {
    const proposal = request.proposal;
    return approveReviewCapture({
      root,
      captureId: request.captureId,
      destination: proposal.destination,
      content: proposal.content,
    });
  }
  throw new Error('missing_decision_executor');
}

function recordFailure(store, requestId, code) {
  try {
    return store.transition(requestId, 'failed', {failureCode: code});
  } catch {
    return null;
  }
}

export async function routeNotificationAction({
  store,
  requestId,
  action,
  root,
  openDeepLink = (deepLink) => defaultOpenDeepLink(deepLink),
  execute = {},
} = {}) {
  if (!store || typeof store.load !== 'function') throw new Error('missing_request_store');
  const normalizedAction = String(action ?? '').trim().toLowerCase();
  const handle = async (record) => {
    if (record.state !== 'pending') return {status: 'already_resolved', requestId: record.requestId, state: record.state};

    if (normalizedAction === 'review') {
      const opened = await openDeepLink(record.request.deepLink);
      return {status: 'review-opened', requestId: record.requestId, state: record.state, deepLink: record.request.deepLink, opened};
    }

    try {
      assertDecisionActionAllowed(record.request, normalizedAction);
      if (normalizedAction === 'approve') verifyStoredProposal(record);
      const handler = execute[normalizedAction] ?? ((request) => defaultExecutor({root, action: normalizedAction, request}));
      const result = await handler(record.request);
      const state = normalizedAction === 'approve' ? 'resolved-approved' : 'resolved-rejected';
      const resolved = store.transition(record.requestId, state, {
        decision: normalizedAction,
        result: result && typeof result === 'object' ? {decision: result.decision ?? normalizedAction, receipt: result.receipt ?? null} : null,
      });
      return {status: 'resolved', requestId: record.requestId, state: resolved.state, result};
    } catch (error) {
      const code = safeFailureCode(error);
      const actionWasNotAllowed = code === 'approve_requires_immutable_proposal' || code === 'decision_action_not_allowed';
      if (!actionWasNotAllowed) recordFailure(store, record.requestId, code);
      if (normalizedAction === 'approve') {
        let fallback;
        try { fallback = await openDeepLink(record.request.deepLink); }
        catch { fallback = null; }
        return {status: 'failed-review-required', requestId: record.requestId, state: 'failed', failureCode: code, fallback};
      }
      return {status: 'failed', requestId: record.requestId, state: 'failed', failureCode: code};
    }
  };

  if (typeof store.withClaim === 'function') {
    const claimed = await store.withClaim(requestId, handle);
    if (!claimed.claimed) return {status: 'already_processing', requestId: claimed.requestId, state: claimed.state};
    return claimed.value;
  }
  return handle(store.load(requestId));
}

export async function drainNotificationActions({store, root, openDeepLink, execute} = {}) {
  if (!store || typeof store.listActions !== 'function') throw new Error('missing_request_store');
  const results = [];
  for (const event of store.listActions()) {
    let result;
    try {
      result = await routeNotificationAction({store, root, openDeepLink, execute, requestId: event.requestId, action: event.action});
    } catch (error) {
      result = {status: 'failed', requestId: event.requestId, failureCode: safeFailureCode(error)};
    }
    if (result.status === 'resolved' && event.action !== 'review' && typeof openDeepLink === 'function') {
      try {
        result = {...result, refreshed: await openDeepLink('evermind://queue')};
      } catch {
        result = {...result, refreshed: {opened: false, deepLink: 'evermind://queue'}};
      }
    }
    if (result.status !== 'already_processing') store.removeAction(event.eventId);
    results.push({event, result});
  }
  return results;
}

export {defaultExecutor, defaultOpenDeepLink, safeFailureCode, verifyStoredProposal};
