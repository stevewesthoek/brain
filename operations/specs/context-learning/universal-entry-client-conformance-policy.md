# Infinite Brain Universal Entry Client Conformance Policy

**Status:** Phase 6D universal adapter conformance contract
**Runtime status:** validation only; no client activation, configuration change, adapter, or execution hook is authorized

## Purpose

This policy proves that replaceable clients can consume the same Universal Infinite Brain Entry Point without becoming authorities. Conformance is evaluated over the bounded output of the existing universal entry consumer.

## Required adapter behavior

Every client profile must:

1. discover the Brain revision, authority registry reference, and navigation contract;
2. consume the bounded bootstrap before requesting deeper context;
3. preserve Brain/Mind authority boundaries;
4. surface freshness and session conflicts;
5. fail closed when the entry is unavailable, stale, conflicting, or authoritative context is unknown;
6. avoid loading full repositories, full conversations, secrets, or client configuration through the Brain bootstrap.
7. consume the same versioned universal stages and preserve the semantic route,
   gate, context, evidence, safety, receipt, and continuation fields.
8. report every required capability negotiation outcome; unavailable required
   capabilities must be explicit and fail closed.

## Environment boundaries

| Consumer surface | Conformance boundary |
|---|---|
| Claude Code | Thin universal adapter; local session/runtime behavior remains outside Brain authority. |
| Codex | Thin universal adapter; existing Code canary remains separately bounded. |
| Cursor | Thin universal adapter; IDE behavior remains outside Brain authority. |
| Kiro | Thin universal adapter; live ignored projection remains separately authorized. |
| Antigravity | Thin universal adapter; tracked projection and runtime remain separately verified. |
| Gemini | Thin universal adapter; model/provider behavior remains outside Brain authority. |
| Workbench | Brain context bridge; MCP and execution authority remain separately controlled. |
| Future consumer | Must support the same versioned stages, progressive retrieval, freshness, authority, negotiation, and fail-closed requirements. |

These labels identify consumer profiles only. They do not activate or configure any client.

## Validation model

The validator checks provider neutrality, visible Brain revision and authority boundaries, bounded navigation, progressive retrieval, freshness visibility, no authority escalation, no automatic takeover, and zero provider calls/writes. Failure outputs are conformant only when they fail closed and preserve zero mutation/execution authority.

Conformance output is deterministic and derived from the supplied read-only consumption result. It is not a memory store, authority registry, routing layer, or client adapter.

## Acceptance boundary

MRU0-P2.8 does not activate Claude, Codex, Workbench, or future agents; modify client instructions/configuration; introduce automatic bootstrap; create client memory; or expose execution. Client-specific activation and runtime conformance are separate future decisions.
