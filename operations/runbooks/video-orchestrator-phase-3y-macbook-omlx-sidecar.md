# Video Orchestrator Phase 3Y — MacBook oMLX Sidecar Worker

**Status:** Standard local sidecar scaffold, enabled by operator config  
**Scope:** Low-risk local text tasks only  
**Not required for:** production uploads, media generation, transcription, posting, or the Mac mini control plane

---

## Purpose

Phase 3Y adds a safe distributed local worker-node scaffold so the Video Orchestrator can route selected `llm_text` jobs to an oMLX server running on a MacBook over a trusted Thunderbolt Bridge or private LAN network.

The Mac mini remains the control plane. The MacBook is a standard expected local worker for text-only inference, while still degrading safely if it is sleeping, unplugged, or temporarily unreachable.

---

## Architecture

- Mac mini:
  - job queue and orchestration
  - manifest/package generation
  - upload/posting control
  - fallback oMLX provider
  - sidecar health checks, leasing, dispatch, result ingestion, and retry/skip decisions
- MacBook:
  - expected M1 16 GB oMLX sidecar server
  - low-risk text tasks only
  - returns structured results to the Mac mini for normal pipeline continuation
  - no secrets, credentials, upload, or media generation
- Transport:
  - Thunderbolt Bridge / private RFC1918 LAN only
  - enabled through local worker-node configuration

Apple supports IP over Thunderbolt between Macs. Use a private static address pair such as:
- Mac mini: `10.10.10.1`
- MacBook: `10.10.10.2`

The operator may also use a private LAN address, for example the current MacBook endpoint `192.168.2.2`. The exact IPs do not matter; the network must remain private and controlled.

---

## What This Phase Does

- Defines a local worker-node schema for oMLX sidecars
- Allows an explicit `trusted_thunderbolt_lan` network scope
- Validates that sidecar jobs are enabled through local worker-node configuration
- Supports health checks against a configurable models endpoint
- Keeps runtime support limited to `metadata_variants` for now
- Preserves safe fallback to local oMLX or skip-with-warning
- Ensures the Mac mini records sidecar dispatch/results and resumes the pipeline using the returned artifact shape

---

## What This Phase Does Not Do

- No YouTube posting
- No FFmpeg rendering
- No Whisper transcription
- No image or video generation
- No OAuth
- No credential handling
- No `.env` changes
- No broad firewall exposure
- No hard failure when the MacBook is offline
- No production dependency that can dead-letter the pipeline when remote oMLX is unavailable

---

## Local Worker Node Config

Use `operations/specs/video-orchestrator/local-worker-nodes.schema.json` for sidecar configuration.

Important fields:
- `node_id`
- `display_name`
- `role`
- `enabled`
- `provider`
- `base_url`
- `network_scope`
- `allowed_tasks`
- `max_parallel_jobs`
- `health_check_path`
- `timeout_ms`
- `fallback_behavior`
- `secrets_allowed: false`
- `posting_allowed: false`
- `media_generation_allowed: false`
- `upload_allowed: false`

`enabled` is operator-controlled. For this workspace, the M1 MacBook should be treated as an expected local worker once configured, but every sidecar task must still have `local_or_skip` or equivalent fallback behavior so the pipeline keeps moving if the MacBook is temporarily unavailable.

---

## Allowed Tasks

The node spec defines future text-only tasks:

- `metadata_variants`
- `hook_variants`
- `description_draft`
- `caption_cleanup`
- `package_qa_summary`

At runtime, Phase 3Y may still execute only `metadata_variants`. The other tasks are reserved for later expansion.

---

## Forbidden Tasks

Do not route these tasks to the MacBook sidecar:

- YouTube upload jobs
- posting jobs
- FFmpeg rendering
- Whisper transcription
- SDXL / FLUX / image generation
- video generation
- OAuth or token exchange
- Keychain operations
- secret-bearing prompts

---

## Network Scope Rules

Supported scopes:
- `localhost`
- `trusted_thunderbolt_lan`

Rules:
- `localhost` stays loopback-only
- `trusted_thunderbolt_lan` requires explicit opt-in
- only private RFC1918 addresses are allowed for sidecar nodes
- public IPs are rejected
- non-HTTP protocols are rejected
- the worker should not call a remote node if payload keys look secret-shaped

---

## Health Check

The sidecar uses a short-timeout health check against a models endpoint, usually `/models`.

If the node is unavailable:
- the job falls back to the local oMLX path if configured
- otherwise it skips with a warning
- production does not fail
- the scheduler should retry future eligible jobs after the next successful health check

The Mac mini is authoritative: it leases the job, sends only the allowed payload, receives the structured result, stores the result in the normal job/artifact path, and marks the sidecar step succeeded, skipped, or degraded. The MacBook never owns queue state.

---

## Night Scheduler Usage

Use the sidecar for low-risk batch text jobs during night windows and daytime queue-drain windows when the MacBook is available.

Suggested usage:
- route only `llm_text` jobs
- keep `max_parallel_jobs` at `1` initially
- enable `local_or_skip` fallback
- avoid any secret-bearing or account-specific prompts

Operational note:
- the MacBook must remain awake for the sidecar to stay reachable
- the safest overnight setup is plugged in with the lid slightly open, or a valid clamshell configuration
- the display may sleep, but the computer itself should not
- if the MacBook sleeps, the sidecar is unavailable and jobs should fall back or skip safely

The sidecar is expected local capacity, but it remains non-blocking by design. This prevents one sleeping or unreachable machine from stopping the production studio.

---

## Validation

Before enabling a real MacBook endpoint:

1. Confirm the node config validates against the schema.
2. Confirm the sidecar health check returns success on the private LAN.
3. Confirm secret-like payload keys are rejected before a network call.
4. Confirm fallback to localhost oMLX works.
5. Confirm unavailable sidecar calls do not dead-letter jobs.
6. Confirm no posting, upload, or media-generation tasks can route to the node.

---

## Troubleshooting

- If the node is unreachable, verify Thunderbolt Bridge is active and the IP is in a private range.
- If a job is rejected, check for secret-shaped keys in the payload.
- If a job skips, confirm the fallback provider is configured.
- If the worker emits `trusted_thunderbolt_lan` without opt-in, treat it as a misconfiguration.
- If the MacBook is offline, the Mac mini should continue operating normally.
