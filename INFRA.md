# SAAS INFRASTRUCTURE

This document describes the full infrastructure used to run and deploy SaaS applications.  
Audience: humans and AI agents that need to understand what exists, where it runs, and how to connect to it.

---

## 1. Overview

- **Cloud Providers**
  - **Azure**: Dokploy server + Supabase server (DB + backend).
  - **Hetzner Cloud**: Cloudpanel server (for hosting misc workloads / sites).
- **Ingress / Edge**
  - All three servers (Dokploy, Supabase, Cloudpanel) are reachable via **Cloudflare Tunnels**, one tunnel per server.
  - Selected services are exposed publicly via Cloudflare-managed DNS (e.g. `prochat.tools`).
- **Data Layer**
  - Supabase PostgreSQL is **not exposed to the internet**.
  - Only reachable from the Dokploy VM (and internally on the Supabase VM itself).

---

## 2. Cloud Providers

### 2.1 Azure

- **Provider:** Microsoft Azure
- **Usage:** Application orchestration (Dokploy) + Database / Supabase.
- **OS:** Ubuntu 24.04 LTS on all Azure VMs.
- **Region:** `Spain Central`

### 2.2 Hetzner Cloud

- **Provider:** Hetzner
- **Usage:** Cloudpanel server for hosting additional apps/sites.
- **Machine Type:** `cax21`
  - **vCPUs:** 4
  - **RAM:** 8 GB
  - **Disk:** 80 GB local
- **OS:** `TODO: <document OS/version on Cloudpanel>`

---

## 3. High-Level Architecture

- **Dokploy Server (Azure)**
  - Orchestrates and deploys Dockerized SaaS applications.
  - Acts as the main application host.
  - Reaches Supabase DB over a private Azure network.
  - Exposed to the internet via:
    - Public IP (Azure).
    - Cloudflare Tunnel (preferred path for users / management endpoints).

- **Supabase Server (Azure)**
  - Runs Supabase stack (PostgreSQL + backend services).
  - Database is **private-only** on internal IP.
  - **Supabase Studio frontend** exposed via Cloudflare + domain `prochat.tools`.
    - Only the Studio web UI is reachable from the internet.
    - The underlying PostgreSQL port is **not** exposed via Cloudflare or public IP.

- **Cloudpanel Server (Hetzner)**
  - Runs Cloudpanel for managing additional workloads.
  - Exposed via:
    - Direct public IP (Hetzner).
    - Cloudflare Tunnel (used for clean HTTPS + DNS).

---

## 4. Compute Nodes

### 4.1 Dokploy Server (Azure)

- **Purpose:** Application orchestration & deployment.
- **Cloud:** Azure
- **VM Size:** `Standard B2ms`
  - **vCPUs:** 2
  - **Memory:** 8 GiB
- **OS:** Ubuntu 24.04 LTS
- **Networking:**
  - **Public IP:** `68.221.202.242`
  - **Private IP:** `10.0.1.5`
  - **Subnet:** Routable to Supabase subnet (named `supabase` on Azure).
- **Key Services:**
  - Dokploy platform.
  - Application containers (SaaS apps).

### 4.2 Supabase Server (Azure)

- **Purpose:** Primary database and Supabase backend.
- **Cloud:** Azure
- **VM Size:** `Standard B2s`
  - **vCPUs:** 2
  - **Memory:** 4 GiB
- **OS:** Ubuntu 24.04 LTS
- **Networking:**
  - **Public IP (allocated):** `68.221.194.245`  
    - Public access effectively **blocked** by firewall/NSG.
  - **Private IP:** `10.0.2.4`
  - **Subnet:** `supabase`
- **Exposure:**
  - PostgreSQL **not exposed** to the internet.
  - Only accessible from:
    - Dokploy VM (`10.0.1.5`) over the Azure VNet.
    - Localhost / internal processes on the Supabase VM.
- **Supabase Studio:**
  - Frontend exposed on `https://prochat.tools`.
  - Only the **Studio UI** goes through Cloudflare.
  - Database remains private; Studio uses internal connection from within the Supabase VM.

### 4.3 Cloudpanel Server (Hetzner)

- **Purpose:** Cloudpanel hosting environment for additional apps / sites.
- **Cloud:** Hetzner Cloud
- **Machine:** `cax21`
  - **vCPUs:** 4
  - **RAM:** 8 GB
  - **Disk:** 80 GB local
- **Public IP:** `91.99.71.221`
- **OS:** `TODO: <document OS/version>`
- **Exposure:**
  - Reachable over public IP.
  - Also reachable via a dedicated Cloudflare Tunnel for clean HTTPS and DNS.

