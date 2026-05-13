# Video Orchestrator Roadmap — Phase 0 → Phase 5+ (Revised)

**Date Updated:** 2026-05-13 (VO-7AA Complete)  
**Status:** Phase 0–1 complete (smart routing, 4 local models). Phase 2A–2E complete (project distribution, packages, drafts, content briefs). Phase 3A–3D complete (media validation, render planning, file existence validation, manifest consistency checks). Phase 3E complete (render execution gate, manual export bundle, operator approval workflow). Phase 3F complete (operator approval records, render-readiness freeze snapshots). Phase 4A complete (render executor contract, dry-run command manifest). Phase 4B complete (renderer preflight environment checks). Phase 4C complete (renderer binary discovery manifests). Phase 4D complete (operator-approved renderer version check plan). Phase 4E complete (mock renderer execution result contract). Phase 4F—Real Renderer Execution Spike Gate (VO-5A) complete. Phase 5A—Real Renderer Execution Approval Record (VO-5B) complete. Phase 5B—Explicit Local Render Spike, Test-Only Asset, Operator-Gated (VO-6A) complete. Phase 5C—Controlled Production Render Design (VO-6B) complete. Phase 5D—Source Media Inventory and Read-Only Validation (VO-6C) complete. Phase 5E—Output Directory Approval and Write Boundary (VO-6D) complete. Phase 5F—Final Production Render Execution Request (VO-6E) complete. Phase 5G—Controlled Production Render Spike (VO-7A) complete. Phase 5H—Operator Review of Generated Local Output (VO-7B) complete. Phase 5I—Upload Package Design (VO-7C) complete. Phase 5J—Platform Upload Request Artifact (VO-7D) complete. Phase 5K—Upload Execution Approval (VO-7E) complete. Phase 5L—Upload Execution Design (VO-7F) complete. Phase 5M—Dry-Run Upload Spike Simulation (VO-7G) complete. Phase 5N—Real Upload Readiness Assessment (VO-7H) complete. Phase 5O—Real Upload Execution Request (VO-7I) complete. Phase 5P—Real Upload Strategy Design (VO-7J) complete. Phase 5Q—Real Upload Execution Plan (VO-7K) complete. Phase 5R—Real Upload Dry-Run Execution Simulator (VO-7L) complete. Phase 5S—Final Real Upload Preflight Gate (VO-7M) complete. Phase 5T—Real Upload Implementation Design (VO-7N) complete. Phase 5U—Real Upload Scaffold Design (VO-7O) complete. Phase 5V—Real Upload Scaffold Contracts (VO-7P) complete. Phase 5W—Real Upload Scaffold Contract Tests (VO-7Q) complete. Phase 5X—Real Upload Scaffold Stub Design (VO-7R) complete. Phase 5Y—Real Upload Stub Contracts (VO-7S) complete. Phase 5Z—Real Upload Stub Contract Tests (VO-7T) complete. Phase 5AA—Real Upload Stub No-Op Implementation Design (VO-7U) complete. Phase 5AB—Real Upload No-Op Stub File Plan (VO-7V) complete. Phase 5AC—Real Upload No-Op Stub File Creation (VO-7W) complete. Phase 5AD—Real Upload No-Op Stub Wiring Plan (VO-7X) complete. Phase 5AE—Real Upload No-Op Wiring Contracts (VO-7Y) complete. Phase 5AF—Real Upload No-Op Wiring Contract Tests (VO-7Z) complete. Phase 5AG—Real Upload No-Op Wiring Readiness Review and Activation Plan (VO-7AA) complete.  
**Roadmap Duration:** 6 months (May 2026 — October 2026)  
**Architecture:** Local-first production + platform adapters (not fully local publishing)

---

## Vision: Local-First Video Production Studio

The `/video` orchestrator will evolve into a **local production control center** that:

- ✅ **Generates production-ready packages** for 7+ platforms (not direct posting)
- ✅ **Local Media Pipeline:** Script generation, TTS, image/video generation, composition, captions, thumbnails — all on Mac mini
- ✅ **Platform Adapters:** Publishing through authorized APIs, n8n, browser-assisted, or manual fallback
- ✅ **Multi-Account Support:** Safe scheduling across many accounts with duplicate-content prevention and cooldowns
- ✅ **Resource-Aware:** Smart scheduling for heavy models (FLUX, LoRA) at night; posting jobs parallel to generation
- ✅ **Resumable:** Mid-pipeline recovery, state tracking, audit logs
- ✅ **Learning Loop:** Track performance snapshots; optionally improve future batches

**NOT included:** Real-time posting to all platforms, guaranteed cloud-free publishing, automatic analytics collection from all APIs, full LoRA training during peak hours.

---

## Architecture Summary

### Local Infrastructure (Mac mini M4 Pro, 24GB RAM)
- 4 local AI models (SDXL, Wave, FLUX, Roop)
- PostgreSQL job queue + worker (Docker)
- Local transcription (Whisper.cpp)
- Script/metadata generation
- Video composition + FFmpeg
- Safe-zone-aware multi-format rendering
- Thumbnail generation
- Manifest and metadata assembly
- Account registry (OS Keychain)
- Performance metrics (local snapshots)

### Publishing Infrastructure (Adapter-Dependent)
- **Authorized APIs:** YouTube, Bluesky (when credentials/auth available)
- **n8n Wrappers:** Optional centralization layer for authorized APIs
- **Browser-Assisted:** Playwright automation for semi-authenticated workflows
- **Manual Fallback:** Always available; user uploads generated package
- Each adapter has status (supported, partial, manual_only, blocked)

### Resource Management
- **Resource Classes:** cpu_light, media_encode, image_fast, image_heavy, talking_head, posting, analytics
- **Scheduling Constraint:** Only one heavy model job at a time (FLUX, LoRA → night mode preferred)
- **Parallelism:** FFmpeg 2–3 concurrent encodes; posting jobs in separate pool
- **Memory:** Track 24 GB shared memory; do not assume all 4 models run concurrently

---

## Phase Summary (Revised Structure)

