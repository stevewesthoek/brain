# Supabase Runbook

## Purpose
Safe access to the private Supabase VM and DB lifecycle operations.

## Checklist
- Use VNet-only access (Dokploy or VM)
- Never expose DB publicly
- Use system scripts for migrations/provisioning

## Rollback
- Revert migration if needed
- Restore from backup snapshot
