# Codex Live Infinite Brain Consumption Pilot Policy

**Status:** MRU0-P3.2 bounded live Codex pilot
**Runtime boundary:** read-only consumption in the current Codex environment; no Codex configuration, provider call, memory store, or autonomous action

## Pilot path

`verified Brain source identity → Codex entry discovery → bounded bootstrap → continuity binding → freshness/authority visibility`

The pilot consumes only the Universal Brain Entry contract and its bounded pointers. It does not load the full repository, conversations, secrets, or unrelated history.

## Source and session requirements

The source must provide repository, worktree, branch, and current Brain revision. The Codex session must bind to the same repository, worktree, branch, and Brain revision, have no conflicts, and require confirmation before mutation, execution, provider calls, or external effects.

## Evidence

The pilot records entry version/revision, source identity, dirty-item count, bounded bootstrap size, pointer count, freshness and authority visibility, continuity compatibility, and exclusion metrics. It records aggregate state only and does not ingest transcripts.

## Failure and rollback

Missing source identity, revision mismatch, stale context, or session conflict fails closed. Disable by running with `enabled=false`; restore the prior Codex session path. No Codex configuration or external session state is changed by this module.

## Authority boundary

Codex is a context consumer. Brain remains the AI-system authority and Mind remains the human meaning/priority authority. This pilot grants Codex no memory, knowledge, decision, execution, or mutation authority.
