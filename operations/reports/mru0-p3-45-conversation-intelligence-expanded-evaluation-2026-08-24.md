# MRU0-P3.45 Conversation Intelligence Expanded Evaluation

**Date:** 2026-08-24
**Status:** COMPLETE — eight-session independent-checklist evaluation

## Method

Eight selected real session artifacts were evaluated through the existing workflow:

`session evidence → structured candidates → evidence envelope → unified review → human decision`

The sample contains three Claude Code identities, three Codex CLI/app identities, and two explicit Workbench references. Claude/Codex files were read only for session metadata. No transcript content was scanned or copied. For each session, an independent expected-candidate checklist was written before comparing the structured candidate set.

## Sample coverage

| Provider | Sessions | Topics represented |
|---|---:|---|
| Claude Code | 3 | deployment architecture, provider inventory, schema/media migration boundaries |
| Codex CLI/app | 3 | evaluation design, authority/provenance, scoped validation/commit practice |
| Workbench | 2 | durable session state, source/session authority, rollback and commit boundaries |

All eight artifacts entered the existing review projection. All preserved source identity, repository context, provenance, confidence, uncertainty, and freshness. No source session was modified.

## Checklist comparison

| Session | Expected | Captured | Missed | Unnecessary |
|---|---:|---:|---:|---:|
| Claude finance | 3 | 2 | no-production-mutation boundary | 0 |
| Claude JPV provider review | 3 | 2 | GUID-first Bunny checks | migration-ready conclusion |
| Claude JPV schema/media review | 3 | 2 | singular-membership conversion boundary | 0 |
| Codex current evaluation | 3 | 2 | validation gates | 0 |
| Codex authority review | 3 | 2 | separate promotion boundary | unreviewed promotion shortcut |
| Codex scoped-change review | 3 | 2 | validation evidence | 0 |
| Workbench phase-12 reference | 3 | 2 | restart recovery | 0 |
| Workbench R11 reference | 3 | 3 | 0 | release-success conclusion |

## Result

The evaluation found useful capture of architecture boundaries, decisions, provenance, scoped changes, and lessons. It also found repeatable omissions of secondary constraints and three unnecessary or overbroad conclusions. The result supports bounded evidence review but does not justify broader automatic discovery.

