'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { brainCoreRequest } from '@/lib/braincore-client';
import { infraCloudflareTunnelsStatusSchema, type InfraTunnel } from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';

type TunnelHostname = {
  hostname: string;
  service: string;
  online: boolean | null;
};

type TunnelRecord = Omit<InfraTunnel, 'hostnames'> & {
  hostnames?: TunnelHostname[];
};

const LIVE_TUNNEL_STATUSES = new Set(['healthy', 'active', 'running', 'up', 'connected', 'online']);
const TRANSITIONAL_TUNNEL_STATUSES = new Set(['degraded', 'pending', 'unknown', 'initializing']);

function normalizeStatus(value: string): string {
  return value.trim().toLowerCase();
}

function tunnelIsLive(tunnel: TunnelRecord): boolean {
  const hostnames = tunnel.hostnames ?? [];
  if (hostnames.some((hostname) => hostname.online === true)) return true;
  return LIVE_TUNNEL_STATUSES.has(normalizeStatus(tunnel.status));
}

function tunnelTone(tunnel: TunnelRecord): 'available' | 'warning' | 'error' {
  if (tunnelIsLive(tunnel)) return 'available';
  if (TRANSITIONAL_TUNNEL_STATUSES.has(normalizeStatus(tunnel.status))) return 'warning';
  return 'error';
}

function hostnameTone(online: boolean | null): 'available' | 'warning' | 'error' {
  if (online === true) return 'available';
  if (online === null) return 'warning';
  return 'error';
}

function HostnameRow({ hostname, service, online }: { hostname: string; service: string; online: boolean | null }) {
  return (
    <div className="tunnel-hostname">
      <div className="tunnel-hostname-left">
        <span
          className="tunnel-hostname-dot"
          aria-hidden="true"
          style={{ background: online === true ? 'var(--success)' : online === false ? 'var(--destructive)' : 'var(--warning)' }}
        />
        <div className="min-w-0">
          <div className="card-title">{hostname}</div>
          <div className="meta">{service}</div>
        </div>
      </div>
      <StatusBadge status={hostnameTone(online)} label={online === true ? 'Live' : online === false ? 'Offline' : 'Unknown'} />
    </div>
  );
}

function TunnelCard({ tunnel }: { tunnel: TunnelRecord }) {
  const hostnames = tunnel.hostnames ?? [];
  const live = tunnelIsLive(tunnel);
  const onlineCount = hostnames.filter((hostname) => hostname.online === true).length;
  const hostnameCount = hostnames.length;

  return (
    <article className="card tunnel-card">
      <div className="card-header">
        <div className="min-w-0">
          <div className="card-title">{tunnel.name}</div>
          <div className="card-description">{tunnel.id}</div>
        </div>
        <StatusBadge status={tunnelTone(tunnel)} label={live ? 'Live' : 'Not live'} />
      </div>

      <div className="tunnel-summary">
        <div>
          <span>Raw status</span>
          <strong>{tunnel.status}</strong>
        </div>
        <div>
          <span>Hostnames</span>
          <strong>{hostnameCount}</strong>
        </div>
        <div>
          <span>Reachable</span>
          <strong>{onlineCount}</strong>
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {hostnames.map((hostname) => (
          <HostnameRow key={hostname.hostname} hostname={hostname.hostname} service={hostname.service} online={hostname.online} />
        ))}
        {hostnames.length === 0 ? <p className="meta">No public hostnames configured.</p> : null}
      </div>
    </article>
  );
}

export function TunnelsDashboard() {
  const tunnels = useQuery({
    queryKey: ['infra-tunnels'],
    queryFn: () => brainCoreRequest('/infra/tunnels', infraCloudflareTunnelsStatusSchema, { timeoutMs: 12_000 }),
    refetchInterval: 15_000,
  });

  const tunnelList = useMemo(() => tunnels.data?.tunnels ?? [], [tunnels.data?.tunnels]);
  const liveTunnels = useMemo(() => tunnelList.filter((tunnel) => tunnelIsLive(tunnel)).length, [tunnelList]);
  const hostnameCount = useMemo(() => tunnelList.reduce((count, tunnel) => count + (tunnel.hostnames?.length ?? 0), 0), [tunnelList]);
  const reachableHostnames = useMemo(
    () =>
      tunnelList.reduce(
        (count, tunnel) => count + (tunnel.hostnames?.filter((hostname) => hostname.online === true).length ?? 0),
        0,
      ),
    [tunnelList],
  );

  const overallStatus = tunnels.data?.status ?? (tunnels.isError ? 'error' : 'not-configured');
  const overallLabel = overallStatus === 'ok' ? 'Connected' : overallStatus === 'not-configured' ? 'Credentials missing' : 'Offline';
  const overallTone: 'available' | 'warning' | 'error' = overallStatus === 'ok' ? 'available' : overallStatus === 'not-configured' ? 'warning' : 'error';

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Infrastructure</div>
          <h1>Tunnels</h1>
          <p>Brain Core reads Cloudflare tunnels and their public hostnames. The console shows which tunnels are live and which hostnames are reachable, without exposing credentials or management controls.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={overallTone} label={overallLabel} />
          <span className="meta">Refreshes every 15 seconds</span>
          <button className="button compact secondary" onClick={() => void tunnels.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {tunnels.isError ? (
        <div className="compact-error">
          <strong>Cloudflare tunnel data failed to load.</strong> Brain Core could not read `/infra/tunnels`.
        </div>
      ) : null}

      {tunnels.data?.status === 'not-configured' ? (
        <div className="compact-error">
          <strong>Cloudflare credentials are not configured.</strong> Set <code>CLOUDFLARE_API_TOKEN</code> and <code>CLOUDFLARE_ACCOUNT_ID</code>, or create <code>~/.config/cloudflare-ai/credentials/prochat-provisioner.env</code>.
        </div>
      ) : null}

      <section className="grid cards">
        <article className="card">
          <div className="card-title">Tunnels</div>
          <div className="metric">{tunnelList.length}</div>
          <div className="meta">{liveTunnels} live, {Math.max(0, tunnelList.length - liveTunnels)} not live</div>
        </article>
        <article className="card">
          <div className="card-title">Hostnames</div>
          <div className="metric">{hostnameCount}</div>
          <div className="meta">{reachableHostnames} reachable right now</div>
        </article>
        <article className="card">
          <div className="card-title">Tunnel source</div>
          <div className="metric">GET</div>
          <div className="meta">Read-only status from `/infra/tunnels`</div>
        </article>
        <article className="card">
          <div className="card-title">Visibility</div>
          <div className="metric">Live</div>
          <div className="meta">Each hostname is checked for reachability</div>
        </article>
      </section>

      <section className="grid two tunnel-grid">
        {tunnelList.map((tunnel) => <TunnelCard key={tunnel.id} tunnel={tunnel} />)}
        {tunnelList.length === 0 ? (
          <article className="card">
            <div className="card-title">No tunnels returned</div>
            <p>Brain Core did not return any tunnel records.</p>
          </article>
        ) : null}
      </section>
    </div>
  );
}
