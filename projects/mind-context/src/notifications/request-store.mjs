import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {allowedDecisionActions, deserializeDecisionRequest, serializeDecisionRequest} from '../review/decision-request.mjs';

const STORE_VERSION = 1;
const REQUEST_TTL_MS = 7 * 86_400_000;
const CLAIM_TTL_MS = 60_000;
const MAX_SERIALIZED_REQUEST_BYTES = 2 * 1024 * 1024;
const REQUEST_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const ACTION_RE = /^(review|reject|approve)$/;
const TERMINAL_STATES = new Set(['resolved-approved', 'resolved-rejected', 'expired', 'failed']);

function requireRequestId(value) {
  const id = String(value ?? '').trim();
  if (!REQUEST_ID_RE.test(id)) throw new Error('invalid_request_id');
  return id;
}

function requireAction(value) {
  const action = String(value ?? '').trim().toLowerCase();
  if (!ACTION_RE.test(action)) throw new Error('invalid_decision_action');
  return action;
}

function defaultStoreRoot(platform = process.platform) {
  if (platform === 'darwin') return path.join(os.homedir(), 'Library', 'Application Support', 'Evermind', 'notifications');
  if (platform === 'win32') return path.join(process.env.LOCALAPPDATA ?? os.homedir(), 'Evermind', 'notifications');
  return path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state'), 'evermind', 'notifications');
}

function assertDirectoryNotSymlink(directory, {create = false} = {}) {
  const absolute = path.resolve(directory);
  if (create) fs.mkdirSync(absolute, {recursive: true, mode: 0o700});
  let stat;
  try { stat = fs.lstatSync(absolute); }
  catch { throw new Error('request_store_unavailable'); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('unsafe_request_store');
  const real = fs.realpathSync(absolute);
  try { fs.chmodSync(real, 0o700); } catch {}
  return real;
}

function ensureChildPath(root, child) {
  const absoluteRoot = assertDirectoryNotSymlink(root);
  const absolute = path.resolve(absoluteRoot, child);
  const relative = path.relative(absoluteRoot, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('request_path_outside_store');
  return absolute;
}

function ensureFilePath(root, filename) {
  const target = ensureChildPath(root, filename);
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe_request_file');
  }
  return target;
}

function atomicWriteJson(file, value) {
  const dir = path.dirname(file);
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_REQUEST_BYTES) throw new Error('decision_request_too_large');
  try {
    fs.writeFileSync(temporary, serialized, {encoding: 'utf8', flag: 'wx', mode: 0o600});
    try { fs.chmodSync(temporary, 0o600); } catch {}
    fs.renameSync(temporary, file);
    try { fs.chmodSync(file, 0o600); } catch {}
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch {}
    throw error;
  }
  try { fs.chmodSync(dir, 0o700); } catch {}
}

function readJson(file) {
  let stat;
  try { stat = fs.lstatSync(file); }
  catch { throw new Error('request_not_found'); }
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe_request_file');
  if (stat.size > MAX_SERIALIZED_REQUEST_BYTES) throw new Error('decision_request_too_large');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('invalid_stored_request'); }
}

function normalizedExpiry(expiresAt, now, ttlMs) {
  const fallback = now + ttlMs;
  if (expiresAt === undefined || expiresAt === null) return new Date(fallback).toISOString();
  const parsed = new Date(expiresAt);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= now) throw new Error('invalid_request_expiry');
  return parsed.toISOString();
}

function identityFor(request) {
  return {
    proposalId: request.proposalId ?? null,
    proposalVersion: request.proposal?.version ?? null,
    proposalHash: request.proposal?.hash ?? null,
    deepLink: request.deepLink,
  };
}

function validateRecord(record, requestId) {
  if (!record || record.schemaVersion !== STORE_VERSION || record.requestId !== requestId) throw new Error('invalid_stored_request');
  if (!['pending', ...TERMINAL_STATES].includes(record.state)) throw new Error('invalid_request_state');
  if (!record.request || typeof record.request !== 'object') throw new Error('invalid_stored_request');
  const request = deserializeDecisionRequest(JSON.stringify(record.request));
  const expected = identityFor(request);
  if (JSON.stringify(record.identity ?? null) !== JSON.stringify(expected)) throw new Error('request_identity_mismatch');
  return {...record, request};
}

function requestFilename(requestId) {
  return `${requireRequestId(requestId)}.json`;
}

function actionFilename(eventId) {
  const normalized = requireRequestId(eventId);
  return `action-${normalized}.json`;
}

