# Video Orchestrator Phase 3Y — MacBook oMLX Sidecar Worker

**Status:** Optional, opt-in sidecar scaffold  
**Scope:** Low-risk local text tasks only  
**Not required for:** production uploads, media generation, transcription, posting, or the Mac mini control plane

---

## Purpose

Phase 3Y adds a safe distributed local worker-node scaffold so the Video Orchestrator can route selected `llm_text` jobs to an oMLX server running on a MacBook over a trusted Thunderbolt Bridge network.

The Mac mini remains the control plane. The MacBook is a secondary local worker for text-only inference.

---

## Architecture

- Mac mini:
  - job queue and orchestration
  - manifest/package generation
  - upload/posting control
  - fallback oMLX provider
- MacBook:
  - optional oMLX sidecar server
  - low-risk text tasks only
  - no secrets, credentials, upload, or media generation
- Transport:
  - Thunderbolt Bridge / private RFC1918 LAN only
  - explicit opt-in required for remote calls

Apple supports IP over Thunderbolt between Macs. Use a private static address pair such as:
- Mac mini: `10.10.10.1`
- MacBook: `10.10.10.2`

The exact IPs do not matter; the network must remain private and controlled.

---

## What This Phase Does

- Defines a local worker-node schema for oMLX sidecars
- Allows an explicit `trusted_thunderbolt_lan` network scope
- Validates that sidecar jobs are opt-in
- Supports health checks against a configurable models endpoint
- Keeps runtime support limited to `metadata_variants` for now
- Preserves safe fallback to local oMLX or skip-with-warning

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
- No requirement that the MacBook be online
- No production dependency on remote oMLX

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

`enabled` defaults to `false`. Sidecar routing stays disabled unless explicitly turned on.

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

---

## Night Scheduler Usage

Use the sidecar for low-risk batch text jobs during night windows when the MacBook is available.

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

The sidecar is optional and non-blocking.

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
