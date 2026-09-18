#!/usr/bin/env node

import {realpathSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {explainContextCommand, healthContextCommand, renderContextGatewayOutput, resolveContextCommand} from '../core/gateway-commands.mjs';
import {MAX_CAPTURE_BYTES, writeRawCapture} from '../capture/capture.mjs';
import {ensureConfiguredDirectory, readLocalConfig, resolveLocalPaths, writeLocalConfig} from '../config/local-config.mjs';
import {installNotifications, notificationStatus, uninstallNotifications} from '../notifications/lifecycle.mjs';
import {approveReviewCapture, getReviewCapture, listReviewQueue, rejectReviewCapture} from '../review/review.mjs';

function usage() {
  return [
    'Usage:',
    '  npm --prefix projects/mind-context run cli -- capture "raw text" --root PATH [--source-type TYPE] [--provenance VALUE]',
    '  cat note.md | npm --prefix projects/mind-context run cli -- capture --root PATH [--source-type TYPE] [--provenance VALUE]',
    '  npm --prefix projects/mind-context run cli -- review list --root PATH',
    '  npm --prefix projects/mind-context run cli -- review show CAPTURE_ID --root PATH',
    '  npm --prefix projects/mind-context run cli -- review approve CAPTURE_ID --root PATH --destination RELATIVE.md [--content "edited text"]',
    '  npm --prefix projects/mind-context run cli -- review reject CAPTURE_ID --root PATH [--reason "..."]',
    '  npm --prefix projects/mind-context run cli -- notifications install [--root PATH]',
    '  npm --prefix projects/mind-context run cli -- notifications configure --root PATH --drop-folder PATH',
    '  npm --prefix projects/mind-context run cli -- notifications status [--root PATH]',
    '  npm --prefix projects/mind-context run cli -- notifications uninstall',
    '  npm --prefix projects/mind-context run cli -- resolve --query "..." --root PATH --scope SCOPE [--scope SCOPE] [--format json|markdown] [--max-items N] [--max-tokens N] [--scope-subset SCOPE] [--authority-filter any|current] [--freshness-filter any|fresh]',
    '  npm --prefix projects/mind-context run cli -- explain --query "..." --root PATH --scope SCOPE [options]',
    '  npm --prefix projects/mind-context run cli -- health [--format json|markdown]',
  ].join('\n');
}

async function readStdin(limitBytes = MAX_CAPTURE_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of process.stdin) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > limitBytes) throw new Error('capture_too_large');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseArgs(argv) {
  const args = {_: []};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      args._.push(arg);
      continue;
    }
    const eq = arg.indexOf('=');
    const key = arg.slice(2, eq === -1 ? undefined : eq);
    const value = eq === -1 ? argv[++i] ?? true : arg.slice(eq + 1);
    if (key === 'scope' || key === 'forbidden-scope' || key === 'scope-subset') {
      const listKey = key === 'scope' ? 'scopes' : key === 'forbidden-scope' ? 'forbiddenScopes' : 'scopeSubset';
      args[listKey] ??= [];
      args[listKey].push(String(value));
      continue;
    }
    args[key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value === true ? true : String(value);
  }
  return args;
}

