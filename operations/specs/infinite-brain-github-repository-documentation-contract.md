# Infinite Brain GitHub Repository Documentation Contract

**Status:** MRU0-P3.39 bounded README/documentation intelligence
**Scope:** public, bounded, read-only documentation evidence

## Purpose

P3.39 adds a bounded README evidence layer to the existing GitHub repository review workflow. It captures what a repository publicly documents about its purpose and scope without treating documentation as verified implementation fact.

## Source and limits

The adapter requests only the public GitHub README endpoint, limits decoded content to 64 KiB, and does not clone, execute, install, inspect source code, inspect dependencies, or follow arbitrary external links. Supported signals are:

- stated purpose;
- documented capabilities;
- target users;
- supported technology mentions;
- integration points;
- examples/use cases;
- documented limitations.

Signals are bounded text extracted from named README sections. They are not generated claims.

## Evidence contract

Each signal contains its source, retrieval timestamp, freshness, confidence, uncertainty, and provenance. Unavailable, stale, truncated, minimal, and misleading documentation remains visible as uncertain evidence. Documentation status and README URL provenance are retained separately from repository metadata.

## Fit integration

Documentation evidence is added to the existing repository evidence and fit assessment. It can improve purpose and overlap triage, but it cannot establish integration compatibility, security, dependency safety, or adoption value. Human review remains authoritative.

## Safety boundary

The adapter is read-only and advisory. It does not create recommendations as decisions, write Mind, write Brain canonical state, modify roadmaps, create tasks, trust external code, or grant provider/execution authority.