export function createRequestStore({root = defaultStoreRoot(), now = () => Date.now(), ttlMs = REQUEST_TTL_MS} = {}) {
  const storeRoot = assertDirectoryNotSymlink(root, {create: true});
  const requestsRoot = assertDirectoryNotSymlink(path.join(storeRoot, 'requests'), {create: true});
  const actionsRoot = assertDirectoryNotSymlink(path.join(storeRoot, 'actions'), {create: true});
  const clock = typeof now === 'function' ? now : () => Number(now);
  const ttl = Number(ttlMs);
  if (!Number.isFinite(ttl) || ttl <= 0) throw new Error('invalid_request_ttl');

  function requestPath(requestId) {
    return ensureFilePath(requestsRoot, requestFilename(requestId));
  }

  function actionPath(eventId) {
    return ensureFilePath(actionsRoot, actionFilename(eventId));
  }

  function writeRecord(record) {
    atomicWriteJson(requestPath(record.requestId), record);
  }

  function put(request, {expiresAt} = {}) {
    const serialized = serializeDecisionRequest(request);
    const normalizedRequest = deserializeDecisionRequest(serialized);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_SERIALIZED_REQUEST_BYTES) throw new Error('decision_request_too_large');
    const requestId = requireRequestId(normalizedRequest.requestId);
    const file = requestPath(requestId);
    if (fs.existsSync(file)) throw new Error('request_exists');
    const nowMs = clock();
    if (!Number.isFinite(nowMs)) throw new Error('invalid_store_time');
    const record = {
      schemaVersion: STORE_VERSION,
      requestId,
      state: 'pending',
      createdAt: normalizedRequest.createdAt,
      expiresAt: normalizedExpiry(expiresAt, nowMs, ttl),
      identity: identityFor(normalizedRequest),
      actions: allowedDecisionActions(normalizedRequest),
      request: JSON.parse(serialized),
    };
    writeRecord(record);
    return {...record, request: normalizedRequest};
  }

  function load(requestId, {markExpired = true} = {}) {
    const normalizedId = requireRequestId(requestId);
    const record = validateRecord(readJson(requestPath(normalizedId)), normalizedId);
    const nowMs = clock();
    if (!Number.isFinite(nowMs)) throw new Error('invalid_store_time');
    if (record.state === 'pending' && Date.parse(record.expiresAt) <= nowMs) {
      const expired = {...record, state: 'expired', resolvedAt: new Date(nowMs).toISOString(), failureCode: 'request_expired'};
      if (markExpired) writeRecord(expired);
      return {...expired, request: record.request};
    }
    return record;
  }

  function transition(requestId, state, details = {}) {
    if (!TERMINAL_STATES.has(state)) throw new Error('invalid_terminal_state');
    const current = load(requestId);
    if (current.state !== 'pending') return current;
    const nowMs = clock();
    const next = {
      ...current,
      ...details,
      state,
      resolvedAt: new Date(nowMs).toISOString(),
    };
    writeRecord(next);
    return next;
  }

  async function withClaim(requestId, callback) {
    const normalizedId = requireRequestId(requestId);
    const lock = ensureFilePath(requestsRoot, `${normalizedId}.lock`);
    let descriptor;
    try {
      descriptor = fs.openSync(lock, 'wx', 0o600);
      try { fs.chmodSync(lock, 0o600); } catch {}
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      let stale = false;
      try {
        const stat = fs.lstatSync(lock);
        if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('unsafe_request_lock');
        stale = clock() - stat.mtimeMs > CLAIM_TTL_MS;
      } catch (lockError) {
        if (lockError?.message === 'unsafe_request_lock') throw lockError;
      }
      if (!stale) return {claimed: false, requestId: normalizedId, state: 'processing'};
      try { fs.unlinkSync(lock); } catch { return {claimed: false, requestId: normalizedId, state: 'processing'}; }
      return withClaim(normalizedId, callback);
    }
    try {
      const record = load(normalizedId);
      return {claimed: true, requestId: normalizedId, value: await callback(record)};
    } finally {
      try { if (descriptor !== undefined) fs.closeSync(descriptor); } catch {}
      try { fs.unlinkSync(lock); } catch {}
    }
  }

  function writeAction({requestId, action, eventId = crypto.randomUUID(), createdAt = new Date(clock()).toISOString()} = {}) {
    const normalizedRequestId = requireRequestId(requestId);
    const normalizedAction = requireAction(action);
    const normalizedEventId = requireRequestId(eventId);
    const file = actionPath(normalizedEventId);
    if (fs.existsSync(file)) throw new Error('action_event_exists');
    const event = {schemaVersion: STORE_VERSION, eventId: normalizedEventId, requestId: normalizedRequestId, action: normalizedAction, createdAt};
    atomicWriteJson(file, event);
    return event;
  }

  function listActions() {
    return fs.readdirSync(actionsRoot)
      .filter((name) => name.startsWith('action-') && name.endsWith('.json'))
      .sort()
      .map((name) => {
        const event = readJson(ensureFilePath(actionsRoot, name));
        if (event.schemaVersion !== STORE_VERSION || event.eventId !== name.slice('action-'.length, -'.json'.length)) throw new Error('invalid_action_event');
        return event;
      });
  }

  function removeAction(eventId) {
    const file = actionPath(eventId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }

  function listRequests() {
    return fs.readdirSync(requestsRoot)
      .filter((name) => name.endsWith('.json') && !name.endsWith('.lock'))
      .sort()
      .map((name) => name.slice(0, -'.json'.length))
      .map((requestId) => load(requestId))
      .filter((record) => record.state === 'pending');
  }

  function findByProposalId(proposalId) {
    const normalizedProposalId = requireRequestId(proposalId);
    const records = fs.readdirSync(requestsRoot)
      .filter((name) => name.endsWith('.json') && !name.endsWith('.lock'))
      .sort()
      .map((name) => name.slice(0, -'.json'.length))
      .map((requestId) => load(requestId));
    const record = records.find((candidate) => candidate.request.proposalId === normalizedProposalId);
    if (!record) throw new Error('request_not_found');
    return record;
  }

  return Object.freeze({
    root: storeRoot,
    requestsRoot,
    actionsRoot,
    put,
    load,
    transition,
    withClaim,
    writeAction,
    listActions,
    removeAction,
    listRequests,
    findByProposalId,
  });
}

export {CLAIM_TTL_MS, MAX_SERIALIZED_REQUEST_BYTES, REQUEST_TTL_MS, STORE_VERSION, defaultStoreRoot};
