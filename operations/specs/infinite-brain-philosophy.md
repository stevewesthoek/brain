# Infinite Brain Philosophy

**Status:** canonical philosophy  
**Contract version:** 1.0
**Purpose:** define the first principles that guide Infinite Brain across Brain and Mind without collapsing their distinct responsibilities.

## Core idea

Infinite Brain is a human-first knowledge system that improves over time by preserving provenance, surfacing change, and turning reviewed insight into durable knowledge.

```text
capture continuously
→ preserve sources
→ keep current truth visible
→ turn reviewed insight into durable knowledge
→ retrieve what matters
→ detect change and contradiction
→ update or supersede stale knowledge
→ preserve useful history
→ improve through continued use
```

The value of Infinite Brain is not the number of files it stores. Its value is that knowledge remains understandable, retrievable, current, and useful over time.

## Human-first rule

Infinite Brain must stay readable and navigable for humans first.

Therefore:

- fewer folders are better;
- shallow structure is better than deep nesting;
- one clear page is better than several fragmented indexes;
- natural titles and links are better than machine-only identifiers;
- automation should reduce maintenance, not make the system feel technical;
- important truth changes remain visible and reviewable by a human.

## Brain and Mind

The repositories are separate but paired:

```text
brain = AI operating system
mind  = human knowledge and personal operating system
```

Brain owns:

- AI skills and orchestrators;
- automation and runtime behavior;
- schedulers and queues;
- model routing;
- technical runbooks and system health;
- machine-facing execution logic;
- approval, recovery, and runtime safety boundaries for Brain-owned automation.

Mind owns:

- personal knowledge and convictions;
- business strategy and decisions;
- active projects and priorities;
- research conclusions;
- durable human context;
- the current human interpretation of what is true and important.

Mind remains the authority for human and business truth. Brain may observe, classify, summarize, compare, and propose changes to Mind, but Brain does not redefine Mind truth on its own.

## Shared Infinite Brain laws

Brain and Mind should follow the same underlying laws, even though their implementations differ.

### 1. Retrieve selectively

Do not load or review everything when one relevant page or source is enough.

### 2. Preserve provenance

Important claims, conclusions, and decisions should retain links to their source when useful.

### 3. Current truth wins

Stored knowledge is not permanent proof. New evidence may change an earlier conclusion.

### 4. Surface contradictions

Do not silently merge conflicting information. Show the conflict and prepare a reviewed resolution.

### 5. Revalidate changing knowledge

Business strategy, active projects, technical stacks, vendors, pricing, schedules, and procedures can become stale.

### 6. Preserve history without confusing it with current truth

Superseded or completed material should move out of the active layer while remaining available in archive/history.

### 7. Prevent unnecessary duplication

Before creating durable knowledge, check whether an existing page should be updated instead.

### 8. Improve through reviewed use

Each capture, decision, correction, and completed project should have the opportunity to improve future work.

### 9. Human approval governs important truth changes

Automation may detect, prepare, and recommend. It must not silently redefine personal beliefs, business strategy, priorities, or durable conclusions.

### 10. Keep the system calm

The Infinite Brain should feel simpler as it grows, not more complicated.

## Brain-specific responsibilities

Brain is responsible for implementation, execution safety, and operational surfacing.

- Brain Core may expose read-only scheduler, runtime report, and approval surfaces.
- The bounded maintenance pilot remains report-only unless a separate approved write path is introduced.
- Mind Steward remains a Brain-side bridge for classification and report-only preflights, not a general Mind writer.
- Scheduler integration must stay explicit and observable.
- Approval flows must distinguish proposed, approved, applied, and rejected states.
- Recovery flows must preserve user work and avoid destructive defaults.

## Mind-specific responsibilities

Mind is responsible for durable human knowledge and the structure that makes that knowledge usable.

- Mind keeps current truth visible to humans.
- Mind keeps reviewed history available without conflating it with active truth.
- Mind owns the contract for human and business meaning.
- Mind records maintenance and write-policy decisions only through explicit review and approved write proposals.

## Bridge and maintenance boundaries

Brain and Mind interact through bounded contracts, not implicit side effects.

- Brain may generate report-only maintenance findings.
- Brain may generate approved write proposals after human review.
- Mind remains read-only until an approved write path is explicitly selected.
- The bounded maintenance pilot reads exactly the approved pilot files, writes only the latest maintenance reports, and validates that no protected source files changed.
- Mind Steward report-only preflights may classify and summarize, but they must not enable automatic Mind writes.
- Scheduler surfaces may display report-backed status, but they do not imply autonomous execution.
- Approval and recovery are separate from report generation.

## Drift prevention checklist

- Keep the shared laws identical across Brain and Mind.
- Keep repo-specific implementation responsibilities in separate sections.
- Keep Mind as the authority for human and business truth.
- Keep report-only, approved-write, scheduled, and continuous phases distinct.
- Keep the maintenance pilot bounded to its documented files and outputs.
- Keep scheduler and approval docs explicit about what executes and what only reports.
- Prefer links to canonical docs instead of duplicating roadmap material.
