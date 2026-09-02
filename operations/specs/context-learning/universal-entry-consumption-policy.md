# Infinite Brain Universal Entry Consumption Policy

**Status:** Phase 6D universal consumer contract v1; provider-neutral consumption contract
**Runtime status:** read-only contract and pure consumer only; no client activation is authorized

The versioned Brain-owned consumer envelope is
`operations/specs/infinite-brain-universal-consumer-contract.v1.json`. It is
consumed through a thin environment adapter; the adapter is not a second
orchestrator.

## Purpose

The Universal Infinite Brain Entry Point is a bounded navigation contract. A client consumes its minimal bootstrap and retrieves deeper context only when the task requires it. The entry is a projection over canonical Brain and Mind authority; it is not a new store, decision system, or execution surface.

## Discovery and bootstrap

A consumer must locate the entry contract, verify its schema mode, Brain revision, authority-registry reference, provider-neutral marker, and navigation pointers. The immediate bootstrap contains only identity, authority boundaries, Brain/Mind/context/session navigation, current operating status, freshness, and continuity status.

The consumer must not load the full repository, conversation history, secrets, or client configuration as part of bootstrap.

After bootstrap, the universal progression is
`BrainRequest → BrainRoute → TaskPacket → CompositionGraph → ContextRequest[]
→ CapabilitySelection[] → GateSelection[] → EvidencePacket[] → BrainResult →
Continuation`. All stages remain Brain-owned and versioned; an adapter may only
translate native input/session data, report capabilities, render results, and
expose references.

## Progressive retrieval

| Layer | Behavior |
|---|---|
| Immediate | Identity, authority boundaries, navigation, operating status, freshness, continuity |
| On demand | Observations, capabilities, decision awareness, evolution awareness, and exact cited sources |
| Untouched | Full repository, full conversations, secrets, and client configuration |

Retrieval remains bounded, cited, freshness-visible, and subject to the existing Context Broker contracts. Structural navigation is a pointer, not authority.

## Environment boundary

Claude Code, Codex, Cursor, Kiro, Antigravity, Gemini, Workbench, and future
clients are replaceable environment adapters. The Brain entry contract supplies
shared navigation and safety semantics but never selects a client model, changes
a session, grants execution authority, or becomes an environment's source of
truth. Capability equivalence, rather than client identity, determines whether a
route is supported, degraded, externally dependent, unavailable, or blocked.

## Fail-closed behavior

Consumption fails closed when the entry is unavailable, its authority is unknown, provider neutrality is absent, navigation is incomplete, freshness is stale/superseded/contradicted/unknown, or session conflicts are present. The consumer may report the bounded identity and reason, but it must not resume, mutate, execute, or silently treat stale context as current.

An unknown continuity state is surfaced as a warning and is not an automatic resume permission. Confirmation remains required before any future mutation outside this read-only packet.

## Safety and provenance

The consumer records source revision, authority reference, freshness, conflicts, and bounded warnings. It performs no provider calls and no writes. Mind remains the authority for meaning, priorities, strategy, and personal/business context; Brain remains the authority for AI-system knowledge, operational policy, validation, and bounded execution rules.

## Acceptance boundary

This contract is accepted when its pure consumer demonstrates bounded deterministic output, progressive retrieval, provider neutrality, Mind/Brain separation, visible freshness, fail-closed failure handling, and zero mutation/provider activity. Client bootstrap activation and client conformance migration are separate future packets.
