#!/usr/bin/env node

import {realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

import {drainNotificationActions, routeNotificationAction} from './action-router.mjs';
import {createRequestStore, defaultStoreRoot} from './request-store.mjs';
import {getReviewCapture} from '../review/review.mjs';

function openCompanionDeepLink(deepLink) {
  if (typeof deepLink !== 'string' || !/^evermind:\/\/(?:queue|capture\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127}|review\/[A-Za-z0-9][A-Za-z0-9._:-]{0,127})$/i.test(deepLink)) {
    throw new Error('invalid_decision_deep_link');
  }
  const result = spawnSync('/usr/bin/open', ['-g', deepLink], {encoding: 'utf8'});
  return {opened: result?.status === 0, deepLink, fallback: result?.status === 0 ? null : 'stdout'};
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--drain') args.drain = true;
    else if (value === '--list') args.list = true;
    else if (value === '--show') args.show = true;
    else if (value === '--capture-id') args.captureId = argv[++index];
    else if (value === '--proposal-id') args.proposalId = argv[++index];
    else if (value === '--store-root') args.storeRoot = argv[++index];
    else if (value === '--root') args.root = argv[++index];
    else if (value === '--request-id') args.requestId = argv[++index];
    else if (value === '--action') args.action = argv[++index];
    else if (value === '--help') args.help = true;
    else throw new Error('invalid_argument');
  }
  return args;
}

export async function runNotificationActionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    process.stdout.write('Usage: evermind-notification-action --store-root PATH (--drain | --list | --show --request-id ID | --show --proposal-id ID | --capture-id ID --root PATH | --request-id ID --action review|reject|approve) [--root PATH]\n');
    return 0;
  }
  const store = createRequestStore({root: args.storeRoot ?? defaultStoreRoot()});
  let result;
  if (args.drain) {
    result = await drainNotificationActions({store, root: args.root, openDeepLink: openCompanionDeepLink});
  } else if (args.list) {
    result = store.listRequests().map((record) => ({
      requestId: record.requestId,
      state: record.state,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      actions: record.actions,
      request: {
        kind: record.request.kind,
        title: record.request.title,
        summary: record.request.summary,
        deepLink: record.request.deepLink,
        captureId: record.request.captureId,
        proposalId: record.request.proposalId,
      },
    }));
  } else if (args.show) {
    if (!args.requestId && !args.proposalId) throw new Error('missing_request_id');
    const record = args.proposalId ? store.findByProposalId(args.proposalId) : store.load(args.requestId);
    result = {record, allowedActions: record.actions};
  } else if (args.captureId) {
    result = getReviewCapture({root: args.root, captureId: args.captureId});
  } else {
    result = await routeNotificationAction({
      store,
      root: args.root,
      requestId: args.requestId,
      action: args.action,
      openDeepLink: (deepLink) => ({opened: false, deepLink}),
    });
  }
  process.stdout.write(`${JSON.stringify({status: 'ok', result})}\n`);
  return 0;
}

const executedDirectly = process.argv[1]
  ? realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  try {
    process.exitCode = await runNotificationActionCli();
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

export {parseArgs};
