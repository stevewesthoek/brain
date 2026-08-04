# B8.1 Source-Root Hardening Specification

## Status

Adopted with v3 plan contract. Corrects false cleanup claims from v2 authorization package.

---

## 1. What Source Roots Are

Source roots are **persistent benchmark inputs** — deterministic clean Git worktrees pinned at exact commits, used as read-only content sources for B8.1 fixture validation and benchmark execution.

**Location:** `/Users/Office/.brain/benchmark/b8-1/source-roots/<repositoryId>/<pinnedCommit>/`

**Creation:** `tools/lib/b8-1-prepare-source-roots.mjs` — idempotent, uses local Git object stores only, no network clones. Creates via `git worktree add --detach <path> <pinnedCommit>`.

**Retention:** Source roots persist across multiple runs of the same pinned commit. They are **not** ephemeral. Delete only when the pinned commit is removed from all active manifests.

---

## 2. Boundary

Source roots are **read-only benchmark inputs**. No writes occur inside source roots during preflight, materialization, or execution.

- Executors and validators read from source roots.
- All run output writes go to the run directory: `/Users/Office/.brain/benchmark/b8-1/runs/<runId>/`.
- The source root is never the target of any `fs.writeFileSync`, `fs.mkdirSync`, or archive extraction.

---

## 3. Permissions

No `chmod` is required after creation. Executables within source roots are never invoked directly from the source root during execution. Source roots contain source code as plain files.

---

## 4. Pre-Run Verification

Before every preflight run, `b8-1-prepare-source-roots.mjs --check` (or the equivalent in `prepare-b8-1-context-memory-benchmark.mjs`) verifies:

1. The source root directory exists at the expected path.
2. `git rev-parse HEAD` equals the pinned commit.
3. `git status --porcelain` is empty (clean tree).

Any failure blocks preflight with `source-root-overrides: fail` or `source-state-binding: fail`.

---

## 5. No-Edit Rule

Source roots must never be modified between preflight approval and execution. The plan digest binds `exportedTreeSha256` for each repository. If any file inside a source root changes after approval, the next source-state check will fail with a hash mismatch.

Do not:
- Commit into a source root worktree.
- Apply patches or edits inside a source root.
- Run any tool that writes to a source root.

---

## 6. Retention and Cleanup

- Retain source roots for as long as any active manifest pins their commit.
- When a manifest is updated to a new commit, the old source root may be removed with `git worktree remove --force <path>`.
- Running `b8-1-prepare-source-roots.mjs --check` reports roots for commits no longer in the current manifest (informational, does not delete).

---

## 7. Distinction from Run Materialization

| | Source Root | Run Directory |
|---|---|---|
| Role | Read-only benchmark input | Write output of preflight/execution |
| Path | `/…/source-roots/<repoId>/<commit>/` | `/…/runs/<runId>/` |
| Created by | `b8-1-prepare-source-roots.mjs` | `prepare-b8-1-context-memory-benchmark.mjs --materialize` |
| Lifetime | Persistent across runs | Per-run; may be deleted after evidence export |
| Contains | Git-managed source code at pinned commit | Evidence, receipts, source snapshots, logs |

---

## 8. Rejection Criteria

`b8-1-prepare-source-roots.mjs` and `applySourceRootOverrides()` in the preflight harness reject:

- **Symlink/path escape** — root must be a non-symlink directory; realpath must not escape the expected base.
- **Dirty root** — `git status --porcelain` must be empty.
- **Wrong top-level commit** — `git rev-parse HEAD` must equal the pinned commit.
- **Wrong Git top-level** — `git rev-parse --show-toplevel` must match the provided path.
- **Concurrent creation** — `fs.mkdirSync` with `recursive: false` fails if the directory already exists, preventing races.
- **Path traversal** — any `..` component in the source root path is rejected.

---

## 9. Correction of False Claim in v2 Authorization Report

The v2 authorization package (`b8-1-benchmark-authorization-package-2026-08-04.md`) states:

> *"Source roots are deterministic clean detached worktrees at `/Users/Office/.brain/benchmark/b8-1/source-roots/`. Created by `tools/lib/b8-1-prepare-source-roots.mjs` — idempotent…"*

And separately implied these were cleaned up after the dry-run. **This was incorrect.** The source roots:

- Were created during the v2 dry-run authorization.
- Were **not** deleted after the dry-run.
- **Persist** at `/Users/Office/.brain/benchmark/b8-1/source-roots/` as of 2026-08-04.

This is **correct behavior** per this specification. Source roots are persistent inputs, not ephemeral artifacts. The v2 report was misleading; this document corrects the record.

---

## 10. Shell-Free Archive Hashing

Tree hashing in `captureSourceState()` uses shell-free Node.js:

```js
const archiveBuf = execFileSync('git', ['-C', repoPath, 'archive', 'HEAD', '--format=tar'],
  { encoding: 'buffer', maxBuffer: 500 * 1024 * 1024 });
const hash = crypto.createHash('sha256').update(archiveBuf).digest('hex');
```

This replaces the previous `sh -c "git archive … | shasum"` pattern which:
- Required shell access (metacharacter injection risk for paths with spaces/special chars)
- Could fail silently on paths containing shell metacharacters
- Relied on `shasum` being in PATH

The new approach is portable, shell-free, and handles paths with spaces and metacharacters correctly. Repos exceeding 500MB return `null` for `exportedTreeSha256` rather than causing OOM.
