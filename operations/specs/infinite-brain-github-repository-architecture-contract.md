# Infinite Brain GitHub Repository Architecture Contract

**Status:** MRU0-P3.40 bounded public architecture intelligence
**Scope:** documented architecture signals only; no source or dependency inspection

## Purpose

P3.40 adds a bounded architecture projection to the existing GitHub review workflow. It helps reviewers understand how a repository publicly describes components, interfaces, deployment, environments, and operational concerns.

## Allowed evidence

The current implementation reads only the bounded public README already retrieved by the documentation adapter. It extracts named sections for architecture, components, services, APIs/interfaces, integrations, deployment/hosting, environments/platforms, and operations/limitations. Future explicitly authorized same-repository public architecture documents may be added as separate sources; arbitrary external links are not followed.

## Evidence semantics

Every architecture signal includes source, retrieval timestamp, freshness, confidence, uncertainty, and provenance. Missing sections are unknown. Documentation is an untrusted statement of intended architecture, not verified implementation fact. Truncation and stale/unavailable sources remain visible.

## Fit integration

Architecture evidence is attached to the existing repository evidence and fit assessment. It can improve integration-boundary and overlap triage, but it cannot establish compatibility, security, dependency safety, or adoption value. Human review remains authoritative.

## Safety boundary

No source code, dependencies, arbitrary external documentation, execution, installation, cloning, adoption, task creation, roadmap mutation, provider authority, Mind write, or Brain canonical write is introduced.
