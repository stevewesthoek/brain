SAAS INFRASTRUCTURE

This document describes the full infrastructure used to run and deploy SaaS applications.
Audience: humans and AI agents that need to understand what exists, where it runs, and how to connect to it.

⸻

1. Overview
	•	Cloud Providers
	•	Azure: Dokploy server + Supabase server (DB + backend) + Cloudpanel server (new, migration target).
	•	Hetzner Cloud: Cloudpanel server (current production, pending migration to Azure).
	•	Ingress / Edge
	•	User-facing web services and UIs are reachable via Cloudflare Tunnels, one tunnel per server where applicable.
	•	Selected services are exposed publicly via Cloudflare-managed DNS (e.g. prochat.tools).
	•	Data Layer
	•	Supabase PostgreSQL is not exposed to the internet.
	•	Only reachable from the Dokploy VM via Tailscale and internally on the Supabase VM itself.

⸻

2. Cloud Providers

2.1 Azure
	•	Provider: Microsoft Azure
	•	Usage: Application orchestration (Dokploy), database / Supabase, and Cloudpanel (new, in-progress migration).
	•	OS: Ubuntu 24.04 LTS on all Azure VMs.
	•	Region: Spain Central

2.2 Hetzner Cloud
	•	Provider: Hetzner
	•	Usage: Cloudpanel server for hosting additional apps/sites.
	•	Status: Current production Cloudpanel (migration to Azure Cloudpanel in progress; decommission pending).
	•	Machine Type: cax21
	•	vCPUs: 4
	•	RAM: 8 GB
	•	Disk: 80 GB local
	•	OS: TODO: <document OS/version on Cloudpanel>

⸻

3. High-Level Architecture
	•	Dokploy Server (Azure)
	•	Orchestrates and deploys Dockerized SaaS applications.
	•	Acts as the main application host.
	•	Reaches Supabase DB exclusively via Tailscale.
	•	Exposed to the internet via:
	•	Cloudflare Tunnel (preferred path for users / management endpoints).
	•	Supabase Server (Azure)
	•	Runs Supabase stack (PostgreSQL + backend services).
	•	Database is private-only.
	•	Supabase Studio frontend exposed via Cloudflare + domain studio.prochat.tools.
	•	Only the Studio web UI is reachable from the internet.
	•	The underlying PostgreSQL port is not exposed via Cloudflare or public IP.
	•	Cloudpanel Servers
	•	Hetzner Cloudpanel: current production Cloudpanel.
	•	Azure Cloudpanel: new Cloudpanel VM, intended to replace Hetzner after migration.
	•	Cloudpanel servers have no application-level dependency on Supabase.
	•	Exposed via Cloudflare Tunnel for HTTPS access.

⸻

4. Compute Nodes

4.1 Dokploy Server (Azure)
	•	Purpose: Application orchestration & deployment.
	•	Cloud: Azure
	•	VM Size: Standard D2as v5
	•	vCPUs: 2
	•	Memory: 8 GiB
	•	OS: Ubuntu 24.04 LTS
	•	Networking:
	•	Public IP: 68.221.202.242 (locked down; not used for admin access).
	•	Private IP: Exists but not used for inter-VM routing.
	•	Connectivity:
	•	Tailscale:
	•	Admin access (SSH).
	•	Data-plane connectivity to Supabase VM (cross-subscription).
	•	Key Services:
	•	Dokploy platform.
	•	Application containers (SaaS apps).

4.2 Supabase Server (Azure)
	•	Purpose: Primary database and Supabase backend.
	•	Cloud: Azure
	•	VM Size: Standard B2s
	•	vCPUs: 2
	•	Memory: 4 GiB
	•	OS: Ubuntu 24.04 LTS
	•	Networking:
	•	Public IP (allocated): Present but blocked by firewall/NSG.
	•	Private IP / subnet: Exists for legacy reasons; not used for Dokploy access anymore.
	•	Connectivity:
	•	Tailscale:
	•	Accepts database connections from Dokploy VM.
	•	Exposure:
	•	PostgreSQL not exposed to the internet.
	•	Supabase Studio:
	•	Frontend exposed on https://studio.prochat.tools via Cloudflare Tunnel.
	•	Database access remains internal to the VM.

