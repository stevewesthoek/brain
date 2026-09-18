import {spawnSync} from 'node:child_process';
import path from 'node:path';

import {allowedDecisionActions, serializeDecisionRequest} from '../review/decision-request.mjs';
import {discoverHelper, safeBundlePath} from './lifecycle.mjs';
import {createRequestStore} from './request-store.mjs';

const MACOS_NOTIFICATION_SCRIPT = [
  'on run argv',
  '  set notificationTitle to item 1 of argv',
  '  set notificationSubtitle to item 2 of argv',
  '  set notificationBody to item 3 of argv',
  '  display notification notificationBody with title notificationTitle subtitle notificationSubtitle',
  'end run',
].join('\n');

const ACTION_LABELS = Object.freeze({approve: 'Approve', review: 'Review', reject: 'Reject'});

function actionLabels(request) {
  return allowedDecisionActions(request).map((action) => ACTION_LABELS[action]);
}

function notificationCategory(request) {
  return {
    identifier: 'EVERMIND_DECISION',
    actions: allowedDecisionActions(request).map((identifier) => ({identifier, title: ACTION_LABELS[identifier]})),
  };
}

function notificationPayload(request) {
  return {
    requestId: request.requestId,
    title: request.title ?? 'Evermind needs your review',
    subtitle: actionLabels(request).join(' / '),
    body: request.summary ?? 'A local Evermind item needs attention.',
    deepLink: request.deepLink,
    actions: allowedDecisionActions(request),
  };
}

function consoleNotifier({emit = (line) => process.stdout.write(`${line}\n`)} = {}) {
  return {
    kind: 'console',
    supportsActions: false,
    requestStore: null,
    notify(request) {
      const payload = notificationPayload(request);
      emit(JSON.stringify({status: 'notification', ...payload}));
      return {delivered: true, kind: 'console', ...payload};
    },
  };
}

function macOSNotifier({execute = (file, args) => spawnSync(file, args, {encoding: 'utf8', stdio: 'ignore'})} = {}) {
  return {
    kind: 'macos-legacy',
    supportsActions: false,
    requestStore: null,
    notify(request) {
      const payload = notificationPayload(request);
      const result = execute('/usr/bin/osascript', ['-e', MACOS_NOTIFICATION_SCRIPT, payload.title, payload.subtitle, payload.body]);
      if (result?.error || result?.status !== 0) throw result?.error ?? new Error('macos_notification_failed');
      return {delivered: true, kind: 'macos-legacy', ...payload};
    },
  };
}

function helperExists(helperPath) {
  return Boolean(safeBundlePath(helperPath).usable);
}

function helperArguments({helperPath, store, request}) {
  if (!store?.root) throw new Error('missing_request_store');
  if (!path.isAbsolute(store.root) || !helperPath || !path.isAbsolute(helperPath)) throw new Error('unsafe_notification_helper_path');
  const serialized = serializeDecisionRequest(request);
  if (Buffer.byteLength(serialized, 'utf8') > 2 * 1024 * 1024) throw new Error('decision_request_too_large');
  // The helper receives only a trusted store root and opaque request ID. It loads
  // the bounded serialized request from <root>/requests/<id>.json itself.
  return ['-g', '-n', helperPath, '--args', '--store-root', store.root, '--request-id', request.requestId];
}

function macOSActionNotifier({
  helperPath,
  requestStore = null,
  execute = (file, args) => spawnSync('/usr/bin/open', args, {encoding: 'utf8', stdio: 'ignore'}),
  helperAvailable,
} = {}) {
  const discovery = helperPath ? {path: helperPath} : discoverHelper();
  const resolvedHelperPath = discovery.path;
  const validation = resolvedHelperPath ? safeBundlePath(resolvedHelperPath) : {usable: false};
  const available = typeof helperAvailable === 'function'
    ? helperAvailable(resolvedHelperPath) === true
    : validation.usable === true;
  const store = available ? (requestStore ?? createRequestStore()) : null;
  return {
    kind: 'macos-usernotifications',
    supportsActions: available && store !== null,
    available: available && store !== null,
    requestStore: store,
    notify(request) {
      if (!available || !store) throw new Error('macos_action_helper_unavailable');
      const record = store.put(request);
      const args = helperArguments({helperPath: resolvedHelperPath, store, request: record.request});
      const result = execute(resolvedHelperPath, args);
      if (result?.error || (result && result.status !== undefined && result.status !== 0)) {
        throw result?.error ?? new Error('macos_action_helper_failed');
      }
      return {delivered: true, kind: 'macos-usernotifications', ...notificationPayload(request), category: notificationCategory(request)};
    },
  };
}

export function createNotifier({platform = process.platform, execute, executeHelper, emit, helperPath, requestStore, helperAvailable} = {}) {
  if (platform === 'darwin') {
    const actionNative = macOSActionNotifier({helperPath, requestStore, execute: executeHelper, helperAvailable});
    const legacy = macOSNotifier({execute});
    const consoleFallback = consoleNotifier({emit});
    return {
      kind: actionNative.available ? actionNative.kind : legacy.kind,
      supportsActions: actionNative.available,
      requestStore: actionNative.requestStore,
      notify(request) {
        if (actionNative.available) {
          try { return actionNative.notify(request); }
          catch {}
        }
        try { return legacy.notify(request); }
        catch { return consoleFallback.notify(request); }
      },
    };
  }
  return consoleNotifier({emit});
}

export {
  ACTION_LABELS,
  MACOS_NOTIFICATION_SCRIPT,
  actionLabels,
  consoleNotifier,
  helperArguments,
  helperExists,
  macOSActionNotifier,
  macOSNotifier,
  notificationCategory,
  notificationPayload,
};