---

## 5. Networking & Access

### 5.1 Azure Virtual Network

- Dokploy VM and Supabase VM are in the same Azure VNet (or peered networks with full routing).
- **Subnets:**
  - Supabase VM is in subnet named `supabase`.
  - Dokploy VM has private IP `10.0.1.5` and can reach `10.0.2.4` (Supabase).
- **Key rule:** Supabase DB is **only** reachable over the private VNet, not from the public internet.

### 5.2 Public IPs

| Server        | Cloud   | Public IP       | Notes                                   |
|--------------|---------|-----------------|-----------------------------------------|
| Dokploy      | Azure   | `68.221.202.242`| Also behind Cloudflare tunnel.          |
| Supabase     | Azure   | `68.221.194.245`| Public access blocked; internal only.   |
| Cloudpanel   | Hetzner | `91.99.71.221`  | Also behind Cloudflare tunnel.          |

### 5.3 Cloudflare Tunnels

- One Cloudflare Tunnel per server:
  - **Dokploy Tunnel**
    - Routes selected hostnames (e.g. Dokploy UI) to the Dokploy VM.
  - **Supabase Tunnel**
    - Routes `studio.prochat.tools` to Supabase Studio frontend on Supabase VM.
    - Only the Studio web app; DB is not exposed via the tunnel.
  - **Cloudpanel Tunnel**
    - Routes chosen domains/subdomains to the Hetzner Cloudpanel VM.

> For agents: prefer Cloudflare hostnames over raw IPs wherever possible.

### 5.4 DNS / Domains

- **Known domains:**
  - `prochat.tools` → Supabase VM (Supabase Studio frontend).
- **TODO:**
  - Document:
    - Dokploy dashboard domain (if any).
    - Cloudpanel access domain (if any).
    - App domains hosted via Dokploy or Cloudpanel.

---

## 6. Data & DB Access Model

- **Primary DB:** Supabase PostgreSQL on `10.0.2.4:5433` (Azure).
- **Port:** `5433`.
- **Access rules:**
  - Accessible from Dokploy VM (`10.0.1.5`) over private network.
  - Accessible from internal Supabase processes and Supabase Studio (running on the Supabase VM).
  - **Not** directly reachable via public IP or Cloudflare tunnel.

- **Supabase Studio (`prochat.tools`):**
  - Client (browser) connects to Studio frontend via Cloudflare → Supabase VM.
  - Studio backend on the Supabase VM talks to PostgreSQL over `localhost` / `10.0.2.4`.
  - Database credentials and ports are never exposed to the public network.

---

## 7. Deployment & Tooling

- **Dokploy**
  - Handles deployments of Next.js / other Dockerized apps.
  - Runs on the Azure Dokploy VM.
  - Applications use Supabase DB via internal connection string to `10.0.2.4:5433`.

- **Cloudpanel**
  - Provides a UI for managing sites/apps on the Hetzner VM.
  - Uses Cloudflare Tunnel + DNS for clean external access (domain TBD).

---

## 8. Security Model

- **Supabase DB Isolation**
  - No direct public access (port closed on public IP).
  - No DB exposure through Cloudflare Tunnel.
  - Only Dokploy VM and Supabase VM have DB-level access.

- **Network Segregation**
  - Azure VNet subnets ensure only trusted paths can reach the DB.
  - Hetzner server is separate; it does **not** directly touch the Supabase DB (unless configured later).

- **Ingress via Cloudflare**
  - All user-facing endpoints are ideally behind Cloudflare Tunnels.
  - Allows centralized TLS, WAF, and DNS configuration.

- **Public IPs**
  - Still exist at Azure/Hetzner level but should be locked down with firewall/NSG rules.
  - Cloudflare acts as the preferred and documented ingress layer.

---

## 9. TODOs / Gaps to Fill

For completeness, the following should be added and kept up to date:

- **OS Details on Hetzner Cloudpanel**
  - e.g. `Ubuntu 22.04`, `Debian`, etc.

- **DNS & Domains**
  - Dokploy dashboard domain.
  - Cloudpanel admin domain.
  - All production app domains + which server they live on.

- **Firewall / NSG Rules**
  - Explicit inbound rules for each VM:
    - Ports open via public IP (if any).
    - Ports exposed via Cloudflare Tunnel.
    - Confirm that Supabase DB port is blocked on public IP and tunnel.

---

_Last updated: manually maintained. Keep this file in the root of the main repo so agents/humans always have a single source of truth._
