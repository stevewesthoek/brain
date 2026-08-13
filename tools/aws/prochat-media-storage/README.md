# ProChat Media Storage — AWS S3 Foundation

## Bucket

| Field | Value |
|-------|-------|
| Name | `prochat-media-prod-909439522876-us-east-1` |
| Account | `909439522876` |
| Region | `us-east-1` |
| Naming convention | `<org>-<workload>-<env>-<account>-<region>` |

## Prefix Structure

| Prefix | Purpose |
|--------|---------|
| `models/` | Persistent model weights (ComfyUI, Wan 2.2, FLUX, etc.) |
| `workflows/` | ComfyUI workflow JSON, pipeline definitions |
| `inputs/` | Source assets for generation jobs (images, audio, text) |
| `jobs/pending/` | Job manifests awaiting pickup |
| `jobs/running/` | Job manifests currently executing |
| `jobs/completed/` | Job manifests that finished successfully |
| `jobs/failed/` | Job manifests that failed |
| `outputs/` | Final rendered media assets |
| `temp/` | Intermediate render artifacts (auto-expired) |

### Job prefix semantics

`jobs/{pending,running,completed,failed}/` hold small JSON manifest and state files only. Large media assets belong in `inputs/`, `outputs/`, or `temp/`.

## Security

- Block Public Access: all 4 settings enabled
- Object Ownership: BucketOwnerEnforced (ACLs disabled)
- Encryption: SSE-S3 (AES-256), BucketKeyEnabled = false
- Bucket policy: Deny-only — rejects all non-HTTPS requests (`aws:SecureTransport` = false)
- Versioning: not enabled
- No public ACLs, no public URLs, no Allow statements in bucket policy
- No IAM users or long-lived access keys created

## Lifecycle Rules

| Rule ID | Scope | Action |
|---------|-------|--------|
| `expire-temp-7d` | `temp/` | Delete objects after 7 days |
| `abort-incomplete-multipart-1d` | Entire bucket | Abort incomplete multipart uploads after 1 day |

No automatic expiration on `models/`, `workflows/`, `inputs/`, `jobs/`, or `outputs/`.

## Future GPU Worker Access Model

External Lambda Cloud GPU instances should access this bucket using:

1. **Presigned URLs** (preferred) — the orchestrator generates narrowly-scoped GET/PUT URLs valid for minutes, passed to the worker at job dispatch time.
2. **STS temporary credentials** (alternative) — short-lived credentials via `AssumeRole` with a policy scoped to the specific job prefix.

Do NOT store long-lived AWS credentials on GPU workers. Workers are disposable and terminated when idle.

## Scripts

| File | Purpose |
|------|---------|
| `create-bucket.sh` | Idempotent provisioning (re-runnable) |
| `verify-bucket.sh` | Verification checks (exits 0 if all pass) |
| `config.json` | Non-secret bucket configuration |

## Verification

```bash
bash tools/aws/prochat-media-storage/verify-bucket.sh
```
