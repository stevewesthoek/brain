# Video Orchestrator Option D — Revised Implementation Plan and Task Breakdown

**Status:** adopted planning update  
**Date:** 2026-05-14  
**Resumes from:** VO-7BV complete  
**Architecture decision source:** `operations/runbooks/1778778167625-video-orchestrator-says-the-bible-migration-architecture.md`  
**Legacy repo mutation:** forbidden in this phase  
**Real upload execution:** paused until explicit later approval  

## Why Option D is reframed

The previous Option D path asked for target platform, credential strategy, media boundary, network/API boundary, kill switch, single-upload constraint, visibility, and first implementation mode. The new architecture decision answers these at a higher level:

- YouTube is the first platform path.
- Says the Bible already has a working YouTube pipeline and should remain unchanged for now.
- Video Orchestrator should become the one reusable production house and upload pipeline across all projects/platforms/accounts.
- Says the Bible should later migrate into Video Orchestrator as a project/account configuration, not be copied as a redundant project-specific pipeline.
- Before real upload execution, Video Orchestrator needs a general project/platform/account model, credential/OAuth UI design, platform policy/resume design, and preflight layers.

## Architectural answers

### What happens to the Says the Bible pipeline?

Keep it running unchanged while the Video Orchestrator is built beside it.

The Video Orchestrator should learn from it and reuse concepts, not mutate or duplicate it wholesale. The long-term target is one canonical Video Orchestrator pipeline that can serve Says the Bible and all other projects.

### Should Video Orchestrator incorporate the Says the Bible pipeline?

Yes, conceptually and eventually operationally, but through migration and abstraction:

1. Read the legacy pipeline read-only.
2. Extract reusable concepts: OAuth, scheduled YouTube upload, resumable upload, quota handling, YouTube/DB sync, output folder conventions, thumbnail sync, pipeline state.
3. Build project-agnostic Video Orchestrator interfaces.
4. Add Says the Bible as a project configuration in Video Orchestrator.
5. Run both pipelines in parallel until Video Orchestrator proves parity.
6. Cut over only after repeated successful scheduled uploads and recovery behavior.

### Should Video Orchestrator spin up beside it?

Yes. That is the safe migration path.

## Revised Option D phases

### VO-7BX — Project / Platform / Account Model Design

**Goal:** Define the canonical data model and UI concepts for projects, platform accounts, credential references, OAuth connection state, and per-account capabilities.

**Tasks**
- Define project/account/platform/account-credential conceptual model.
- Define safe schema types for project, platform account, credential reference, OAuth status, capability, and upload gate state.
- Define dashboard UI sections: Projects, Platform Accounts, Credential Health, OAuth Connect, API Setup Instructions, Account Limits, Upload Gates.
- Define deep-link/manual setup guidance model per platform.
- Define multi-account association rules: one project can have multiple accounts per platform.
- Define secret boundaries: no raw tokens in repo, logs, docs, chat, or dashboard output.

**No-go boundaries**
- No database migrations yet.
- No OAuth callbacks yet.
- No token storage yet.
- No env writes yet.
- No upload execution.

### VO-7BY — Says the Bible Legacy Mapping and Migration Bridge Design

**Goal:** Map Says the Bible concepts to Video Orchestrator abstractions without changing the legacy repo.

**Tasks**
- Map STB output folders to Video Orchestrator render artifacts.
- Map STB YouTube upload metadata to Video Orchestrator upload package metadata.
- Map STB OAuth/token file concept to Video Orchestrator credential-reference concept.
- Map STB scheduled publish behavior to Video Orchestrator scheduled upload policy.
- Map STB sync/resume concepts to Video Orchestrator upload lifecycle/resume state.
- Define a read-only migration bridge that can ingest metadata from STB later without mutating STB.

**No-go boundaries**
- No STB repo writes.
- No copying credentials.
- No live STB pipeline calls.
- No upload execution.

### VO-7BZ — YouTube Platform Policy, Scheduling, Quota, and Resume Design

**Goal:** Define YouTube-specific platform policy for scheduled upload, quota/rate-limit handling, and resume behavior.

