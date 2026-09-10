import { createHash, randomUUID } from 'node:crypto';
import { execFile as execFileCallback } from 'node:child_process';
import { access, mkdir, readFile, realpath, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type {
  AgentModeSqliteStateStore,
  AgentModeWorkcell,
  AgentModeWorkcellReceipt,
  AgentModeWorkcellReceiptType,
  AgentModeWorkcellStatus,
} from './sqlite-state-store.js';

const execFile = promisify(execFileCallback);

export const WORKCELL_READ_CAPABILITY = 'repo.read' as const;
export const WORKCELL_WRITE_CAPABILITY = 'repo.write(workcell)' as const;
export const WORKCELL_VALIDATION_CAPABILITY = 'validation.run(workcell)' as const;
export type WorkcellCapability = typeof WORKCELL_READ_CAPABILITY | typeof WORKCELL_WRITE_CAPABILITY | typeof WORKCELL_VALIDATION_CAPABILITY;

export type WorkcellCapabilityDecision = {
  ok: boolean;
  capability?: WorkcellCapability;
  reason: string;
};

/** The foundation names a scoped future write only; it does not implement a write command. */
export function admitWorkcellCapability(capability: unknown, workcellId?: string): WorkcellCapabilityDecision {
  if (capability === WORKCELL_READ_CAPABILITY) return { ok: true, capability, reason: 'read-only repository access is admitted' };
  if (capability === WORKCELL_WRITE_CAPABILITY && typeof workcellId === 'string' && workcellId.startsWith('workcell:')) {
    return { ok: true, capability, reason: 'write is scoped to one durable Workcell' };
  }
  if (capability === WORKCELL_VALIDATION_CAPABILITY && typeof workcellId === 'string' && workcellId.startsWith('workcell:')) {
    return { ok: true, capability, reason: 'validation is scoped to one durable Workcell' };
  }
  return { ok: false, reason: 'capability is not admitted by the Workcell boundary' };
}

export type GitWorktreeInspection = {
  repositoryRoot: string;
  branch: string;
  revision: string;
  dirty: boolean;
};

export type GitRepositoryInspection = {
  canonicalRoot: string;
  headRevision: string;
  currentBranch?: string;
};

export type GitWorkcellAdapter = {
  validateRepository: (repositoryRoot: string) => Promise<GitRepositoryInspection>;
  createWorktree: (input: { repositoryRoot: string; worktreePath: string; branch: string; baseRef: string }) => Promise<void>;
  inspectWorktree: (input: { worktreePath: string }) => Promise<GitWorktreeInspection>;
  removeWorktree: (input: { repositoryRoot: string; worktreePath: string }) => Promise<void>;
  captureDiff: (input: { worktreePath: string; baseRef: string }) => Promise<GitDiffCapture>;
  commitWorktree?: (input: { worktreePath: string; expectedBranch: string; expectedParent: string; changedFiles: readonly string[]; message: string }) => Promise<GitCommitResult>;
  mergeWorktree?: (input: { repositoryRoot: string; expectedTargetRef: string; sourceBranch: string; expectedTargetHead: string }) => Promise<GitMergeResult>;
  inspectRef?: (input: { repositoryRoot: string; targetRef: string }) => Promise<{ targetRef: string; head: string }>;
  verifyMergedSource?: (input: { repositoryRoot: string; targetRef: string; expectedTargetHead: string; sourceCommit: string }) => Promise<{ head: string; sourceIncluded: boolean }>;
};

export type GitDiffCapture = {
  baseRevision: string;
  currentRevision: string;
  changedFiles: string[];
  diffHash: string;
};

export type GitCommitResult = { parentCommit: string; commitSha: string; treeRevision: string };
export type GitMergeResult = { targetHeadBefore: string; targetHeadAfter: string };

const BRANCH_PATTERN = /^codex\/workcell\/[0-9a-f-]{36}$/;
const WORKCELL_ID_PATTERN = /^workcell:[0-9a-f-]{36}$/;
const FORBIDDEN_BRANCHES = new Set(['main', 'master', 'trunk', 'develop']);

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function canonical(value: string): string {
  return path.resolve(value);
}

function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function operationHash(operation: string, workcell: AgentModeWorkcell, resultState: string, observation?: unknown): string {
  return createHash('sha256').update(JSON.stringify({
    operation,
    workcellId: workcell.workcellId,
    taskId: workcell.taskId,
    runId: workcell.runId,
    attemptId: workcell.attemptId,
    repositoryRef: workcell.repositoryRef,
    worktreePath: workcell.worktreePath,
    branch: workcell.branch,
    resultState,
    observation: observation ?? null,
  })).digest('hex');
}

function makeReceipt(
  workcell: AgentModeWorkcell,
  operation: AgentModeWorkcellReceipt['operation'],
  actor: string,
  timestamp: string,
  resultState: AgentModeWorkcellReceipt['resultState'],
  receiptType: AgentModeWorkcellReceiptType,
  observation?: unknown,
): AgentModeWorkcellReceipt {
  const hash = operationHash(operation, workcell, resultState, observation);
  return {
    receiptId: `workcell-receipt:${hash}`,
    receiptType,
    taskId: workcell.taskId,
    runId: workcell.runId,
    attemptId: workcell.attemptId,
    workcellId: workcell.workcellId,
    repositoryRef: workcell.repositoryRef,
    actor,
    timestamp,
    operationHash: hash,
    operation,
    resultState,
  };
}

async function runGit(args: readonly string[]): Promise<string> {
  if (args[0] !== '-C' || !nonEmpty(args[1])) throw new Error('internal Git adapter received an invalid command');
  const result = await execFile('git', [...args], {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 512 * 1024,
  });
  return String(result.stdout).trim();
}

async function runGitRaw(args: readonly string[]): Promise<string> {
  if (args[0] !== '-C' || !nonEmpty(args[1])) throw new Error('internal Git adapter received an invalid command');
  const result = await execFile('git', [...args], {
    encoding: 'utf8',
    timeout: 15_000,
    maxBuffer: 4 * 1024 * 1024,
  });
  return String(result.stdout);
}

/** Fixed Git subcommands only. It is not a general process or shell runner. */
export class GitCliWorkcellAdapter implements GitWorkcellAdapter {
  async validateRepository(repositoryRoot: string): Promise<GitRepositoryInspection> {
    const root = canonical(await realpath(repositoryRoot));
    const canonicalRoot = canonical(await realpath(await runGit(['-C', root, 'rev-parse', '--show-toplevel'])));
    const headRevision = await runGit(['-C', canonicalRoot, 'rev-parse', '--verify', 'HEAD^{commit}']);
    const currentBranch = await runGit(['-C', canonicalRoot, 'branch', '--show-current']);
    return { canonicalRoot, headRevision, ...(currentBranch ? { currentBranch } : {}) };
  }

  async createWorktree(input: { repositoryRoot: string; worktreePath: string; branch: string; baseRef: string }): Promise<void> {
    await runGit(['-C', canonical(input.repositoryRoot), 'worktree', 'add', '-b', input.branch, canonical(input.worktreePath), input.baseRef]);
  }

  async inspectWorktree(input: { worktreePath: string }): Promise<GitWorktreeInspection> {
    const worktreePath = canonical(input.worktreePath);
    const commonGitDirectory = canonical(await runGit(['-C', worktreePath, 'rev-parse', '--path-format=absolute', '--git-common-dir']));
    const repositoryRoot = path.dirname(commonGitDirectory);
    const branch = await runGit(['-C', worktreePath, 'branch', '--show-current']);
    const revision = await runGit(['-C', worktreePath, 'rev-parse', '--verify', 'HEAD^{commit}']);
    const status = await runGit(['-C', worktreePath, 'status', '--porcelain=v1', '--untracked-files=all']);
    if (!branch) throw new Error('worktree is detached and has no branch');
    return { repositoryRoot, branch, revision, dirty: status.length > 0 };
  }

  async removeWorktree(input: { repositoryRoot: string; worktreePath: string }): Promise<void> {
    await runGit(['-C', canonical(input.repositoryRoot), 'worktree', 'remove', '--', canonical(input.worktreePath)]);
  }

  async captureDiff(input: { worktreePath: string; baseRef: string }): Promise<GitDiffCapture> {
    const worktreePath = canonical(input.worktreePath);
    const baseRevision = await runGit(['-C', worktreePath, 'rev-parse', '--verify', `${input.baseRef}^{commit}`]);
    const currentRevision = await runGit(['-C', worktreePath, 'rev-parse', '--verify', 'HEAD^{commit}']);
    const changedFilesOutput = await runGit(['-C', worktreePath, 'diff', '--name-only', '--no-ext-diff', '--no-textconv', baseRevision, '--']);
    const diff = await runGitRaw(['-C', worktreePath, 'diff', '--binary', '--no-ext-diff', '--no-textconv', baseRevision, '--']);
    const untrackedOutput = await runGitRaw(['-C', worktreePath, 'ls-files', '--others', '--exclude-standard', '-z']);
    const untrackedFiles = untrackedOutput.split('\0').filter(Boolean).sort();
    const changedFiles = [...new Set([...(changedFilesOutput ? changedFilesOutput.split('\n').filter(Boolean) : []), ...untrackedFiles])].sort();
    const diffDigest = createHash('sha256').update(diff);
    for (const relativePath of untrackedFiles) {
      const candidate = path.resolve(worktreePath, relativePath);
      if (!isContained(worktreePath, candidate)) throw new Error('Git returned an untracked path outside the Workcell');
      diffDigest.update(`\0${relativePath}\0`);
      diffDigest.update(await readFile(candidate));
    }
    return { baseRevision, currentRevision, changedFiles, diffHash: diffDigest.digest('hex') };
  }

  async commitWorktree(input: { worktreePath: string; expectedBranch: string; expectedParent: string; changedFiles: readonly string[]; message: string }): Promise<GitCommitResult> {
    const worktreePath = canonical(input.worktreePath);
    if (!/^[A-Za-z0-9][A-Za-z0-9 .:_/-]{0,119}$/.test(input.message) || input.message.startsWith('-') || /\s--/.test(input.message)) throw new Error('commit message is outside the bounded format');
    const branch = await runGit(['-C', worktreePath, 'branch', '--show-current']);
    const parentCommit = await runGit(['-C', worktreePath, 'rev-parse', '--verify', 'HEAD^{commit}']);
    if (branch !== input.expectedBranch) throw new Error('Workcell branch changed before commit');
    if (parentCommit !== input.expectedParent) throw new Error('Workcell parent changed before commit');
    const staged = await runGit(['-C', worktreePath, 'diff', '--cached', '--name-only', '--no-ext-diff', '--no-textconv']);
    if (staged) throw new Error('pre-existing staged files are not permitted');
    const files = [...new Set(input.changedFiles)].sort();
    if (files.length === 0) throw new Error('empty Workcell commit is not permitted');
    await runGit(['-C', worktreePath, 'add', '--', ...files]);
    const stagedAfter = (await runGit(['-C', worktreePath, 'diff', '--cached', '--name-only', '--no-ext-diff', '--no-textconv'])).split('\n').filter(Boolean).sort();
    if (JSON.stringify(stagedAfter) !== JSON.stringify(files)) throw new Error('staged commit scope differs from approved diff');
    await runGit(['-C', worktreePath, 'commit', '--no-verify', '-m', input.message]);
    const commitSha = await runGit(['-C', worktreePath, 'rev-parse', '--verify', 'HEAD^{commit}']);
    const treeRevision = await runGit(['-C', worktreePath, 'rev-parse', '--verify', 'HEAD^{tree}']);
    return { parentCommit, commitSha, treeRevision };
  }

  async mergeWorktree(input: { repositoryRoot: string; expectedTargetRef: string; sourceBranch: string; expectedTargetHead: string }): Promise<GitMergeResult> {
    const repositoryRoot = canonical(input.repositoryRoot);
    const branch = await runGit(['-C', repositoryRoot, 'branch', '--show-current']);
    const targetHeadBefore = await runGit(['-C', repositoryRoot, 'rev-parse', '--verify', 'HEAD^{commit}']);
    if (branch !== input.expectedTargetRef) throw new Error('merge target checkout is not the approved target ref');
    if (targetHeadBefore !== input.expectedTargetHead) throw new Error('merge target head moved since approval');
    try {
      await runGit(['-C', repositoryRoot, 'merge', '--no-ff', '--no-edit', '--', input.sourceBranch]);
    } catch (error) {
      await runGit(['-C', repositoryRoot, 'merge', '--abort']).catch(() => undefined);
      throw new Error(`bounded merge rejected: ${error instanceof Error ? error.message : String(error)}`);
    }
    const targetHeadAfter = await runGit(['-C', repositoryRoot, 'rev-parse', '--verify', 'HEAD^{commit}']);
    return { targetHeadBefore, targetHeadAfter };
  }

  async inspectRef(input: { repositoryRoot: string; targetRef: string }): Promise<{ targetRef: string; head: string }> {
    const repositoryRoot = canonical(input.repositoryRoot);
    const branch = await runGit(['-C', repositoryRoot, 'branch', '--show-current']);
    if (branch !== input.targetRef) throw new Error('target ref is not checked out in the bound repository');
    return { targetRef: branch, head: await runGit(['-C', repositoryRoot, 'rev-parse', '--verify', 'HEAD^{commit}']) };
  }

  async verifyMergedSource(input: { repositoryRoot: string; targetRef: string; expectedTargetHead: string; sourceCommit: string }): Promise<{ head: string; sourceIncluded: boolean }> {
    const repositoryRoot = canonical(input.repositoryRoot);
    const branch = await runGit(['-C', repositoryRoot, 'branch', '--show-current']);
    if (branch !== input.targetRef) throw new Error('target ref is not checked out in the bound repository');
    const head = await runGit(['-C', repositoryRoot, 'rev-parse', '--verify', 'HEAD^{commit}']);
    if (head === input.expectedTargetHead) return { head, sourceIncluded: false };
    try {
      await runGit(['-C', repositoryRoot, 'merge-base', '--is-ancestor', input.sourceCommit, 'HEAD']);
      return { head, sourceIncluded: true };
    } catch {
      return { head, sourceIncluded: false };
    }
  }
}

export type WorkcellCreateInput = {
  taskId: string;
  runId: string;
  attemptId: string;
  repositoryRef: string;
  repositoryRoot: string;
  workcellsRoot: string;
  ownerAgent: string;
  createdAt?: string;
  baseRef?: string;
};

export type WorkcellInspection = {
  workcell: AgentModeWorkcell;
  git?: GitWorktreeInspection;
  valid: boolean;
  stale: boolean;
  receipt: AgentModeWorkcellReceipt;
};

export type WorkcellManagerOptions = {
  store: AgentModeSqliteStateStore;
  git?: GitWorkcellAdapter;
  staleAfterMs?: number;
};

export class WorkcellManager {
  private readonly git: GitWorkcellAdapter;
  private readonly staleAfterMs: number;

  constructor(private readonly options: WorkcellManagerOptions) {
    this.git = options.git ?? new GitCliWorkcellAdapter();
    this.staleAfterMs = options.staleAfterMs ?? 15 * 60 * 1000;
  }

  async create(input: WorkcellCreateInput): Promise<AgentModeWorkcell> {
    this.validateIdentity(input);
    const repository = await this.git.validateRepository(input.repositoryRoot);
    const repositoryRoot = canonical(await realpath(input.repositoryRoot));
    if (repository.canonicalRoot !== repositoryRoot) throw new Error('repository binding does not match the Git repository root');
    const requestedWorkcellsRoot = canonical(input.workcellsRoot);
    let workcellsRoot: string;
    try {
      workcellsRoot = canonical(await realpath(requestedWorkcellsRoot));
    } catch {
      const workcellsParent = canonical(await realpath(path.dirname(requestedWorkcellsRoot)));
      workcellsRoot = path.join(workcellsParent, path.basename(requestedWorkcellsRoot));
    }
    if (!isContained(path.dirname(workcellsRoot), workcellsRoot) || isContained(repositoryRoot, workcellsRoot) || workcellsRoot === repositoryRoot) {
      throw new Error('workcells root must be an explicit directory outside the primary checkout');
    }
    await mkdir(workcellsRoot, { recursive: true });
    const uuid = randomUUID();
    const now = input.createdAt ?? new Date().toISOString();
    const workcell: AgentModeWorkcell = {
      workcellId: `workcell:${uuid}`,
      taskId: input.taskId,
      runId: input.runId,
      attemptId: input.attemptId,
      repositoryRef: input.repositoryRef,
      repositoryRoot,
      worktreePath: path.join(workcellsRoot, `agent-task-${uuid}`),
      branch: `codex/workcell/${uuid}`,
      ownerAgent: input.ownerAgent,
      baseRef: input.baseRef ?? repository.headRevision,
      createdAt: now,
      updatedAt: now,
      status: 'created',
    };
    this.validateWorkcellTarget(workcell, workcellsRoot);
    const receipt = makeReceipt(workcell, 'create', input.ownerAgent, now, 'created', 'WorkcellCreatedReceipt');
    const result = this.options.store.createWorkcell(workcell, receipt);
    if (result === 'conflict') throw new Error(`workcell identity conflict: ${workcell.workcellId}`);
    return workcell;
  }

  async prepare(workcellId: string, actor: string, now = new Date().toISOString()): Promise<AgentModeWorkcell> {
    const workcell = this.requireOwned(workcellId, actor);
    if (workcell.status === 'prepared') return workcell;
    if (workcell.status !== 'created') throw new Error(`workcell cannot be prepared from status ${workcell.status}`);
    this.validateWorkcellTarget(workcell, path.dirname(workcell.worktreePath));
    const targetWasAbsent = !(await this.pathExists(workcell.worktreePath));
    try {
      let inspection: GitWorktreeInspection | undefined;
      try { inspection = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath }); } catch { /* creation is still required */ }
      if (!inspection) {
        await this.git.createWorktree({ repositoryRoot: workcell.repositoryRoot, worktreePath: workcell.worktreePath, branch: workcell.branch, baseRef: workcell.baseRef });
        inspection = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
      }
      this.assertMatchingWorktree(workcell, inspection);
      const updated = { ...workcell, status: 'prepared' as const, updatedAt: now };
      const receipt = makeReceipt(updated, 'prepare', actor, now, 'prepared', 'WorkcellPreparedReceipt', inspection);
      const result = this.options.store.updateWorkcellStatus(workcellId, 'prepared', now, 'created', receipt);
      if (result === 'conflict') throw new Error(`workcell prepare conflict: ${workcellId}`);
      return updated;
    } catch (error) {
      await this.cleanupFailedPreparation(workcell, targetWasAbsent);
      const failed = { ...workcell, status: 'failed' as const, updatedAt: now };
      const receipt = makeReceipt(failed, 'recover', actor, now, 'failed', 'ValidationReceipt', { error: error instanceof Error ? error.message : String(error) });
      try { this.options.store.updateWorkcellStatus(workcellId, 'failed', now, 'created', receipt); } catch { /* preserve the original failure */ }
      throw error;
    }
  }

  async inspect(workcellId: string, actor: string, now = new Date().toISOString()): Promise<WorkcellInspection> {
    const workcell = this.options.store.getWorkcell(workcellId);
    if (!workcell) throw new Error(`workcell not found: ${workcellId}`);
    this.validateWorkcellTarget(workcell, path.dirname(workcell.worktreePath));
    let git: GitWorktreeInspection | undefined;
    let valid = false;
    let stale = false;
    try {
      git = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
      valid = this.isMatchingWorktree(workcell, git);
      stale = !valid;
    } catch {
      stale = workcell.status === 'created' || workcell.status === 'prepared' || workcell.status === 'active';
    }
    const resultState: AgentModeWorkcellReceipt['resultState'] = valid ? 'valid' : stale ? 'stale' : 'invalid';
    const receipt = makeReceipt(workcell, 'inspect', actor, now, resultState, 'ValidationReceipt', git);
    this.options.store.recordWorkcellReceipt(receipt);
    return { workcell, ...(git ? { git } : {}), valid, stale, receipt };
  }

  async destroy(workcellId: string, actor: string, now = new Date().toISOString()): Promise<AgentModeWorkcell> {
    const workcell = this.requireOwned(workcellId, actor);
    if (workcell.status === 'merged') throw new Error('merged workcells are outside K3.0 destroy authority');
    if (workcell.status === 'discarded') return workcell;
    this.validateWorkcellTarget(workcell, path.dirname(workcell.worktreePath));
    try {
      const inspection = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
      this.assertMatchingWorktree(workcell, inspection);
      if (inspection.dirty) throw new Error('refusing to destroy a dirty Workcell');
      await this.git.removeWorktree({ repositoryRoot: workcell.repositoryRoot, worktreePath: workcell.worktreePath });
    } catch (error) {
      if (await this.pathExists(workcell.worktreePath)) throw error;
    }
    const discarded = { ...workcell, status: 'discarded' as const, updatedAt: now };
    const receipt = makeReceipt(discarded, 'destroy', actor, now, 'discarded', 'WorkcellDestroyedReceipt');
    const result = this.options.store.updateWorkcellStatus(workcellId, 'discarded', now, workcell.status, receipt);
    if (result === 'conflict') throw new Error(`workcell destroy conflict: ${workcellId}`);
    return discarded;
  }

  listStale(now = new Date().toISOString()): AgentModeWorkcell[] {
    const nowMs = Date.parse(now);
    return this.options.store.listWorkcells().filter((workcell) => {
      if (['discarded', 'failed', 'merged'].includes(workcell.status)) return false;
      return nowMs - Date.parse(workcell.updatedAt) >= this.staleAfterMs;
    });
  }

  async recoverStale(now = new Date().toISOString(), actor = 'system:workcell-recovery'): Promise<AgentModeWorkcell[]> {
    const recovered: AgentModeWorkcell[] = [];
    for (const workcell of this.listStale(now)) {
      if (workcell.status !== 'created') continue;
      try {
        const inspection = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
        this.assertMatchingWorktree(workcell, inspection);
        const prepared = { ...workcell, status: 'prepared' as const, updatedAt: now };
        const receipt = makeReceipt(prepared, 'recover', actor, now, 'prepared', 'ValidationReceipt', inspection);
        this.options.store.updateWorkcellStatus(workcell.workcellId, 'prepared', now, 'created', receipt);
        recovered.push(prepared);
      } catch {
        const failed = { ...workcell, status: 'failed' as const, updatedAt: now };
        const receipt = makeReceipt(failed, 'recover', actor, now, 'failed', 'ValidationReceipt');
        this.options.store.updateWorkcellStatus(workcell.workcellId, 'failed', now, 'created', receipt);
        recovered.push(failed);
      }
    }
    return recovered;
  }

  private validateIdentity(input: WorkcellCreateInput): void {
    for (const [name, value] of Object.entries(input)) {
      if (['createdAt', 'baseRef'].includes(name)) continue;
      if (!nonEmpty(value)) throw new Error(`invalid Workcell identity field: ${name}`);
    }
    if (input.baseRef !== undefined && (!nonEmpty(input.baseRef) || input.baseRef.includes('\0') || input.baseRef.startsWith('-'))) throw new Error('invalid Workcell base ref');
  }

  private validateWorkcellTarget(workcell: AgentModeWorkcell, workcellsRoot: string): void {
    if (!WORKCELL_ID_PATTERN.test(workcell.workcellId)) throw new Error('invalid Workcell identity');
    if (!BRANCH_PATTERN.test(workcell.branch) || FORBIDDEN_BRANCHES.has(workcell.branch)) throw new Error('invalid or protected Workcell branch');
    const repositoryRoot = canonical(workcell.repositoryRoot);
    const target = canonical(workcell.worktreePath);
    const root = canonical(workcellsRoot);
    if (target === repositoryRoot || isContained(repositoryRoot, target)) throw new Error('primary checkout cannot be a Workcell target');
    if (!isContained(root, target)) throw new Error('Workcell target is outside its designated workcells root');
    if (target === root) throw new Error('Workcell target must be a child of its designated root');
  }

  private requireOwned(workcellId: string, actor: string): AgentModeWorkcell {
    const workcell = this.options.store.getWorkcell(workcellId);
    if (!workcell) throw new Error(`workcell not found: ${workcellId}`);
    if (workcell.ownerAgent !== actor) throw new Error('Workcell is owned by another agent');
    return workcell;
  }

  private isMatchingWorktree(workcell: AgentModeWorkcell, inspection: GitWorktreeInspection): boolean {
    return canonical(inspection.repositoryRoot) === canonical(workcell.repositoryRoot)
      && inspection.branch === workcell.branch;
  }

  private assertMatchingWorktree(workcell: AgentModeWorkcell, inspection: GitWorktreeInspection): void {
    if (!this.isMatchingWorktree(workcell, inspection)) throw new Error('Git worktree does not match durable Workcell binding');
  }

  private async cleanupFailedPreparation(workcell: AgentModeWorkcell, targetWasAbsent: boolean): Promise<void> {
    try {
      const inspection = await this.git.inspectWorktree({ worktreePath: workcell.worktreePath });
      if (this.isMatchingWorktree(workcell, inspection) && !inspection.dirty) {
        await this.git.removeWorktree({ repositoryRoot: workcell.repositoryRoot, worktreePath: workcell.worktreePath });
      }
    } catch {
      // A failed adapter may have created only a partial directory. Remove it
      // only when the exact durable target was absent before this preparation.
      if (targetWasAbsent && await this.pathExists(workcell.worktreePath)) {
        await rm(workcell.worktreePath, { recursive: true, force: false });
      }
    }
  }

  private async pathExists(candidate: string): Promise<boolean> {
    try { await access(candidate); await stat(candidate); return true; } catch { return false; }
  }
}