| Phase | Timeline | Focus | Success Criteria |
|-------|----------|-------|------------------|
| **0–1** | ✅ Done | Smart routing + 4 models installed | Models tested, thermal stable, local setup confirmed |
| **VO-1–1B** | ✅ Done | Scheduler Foundation Hardening | Dry-run scheduler tested, job persistence, quota management, isolated tests |
| **VO-2A** | ✅ Done | Project-Based Distribution Model Foundation | JSON schema for projects; planning model with weekly cadence; dry-run planning only (no job creation, no APIs, no upload) |
| **VO-2B** | ✅ Done | Project Distribution Dry-Run Scheduling | Convert project plans to dry-run scheduler jobs; distribute by posts_per_week and preferred_days; detect duplicates; no APIs, no upload |
| **VO-2C** | ✅ Done | Production Package Foundation (Metadata-Only Drafts) | Metadata-only package draft schema + example + safe draft function; no fake media, no rendering, ready_to_post always false |
| **VO-2D** | ✅ Done | Package Draft Persistence and Local Validation | Local JSON-backed package draft storage; metadata-only validation; no media rendering, no platform APIs, no upload |
| **VO-2E** | ✅ Done | Package Draft CLI, Local Adapter Contracts, and Readiness Reporting | CLI for create/list/validate/status; formal local adapter contract types; readiness summary reporting; no rendering, no APIs, no upload |
| **VO-2F** | ✅ Done | Content Brief/Input Model Foundation | Content brief schema + example; TypeScript validation with safe error messages; local media asset validation contracts (shape/path only); brief-to-draft bridge with safe metadata; no file I/O, no FFmpeg, no upload |
| **VO-3A** | ✅ Done | Local Media Validation Contracts | Media asset validation foundation; blocks absolute paths, URLs, traversal; defers real inspection to VO-3B+; hardened to prevent credential leakage in error messages |
| **VO-3B** | ✅ Done | Local Render Planning & Production Manifest Foundation | Render plan schema + TypeScript types; createLocalRenderPlanFromPackageDraft function; JSON-backed render plan store with sorting; listRenderPlans with project_id/plan_state filters; aggregate readiness report; safe summaries; validates platforms, relative paths, forbidden patterns; dry-run only (ready_for_render=false, ready_for_upload=false); package draft validation (dry-run required, upload-ready blocked, platform matching); 40 tests; no FFmpeg, no file creation, no upload |
| **VO-3C** | ✅ Done | Local File Existence Validation and Manifest Consistency Checks | Safe path resolver (blocks absolute, URLs, traversal, forbidden patterns); file existence validation (disabled/explicit modes); manifest consistency checks for render plans; validation reports with safe summaries; 26 tests; no file creation, no FFmpeg, no upload |
| **VO-3D** | ✅ Done | Manual Render Manifest Checks and Format/Platform Consistency Validation | Spec loaders for format and platform specs (graceful degradation if missing, repo-local only); validateRenderTargetAgainstSpecs validates single targets; validateRenderPlanAgainstLocalSpecs validates all targets; getManualRenderManifestCheckReport aggregates safely; legacy unsafe data sanitization; immutable ready_for_render/upload flags; no file checks/creation/FFmpeg; 23 tests |
| **VO-3E** | ✅ Done | Render Execution Gate, Manual Export Bundle, and Operator Approval Workflow | Four-check render execution gate (plan validation, manifest consistency, file existence, format/platform specs); gate evaluation returns state: blocked/needs_operator_approval/approved_for_manual_render/rejected; manual export bundle schema + example; createManualExportBundleFromGate creates pre-render bundle for operator review; gate and bundle JSON-backed stores with list/get/save functions; sanitized gate/bundle reports with path safety; dry_run=true enforced at type and function level; approval_required=true immutable; no FFmpeg, no file creation, no rendering, no uploads, no platform APIs; ready_for_render/ready_for_upload remain false/0; 14 tests covering gate evaluation, stores, bundle creation, reports, and safety constraints |
| **VO-3F** | ✅ Done | Operator Approval Records and Render-Readiness Freeze | Operator approval record schema + example (immutable audit artifacts); createOperatorApprovalRecord creates approval from gate+bundle with decision state (draft, approved_for_manual_render, rejected, revoked); deterministic freeze snapshots from gate/bundle summaries (no paths, no render_targets, no asset_plan); operator review with checklist/risk acknowledgement; approval validation blocks unsafe content, forbidden patterns, execution commands; JSON-backed approval store with project/platform/state filters; approval revocation with safe reason; aggregated reports with hardcoded ready_for_render/upload=0; all approvals are dry-run only, no rendering capability added, no FFmpeg, no file creation, no uploads, no platform APIs; 14 tests covering schema, creation, validation, stores, reports, freeze snapshots |
| **VO-4A** | ✅ Done | Render Executor Contract and Dry-Run Render Command Manifest | Render command manifest schema + example (planning artifacts only); RenderCommandManifest TypeScript types with immutable constraints (dry_run=true, execution_enabled=false, ready_for_execution/render/upload=false); createRenderCommandManifest builds manifests from approved operator records; validateRenderCommandManifest enforces safety constraints (blocks credentials/execution patterns without echoing); store functions save/list/get manifests with project/platform/state filters; getRenderCommandManifestReport aggregates safe summaries with hardcoded readiness=0; all commands are disabled summaries (no shell syntax, no raw paths); JSON-backed local store; 30 tests covering schema, creation, validation, store, report; no FFmpeg execution, no file creation, no rendering, no uploads, no platform APIs, no executable commands |
| **VO-4B** | ✅ Done | Renderer Preflight Environment Checks | Renderer preflight schema + example (declared-only environment checks, no tool execution); RendererPreflight TypeScript types with immutable safety constraints (dry_run=true, executable_invoked=false const, version_checked=false const, ready flags all false); createRendererPreflight checks command manifest safety and derives tool checks from declared summaries only (no child_process, no version commands, no env vars, no tool execution); validateRendererPreflight blocks unsafe manifests and guards all execution patterns; store functions save/list/get preflights with filters; getRendererPreflightReport aggregates tool check summaries with hardcoded readiness=0; preflight_state: draft/blocked/checked; 38 tests covering schema, creation, validation, store, report, and comprehensive execution blockers; no actual tool checking, no FFmpeg, no version commands, no file creation, no rendering, no uploads, no platform APIs, no executable commands |
| **VO-4C** | ✅ Done | Renderer Binary Discovery Manifests | Renderer binary discovery schema + example (explicit declared-only binary availability planning, no tool execution); RendererBinaryDiscovery TypeScript types with immutable safety constraints (dry_run=true const, discovery_mode="declared_only" const, path_checked/executable_invoked/version_checked all false const, ready flags all false const); createRendererBinaryDiscovery derives binary_checks from preflight tool labels with RenderExecutorKind→schema enum mapping (no child_process, no spawn, no execSync, no version commands, no env vars, no FFmpeg invocation, no path resolution); validateRendererBinaryDiscovery enforces all immutable flags and blocks execution patterns; store functions save/list/get binary discoveries with filters (project_id, platform, discovery_state, preflight_id, command_manifest_id); getRendererBinaryDiscoveryReport aggregates state counts with hardcoded readiness=0; discovery_state: draft/blocked/declared; 27 tests covering schema, creation, validation, store, report, filtering, and execution blockers; no FFmpeg execution, no version checking, no path checks, no file creation, no rendering, no uploads, no platform APIs; next phase may add operator-approved version-check planning contracts (separate approval gate, still no render execution unless separately approved) |
| **VO-4D** | ✅ Done | Operator-Approved Renderer Version Check Plan | Operator-approved version check plan schema + example (planned-only version checks, no execution); RendererVersionCheckPlan TypeScript types with immutable safety constraints (dry_run=true const, approval_required=true const, check_mode="planned_only" const, all execution/capture flags false const, ready flags all false const); createRendererVersionCheckPlan derives planned_checks from binary discovery with safe summaries (e.g., "[would-run-ffmpeg-version-if-approved]", no raw commands, no paths, no version execution); validateRendererVersionCheckPlan enforces all immutable flags and blocks execution patterns; store functions save/list/get plans with filters (project_id, platform, plan_state, discovery_id, preflight_id); getRendererVersionCheckPlanReport aggregates state counts with hardcoded readiness=0; plan_state: draft/blocked/ready_for_operator_review; 46 tests covering schema, creation, validation, store, report, filtering, and execution blockers; no FFmpeg execution, no version checking, no path resolution, no process output capture, no file creation, no rendering, no uploads, no platform APIs; next phase may add explicit mocked executor tests (still no real rendering unless separately approved) |
| **VO-4E** | ✅ Done | Mock Renderer Execution Result Contract | Mock-only execution result schema + example (simulated execution outcomes, no real FFmpeg/rendering); MockRendererExecutionResult TypeScript types with immutable safety constraints (dry_run=true const, execution_mode="mock_only" const, all execution/capture/media-creation flags false const, actual_output_count=0 const, ready flags all false const); createMockRendererExecutionResult derives mock_checks from version check plan with safe simulation results (e.g., "[mock-pass]", no raw commands, no process output, no file creation); validateMockRendererExecutionResult enforces all immutable flags and blocks execution/file-creation patterns; store functions save/list/get results with filters (project_id, platform, result_state, version_check_plan_id, command_manifest_id); getMockRendererExecutionResultReport aggregates state counts with hardcoded readiness=0 and media_files_created=0; result_state: draft/blocked/mock_passed/mock_failed; 50 tests covering schema, creation, validation, store, report, filtering, and execution/file-creation blockers; no FFmpeg execution, no rendering, no file creation, no process output capture, no uploads, no platform APIs; execution result contract ready for future real-execution spike (still behind approval gate, still marked dry_run=true) |
| **VO-5A** | ✅ Done | Real Renderer Execution Spike Gate | Real execution gate schema + example (approval gate only, no execution); RealRendererExecutionGate TypeScript types with immutable safety constraints (dry_run=true const, real_execution_requested=false const, explicit_operator_approval_required=true const, all execution_constraints false const, ready flags all false const); createRealRendererExecutionGate validates mock execution result preconditions and returns gate with state "ready_for_explicit_operator_approval" or "blocked"; validateRealRendererExecutionGate enforces all immutable flags and blocks execution-enabling payloads; store functions save/list/get gates with filters (project_id, platform, gate_state, mock_result_id, command_manifest_id); getRealRendererExecutionGateReport aggregates state counts with hardcoded readiness=0; gate_state: draft/blocked/ready_for_explicit_operator_approval/rejected; 45 tests covering schema, creation, validation, store, report, filtering, and execution blockers; no FFmpeg execution, no rendering, no file creation, no uploads, no platform APIs; explicit approval gate for hypothetical future real rendering (still planning only, behind dry_run=true and explicit_operator_approval_required gates) |
| **2A** | May 30–Jun 10 | Production Package MVP | One video → platform-ready packages for all defined platform targets |
| **2B** | Jun 10–Jun 20 | Local Queue MVP | Batch of 5 videos can fail mid-run and resume without lost work |
| **2C** | Jun 20–Jun 27 | Local Production Adapters | FFmpeg render/thumbnail outputs and optional Whisper.cpp captions produce real local artifacts |
| **3A** | Jun 20–Jul 15 | Manual Upload Adapter | Export complete local upload packages with auditability and idempotent folder paths |
| **3B** | Jun 20–Jul 15 | Posting Adapter Interface + Registry | Add a safe adapter contract with dry-run/blocked routing for non-manual modes |
| **3C** | Jun 20–Jul 15 | YouTube Dry-Run Preflight | Validate YouTube package/config readiness without OAuth or upload |
| **3D** | Jun 20–Jul 15 | YouTube Credential and OAuth Design | Define credential boundaries and approval gates without enabling upload |
| **3E-A** | Jun 20–Jul 15 | Keychain Credential Helper Scaffold | Validate credential references and redact logs without reading or writing secrets |
| **3E-B** | Jun 20–Jul 15 | YouTube OAuth Setup Scaffold | Generate auth metadata and validate callback/state without token exchange |
| **3E-C** | Jun 20–Jul 15 | YouTube OAuth Token Exchange + Keychain Prototype | Explicitly gated token exchange and Keychain storage without upload |
| **3E-D** | Jun 20–Jul 15 | Credential-Backed YouTube Upload Preflight | Verify redacted Keychain summaries and scope readiness without upload |
| **3E-E** | Jul 15–Aug 15 | Authorized Posting Adapters | Add the first real platform API adapters only after credential boundaries and explicit upload approval are complete |
| **3E-F** | Aug 15–Sep 15 | YouTube Upload Lifecycle / Status Handling | Add read-only lifecycle checks for known private uploads without new publishing capability |
| **3E-G** | Aug 15–Sep 15 | Dashboard Surfacing for YouTube Upload Lifecycle | Show read-only lifecycle state in the dashboard without adding controls |
| **3Z** | Sep 15–Sep 20 | Security, Operations, and End-to-End Readiness Review | Review accumulated boundaries and readiness before any broader expansion |
| **3X** | Jun 20–Jul 15 | Optional oMLX Local LLM Provider MVP | Add a localhost-only metadata variants provider for low-risk text tasks |
| **3Y** | Jun 20–Jul 15 | MacBook oMLX Sidecar Worker | Add an opt-in trusted Thunderbolt/LAN worker-node path for low-risk text tasks |
| **4** | Jul 15–Aug 15 | Multi-Account Scheduler | Safe distribution across accounts with duplicate-content prevention |
| **5** | Aug 15–Sep 15 | Optimization + Optional LoRA | Metrics snapshots; optional LoRA experiments (does not block production) |

