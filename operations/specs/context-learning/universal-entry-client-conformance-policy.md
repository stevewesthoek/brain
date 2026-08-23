# Infinite Brain Universal Entry Client Conformance Policy

**Status:** MRU0-P2.8 read-only validation contract
**Runtime status:** validation only; no client activation, configuration change, adapter, or execution hook is authorized

## Purpose

This policy proves that replaceable clients can consume the same Universal Infinite Brain Entry Point without becoming authorities. Conformance is evaluated over the bounded output of the existing universal entry consumer.

## Required client behavior

Every client profile must:

1. discover the Brain revision, authority registry reference, and navigation contract;
2. consume the bounded bootstrap before requesting deeper context;
3. preserve Brain/Mind authority boundaries;
4. surface freshness and session conflicts;
5. fail closed when the entry is unavailable, stale, conflicting, or authoritative context is unknown;
6. avoid loading full repositories, full conversations, secrets, or client configuration through the Brain bootstrap.

## Environment boundaries

| Consumer | Conformance boundary |
|---|---|
| Claude | Brain context consumer; local session/runtime behavior remains outside Brain authority. |
| Codex | Brain context and continuity consumer; session/model behavior remains outside Brain authority. |
| Workbench | Brain context bridge; MCP and execution authority remain separately controlled. |
| Future agent | Must support the same entry, progressive retrieval, freshness, authority, and fail-closed requirements. |

These labels identify consumer profiles only. They do not activate or configure any client.

## Validation model

The validator checks provider neutrality, visible Brain revision and authority boundaries, bounded navigation, progressive retrieval, freshness visibility, no authority escalation, no automatic takeover, and zero provider calls/writes. Failure outputs are conformant only when they fail closed and preserve zero mutation/execution authority.

Conformance output is deterministic and derived from the supplied read-only consumption result. It is not a memory store, authority registry, routing layer, or client adapter.

## Acceptance boundary

MRU0-P2.8 does not activate Claude, Codex, Workbench, or future agents; modify client instructions/configuration; introduce automatic bootstrap; create client memory; or expose execution. Client-specific activation and runtime conformance are separate future decisions.
