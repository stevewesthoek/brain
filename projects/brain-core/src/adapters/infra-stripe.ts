import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const STRIPE_CONFIG_PATH = path.join(os.homedir(), '.config', 'stripe', 'config.toml');

interface StripeProfile {
  profileName: string;
  displayName: string;
}

export interface InfraStripeAccountSummary {
  profileName: string;
  displayName: string;
  liveAvailableAmount: number | null;
  livePendingAmount: number | null;
  liveCurrency: string | null;
  testAvailableAmount: number | null;
  testPendingAmount: number | null;
  error?: string;
}

export interface InfraStripeStatus {
  status: 'ok' | 'not-configured' | 'error';
  accounts: InfraStripeAccountSummary[];
  error?: string;
}

function parseStripeConfig(): StripeProfile[] {
  if (!fs.existsSync(STRIPE_CONFIG_PATH)) return [];
  const profiles: StripeProfile[] = [];
  let current: StripeProfile | null = null;

  for (const rawLine of fs.readFileSync(STRIPE_CONFIG_PATH, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      if (current?.displayName) profiles.push(current);
      const section = sectionMatch[1]?.replace(/^['"]|['"]$/g, '') ?? '';
      current = { profileName: section, displayName: '' };
      continue;
    }

    if (!current) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key === 'display_name') current.displayName = value;
  }

  if (current?.displayName) profiles.push(current);
  return profiles.filter((p) => p.profileName !== 'color' && p.profileName !== 'project-name');
}

async function stripeBalance(profileName: string, live: boolean): Promise<{ available: number; pending: number; currency: string | null } | null> {
  try {
    const args = ['get', '/v1/balance', '-p', profileName];
    if (live) args.push('--live');
    const { stdout } = await execFileAsync('stripe', args, { timeout: 15_000, maxBuffer: 2 * 1024 * 1024 });
    const data = JSON.parse(stdout) as { available?: Array<{ amount?: number; currency?: string }>; pending?: Array<{ amount?: number }> };
    const available = (data.available ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0) / 100;
    const pending = (data.pending ?? []).reduce((sum, e) => sum + (e.amount ?? 0), 0) / 100;
    const currency = data.available?.[0]?.currency ?? null;
    return { available, pending, currency };
  } catch {
    return null;
  }
}

export async function getInfraStripeStatus(): Promise<InfraStripeStatus> {
  const profiles = parseStripeConfig();
  if (!profiles.length) {
    return {
      status: 'not-configured',
      accounts: [],
      error: 'Stripe not configured. Create ~/.config/stripe/config.toml with profile sections.',
    };
  }

  try {
    const accounts = await Promise.all(
      profiles.slice(0, 6).map(async (profile): Promise<InfraStripeAccountSummary> => {
        const [live, test] = await Promise.all([
          stripeBalance(profile.profileName, true),
          stripeBalance(profile.profileName, false),
        ]);
        return {
          profileName: profile.profileName,
          displayName: profile.displayName,
          liveAvailableAmount: live?.available ?? null,
          livePendingAmount: live?.pending ?? null,
          liveCurrency: live?.currency ?? null,
          testAvailableAmount: test?.available ?? null,
          testPendingAmount: test?.pending ?? null,
        };
      }),
    );

    return { status: 'ok', accounts };
  } catch (err) {
    return { status: 'error', accounts: [], error: err instanceof Error ? err.message : String(err) };
  }
}