async function main(argv = process.argv.slice(2)) {
  try {
    const parsed = parseArgs(argv);
    const command = parsed._[0];
    if (!command || parsed.help) {
      process.stdout.write(`${usage()}\n`);
      return 0;
    }
    if (command === 'health') {
      const format = String(parsed.format ?? 'json').toLowerCase();
      process.stdout.write(`${renderContextGatewayOutput(healthContextCommand(), format)}\n`);
      return 0;
    }
    if (command === 'notifications') {
      const action = parsed._[1];
      const root = parsed.root ?? process.env.EVERMIND_ROOT ?? process.env.MIND_CONTEXT_ROOT;
      if (action === 'configure') {
        if (!parsed.dropFolder && !process.env.EVERMIND_DROP_FOLDER) throw new Error('missing_drop_folder');
        const current = readLocalConfig();
        const configured = resolveLocalPaths({root: parsed.root, dropFolder: parsed.dropFolder});
        const ensured = ensureConfiguredDirectory(configured.dropFolder);
        const saved = writeLocalConfig({
          rootPath: parsed.root ?? current.rootPath ?? configured.root,
          dropFolder: ensured.path,
        });
        process.stdout.write(`${JSON.stringify({status: 'configured', configPath: saved.path, root: saved.rootPath, dropFolder: saved.dropFolder, dropCreated: ensured.created})}\n`);
        return 0;
      }
      if (action === 'install') {
        process.stdout.write(`${JSON.stringify({status: 'installed', ...installNotifications({root})})}\n`);
        return 0;
      }
      if (action === 'status') {
        process.stdout.write(`${JSON.stringify({status: 'ok', ...notificationStatus({})})}\n`);
        return 0;
      }
      if (action === 'uninstall') {
        process.stdout.write(`${JSON.stringify({status: 'uninstalled', ...uninstallNotifications({})})}\n`);
        return 0;
      }
      throw new Error('invalid_notification_action');
    }
    if (command === 'capture') {
      const positional = parsed._.slice(1).join(' ').trim();
      const piped = positional || process.stdin.isTTY ? '' : await readStdin();
      const content = positional || piped;
      const result = writeRawCapture({
        root: parsed.root ?? process.env.EVERMIND_ROOT ?? process.env.MIND_CONTEXT_ROOT,
        content,
        sourceType: parsed.sourceType ?? 'cli',
        provenance: parsed.provenance ?? 'cli',
      });
      process.stdout.write(`${JSON.stringify({status: 'captured', ...result})}\n`);
      return 0;
    }
    if (command === 'review') {
      const root = parsed.root ?? process.env.EVERMIND_ROOT ?? process.env.MIND_CONTEXT_ROOT;
      const action = parsed._[1];
      const captureId = parsed._[2];
      if (action === 'list') {
        process.stdout.write(`${JSON.stringify({status: 'ok', items: listReviewQueue({root})})}\n`);
        return 0;
      }
      if (action === 'show') {
        process.stdout.write(`${JSON.stringify({status: 'ok', capture: getReviewCapture({root, captureId})})}\n`);
        return 0;
      }
      if (action === 'approve') {
        const result = approveReviewCapture({root, captureId, destination: parsed.destination, content: parsed.content});
        process.stdout.write(`${JSON.stringify({status: 'reviewed', ...result})}\n`);
        return 0;
      }
      if (action === 'reject') {
        const result = rejectReviewCapture({root, captureId, reason: parsed.reason ?? ''});
        process.stdout.write(`${JSON.stringify({status: 'reviewed', ...result})}\n`);
        return 0;
      }
      throw new Error('invalid_review_action');
    }
    if (command !== 'resolve' && command !== 'explain') throw new Error('invalid_command');
    const payload = command === 'resolve' ? resolveContextCommand(parsed) : explainContextCommand(parsed);
    process.stdout.write(`${renderContextGatewayOutput(payload, payload.input.format)}\n`);
    return 0;
  } catch (error) {
    const code = String(error?.message ?? error);
    const status = code === 'missing_root' || code === 'missing_query' || code === 'missing_scope' || code === 'missing_content' || code === 'missing_capture_id' || code === 'missing_destination' || code === 'missing_drop_folder' || code === 'invalid_capture_root' || code === 'capture_too_large' || code === 'invalid_scope' || code === 'invalid_budget' || code === 'invalid_output_format' || code === 'invalid_command' || code === 'invalid_review_action' || code === 'invalid_notification_action' || code === 'invalid_destination' || code === 'destination_exists' || code === 'capture_not_found' || code === 'invalid_capture_document' || code === 'invalid_source_type' || code === 'invalid_provenance' || code === 'invalid_argument' || code === 'conflicting_cleanup_modes'
      ? 2
      : code === 'insufficient_evidence'
        ? 3
        : 4;
    process.stderr.write(`${code}\n`);
    return status;
  }
}

const executedDirectly = process.argv[1]
  ? realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (executedDirectly) {
  const exitCode = await main();
  process.exitCode = exitCode;
}

export {main as runCli, parseArgs};
