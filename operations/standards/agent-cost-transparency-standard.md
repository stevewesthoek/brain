# Agent Cost Transparency Standard

**Status:** Active  
**Scope:** Brain Core agent surfaces, Brain Console, selector-aware routing

## Purpose

Define the minimum fields and reporting contract for cost-aware agent routing in Brain.

## Required cost fields

Every reported cost event or cost line item must include:

- timestamp or generatedAt
- repo or workspace context when known
- task id
- task type
- provider id
- surface
- model
- estimated token count
- estimated cost in USD
- routing reason
- escalation reason, if any

## Cost aggregation levels

- Session
- Task
- Agent
- Provider
- Surface

## Reporting rules

- Report estimated spend even when the provider has no direct marginal cost.
- Mark the source of the cost as `derived`, `snapshot`, or `runtime` when available.
- Keep the summary surfaces read-only unless a later phase explicitly adds mutation.
- Do not hide escalations; log the reason that a cheaper route was not used.

## Brain Console expectations

- Show today, week, and month spend.
- Show cheapest-capable routes chosen.
- Show escalations separately.
- Show budget state as `ok`, `warning`, `throttled`, or `blocked`.

## Verification

- `/agent-cost-summary` returns a read-only summary.
- Routing choices are explainable from the returned line items.
- Snapshot persistence preserves the same contract when present.
