# B8.1 V2.1 Cold-CPU Headroom Owner Decision Report

**Date:** 2026-08-10  
**Contract:** B8.1-V2.1  
**Amendment:** `maximumPeakCpuPercent` 650 → 700 (cold-start only)  
**Status:** OWNER AUTHORIZED

---

## Background

The prior V2.1 amendment (commit f6fed584) raised cold-start RSS from 1536→2048 MiB
and cold-start CPU from 600→650% to account for mimalloc arena scaling observed under
high-free-memory conditions. That amendment was authorized by the owner.

A subsequent Node-runtime identity drift was discovered: the V2.1 rehearsal and plan
had been generated under Homebrew Node v25.9.0 rather than the canonically pinned NVM
Node v20.20.2. Commit 930ebd48 fixed this by adding `assertPinnedRuntime()` guards and
invalidating the Node25 plan digest.

## Failing Observation

After re-running the 5/5 disposable rehearsal under correctly-pinned Node v20.20.2:

- Run 4 / repository `prochat` cold-start CPU: **587.097%**
- Effective limit under 650% nominal + 10% headroom: **585.0%**
- Overage: +2.097 percentage points

All other 29 gates (28 aggregate + per-run quality/lifecycle) passed 5/5.

## Owner Decision

> "I authorize raising B8.1 V2.1 maximumPeakCpuPercent from 650% to 700%, preserving
> the existing 10% required-headroom rule. Effective cold-CPU rehearsal ceiling becomes
> 630%.
>
> Rationale: under the correctly pinned Node v20.20.2 runtime, one representative
> ProChat cold-start reached 587.097%. The raw 650% cap passed, but the 585% headroom
> gate failed by 2.097 percentage points. 660% would yield only 594% effective and is
> too brittle. 700% yields 630% effective, ~7.3% margin above the observed maximum,
> while still bounding CBM to 7 logical cores nominal on this 12-logical-CPU host.
> This is a measured resource-envelope correction, not permission to relax quality gates.
>
> Do NOT change any other threshold merely to obtain a pass. If any representative run
> exceeds 630% CPU after this amendment, STOP for a new owner decision rather than
> raising the cap again."

## Amendment Scope — EXACTLY ONE FIELD

| Field | Before | After | Changed |
|---|---|---|---|
| `resourceBudget.coldStart.maximumPeakRssMiB` | 2048 | 2048 | **no** |
| `resourceBudget.coldStart.maximumPeakCpuPercent` | 650 | **700** | **YES** |
| `resourceBudget.coldStart.maximumIndexingTimeMsPerRepository` | 30000 | 30000 | **no** |
| All steadyState thresholds | unchanged | unchanged | **no** |
| All quality/accuracy gates | unchanged | unchanged | **no** |
| `rehearsalPolicy.requiredHeadroomRatio` | 0.1 | 0.1 | **no** |

Effective cold-CPU ceiling: 700% × 0.9 = **630%**.  
Observed Node20 maximum: 587.097%. Margin: 42.903 percentage points (7.3% above nominal).

## Finality

700% is the final bounded correction based on current evidence. No further CPU ceiling
raises are authorized without a new owner decision and new supporting rehearsal data.
