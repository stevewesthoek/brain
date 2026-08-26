# Deployment Rules

## Platform

**Dokploy** (self-hosted on AWS Lightsail `dokploy-aws`). UI: `https://dokploy.prochat.tools`. Never use Vercel. Azure Dokploy was decommissioned 2026-08-26.

## Ship workflow

| Step | Skill | Purpose |
|------|-------|---------|
| Ship | `/ship` | Detect + merge base + test + version + changelog + push + PR |
| Land & deploy | `/land-and-deploy` | Merge PR + wait for CI + deploy |
| Configure | `/setup-deploy` | Set deployment settings for land-and-deploy |
| Monitor | `/canary` | Post-deploy canary monitoring |
| Document | `/document-release` | Post-ship documentation update |

## Deploy configs

- Deploy configurations: `operations/deploy/`
- Dockerfile standard: `operations/deploy/dockerfile-standard.md`
- Dokploy compose template: `operations/deploy/dokploy-deploy.yml`

## DNS

Managed via Cloudflare. Use `/cloudflare` skill for record management.

## Self-hosted services

| Service | Port | Access |
|---------|------|--------|
| Firecrawl | 3051 | `http://localhost:3051` (Tailscale) |
| n8n | — | `https://n8n.prochat.tools` |
| Dokploy | — | `https://dokploy.prochat.tools` |
| Ory Kratos | — | `https://auth.prochat.tools` |
| Umami | — | `https://umami.prochat.tools` |