### VO-6A: Explicit Local Render Spike, Test-Only Asset, Operator-Gated

**Goal:** Introduce the first real local FFmpeg execution path, but only as a test-only spike with synthetic input and disposable ignored output directories.

**Hard boundaries:**
- Only `executionMode: "test_only_local_render_spike"` is allowed.
- Requires explicit operator confirmation plus test-only permissions.
- Uses synthetic input only, preferably FFmpeg `lavfi` color source or generated pattern.
- Never touches project, user, or customer media.
- Never uploads.
- Never calls platform APIs.
- Writes only under disposable ignored runtime/test directories.
- Stores only safe summaries, never raw stdout, stderr, commands, env vars, or tokens.
- Does not enable production rendering.

**Expected follow-up:**
- If a future phase is approved, design production rendering separately and keep upload capability out of scope.

### VO-6B: Controlled Production Render Design

**Goal:** Define the production-render request contract and operator-review safety envelope without enabling production rendering yet.

**Hard boundaries:**
- Only a controlled production render request artifact is introduced.
- Source media access remains an explicit future gate.
- Output directory approval remains an explicit future gate.
- All execution permissions remain false.
- No FFmpeg execution.
- No project, user, or customer media mutation.
- No production output files.
- No uploads.
- No platform API calls.

**Expected follow-up:**
- If approved later, the next phase may add read-only source inventory and media validation, still without enabling production rendering.

### VO-6C: Source Media Inventory and Read-Only Validation

This phase adds a metadata-only inventory layer and an explicit read-only validation path for declared source references.

**Hard boundaries:**
- Metadata-only inventory is the default.
- Explicit read-only validation may only stat safe local references under a safe base directory.
- No source mutation.
- No copying.
- No transcoding.
- No rendering.
- No output files.
- No uploads.
- No platform APIs.
- No raw paths in reports.

**Expected follow-up:**
- If approved later, the next step may add output directory approval, still without enabling production rendering.

### VO-6D: Output Directory Approval and Write Boundary

This phase approves a future output boundary only and keeps writing disabled.

**What it does**
- Introduces a safe output directory approval artifact for operator review.
- Records only a summary of the future output boundary.
- Allows explicit validation to check directory existence/writability without creating directories or files.

**What it does not do**
- Does not create directories.
- Does not write output files.
- Does not render.
- Does not upload.
- Does not call platform APIs.
- Does not enable `output_write_allowed` or `media_creation_allowed`.

**Next phase guidance**
- If approved later, the next step may add a final production render execution request, still gated and still separate from upload capability.

### VO-6E: Final Production Render Execution Request

This phase composes the production request, source inventory, output approval, command manifest, and real execution approval into a final operator-reviewed request. It still does not execute rendering.

**What it does**
- Introduces a final execution-request artifact for operator review.
- Keeps execution, writing, media creation, upload, and platform APIs disabled.
- Records only safe summaries and immutable false execution flags.

**What it does not do**
- Does not create directories.
- Does not write files.
- Does not render.
- Does not mutate, copy, or transcode source media.
- Does not upload.
- Does not call platform APIs.

**Next phase guidance**
- If approved later, the next step may be a narrowly scoped production render spike, but only after a separate explicit approval.

### VO-7A: Controlled Production Render Spike

This is the first controlled local production-media render spike. It is explicit, local-only, operator-confirmed, and limited to one output.

**What it does**
- Requires the final execution request to be approved for future execution spike.
- Requires explicit runtime permissions for local child process and FFmpeg execution.
- Reads source media only when already represented by the source inventory and final request.
- Writes output only into an explicit safe local `outputBaseDir`.
- Stores only safe summaries for the spike result.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not run automatically through the normal pipeline.
- Does not store raw commands, stdout, or stderr.
- Does not mutate, copy, or transcode source media outside the single render output.

**Operational note**
- Normal tests do not require FFmpeg.
- Optional FFmpeg test coverage skips safely if FFmpeg is unavailable.

**Next phase guidance**
- If this spike is useful and approved, the next step should add operator review of the generated local output before any upload design.

### VO-7B: Operator Review of Generated Local Output

This phase adds an operator-review artifact for the locally generated render output. It is a review-only step before any upload package design.

**What it does**
- Reviews local render spike output only.
- Records safe metadata and operator acknowledgements.
- Keeps upload and platform APIs disabled.
- Keeps file move, copy, delete, and modify operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not move, copy, delete, or modify generated output files.
- Does not store raw output paths.
- Does not enable upload capability.

**Next phase guidance**
- If approved later, the next step may add upload package design, still without API calls.

### VO-7S: Real Upload Stub Contracts

This phase adds a no-op stub contract artifact only. It defines the future stub contract layer and keeps execution disabled.

**What it does**
- Defines stub contract metadata and no-op boundaries only.
- Keeps stub files, scaffold implementation files, runtime files, dependencies, package metadata changes, upload execution, platform APIs, credentials, tokens, env access, and media reads disabled.
- Records only safe summaries for future review.

**What it does not do**
- Does not create stub implementation files.
- Does not create scaffold implementation files.
- Does not execute runtime or upload flows.
- Does not call platform APIs.
- Does not access credentials, tokens, env vars, or keychain entries.
- Does not read media files.
- Does not store raw paths, payloads, responses, or account IDs.

**Next phase guidance**
- If approved later, the next step may add more stub-test layering, still without implementation or upload capability.

### VO-7T: Real Upload Stub Contract Tests

This phase adds a no-op stub contract test artifact only. It defines future stub contract test metadata and no-op boundaries, but it does not execute runtime work or enable upload flows.

**What it does**
- Defines stub contract test metadata and no-op test boundaries only.
- Keeps stub files, scaffold implementation files, runtime files, dependencies, package metadata changes, upload execution, platform APIs, credentials, tokens, env access, and media reads disabled.
- Records only safe summaries for future review.

**What it does not do**
- Does not create stub implementation files.
- Does not create scaffold implementation files.
- Does not execute runtime or upload flows.
- Does not call platform APIs.
- Does not access credentials, tokens, env vars, or keychain entries.
- Does not read media files.
- Does not store raw paths, payloads, responses, or account IDs.

**Next phase guidance**
- If approved later, the next step may add future stub no-op implementation design work, still without implementation or upload capability.

### VO-7U: Real Upload Stub No-Op Implementation Design

This phase adds a no-op implementation design artifact only. It defines future no-op implementation metadata and no-op boundaries, but it does not execute runtime work or enable upload flows.

**What it does**
- Defines no-op implementation design metadata and no-op boundaries only.
- Keeps implementation code, stub files, scaffold implementation files, runtime files, dependencies, package metadata changes, upload execution, platform APIs, credentials, tokens, env access, and media reads disabled.
- Records only safe summaries for future review.

**What it does not do**
- Does not create implementation code.
- Does not create stub files.
- Does not create scaffold implementation files.
- Does not execute runtime or upload flows.
- Does not call platform APIs.
- Does not access credentials, tokens, env vars, or keychain entries.
- Does not read media files.
- Does not store raw paths, payloads, responses, or account IDs.

**Next phase guidance**
- If approved later, the next step may add future no-op stub file plan work, still without implementation or upload capability.

### VO-7V: Real Upload No-Op Stub File Plan

This phase adds a no-op stub file plan artifact only. It defines future no-op stub file planning metadata and planned no-op file boundaries, but it does not create any files or enable runtime or upload flows.

**What it does**
- Defines no-op stub file planning metadata and boundaries only.
- Keeps files created now, stub files, test files, implementation code, implementation files, scaffold implementation files, runtime files, dependencies, package metadata changes, upload execution, platform APIs, credentials, tokens, env access, and media reads disabled.
- Records only safe summaries for future review.

**What it does not do**
- Does not create files now.
- Does not create stub files.
- Does not create test files.
- Does not create implementation code.
- Does not create scaffold implementation files.
- Does not execute runtime or upload flows.
- Does not call platform APIs.
- Does not access credentials, tokens, env vars, or keychain entries.
- Does not read media files.
- Does not store raw paths, payloads, responses, or account IDs.

**Next phase guidance**
- If approved later, the next step may add future no-op stub file creation work, still without implementation or upload capability.

### VO-7W: Real Upload No-Op Stub File Creation

This phase adds inert no-op stub source and test files only.

**What it does**
- Creates inert no-op stub source and test files only.
- Keeps upload, network, platform APIs, credentials, tokens, env access, media reads, runtime execution, dependencies, and package metadata changes disabled.

**What it does not do**
- Does not upload.
- Does not call network or platform APIs.
- Does not access credentials, tokens, env vars, or keychain entries.
- Does not read media files.
- Does not execute runtime flows.
- Does not add dependencies.
- Does not change package metadata.

**Next phase guidance**
- If approved later, the next step may add future no-op stub wiring plan work, still without implementation or upload capability.

### VO-7X: Real Upload No-Op Stub Wiring Plan

This phase adds a wiring plan artifact only.

**What it does**
- Plans future no-op wiring contracts only.
- Keeps runtime wiring, production path imports, automatic invocation, upload/API/network/credential/media behavior, dependencies, and package metadata changes disabled.

**What it does not do**
- Does not wire runtime behavior.
- Does not call the no-op stub module from production paths.
- Does not enable upload or platform/network/credential/media access.
- Does not change dependencies or package metadata.

**Next phase guidance**
- If approved later, the next step may add future no-op wiring contracts work, still without runtime wiring or upload capability.

### VO-7Y: Real Upload No-Op Wiring Contracts

This phase adds wiring contracts only. It defines future no-op wiring contracts and keeps runtime wiring unapplied.

