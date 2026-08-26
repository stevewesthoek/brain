# Azure Dokploy → AWS Lightsail Migration Records

**Document status:** HISTORICAL / CLOSED
**Migration:** Azure Dokploy → AWS `dokploy-aws`
**Production cutover:** 2026-08-17
**Azure Dokploy decommission:** 2026-08-26

Every file in this directory records a dated migration phase, cutover procedure, rehearsal,
rollback analysis, or lessons-learned snapshot. References to `vm-dokploy`, Azure IPs, Azure
cloudflared, Azure application writers, Azure backup vaults, or Class A/B rollback describe the
historical state and procedures at the date shown. They are not current infrastructure, operator
commands, recovery paths, or production authority.

The migration is fully closed. Azure Dokploy was deleted, its Tailscale node was removed, and
rollback to Azure Dokploy is impossible. Current production authority is AWS `dokploy-aws`;
recovery relies on AWS snapshots/backups and documented reconstruction procedures. Azure
Supabase / PROCHAT-DATA remains ACTIVE PRODUCTION and was untouched.
