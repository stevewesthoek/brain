# MRU0-P3.43 Conversation Intelligence Operational Usage Report

**Date:** 2026-08-24
**Status:** COMPLETE — controlled real-session evidence validation

## Method

Four explicitly selected session artifacts were used through the existing path:

`conversation evidence → review inbox → daily review → human decision`

The sample used real local Claude and Codex session identities and an explicit Workbench session reference. Only metadata was read from Claude/Codex files; no transcript content was dumped or persisted. Candidate statements were bounded, sanitized, structured evidence derived from known outcomes of those sessions. This is an operational validation of the evidence contract and review workflow, not a claim that the current adapter can autonomously discover or semantically extract those statements.

## Sample

| Provider | Session context | Candidate | Freshness | Review state exercised |
|---|---|---|---|---|
| Claude Code | `yeshuaacademy/web/finance` | protected deployment-identity architecture decision | stale | accepted |
| Codex | `brain` | validation-gate lesson | fresh | rejected |
| Codex | `brain` | unresolved TypeScript-toolchain question | stale | deferred |
| Workbench | `workbench-private` explicit phase-12 reference | session-continuity lesson | stale | archived |

## Workflow result

- Four evidence artifacts became four pending unified-review items.
- All four retained source session identity, repository context, source hash, provenance, timestamp, freshness, confidence, and uncertainty.
- Human decisions produced exactly one each of `accepted`, `rejected`, `deferred`, and `archived`.
- Review invariants remained true: no Mind write, no Brain canonical write, no automatic decision, no automatic promotion, and no new storage authority.

## Usefulness assessment

**What worked:**

- Important decision and lesson categories were concise enough to review quickly.
- Repository context distinguished finance, Brain, and Workbench evidence.
- Stale evidence was visible rather than silently treated as current.
- The review workflow made it possible to retain, reject, defer, or archive evidence without changing source sessions.
- Source identity and hashes reduce the cost of locating the originating session later.

**What remains unproven:**

- Extraction recall and precision were not measured because the candidates were explicitly supplied from known session outcomes.
- Noise reduction cannot yet be measured against a raw-session baseline.
- Future investigation time savings were demonstrated qualitatively by source-linked review, not with a timed operator study.

## Conclusion

The capability provides meaningful value as a safe review container and provenance-preserving handoff for selected session knowledge. It does not yet provide evidence that automatic discovery or semantic extraction would improve decisions enough to justify their privacy and complexity cost.