**What it does**
- Defines wiring contracts and safety boundaries only.
- Keeps runtime wiring, production path imports, automatic invocation, upload execution, platform APIs, network calls, credential access, media reads, file mutation, and dependency changes disabled.
- Records only safe summaries for future review.

**What it does not do**
- Does not apply runtime wiring.
- Does not change the live orchestrator execution path.
- Does not enable upload or platform API behavior.
- Does not access credentials, tokens, env vars, keychain, or media files.
- Does not add dependencies or modify package metadata.

**Next phase guidance**
- If approved later, the next step may add future no-op wiring contract tests, still without runtime wiring or upload capability.

### VO-7Z: Real Upload No-Op Wiring Contract Tests

This phase adds wiring contract tests only. It defines test artifacts for future no-op wiring contracts and keeps runtime wiring unapplied.

**What it does**
- Defines wiring contract test artifacts and safety boundaries only.
- Keeps runtime wiring, production path imports, automatic invocation, upload execution, platform APIs, network calls, credential access, media reads, file mutation, and dependency changes disabled.
- Records only safe summaries for future readiness review.

**What it does not do**
- Does not apply runtime wiring.
- Does not change the live orchestrator execution path.
- Does not enable upload or platform API behavior.
- Does not access credentials, tokens, env vars, keychain, or media files.
- Does not add dependencies or modify package metadata.

**Next phase guidance**
- If approved later, the next step may add future no-op wiring readiness review work, still without runtime wiring or upload capability.

### VO-7AA: Real Upload No-Op Wiring Readiness Review and Activation Plan

This phase reviews the no-op wiring contract tests and creates a disabled-by-default activation plan only.

**What it does**
- Reviews readiness for future disabled no-op wiring activation planning only.
- Keeps runtime wiring, feature flags, production path imports, automatic invocation, upload execution, platform APIs, network calls, credential access, media reads, file mutation, and dependency changes disabled.
- Records only safe summaries for future operator review.

**What it does not do**
- Does not apply runtime wiring.
- Does not create or enable a runtime feature flag.
- Does not change the live orchestrator execution path.
- Does not enable upload or platform API behavior.
- Does not access credentials, tokens, env vars, keychain, or media files.
- Does not add dependencies or modify package metadata.

**Next phase guidance**
- If approved later, the next step may add future disabled no-op wiring activation work, still without runtime wiring or upload capability.

### VO-7C: Upload Package Design

This phase adds an upload package design artifact only. It prepares safe metadata and platform-target summaries for a future upload-request design review, but it does not upload or call platform APIs.

**What it does**
- Designs upload metadata/package only.
- Records safe platform target and metadata summaries.
- Keeps upload, credentials, tokens, and API calls disabled.
- Keeps file move, copy, delete, and modify operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not access credentials, tokens, or env vars.
- Does not store raw output paths or raw account IDs.
- Does not move, copy, delete, or modify generated output files.
- Does not enable upload capability.

**Next phase guidance**
- If approved later, the next step may add a platform upload-request artifact, still without API calls.

### VO-7D: Platform Upload Request Artifact

This phase creates a platform-specific upload request artifact only. It prepares a final future upload-execution review record, but it still does not upload or call platform APIs.

**What it does**
- Creates a platform upload request artifact only.
- Records safe platform target and metadata request summaries.
- Keeps upload execution, credentials, tokens, keychain access, env access, and API calls disabled.
- Keeps file move, copy, delete, and modify operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not access credentials, tokens, keychain, or env vars.
- Does not store raw output paths, raw account IDs, or raw platform payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not enable upload capability.

**Next phase guidance**
- If approved later, the next step may add upload execution approval, still without API calls.

### VO-7F: Upload Execution Design

This phase designs the upload execution envelope only. It stays dry-run only and keeps all real upload, network, API, credential, and keychain access disabled.

**What it does**
- Designs the upload execution boundary and reporting model only.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records only safe summaries for future dry-run upload spike design review.
- Keeps file move, copy, delete, and modify operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not store raw output paths, raw account IDs, or raw platform payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not enable real upload capability.

**Next phase guidance**
- If approved later, the next step may be a dry-run upload spike simulation, still without network/API/credential access.

### VO-7G: Dry-Run Upload Spike Simulation

This phase simulates the upload workflow locally only. It stays dry-run only and keeps all real upload, network, API, credential, token, keychain, and env access disabled.

**What it does**
- Simulates the upload workflow locally using safe summaries only.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records only safe summaries for future upload readiness review.
- Keeps file move, copy, delete, and modify operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not store raw output paths, raw account IDs, raw platform payloads, or response payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not enable real upload readiness.

**Next phase guidance**
- If approved later, the next step may add real upload readiness assessment, still without API calls.

### VO-7H: Real Upload Readiness Assessment

This phase assesses readiness only. It evaluates the entire upload chain, but it still keeps all real upload, network, API, credential, token, keychain, env, and media-file access disabled.

**What it does**
- Assesses readiness only using safe summaries and prior validated artifacts.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records the remaining gates that must exist before any real upload execution could be designed.
- Keeps file move, copy, delete, modify, and media-file read operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not read media files.
- Does not store raw output paths, raw account IDs, raw platform payloads, or response payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not make ready_for_real_upload true.

**Next phase guidance**
- If approved later, the next step may add a real upload execution request artifact, still without API calls.

### VO-7I: Real Upload Execution Request

This phase adds the formal operator-request artifact for a future real upload execution design phase. It is still request-only and keeps all real upload, network, API, credential, token, keychain, env, and media-file access disabled.

**What it does**
- Captures a request artifact for future real upload design review only.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records only safe summaries for future real upload design work.
- Keeps file move, copy, delete, modify, and media-file read operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not read media files.
- Does not store raw output paths, raw account IDs, raw platform payloads, or response payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not make ready_for_real_upload true.

**Next phase guidance**
- If approved later, the next step may design real upload strategy documents, still without API calls.

### VO-7J: Real Upload Strategy Design

This phase adds the comprehensive strategy/design artifact for a future real upload execution plan. It stays strategy-only and keeps all real upload, network, API, credential, token, keychain, env, and media-file access disabled.

**What it does**
- Documents safe summaries for credential, network, platform API, media access, retry, rollback, verification, and failure-handling strategy.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records only strategy summaries and operator checklist state.
- Keeps file move, copy, delete, modify, and media-file read operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not read media files.
- Does not store raw output paths, raw account IDs, raw platform payloads, or response payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not make ready_for_real_upload true.

**Next phase guidance**
- If approved later, the next step may add a real upload execution plan artifact, still without API calls.

### VO-7K: Real Upload Execution Plan

This phase adds a plan artifact only for a future dry-run upload execution phase. It stays plan-only and keeps all real upload, network, API, credential, token, keychain, env, and media-file access disabled.

**What it does**
- Documents safe summaries for the execution plan, including credential, network, platform API, media access, retry, rollback, verification, failure-handling, and operator runbook planning.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records planned steps only; it does not create execution code or raw payloads.
- Keeps file move, copy, delete, modify, and media-file read operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not read media files.
- Does not store raw output paths, raw account IDs, raw platform payloads, or response payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not make ready_for_real_upload true.

**Next phase guidance**
- If approved later, the next step may add a dry-run real upload execution simulator, still without API, network, or credential access.

### VO-7L: Real Upload Dry-Run Execution Simulator

This phase adds a local-only simulation result artifact for the real upload execution plan. It stays simulation-only and keeps all real upload, network, API, credential, token, keychain, env, and media-file access disabled.

**What it does**
- Simulates each planned step as a local-only dry run.
- Keeps upload, network calls, platform APIs, credentials, tokens, keychain, and env access disabled.
- Records only safe summaries for each simulated step and overall simulation status.
- Keeps file move, copy, delete, modify, and media-file read operations disabled.

**What it does not do**
- Does not upload.
- Does not call platform APIs.
- Does not make network calls.
- Does not access credentials, tokens, keychain, or env vars.
- Does not read media files.
- Does not store raw output paths, raw account IDs, raw platform payloads, upload payloads, or response payloads.
- Does not move, copy, delete, or modify generated output files.
- Does not make ready_for_real_upload true.

**Next phase guidance**
- If approved later, the next step may add a final real upload preflight gate, still without API calls.

**Total Timeline:** 6 months  
**Total Resource Estimate:** 50 hours Claude Code (revised for adapter complexity)  
**Local Infrastructure Cost:** $0 (excluding electricity ~$50/month, storage costs, paid platform APIs, optional cloud LLM/TTS)

---

## Phase 0: Smart Model Routing ✅ (DONE)

**Status:** 2026-05-08

**Deliverables:**
- ✅ 4 local models: SDXL (30–60s), Wave (60–90s), FLUX (2–4 min), Roop (30–120s)
- ✅ Smart routing skill with decision matrix
- ✅ Performance profiles (VRAM, speed, quality per model)
- ✅ Thermal stability verified (85% CPU safe)

---

## Phase 1: Local Generation Pipeline ✅ (DONE)

**Status:** 2026-05-08

**Deliverables:**
- ✅ 4 models installed, tested, benchmarked
- ✅ Installation runbook with troubleshooting
- ✅ Resource scheduling guidelines (day/night, model limits)

---

## Phase 2A: Production Package MVP

**Timeline:** May 30–June 10, 2026 (2 weeks)  
**Goal:** Generate complete upload-ready packages for all defined platform targets (not post them; just create them)

### 2A.1: Platform & Format Specifications

**Deliverables:**
- Platform specs JSON: YouTube, YouTube Shorts, TikTok, Instagram Reels, Instagram Feed, LinkedIn, Facebook, Bluesky, X
  - Fields: source_url, last_verified_at, verification_frequency_days, hashtag_count, description_max_length, thumbnail_required, posting_modes, adapter_status, known_constraints, manual_fallback
