# Plan: Cloudflare Tunnels Tab in ProBot Dashboard

## Context

Add a new "Tunnels" tab to the ProBot dashboard showing the three key tunnels (CloudPanel AWS, Dokploy, Supabase) in ProChat Studio, with their public hostnames and online/offline status. Layout mirrors the New Relic tab: horizontal tunnel cards in a grid, vertical hostname list beneath each tunnel.

---

## What we know

- **Account**: ProChat Studio (`6a96282349f82a2cc05723f561b5eb3a`)
- **API token**: already in `process.env.CLOUDFLARE_API_TOKEN` (same token used by `getCloudflareDomains`)
- **Three tunnels to highlight** (by name, filtered from all 5):
  - CloudPanel AWS (`1bdef92e-5e70-4836-9552-3e4653cef43a`)
  - Dokploy (`dc7bb87e-6a4d-4e3e-8e7d-71a091fcdf3b`)
  - Supabase (`dd5ca154-87cb-4163-bb06-ee784aeaf36f`)
- **Cloudflare APIs needed**:
  - `GET /accounts/{id}/cfd_tunnel?per_page=100` — list tunnels + status
  - `GET /accounts/{id}/cfd_tunnel/{id}/configurations` — ingress rules (public hostnames)
- **CLOUDFLARE_ACCOUNT_ID** must be read from env or loaded from `~/.config/cloudflare-ai/credentials/prochat-provisioner.env`

---

## Implementation

### File 1: `src/services/cloudflare-tunnels.ts` (new file)

```typescript
interface CloudflareTunnelHostname {
  hostname: string;
  service: string;
  online: boolean | null; // checked via HEAD request
}

interface CloudflareTunnel {
  id: string;
  name: string;
  status: string; // "healthy" | "down" | "degraded" | "inactive"
  hostnames: CloudflareTunnelHostname[];
  error?: string;
}

interface CloudflareTunnelsData {
  tunnels: CloudflareTunnel[];
  error?: string;
}
```

`getCloudflareTunnels()`:
1. Load `CLOUDFLARE_API_TOKEN` from `process.env` first, fall back to reading `~/.config/cloudflare-ai/credentials/prochat-provisioner.env`
2. Load `CLOUDFLARE_ACCOUNT_ID` the same way
3. Fetch `GET /accounts/{id}/cfd_tunnel?per_page=100` — filter to only tunnels where `name` matches the three targets: `["CloudPanel AWS", "Dokploy", "Supabase"]`
4. For each matching tunnel, fetch `GET /accounts/{id}/cfd_tunnel/{tunnelId}/configurations` — extract `config.ingress[]` where `hostname` is set (skip catch-all rule with empty hostname)
5. For each hostname, fire a `HEAD https://{hostname}` with 5s timeout — set `online: true` if HTTP response (any status), `false` if connection refused/timeout, `null` if inconclusive
6. Return `CloudflareTunnelsData` with all three tunnels sorted: CloudPanel AWS, Dokploy, Supabase
7. Cache result in module-level variable for 90 seconds (tunnels change rarely)
8. Graceful error: on any failure, return `{ tunnels: [], error: "..." }`

AbortController pattern for timeouts (same as dokploy.ts).

### File 2: `src/bot/dashboard.ts`

**A. Import** (at top with other service imports):
```typescript
import { getCloudflareTunnels } from "../services/cloudflare-tunnels.js";
```

**B. getDashboardData** — add `getCloudflareTunnels()` to the `Promise.all`:
```typescript
const [..., tunnels] = await Promise.all([
  ...,
  getCloudflareTunnels(),
]);
// add to return object:
tunnels,
```

**C. Tab button** — insert after Domains tab button:
```html
<button class="tab-btn" data-tab="tunnels">Tunnels <span class="tab-count" id="cnt-tunnels"></span></button>
```

**D. Tab panel** — insert after domains panel:
```html
<div class="tab-panel" id="tab-tunnels"></div>
```

**E. renderCloudflareTunnels(data)** — in the inline JS:
- Layout: three tunnel sections stacked vertically, each with:
  - Section header: tunnel name + colored status dot (green=healthy, red=down/degraded, gray=inactive/unknown)
  - `nr-grid`-style hostname grid (3 cols → 2 → 1 on smaller screens)
  - Each hostname card: colored dot + hostname text + service label (like NR cards)
- Tunnel status colors: `healthy` → green, `down`/`degraded` → red, else → gray
- Hostname online colors: `true` → green, `false` → red, `null` → amber (unknown)

**F. render(d) wiring** — add alongside existing tab wirings:
```js
const tcCount = (d.tunnels?.tunnels || []).reduce((n, t) => n + t.hostnames.length, 0);
document.getElementById('cnt-tunnels').textContent = tcCount ? String(tcCount) : '';
document.getElementById('tab-tunnels').innerHTML = renderCloudflareTunnels(d.tunnels);
```

---

## CSS additions (inline in HTML const)

Reuse existing `.nr-grid`, `.nr-card`, `.nr-dot`, `.nr-name`, `.nr-sub`, `.sec-hd`, `.sec-title`, `.sec-count` — these already exist and are exactly the right style. No new CSS needed.

---

## Critical files

- New: `/Users/Office/Repos/stevewesthoek/brain/projects/probot/src/services/cloudflare-tunnels.ts`
- Modified: `/Users/Office/Repos/stevewesthoek/brain/projects/probot/src/bot/dashboard.ts`

---

## Verification

1. `npm run build` — zero TypeScript errors
2. Restart ProBot, hit `http://localhost:7070/api/data` — check `tunnels.tunnels` has 3 entries with hostnames and `online` flags
3. Open dashboard → Tunnels tab shows three tunnel sections with colored status dots and hostname grids
4. Commit and push to main