**Tasks**
- Define YouTube scheduled-first default: scheduled upload when supported, private fallback otherwise.
- Define one-upload-first rule and idempotency key.
- Define upload attempt states: planned, preflighted, queued, uploading, uploaded, scheduled, blocked, retryable, failed, canceled.
- Define quota/rate-limit blocked states and automatic resume behavior on next scheduled job.
- Define duplicate prevention: one render plan/account/platform attempt unless explicitly overridden.
- Define safe error taxonomy for quota/rate-limit/auth/media/platform failures.
- Define post-upload verification requirements without exposing raw responses.

**No-go boundaries**
- No network calls.
- No YouTube API calls.
- No credential reads.
- No media reads.
- No upload execution.

### VO-7CA — Credential / OAuth UI Flow Design

**Goal:** Design the ProBot dashboard credential/account UI and OAuth/manual setup flow.

**Tasks**
- Define dashboard screens and state transitions.
- Define OAuth Connect button flow.
- Define manual API-key setup instructions and deep-link model.
- Define redacted credential health display.
- Define connection status states: disconnected, setup_required, auth_started, connected, expired, revoked, invalid_scope, blocked.
- Define env-write or secret-write abstraction as a future separate permissioned operation.

**No-go boundaries**
- No UI implementation yet unless separately approved.
- No token exchange.
- No Keychain/env/database secret writes.
- No package metadata changes.

### VO-7CB — YouTube Credential / Media / Network Preflight Contracts

**Goal:** Add inert preflight contracts for YouTube credential, media, and network boundaries.

**Tasks**
- Create preflight contract helpers that check only declared metadata.
- Credential boundary: credential reference exists as a safe label; raw credential access remains false.
- Media boundary: render artifact reference exists as an approved relative/safe reference; media read remains false.
- Network boundary: intended YouTube operation is declared; network call remains false.
- Platform API boundary: intended YouTube method is declared; API call remains false.
- Validate scheduled/private fallback policy and one-upload constraint.

**No-go boundaries**
- No credential reads.
- No media reads.
- No network/API calls.
- No raw payloads or responses.

### VO-7CC — YouTube Preflight Review and Safe Report

**Goal:** Review the preflight contracts and produce a safe report before any actual credential/media/network preflight implementation.

**Tasks**
- Review credential reference contract.
- Review media boundary contract.
- Review network/platform API boundary contract.
- Review scheduling/idempotency rules.
- Review kill-switch gates.
- Produce safe report that can only approve a future live preflight implementation.

**No-go boundaries**
- No credential reads.
- No media reads.
- No network/API calls.
- No upload execution.

### VO-7CD — Live Preflight Implementation Boundary

**Goal:** Prepare a separate approval boundary for live preflight implementation.

**Tasks**
- Define exact files allowed to change for live preflight.
- Define whether Keychain/env/database secret access is allowed.
- Define whether media stat/read is allowed.
- Define whether a YouTube account/channel identity check is allowed.
- Define what outputs are redacted and stored.

**No-go boundaries**
- No live preflight yet.
- No upload execution.

### VO-7CE — First Controlled YouTube Upload Boundary

**Goal:** Prepare the final explicit approval boundary for one controlled YouTube upload attempt.

**Tasks**
- Confirm one project, one account, one platform, one render artifact, one upload attempt.
- Confirm scheduled-first default; private fallback if scheduling is not available.
- Confirm idempotency key and duplicate prevention.
- Confirm rollback/remediation approach if upload succeeds but metadata/thumbnail/schedule is wrong.
- Confirm no bulk uploads, no loops, no unrelated metadata changes, no deletes.

**No-go boundaries**
- No upload until this boundary is explicitly approved.

## Immediate next implementation task after documentation update

Resume from VO-7BV with VO-7BX: create project/platform/account model design helpers and tests in Brain only.

The next code work should still be design/schema/helper-only unless a separate approval is granted for database migrations, UI implementation, OAuth callback routes, secret writes, or real platform calls.

## Clarifications captured

### Media boundary example

A media boundary is the approved set of generated files the uploader may inspect or read.

Example: allow one render output and thumbnail for a specific render plan, but block arbitrary filesystem reads, unrelated project folders, `.env`, token files, or home-directory scanning.

### Network/platform API boundary example

A network/platform API boundary is the approved external operation.

Example: allow a future YouTube channel identity preflight or one future scheduled upload, but block arbitrary outbound requests, deleting videos, mass thumbnail changes, or metadata changes outside the approved upload.

## Recommendation retained

Start with credential/media/network preflight before any real upload. The first real upload should be single-attempt, scheduled-first, and guarded by global/project/account gates.