- Format specs JSON: 9 output formats with safe zones, aspect ratios, bitrates, codecs
- Caption specs JSON: SRT/VTT requirements, burn-in options, platform-specific caption fields

**Schemas:**
```json
{
  "platforms": {
    "youtube": {
      "name": "YouTube",
      "source_url": "https://developers.google.com/youtube/v3",
      "last_verified_at": "2026-05-08",
      "formats": ["longform_16_9", "shorts_9_16"],
      "posting_modes": ["api", "manual"],
      "adapter_status": "supported",
      "supports_direct_publish": true,
      "supports_scheduling": true,
      "supports_analytics": true,
      "hashtag_count": {"min": 1, "max": 2},
      "description_max": 5000,
      "verification_frequency_days": 30,
      "known_failure_modes": ["initial_upload_delay", "quota_limits"],
      "requires_paid_plan": false
    }
  },
  "formats": {
    "youtube_longform": {
      "resolution": "1920×1080",
      "aspect_ratio": "16:9",
      "safe_area": "1760×990",
      "codec": "h264",
      "bitrate_video": "5000k",
      "notes": "YouTube supports up to 8K, but 1080p is standard"
    }
  }
}
```

### 2A.2: Local Transcription & Captions

**Deliverables:**
- Whisper.cpp integration (local transcription, no API calls)
- Caption generation: SRT, VTT, JSON formats
- Burn-in capability (FFmpeg overlay for platforms that require it)
- Caption versioning (keep raw + burned variants)

**Workflow:**
```
Audio → Whisper.cpp → transcript.json
transcript.json → format as SRT/VTT
SRT + video → FFmpeg burn-in (optional)
Keep both burned + raw captions for flexibility
```

### 2A.3: Safe-Zone-Aware Multi-Format Rendering

**Deliverables:**
- Safe-zone definitions per format (title-safe, action-safe areas)
- Two rendering modes:
  1. **Simple Transform:** Master 1920×1080 → FFmpeg crop/scale (for center-safe content)
  2. **Canonical Timeline:** One timeline rendered to 16:9, 9:16, 1:1, 4:5 variants using templates
- Recommendation: Default to canonical timeline for quality; use transform for simple content

**Workflow:**
```
Source: script + audio + assets
  ↓
Canonical Timeline (animated objects positioned in safe zones)
  ├─ 16:9 render (1920×1080, YouTube, LinkedIn)
  ├─ 9:16 render (1080×1920, TikTok, Instagram Reels, Shorts)
  ├─ 1:1 render (1080×1080, Instagram Feed, Facebook)
  └─ 4:5 render (1080×1350, Instagram Feed preferred)

OR (for simple content):
Master 1920×1080 → FFmpeg transform to all variants
```

### 2A.4: Thumbnail Packages

**Deliverables:**
- Design integration (via `/design` orchestrator)
- Per-platform thumbnail specs (sizes, safe zones, format requirements)
- Thumbnail versioning (multiple variants for A/B testing)

### 2A.5: Manifest Schema

**Deliverables:**
- Production manifest JSON: tracks all generated assets, captions, variants, metadata
- Example:
```json
{
  "video_id": "episode-001",
  "created_at": "2026-05-08T14:30:00Z",
  "script": "scripts/episode-001.md",
  "audio": "audio/episode-001-narration.wav",
  "caption_sources": [
    "captions/episode-001.srt",
    "captions/episode-001.vtt",
    "captions/episode-001.json"
  ],
  "thumbnails": [
    {"variant": "v1", "path": "thumbnails/episode-001-v1.png", "size": "1280×720"}
  ],
  "production_packages": {
    "youtube_longform": {
      "video": "variants/episode-001-yt-longform-1920x1080.mp4",
      "captions": "captions/episode-001.srt",
      "thumbnail": "thumbnails/episode-001-v1.png",
      "metadata": {
        "title": "Episode 001: Title Here",
        "description": "Full description...",
        "hashtags": ["#tag1", "#tag2"],
        "upload_ready": true
      }
    },
    "tiktok": {
      "video": "variants/episode-001-tiktok-1080x1920.mp4",
      "captions": "captions/episode-001.vtt",
      "thumbnail": "thumbnails/episode-001-v1.png",
      "metadata": {...}
    }
  }
}
```

### 2A Success Criteria
- ✅ Generate complete production packages for all defined platform targets from one source
- ✅ All packages include: video (correct format), captions (SRT/VTT), thumbnail, metadata
- ✅ Manifest tracks every file and variant
- ✅ Packages are upload-ready (human can upload without further editing)

---

## Phase 2B: Local Queue MVP

**Timeline:** June 10–June 20, 2026 (1.5 weeks)  
**Goal:** No lost work; resume from mid-pipeline failure

### 2B.1: PostgreSQL Schema & Docker Setup

**Deliverables:**
- Docker Compose file for PostgreSQL (local, port 5432)
- Durable entity tables: videos, scripts, assets, renders, captions, production_packages, posting_targets, accounts
- Job table for execution only (separate from video/asset entities)
- Event log for audit trail

**Schema highlights:**
```sql
-- Durable production objects
CREATE TABLE videos (
  id UUID PRIMARY KEY,
  series_id UUID,
  title TEXT,
  video_state VARCHAR(50),  -- planned, scripted, voiced, assets_ready, captions_ready, composed, variants_ready, ready_to_post, partially_posted, posted, archived
  created_at TIMESTAMP
);

CREATE TABLE scripts (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  content TEXT,
  created_at TIMESTAMP
);

CREATE TABLE captions (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  format VARCHAR(20),  -- srt, vtt, json
  content TEXT,
  burn_in_variant BOOLEAN
);

CREATE TABLE renders (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  format_key VARCHAR(50),  -- youtube_longform, tiktok, etc.
  file_path VARCHAR(500),
  codec VARCHAR(20),
  bitrate VARCHAR(20),
  created_at TIMESTAMP
);

CREATE TABLE production_packages (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  platform VARCHAR(50),
  manifest_path VARCHAR(500),
  ready_to_post BOOLEAN,
  created_at TIMESTAMP
);

-- Execution-only, ephemeral
CREATE TABLE jobs (
  id UUID PRIMARY KEY,
  video_id UUID REFERENCES videos(id),
  job_type VARCHAR(50),  -- generation, rendering, caption, posting, etc.
  model VARCHAR(50),
  job_state VARCHAR(20),  -- pending, leased, running, succeeded, failed, dead
  retry_count INT DEFAULT 0,
  idempotency_key VARCHAR(100),  -- for posting jobs to prevent duplicates
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE events (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50),  -- video, job, account, etc.
  entity_id UUID,
  event_type VARCHAR(50),  -- created, state_changed, error, etc.
  details JSONB,
  created_at TIMESTAMP
);
```

### 2B.2: Worker Process

**Deliverables:**
- Python worker daemon: pull jobs, execute, update states, log events
- Retry logic: exponential backoff, max 3 retries
- Lease-based job pulling (prevent concurrent execution)

### 2B.3: Video/Asset/Render Registry

**Deliverables:**
- Durable tracking of: scripts, assets, renders, captions, packages
- State machine per entity (video_state, render_state, etc.)
- Mid-pipeline resume: query last completed state, resume from next stage

### 2B Success Criteria
- ✅ Queue 5 videos for processing
- ✅ Simulate failure at render stage
- ✅ Resume batch: completed stages skip, failed stage retries
- ✅ All state transitions logged to event table

---

## Phase 3A: Manual Upload Adapter

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Export complete local upload packages for human posting

### 3.1: Manual Export Contract

**Deliverables:**
- Export local package folders for upload-ready targets
- Copy video, thumbnail, captions, metadata, manifest excerpt, and checksums
- Emit audit events for export completion or refusal
- Keep package paths idempotent and target-specific

### 3.2: Manual Adapter Rules

**Behavior:**
- `adapter_mode = manual` exports the package
- Missing `adapter_mode` may fall back to manual when the platform declares manual fallback
- Incomplete packages require an explicit override
- No platform API calls, OAuth, tokens, cookies, or browser automation

### 3.3: Future Posting Adapters

**Deferred until Phase 3B+:**
- YouTube API adapter
- Bluesky API adapter
- Any browser-assisted or n8n wrapper posting flow

### 3.4: Posting Audit Logs

**Deliverables:**
- Table: posting_jobs (video_id, platform, account, adapter_mode, status, error, retry_count, timestamps)
- Event log: all export attempts, refusals, retries

### 3 Success Criteria
- ✅ Manual upload package generated for an upload-ready target
- ✅ Incomplete target exports are blocked unless override is enabled
- ✅ Export audit log shows all attempts

---

## Phase 3B: Posting Adapter Interface + Registry

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Route posting jobs through a formal adapter contract while keeping real posting disabled

### 3.1: Adapter Contract

**Deliverables:**
- `validateConfig()`
- `validateCredentials()`
- `preflight()`
- `execute()`
- `pollStatus()`

### 3.2: Registry Modes

**Deliverables:**
- `manual`
- `api`
- `n8n`
- `browser_assisted`
- `disabled`

### 3.3: Safety Rules

**Behavior:**
- Manual remains the only executable adapter
- Non-manual modes return dry-run or blocked results
- No network calls or credential access

### 3.4: Success Criteria
- ✅ Posting jobs route through the registry
- ✅ Non-manual jobs emit clear blocked/dry-run audit events
- ✅ No real platform posting occurs

---

## Phase 3C: YouTube Dry-Run Preflight

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Validate YouTube readiness and produce a dry-run plan without upload

### 3.1: YouTube Dry-Run Adapter

**Deliverables:**
- `adapter_mode = api` routes to a YouTube-specific dry-run adapter
- Validate title, description, video media, thumbnail, captions, and privacy config
- Compute idempotency key for future upload phases

