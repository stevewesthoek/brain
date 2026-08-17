import { execFile } from 'node:child_process';
import net from 'node:net';

export interface InfraTailscaleDevice {
  name: string;
  addresses: string[];
  online: boolean | null;
  lastSeenAt: string | null;
  routeState: 'active' | 'none' | 'unknown';
  connectivity: 'direct' | 'relay' | 'unknown';
  sshReachable: boolean | null;
}

export interface InfraTailscaleStatus {
  status: 'ok' | 'not-configured' | 'error';
  devices: InfraTailscaleDevice[];
  error?: string;
}

interface TailscalePeerLike {
  HostName?: string;
  DNSName?: string;
  TailscaleIPs?: string[];
  Online?: boolean;
  LastSeen?: string;
  CurAddr?: string;
  Relay?: string;
  PrimaryRoutes?: string[];
}

interface TailscaleStatusPayload {
  Self?: TailscalePeerLike;
  Peer?: Record<string, TailscalePeerLike>;
}

function runTailscaleStatus(): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'tailscale',
      ['status', '--json'],
      { timeout: 5_000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function probeTcpPort(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

function normalizedName(peer: TailscalePeerLike): string {
  const dnsName = peer.DNSName?.replace(/\.$/, '');
  return peer.HostName || dnsName || 'unknown';
}

function normalizedLastSeen(value: string | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export async function getInfraTailscaleStatus(options: { probeSsh?: boolean; sshTimeoutMs?: number } = {}): Promise<InfraTailscaleStatus> {
  const probeSsh = options.probeSsh ?? false;
  const sshTimeoutMs = Math.min(Math.max(options.sshTimeoutMs ?? 1_500, 250), 5_000);

  let payload: TailscaleStatusPayload;
  try {
    const stdout = await runTailscaleStatus();
    payload = JSON.parse(stdout) as TailscaleStatusPayload;
  } catch (error) {
    const maybeCode = (error as NodeJS.ErrnoException)?.code;
    if (maybeCode === 'ENOENT') {
      return { status: 'not-configured', devices: [], error: 'tailscale CLI is not installed or not available on PATH' };
    }
    return { status: 'error', devices: [], error: error instanceof Error ? error.message : String(error) };
  }

  const peers = [payload.Self, ...Object.values(payload.Peer ?? {})].filter((peer): peer is TailscalePeerLike => Boolean(peer));
  const devices: InfraTailscaleDevice[] = [];

  for (const peer of peers) {
    const addresses = (peer.TailscaleIPs ?? []).filter((value): value is string => typeof value === 'string' && value.length > 0);
    const online = typeof peer.Online === 'boolean' ? peer.Online : null;
    const routeState: InfraTailscaleDevice['routeState'] = Array.isArray(peer.PrimaryRoutes)
      ? peer.PrimaryRoutes.length > 0 ? 'active' : 'none'
      : 'unknown';
    const connectivity: InfraTailscaleDevice['connectivity'] = peer.CurAddr
      ? 'direct'
      : peer.Relay
        ? 'relay'
        : 'unknown';

    let sshReachable: boolean | null = null;
    if (probeSsh && online === true && addresses[0]) {
      sshReachable = await probeTcpPort(addresses[0], 22, sshTimeoutMs);
    }

    devices.push({
      name: normalizedName(peer),
      addresses,
      online,
      lastSeenAt: normalizedLastSeen(peer.LastSeen),
      routeState,
      connectivity,
      sshReachable,
    });
  }

  return { status: 'ok', devices };
}
