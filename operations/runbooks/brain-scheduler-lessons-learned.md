# Brain Scheduler — Lessons Learned

These lessons are the durable operational knowledge from the scheduler
reconciliation, migration, preflight, natural-run acceptance, and closeout.
They are guidance for future maintenance; they do not authorize a production
change by themselves.

1. **One typed registry is essential.** Shell function lists, reports, old JSON
   inventories, and UI ordering drifted. The typed registry is now the only
   inventory and safety-metadata authority.
2. **Source identity and deployment identity are different facts.** A clean
   repository or matching plist does not prove that launchd is executing that
   source. Verify the detached runtime, installed realpath, arguments, working
   directory, and Core `matchesSource` evidence together.
3. **A stable label does not imply a stable runner.** Keep
   `com.office.nightly-scheduler` for continuity, but treat the runner and
   working directory as first-class deployment identity.
4. **`RunAtLoad=false` is a safety boundary.** Bootstrap/reload must not become
   an accidental production invocation. The runner's Lisbon cutoff, duplicate-
   day, and lock guards remain defense in depth, not permission to reload.
5. **Natural-run acceptance must remain natural.** Do not replace the first
   calendar trigger with `FORCE_RUN`, kickstart, a manual runner call, or a job
   rerun when proving launchd behavior.
6. **A detached clean runtime reduces ambiguity.** A shared checkout can be
   dirty, on the wrong branch, or changing while launchd runs. Production
   provenance belongs to the clean runtime named by the installed plist.
7. **Local locked dependencies beat network fallback.** The Mind Steward
   wrapper uses the repository-local locked `tsx`; missing dependencies fail
   closed. Scheduled `npx --yes`, global package lookup, and automatic download
   are not acceptable.
8. **Lifecycle filtering is a hard gate.** Only `lifecycle: active` jobs may
   spawn children. `disabled`, `policy-blocked`, `deprecated`, and `obsolete`
   entries must still receive explicit non-runnable receipts where applicable.
9. **Fail-closed state is safer than guessed recovery.** Malformed,
   impossible, multiline, empty, or future completion state must block before
   child execution. Operators repair state explicitly after preserving
   evidence.
10. **A stale lock is a health failure.** The observer must not silently delete
    a lock or assume that an interrupted process is harmless.
11. **Receipts and job artifacts are different contracts.** A job may be
    stdout-only while the scheduler still owns a successful per-job receipt.
    `outputArtifacts` must describe files the job itself produces, not the
    scheduler's receipt.
12. **Missing evidence is not success.** Repository configuration, old `.last`
    markers, an old report, or a loaded label cannot substitute for a current
    canonical receipt and bounded runtime evidence.
13. **Observers are diagnostic only.** The temporary acceptance observer had a
    minimal-PATH `node` failure. It did not invalidate the accepted canonical
    receipt and was removed rather than promoted into a second authority.
14. **Console and Core should stay read-only.** Core adapts runtime evidence;
    Console renders it. Neither should become a hidden execution, enablement,
    retry, or repair surface.
15. **Historical reports must stay immutable.** Old reports preserve what was
    observed at their date. A current-state document and report index provide
    current navigation without rewriting historical facts.
16. **The active set should be boring.** Report-only local jobs are easy to
    reason about. Financial, credential-sensitive, external-write,
    destructive, and Mind-write-capable work stays blocked or disabled.
17. **No parallel scheduler lane should be inferred.** Graphify semantic work,
    memory-context refresh, NotebookLM ideas, n8n backups, and app-specific
    scripts need their own explicit admission. A mention of the legacy wrapper
    does not create a current scheduled path.
18. **Documentation is part of the operational contract.** Every registry
    change must update the current-state view, decision table, change checklist,
    report index, and relevant consumer guidance before deployment review.