### 3.2: Safety Rules

**Behavior:**
- No OAuth or credential reads
- No YouTube API calls
- No uploads
- Manual export remains the fallback path

### 3.3: Success Criteria
- ✅ Valid YouTube package/config pair passes dry-run preflight
- ✅ Invalid config is blocked safely
- ✅ Dry-run audit output includes upload intent and idempotency metadata

---

## Phase 3D: YouTube Credential and OAuth Design

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Define the credential and OAuth boundary for a future YouTube upload adapter without enabling upload

### 3.1: Credential Contract

**Deliverables:**
- Design-only credential contract JSON with placeholder-only values
- Local callback path shape for localhost OAuth setup
- DB reference model for Keychain-backed storage

### 3.2: Safety Rules

**Behavior:**
- No OAuth execution
- No token storage in repo files or `.env`
- No YouTube API calls
- No upload implementation
- Manual fallback remains required

### 3.3: Success Criteria
- ✅ Credential boundaries are documented
- ✅ Approval gate exists before any real upload phase
- ✅ No secrets or token values are introduced

---

## Phase 3E-A: Keychain Credential Helper Scaffold

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Provide a local-only credential helper scaffold that validates references and redacts logs without reading or writing secrets

### 3.1: Helper Commands

**Deliverables:**
- Credential reference validation
- Redaction helper
- Dry-run Keychain read/write command shapes
- Self-test for safe outputs

### 3.2: Safety Rules

**Behavior:**
- No real Keychain reads or writes by default
- No OAuth execution
- No token storage or network calls
- Manual fallback remains the safe path

### 3.3: Success Criteria
- ✅ Credential reference validation passes for the supported shape
- ✅ Redaction removes sensitive-looking values from sample text
- ✅ Dry-run command shapes print without touching Keychain

---

## Phase 3E-B: YouTube OAuth Setup Scaffold

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Provide a local-only OAuth setup scaffold that generates authorization metadata and validates callback/state shape without exchanging tokens or storing credentials

### 3.1: OAuth Setup Helper

**Deliverables:**
- PKCE and state generation
- Placeholder-only authorization URL builder
- Callback validation for localhost redirect and state
- Self-test coverage for safe scaffolding

### 3.2: Safety Rules

**Behavior:**
- No token exchange
- No Keychain read or write
- No YouTube API calls
- No upload implementation
- No browser automation

### 3.3: Success Criteria
- ✅ OAuth scaffold self-test passes
- ✅ Placeholder config builds an authorization URL
- ✅ Callback validation rejects mismatched state

---

## Phase 3E-C: YouTube OAuth Token Exchange + Keychain Prototype

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Provide an explicitly gated CLI prototype for exchanging a YouTube authorization code and storing the resulting token JSON in macOS Keychain without enabling upload

### 3.1: Token Exchange and Keychain Commands

**Deliverables:**
- Explicitly gated token exchange command
- Explicitly gated Keychain read/write/delete commands
- Redacted summaries for sensitive results
- Sample token exchange config and runbook

### 3.2: Safety Rules

**Behavior:**
- No upload implementation
- No browser automation
- No `.env` or token file output
- No Google client libraries
- User must explicitly approve each sensitive operation

### 3.3: Success Criteria
- ✅ Token self-test passes without real tokens
- ✅ Confirmation flags are required for sensitive commands
- ✅ Redacted summaries never print raw token values

---

## Phase 3E-D: Credential-Backed YouTube Upload Preflight

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Verify redacted Keychain-backed credential readiness during YouTube dry-run preflight without upload

### 3.1: Credential Summary Read

**Deliverables:**
- Redacted Keychain summary command for YouTube credentials
- Worker support for credential-backed dry-run preflight metadata
- Scope-readiness reporting for `youtube.upload`

### 3.2: Safety Rules

**Behavior:**
- No upload implementation
- No YouTube API calls
- No raw token values
- Missing or malformed credentials block safely but do not dead-letter

### 3.3: Success Criteria
- ✅ Redacted summaries report presence/absence without values
- ✅ Worker merges credential-backed preflight metadata safely
- ✅ Production remains upload-free in this phase

---

## Phase 3E-E: Authorized Posting Adapters

**Timeline:** July 15–August 15, 2026 (4 weeks)  
**Goal:** Add the first real platform API adapters only after credential boundaries and explicit upload approval are complete, starting with a private-only YouTube path

### 3.1: Authorized Adapter Gate

**Deliverables:**
- Real platform adapter approval checklist
- Explicit upload authorization gate
- Safety review for credential handling and logging
- Private-only YouTube upload adapter shape

### 3.2: Safety Rules

**Behavior:**
- No upload implementation until the gate is approved
- No Google client libraries unless explicitly required later
- Manual upload remains the fallback path
- First upload is private-only and one job at a time

### 3.3: Success Criteria
- ✅ Credential boundaries are approved before upload work begins
- ✅ Authorized adapters remain separate from dry-run preflight

---

## Phase 3E-F: YouTube Upload Lifecycle / Status Handling

**Timeline:** August 15–September 15, 2026 (4 weeks)  
**Goal:** Add read-only lifecycle checks for known private uploads without adding any new publishing capability

### 3.1: Lifecycle Model

**Deliverables:**
- conservative lifecycle states: not_started, uploading, uploaded, processing, available_private, failed, unknown
- redacted metadata for status checks
- status events tied to known orchestrator-owned uploads

### 3.2: Status Check Boundary

**Deliverables:**
- `videos.list` read path for known uploaded IDs
- explicit `status_check_only` job mode
- no arbitrary polling of unknown videos
- no new upload capabilities

### 3.3: Safety Rules

**Behavior:**
- Private-only uploads remain the base boundary
- No public or unlisted publishing
- No thumbnails, captions, or playlists
- No token logging
- Manual fallback remains available

### 3.4: Success Criteria
- ✅ The worker can report conservative lifecycle status for a known private upload
- ✅ Unknown or failed checks return safe redacted metadata
- ✅ No new publishing mode is introduced

---

## Phase 3E-G: Dashboard Surfacing for YouTube Upload Lifecycle

**Timeline:** August 15–September 15, 2026 (4 weeks)  
**Goal:** Surface read-only lifecycle state in the dashboard without adding any new control surface

### 3.1: Dashboard Summary

**Deliverables:**
- latest YouTube lifecycle state
- YouTube video ID when already known locally
- privacy status, last checked, upload event timestamp
- lifecycle counts and redacted warnings/errors

### 3.2: Read-Only Boundary

**Behavior:**
- No upload buttons
- No OAuth buttons
- No credential reference display
- No token display
- No Keychain or YouTube API calls from the dashboard

### 3.3: Success Criteria
- ✅ The dashboard shows lifecycle state for known uploads
- ✅ Empty state is safe and informative
- ✅ No new publishing capability is introduced

---

## Phase 3Z: Security, Operations, and End-to-End Readiness Review

**Timeline:** September 15–September 20, 2026 (1 week)  
**Goal:** Review the accumulated Video Orchestrator security boundaries, operational constraints, and end-to-end readiness without adding runtime capability

### 3.1: Readiness Package

**Deliverables:**
- readiness report covering upload, token, dashboard, and sidecar boundaries
- first-real-private-upload operator checklist
- security boundary checklist for future phases
- doc corrections where current text is inconsistent with the implementation

### 3.2: Review Boundary

**Behavior:**
- No new upload capabilities
- No new OAuth scopes or credential storage locations
- No Keychain, dashboard, or API behavior changes
- No public or unlisted upload expansion

### 3.3: Success Criteria
- ✅ The current phase boundaries are clearly documented
- ✅ The first private upload path is reviewed honestly, including remaining operator prerequisites
- ✅ The docs no longer imply broader upload capability than the implementation supports

---

## Phase 4A: Account Registry + Credential Health Center

**Timeline:** September 20–October 1, 2026 (2 weeks)  
**Goal:** Add a read-only account registry and credential health center so operators can automate readiness checks before the first private upload and future account expansion

### 4.1: Account Registry

**Deliverables:**
- account registry schema and placeholder examples
- account capability, privacy, and notification metadata
- placeholder-only registry validation

### 4.2: Credential Health Center

**Deliverables:**
- local account-health dry-run script
- redacted credential summary checks for approved accounts
- safe snapshot generation for the dashboard

### 4.3: Read-Only Dashboard Surface

**Deliverables:**
- account health panel in the dashboard
- read-only status summaries
- no credential display and no control actions

### 4.4: Readiness Automation

**Deliverables:**
- readiness dry-run command for the first private upload checklist
- nightly health-check support
- manual-only fallback visibility

### 4.5: Behavior

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

### 4.6: Success Criteria
- ✅ Operators can register accounts using placeholder-only schemas
- ✅ Credential health can be checked safely without exposing token values
- ✅ The dashboard shows read-only account status without exposing credential references
- ✅ The first private upload checklist is automated as far as local state allows

## Phase 4B: Operator Account Snapshot + Nightly Health Job

**Timeline:** October 1–October 8, 2026 (1 week)  
**Goal:** Make account health a set-and-forget local flow with an untracked operator registry and a nightly dashboard snapshot

### 4B.1: Local Registry Bootstrap

**Deliverables:**
- init command for the operator-owned local registry
- default local registry paths under `runtime/local`
- ignore-safe runtime artifact guidance

### 4B.2: Nightly Snapshot Job

**Deliverables:**
- dry-run nightly snapshot command
- safe dashboard snapshot file
- local log path for snapshot runs

### 4B.3: Dashboard Read Path

**Deliverables:**
- dashboard reads snapshot only
- no credential-reference display
- no Keychain access from dashboard

### 4B.4: Behavior

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