4.3 Cloudpanel Server (Hetzner)
	•	Purpose: Cloudpanel hosting environment for additional apps / sites.
	•	Cloud: Hetzner Cloud
	•	Machine: cax21
	•	vCPUs: 4
	•	RAM: 8 GB
	•	Disk: 80 GB local
	•	Public IP: 91.99.71.221
	•	OS: TODO: <document OS/version>
	•	Status: Production (pending migration to Azure Cloudpanel).
	•	Exposure:
	•	Reachable via Cloudflare Tunnel for HTTPS access.

4.4 Cloudpanel Server (Azure)
	•	Purpose: Future primary Cloudpanel server.
	•	Cloud: Azure
	•	Status: Active, migration target; not yet primary.
	•	OS: Ubuntu 24.04 LTS
	•	Exposure:
	•	Cloudflare Tunnel for HTTPS access.

⸻

5. Networking & Access

5.1 Azure Virtual Network (Historical)
	•	Dokploy and Supabase VMs still have Azure VNets and private IPs.
	•	These paths are no longer used for application or database traffic.
	•	Kept only as residual infrastructure; no dependency on Azure VNet routing.

5.2 Tailscale Network (Active)
	•	Primary connectivity layer between servers.
	•	Data Plane:
	•	Dokploy → Supabase PostgreSQL (cross Azure subscriptions).
	•	Admin Plane:
	•	SSH access to all VMs.
	•	No SSH access via Cloudflare.
	•	Cloudflare availability is not required for VM access.

5.3 Public IPs

Server	Cloud	Public IP	Notes
Dokploy	Azure	68.221.202.242	Locked down; not used for admin access.
Supabase	Azure	Allocated	Blocked by NSG/firewall.
Cloudpanel	Hetzner	91.99.71.221	Behind Cloudflare Tunnel.

5.4 Cloudflare Tunnels
	•	Used only for HTTPS access to web services and UIs:
	•	Dokploy UI.
	•	Supabase Studio.
	•	Cloudpanel UI(s).
	•	Not used for SSH or VM management.

⸻

6. Data & DB Access Model
	•	Primary DB: Supabase PostgreSQL (Azure Supabase VM).
	•	Port: 5433 (internal only).
	•	Access rules:
	•	Accessible from Dokploy VM via Tailscale only.
	•	Accessible from internal Supabase services and Supabase Studio.
	•	Not reachable via public IP, Azure VNet routing, or Cloudflare tunnel.
	•	Backups:
	•	All VMs use a uniform Azure VM backup policy:
	•	Daily: 7 retained.
	•	Weekly: 2 retained.
	•	Automated thinning enabled to control storage costs.

⸻

7. Deployment & Tooling
	•	Dokploy
	•	Handles deployments of Next.js / other Dockerized apps.
	•	Runs on the Azure Dokploy VM.
	•	Applications connect to Supabase DB via Tailscale address.
	•	Cloudpanel
	•	Provides a UI for managing sites/apps.
	•	Hetzner Cloudpanel: current production.
	•	Azure Cloudpanel: future production after migration.

⸻

8. Security Model
	•	Supabase DB Isolation
	•	No direct public access.
	•	No DB exposure through Cloudflare Tunnel.
	•	DB access limited to Supabase VM and Dokploy VM via Tailscale.
	•	Network Segregation
	•	Azure VNets are no longer relied upon for cross-VM communication.
	•	Tailscale enforces explicit, authenticated connectivity.
	•	Ingress via Cloudflare
	•	HTTPS only for user-facing services.
	•	Centralized TLS and DNS.

⸻

9. TODOs / Gaps to Fill

For completeness, the following should be added and kept up to date:
	•	OS Details on Hetzner Cloudpanel
	•	DNS & Domains
	•	Dokploy dashboard domain.
	•	Cloudpanel admin domains.
	•	App domains hosted per server.

⸻

Last updated: v1.2 – 2026-02-02
