- database auto provisioning
	What’s not in this version (by design)

	To keep the boilerplate lean, you do not currently have:
		•	Per-PR preview tenants (slug = repo + PR number).
		•	MCP / Dokploy-API integration for remote scripted operations.
		•	Multi-tenant runtime switching (you’re single-tenant-per-app right now, using one APP_SLUG).

Those can be layered on later without breaking what you’ve got.
- better solution for supabase shell/wrapper for easy visualitation