### 4B.5: Success Criteria
- ✅ Operators can initialize a local registry in one command
- ✅ Nightly health checks produce a safe dashboard snapshot
- ✅ Runtime files remain untracked and outside the repo history

## Phase 4C: Dashboard Account Onboarding + OAuth Connect Flow

**Timeline:** October 8–October 22, 2026 (2 weeks)  
**Goal:** Make the dashboard the operator entry point for adding accounts, connecting YouTube OAuth, and regenerating local health state without manual JSON editing

### 4C.1: Dashboard Onboarding

**Deliverables:**
- account onboarding form for YouTube
- safe local registry write path
- update-safe account metadata editing

### 4C.2: OAuth Connect Flow

**Deliverables:**
- YouTube OAuth start button/link
- localhost callback handling
- Keychain token storage

### 4C.3: Automatic Health Refresh

**Deliverables:**
- snapshot regeneration after save/connect
- safe account status refresh
- read-only health display in dashboard

### 4C.4: Behavior

**Behavior:**
- No upload capability is added
- No new OAuth scopes are introduced
- No secrets are stored in the repo
- No public or unlisted upload support is added
- No multi-account scheduler is introduced yet

### 4C.5: Success Criteria
- ✅ Operators can add and connect YouTube accounts from the dashboard
- ✅ Local registry and snapshot update automatically after save/connect
- ✅ Dashboard remains read-only for upload actions

---

## Phase 3X: Optional oMLX Local LLM Provider MVP

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Add a localhost-only local LLM provider path for metadata variants

### 3.1: Metadata Variants Task

**Deliverables:**
- `llm_text` job path for metadata variants
- Prompt-to-JSON generation for title variants, hook variants, description draft, and hashtag suggestions
- Local fallback/skip when oMLX is unavailable

### 3.2: Safety Rules

**Behavior:**
- No media generation
- No transcription
- No posting
- No secrets, OAuth, or external network access
- oMLX stays optional and non-blocking

### 3.3: Success Criteria
- ✅ Metadata variants job returns valid structured JSON when oMLX is available
- ✅ Unavailable oMLX returns a safe skip/warning result
- ✅ Production remains healthy when oMLX is offline

---

## Phase 3Y: MacBook oMLX Sidecar Worker

**Timeline:** June 20–July 15, 2026 (4 weeks)  
**Goal:** Add an opt-in trusted Thunderbolt/LAN worker-node path for low-risk local text tasks

### 3.1: Sidecar Node Registry

**Deliverables:**
- local worker-node schema for oMLX sidecars
- example MacBook node config
- allowed task list for future text-only work

### 3.2: Routing and Health Checks

**Deliverables:**
- trusted Thunderbolt/LAN endpoint validation
- short-timeout health check against the models endpoint
- explicit opt-in for remote sidecar calls
- secret-field guards before any remote payload is sent

### 3.3: Safety Rules

**Behavior:**
- No secrets, OAuth, posting, uploads, or media generation
- Only low-risk text tasks are eligible
- The Mac mini remains the control plane
- Remote sidecar use is optional and non-blocking

### 3.4: Success Criteria
- ✅ The worker can route allowed text jobs to an enabled MacBook sidecar
- ✅ Public IPs and untrusted endpoints are rejected
- ✅ Sidecar unavailability falls back locally or skips safely

---

## Phase 4: Multi-Account Scheduler

**Timeline:** July 15–August 15, 2026 (4 weeks)  
**Goal:** Safely distribute across many accounts without spam risk

### 4.1: Account Registry

**Deliverables:**
- Table: accounts (platform, handle, account_id, status, daily_limit, per_hour_burst_limit, min_cooldown_minutes)
- Credentials: OS Keychain (encrypted local storage, reference in DB)
- Account health: last_posted_at, posted_count_today, failure_streak

### 4.2: Content Distribution Policies

**Deliverables:**
- Duplicate-content policy: min_delay_same_platform (e.g., 30 min between posts to same platform)
- Caption variation: optional require different captions per account posting
- Thumbnail variation: optional require different thumbnails
- Account topic fit: soft constraint (e.g., brand accounts reject casual content)

### 4.3: F0 Workflow (Distribution Planning)

**Deliverables:**
- User selects: platforms + accounts for batch
- Pre-flight validation:
  - Adapter status check (supported / manual)
  - Credential validity
  - Account daily limits (won't exceed)
  - Duplicate-content policy compliance
  - Thermal/resource availability
- Output: distribution manifest (video → platforms → accounts)

### 4.4: Posting Job Scheduling

**Deliverables:**
- Stagger posts per account: enforce min_cooldown_minutes
- Respect adapter limits: YouTube quota, TikTok rate limits
- Separate thread pool: posting jobs don't compete with generation jobs
- Idempotency: same posting job never posts twice (via idempotency_key)

### 4 Success Criteria
- ✅ Register 2+ accounts per platform
- ✅ F0 workflow selects distribution
- ✅ Pre-flight validation blocks if limits exceeded
- ✅ Post 10 videos across 3 YouTube accounts with 30-min cooldown respected

---

## Phase 5: Optimization & Optional LoRA

**Timeline:** August 15–September 15, 2026 (4 weeks)  
**Goal:** Data-driven future improvements; optional brand customization

### 5.1: Performance Metrics (Local Snapshots)

**Deliverables:**
- Table: performance_snapshots (video_id, platform, account, posted_at, hook, model, avatar, template_id, views, likes, comments, shares)
- Collection: Manual snapshots (no automated analytics API polling; use manual data entry + optional API integration)
- Dashboard: CSV export or simple web UI (localhost:5000)

### 5.2: Learning Recommendations

**Deliverables:**
- Query: which model/hook/avatar performed best in last 30 days?
- Recommendation engine: suggest best performers for next batch
- Example output: "Last month: hook X averaged 3.2% engagement; recommend for this batch"

### 5.3: Optional LoRA Experiments (Not Blocking)

**Deliverables:**
- LoRA fine-tuning scripts: train on 50 brand images (optional, 4–8 GPU hours)
- LoRA model manager: load fine-tuned model if available
- Caution: LoRA training on 24 GB Mac mini may succeed or may hit memory limits; benchmark first
- **Does NOT block production:** If LoRA fails, fall back to base FLUX

### 5 Success Criteria
- ✅ Collect performance snapshots for 10 videos
- ✅ Generate recommendations: best model, hook, avatar
- ✅ (Optional) Train LoRA on 50 brand images; test inference
- ✅ Production continues even if LoRA training fails

---

## Resource Scheduling & Constraints

### Resource Classes
- **cpu_light:** Metadata, script gen (can run anytime, negligible CPU)
- **media_encode:** FFmpeg encoding (2–3 parallel, limit VRAM pressure)
- **image_fast:** SDXL (30–60s, daytime OK)
- **image_heavy:** FLUX, LoRA (2–4 min, schedule at night)
- **talking_head:** Wave, Roop (60–120s, can run anytime but prefer lighter times)
- **posting:** n8n, API, manual (separate thread pool, parallel to media jobs)
- **analytics:** Metrics collection, LoRA training (night batch)

### Scheduling Rules
1. **Only one heavy model job at a time** (FLUX, LoRA → night mode preferred)
2. **FFmpeg:** 2–3 concurrent encodes if VRAM + CPU permit; monitor pressure
3. **Posting jobs:** Separate thread pool; can run while generation jobs run
4. **Night mode:** ~90% CPU/GPU available; safe for FLUX, LoRA, heavy batches
5. **Day mode:** SDXL + posting + analytics only; reserve thermal headroom
6. **Monitor:** Track RAM usage, thermal state, CPU load; throttle if exceeding 85% CPU

---

## Throughput Targets (Not Guarantees)

Validate each tier by benchmarking; actual throughput depends on content complexity, model selection, and resource availability.

### Tier A (Simple): 30–100 videos/week
- Script + TTS + static image + captions + all format variants
- No talking-head, no FLUX, no LoRA
- Minimal manual review

### Tier B (Higher Quality): 15–50 videos/week
- Custom thumbnails + multi-format rendering + manual review
- SDXL or Wave (not FLUX)
- 1–2 accounts per platform

### Tier C (Avatar/Product): 5–25 videos/week
- Talking-head (Wave) or avatar (Roop) or product photos
- Higher generation time per video
- 2–5 accounts per platform

### Tier D (FLUX/LoRA/Complex): 2–10 videos/week
- FLUX-heavy, LoRA, complex Remotion compositions
- 4–8 hour batch jobs at night only
- Benchmark required before committing

---

## Known Limitations & Workarounds

### Posting
- **TikTok API:** Direct posting requires TikTok Content Posting API product access and the official creator-info → initialize → export flow; fallback to manual upload or browser-assisted workflows when not approved.
- **Instagram/Facebook:** Publishing depends on Meta API permissions, account type, OAuth setup, and app review; fallback to manual upload packages when not authorized.
- **YouTube Quota:** YouTube upload quota costs and daily quota limits change over time. Store `last_verified_at`, quota assumptions, and failure modes in platform specs instead of hardcoding a videos/day claim.
- **Bluesky:** Video posting is feasible through ATProto, but email verification, daily video limits, CDN limits, and moderation requirements apply and should be represented in adapter specs.
- **X / LinkedIn:** Rate limits, API plan restrictions, and permissions are adapter constraints. Do not hardcode one global limit; verify before each implementation cycle.

### LoRA Training
- **FLUX LoRA on 24 GB Mac:** May succeed with careful memory management; not guaranteed
- **Training time:** 4–8 GPU hours (run at night only)
- **Fallback:** If training fails, fall back to base FLUX; do not block production

### Captions
- **Whisper.cpp:** Local, no API costs; quality depends on audio input
- **Fallback:** Optional integration with cloud TTS/transcription APIs (user chooses)

### Safe-Zone Rendering
- **Simple content:** FFmpeg crop/scale sufficient
- **Complex layouts:** Use canonical timeline (separate render per format)
- **Benchmark:** Measure quality + time for both approaches; choose per project

---

## Cost Summary

**Local Infrastructure:** $0
- Docker + PostgreSQL: free
- Worker process: free
- Whisper.cpp: free
- Python scripts: free

**Not Included (User Responsibility):**
- Electricity and wear from sustained local workloads
- Storage: local SSD/NAS/cloud backup if desired
- Optional paid APIs or platform plans where a platform requires them
- Optional cloud LLM/TTS/transcription services if the user chooses quality or speed over fully local execution
- Platform-specific business/app review costs, verification requirements, or developer-account constraints where applicable

---

## Next Steps

1. **Phase 2A (May 30):** Start platform/format/caption specs
2. **Phase 2B (June 10):** Implement PostgreSQL queue
3. **Phase 3 (June 20):** Begin posting adapter work; target YouTube + Bluesky
4. **Phase 4 (July 15):** Multi-account scheduler
5. **Phase 5 (Aug 15):** Metrics + optional LoRA

All phases assume feedback and iteration; do not treat timelines as fixed.


## Phase 5AH — Real Upload Disabled No-Op Wiring Activation and Smoke Test (VO-7AB)

Status: complete.

VO-7AB records a disabled no-op wiring activation result and a no-op wiring smoke test result. These are artifact and validation layers only. They do not apply runtime wiring, create or enable a feature flag, change live execution paths, add production imports, upload, call platform APIs, make network calls, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

Approval only permits future real upload readiness gate v2 work.

## Phase 5AI — Real Upload Readiness Gate V2 (VO-7AC)

Status: complete.

VO-7AC adds a real upload readiness gate v2 artifact. This gate reviews the disabled no-op wiring smoke test and records the remaining gates required before executor adapter design can proceed. It does not enable real upload, network calls, platform APIs, credentials, media reads, runtime execution, dependencies, or package metadata changes.

Approval only permits future real upload executor adapter design work; `ready_for_real_upload` remains false.

## Phase 5AJ — Real Upload Executor Adapter Design (VO-7AD)

Status: complete.

VO-7AD adds a real upload executor adapter design artifact. It defines the required credential, network, platform API, media read, payload, response redaction, dry-run-first, and executor orchestration boundaries before any executor contract work.

It does not create adapter code, enable runtime adapter behavior, upload, call platform APIs, make network calls, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

Approval only permits future executor contract work.

## Phase 5AK — Real Upload Executor Contracts (VO-7AE)

Status: complete.

VO-7AE adds real upload executor contract artifacts. It defines contracts for credential boundaries, media read boundaries, payload building, platform client boundaries, network boundaries, response redaction, and executor orchestration.

It does not create adapter code, enable runtime behavior, upload, call platform APIs, make network calls, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

Approval only permits future executor contract test work.

## Phase 5AL — Real Upload Executor Contract Tests and Dry-Run Adapter Design (VO-7AF/VO-7AG)

Status: complete.

VO-7AF adds executor contract test artifacts for the credential, media read, payload builder, platform client, network, response redaction, and executor orchestration contracts. VO-7AG adds a dry-run adapter design artifact for local simulation boundaries only.

These phases do not create adapter code, enable runtime behavior, upload, call platform APIs, make network calls, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

Approval only permits future dry-run adapter contract work.

## Phase 5AM — Dry-Run Adapter Contracts, Contract Tests, and Final Operator Checklist (VO-7AH/VO-7AI/VO-7AJ)

Status: complete.

VO-7AH adds dry-run adapter contracts, VO-7AI adds dry-run adapter contract tests, and VO-7AJ adds the final operator checklist before any future real upload enablement request. These phases remain non-executing and do not enable real upload.

They do not create adapter code, enable runtime behavior, upload, call platform APIs, make network calls, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

Approval only permits a future separate real upload enablement request artifact.

## Phase 5AN — Real Upload Enablement Request, Safety Plan, and Review Gate (VO-7AK/VO-7AL/VO-7AM)

Status: complete.

VO-7AK adds a real upload enablement request artifact, VO-7AL adds an enablement safety plan, and VO-7AM adds an enablement review gate. These are controlled enablement-planning artifacts only. They still do not enable real upload, upload execution, network calls, platform API calls, credential/token/env/keychain access, media reads, runtime execution, dependencies, or package metadata changes.

Approval only permits a future controlled enablement artifact in a separate phase and commit.

## Phase 5AO — Controlled Real Upload Enablement and Preflight (VO-7AN/VO-7AO)

Status: complete.

VO-7AN adds a controlled real upload enablement artifact and VO-7AO adds a controlled enablement preflight result. These artifacts define the last planning and preflight boundary before any future runtime activation artifact.

They do not enable real upload, upload execution, network calls, platform API calls, credential/token/env/keychain access, media reads, runtime execution, dependencies, or package metadata changes. `ready_for_real_upload` remains false.

## Phase 5AP — Controlled Runtime Activation Request, Safety Contract, and Dry-Run (VO-7AP/VO-7AQ/VO-7AR)

Status: complete.

VO-7AP adds a controlled runtime activation request artifact, VO-7AQ adds a runtime activation safety contract, and VO-7AR adds a runtime activation dry-run result. These phases remain artifact/contract/dry-run only.

They do not add runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AQ — Runtime Activation Implementation Planning (VO-7AS/VO-7AT/VO-7AU)

Status: complete.

VO-7AS adds a runtime activation implementation plan, VO-7AT adds an implementation contract, and VO-7AU adds an implementation dry-run review. These phases plan and review future implementation only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AR — Activation Candidate, Final Review, and Rollback Plan (VO-7AV/VO-7AW/VO-7AX)

Status: complete.

VO-7AV adds a controlled runtime activation candidate, VO-7AW adds a final review artifact, and VO-7AX adds a rollback plan artifact. These phases remain candidate/review/rollback-planning artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AS — Activation Go/No-Go, Final Safe Report, and Boundary Completion Summary (VO-7AY/VO-7AZ/VO-7BA)

Status: complete.

VO-7AY adds an activation go/no-go artifact, VO-7AZ adds a final safe activation report, and VO-7BA adds a boundary completion summary. These phases remain artifact/report/summary only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AT — Runtime Implementation Boundary Request, Safety Contract, and Dry-Run (VO-7BB/VO-7BC/VO-7BD)

Status: complete.

VO-7BB adds a runtime implementation boundary request, VO-7BC adds a boundary safety contract, and VO-7BD adds a boundary dry-run artifact. These phases remain boundary-request/contract/dry-run artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AU — Runtime Implementation Candidate, Review, and Safe Report (VO-7BE/VO-7BF/VO-7BG)

Status: complete.

VO-7BE adds a runtime implementation candidate artifact, VO-7BF adds a candidate review artifact, and VO-7BG adds a candidate safe report artifact. These phases remain candidate/review/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AV — Runtime Implementation Final Boundary, Review, and Safe Report (VO-7BH/VO-7BI/VO-7BJ)

Status: complete.

VO-7BH adds a runtime implementation final boundary artifact, VO-7BI adds a final boundary review artifact, and VO-7BJ adds a final boundary safe report artifact. These phases remain final-boundary/review/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AW — Real Runtime Stub Boundary, Contract, and Dry-Run Report (VO-7BK/VO-7BL/VO-7BM)

Status: complete.

VO-7BK adds a real runtime stub boundary request, VO-7BL adds a real runtime stub boundary contract, and VO-7BM adds a real runtime stub boundary dry-run report. These phases remain stub-boundary/contract/dry-run report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AX — No-Op Runtime Stub, Review, and Safe Report (VO-7BN/VO-7BO/VO-7BP)

Status: complete.

VO-7BN adds a no-op runtime stub artifact, VO-7BO adds a no-op runtime stub review, and VO-7BP adds a no-op runtime stub safe report. These phases remain no-op stub/review/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AY — Runtime Stub Store, Retrieval Contract, and Safe Report (VO-7BQ/VO-7BR/VO-7BS)

Status: complete.

VO-7BQ adds a runtime stub store artifact, VO-7BR adds a runtime stub retrieval contract, and VO-7BS adds a store/retrieval safe report. These phases remain store/retrieval-contract/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5AZ — Runtime Stub Manifest, Index Contract, and Safe Report (VO-7BT/VO-7BU/VO-7BV)

Status: complete.

VO-7BT adds a runtime stub manifest artifact, VO-7BU adds a runtime stub index contract, and VO-7BV adds a manifest/index safe report. These phases remain manifest/index-contract/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5BA — Runtime Stub Release Candidate, Review, and Safe Report (VO-7BW/VO-7BX/VO-7BY)

Status: complete.

VO-7BW adds a runtime stub release candidate artifact, VO-7BX adds a release candidate review, and VO-7BY adds a release candidate safe report. These phases remain release-candidate/review/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5BB — Runtime Stub Final Gate, Review, and Safe Report (VO-7BZ/VO-7CA/VO-7CB)

Status: complete.

VO-7BZ adds a runtime stub final gate artifact, VO-7CA adds a final gate review, and VO-7CB adds a final gate safe report. These phases remain final-gate/review/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.

## Phase 5BC — Runtime Stub Completion Summary, Review, and Safe Report (VO-7CC/VO-7CD/VO-7CE)

Status: complete.

VO-7CC adds a runtime stub completion summary, VO-7CD adds a runtime stub completion review, and VO-7CE adds a runtime stub completion safe report. These phases remain completion-summary/review/report artifacts only.

They do not implement runtime wiring, enable real upload, enable upload execution, make network calls, call platform APIs, access credentials/tokens/env/keychain, read media, mutate files, add dependencies, modify package metadata, or make `ready_for_real_upload` true.