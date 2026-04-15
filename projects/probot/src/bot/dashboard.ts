import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { exec, execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppContext } from "../types/app.js";
import { buildSessionOverview } from "../services/sessions.js";
import { buildRecentContinuationCards } from "../services/control-plane.js";
import { getCodexUsage } from "../services/codex-usage.js";
import { getDokployStatus } from "../services/dokploy.js";
import { getCloudflareTunnels } from "../services/cloudflare-tunnels.js";

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);
const FAVICON_SVG = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="lobster-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff4d4d"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>
  </defs>
  <path d="M60 10 C30 10 15 35 15 55 C15 75 30 95 45 100 L45 110 L55 110 L55 100 C55 100 60 102 65 100 L65 110 L75 110 L75 100 C90 95 105 75 105 55 C105 35 90 10 60 10Z" fill="url(#lobster-gradient)"/>
  <path d="M20 45 C5 40 0 50 5 60 C10 70 20 65 25 55 C28 48 25 45 20 45Z" fill="url(#lobster-gradient)"/>
  <path d="M100 45 C115 40 120 50 115 60 C110 70 100 65 95 55 C92 48 95 45 100 45Z" fill="url(#lobster-gradient)"/>
  <path d="M45 15 Q35 5 30 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/>
  <path d="M75 15 Q85 5 90 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/>
  <circle cx="45" cy="35" r="6" fill="#050810"/>
  <circle cx="75" cy="35" r="6" fill="#050810"/>
  <circle cx="46" cy="34" r="2.5" fill="#00e5cc"/>
  <circle cx="76" cy="34" r="2.5" fill="#00e5cc"/>
</svg>`;

const START_TIME = Date.now();

// ─── Data helpers ────────────────────────────────────────────────────────────

function parseHandoffSections(content: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  let current: string | null = null;
  for (const line of content.split("\n")) {
    if (line.startsWith("## ")) {
      current = line.slice(3).trim();
      sections[current] = [];
    } else if (current !== null && line.trim()) {
      sections[current]!.push(line.trim());
    }
  }
  return sections;
}

function getFreshness(updatedAt: string | null): "fresh" | "stale" | "old" | "none" {
  if (!updatedAt) return "none";
  const ageH = (Date.now() - new Date(updatedAt).getTime()) / 3_600_000;
  if (ageH < 6) return "fresh";
  if (ageH < 24) return "stale";
  return "old";
}

function isLocalDashboardRequest(req: http.IncomingMessage): boolean {
  // Check TCP socket origin — handles proxied access (Cloudflare tunnel, Nginx, etc.)
  // where the Host header is a public domain but the connection comes from localhost.
  const addr = req.socket.remoteAddress ?? "";
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

async function openGhosttySession(directCommand: string, cwd: string, executeCommand: boolean = true): Promise<void> {
  if (!directCommand.trim()) throw new Error("directCommand is empty.");
  if (!cwd.trim()) throw new Error("cwd is empty.");

  const fullCommand = `cd ${JSON.stringify(cwd)} && ${directCommand}`;

  // Copy the command to clipboard as a fallback
  await execAsync(`printf %s ${JSON.stringify(fullCommand)} | pbcopy`);

  // Check if Ghostty is already running
  const { stdout: pgrep } = await execFileAsync("pgrep", ["-f", "Ghostty"]);
  const isRunning = pgrep.trim().length > 0;

  if (isRunning) {
    // Ghostty is already running — open a new window and paste the command
    // If executeCommand is true, also press Enter to run it
    // If false, user can review before pressing Enter
    const appleScript = `
tell application "Ghostty"
  activate
  delay 0.1
  tell application "System Events"
    keystroke "n" using command down
    delay 0.3
    keystroke "v" using command down
    delay 0.1
    ${executeCommand ? 'keystroke return' : '-- User can review before pressing Enter'}
  end tell
end tell
`;
    try {
      await execFileAsync("osascript", ["-e", appleScript]);
    } catch (err) {
      // If AppleScript fails, user has command in clipboard
      console.error("AppleScript failed but command is in clipboard:", String(err));
    }
  } else {
    // Ghostty is not running — start it
    await execAsync(`open -a Ghostty`);
    // Wait for Ghostty to start
    await new Promise((resolve) => setTimeout(resolve, 500));
    // Now paste the command (but don't execute if executeCommand is false)
    const appleScript = `
tell application "Ghostty"
  activate
  delay 0.2
  tell application "System Events"
    keystroke "v" using command down
    delay 0.1
    ${executeCommand ? 'keystroke return' : '-- User can review before pressing Enter'}
  end tell
end tell
`;
    try {
      await execFileAsync("osascript", ["-e", appleScript]);
    } catch (err) {
      // If AppleScript fails, user has command in clipboard
      console.error("AppleScript failed but command is in clipboard:", String(err));
    }
  }
}

// ─── New Relic helpers ────────────────────────────────────────────────────────

interface NRHost {
  name: string;
  alertSeverity: "NOT_ALERTING" | "NOT_CONFIGURED" | "CRITICAL" | "WARNING" | null;
  reporting: boolean;
  online?: boolean;
  alertConfigured?: boolean;
  lastSeenAt?: string | null;
}

interface NRSynthetic {
  name: string;
  alertSeverity: string | null;
  reporting: boolean;
  monitorId?: string | null;
  online?: boolean | null;
  alertConfigured?: boolean;
  lastCheckAt?: string | null;
  lastResult?: string | null;
  lastError?: string | null;
}

interface NRHealth {
  hosts: NRHost[];
  synthetics: NRSynthetic[];
  error?: string;
}

interface NRSyntheticCondition {
  monitor_id?: string;
  enabled?: boolean;
}

interface NRInfraCondition {
  type?: string;
  enabled?: boolean;
  where_clause?: string;
}

interface NRHostSample {
  facet?: string;
  hostname?: string;
  "latest.timestamp"?: number;
}

interface NRSyntheticCheck {
  facet?: string;
  monitorName?: string;
  "latest.result"?: string;
  "latest.error"?: string;
  "latest.timestamp"?: number;
}

const NR_ENTITY_LABEL_OVERRIDES: Array<{ match: RegExp; replace: string }> = [
  // Keep the legacy Open Fund monitor explicit so the dashboard does not
  // misrepresent its health as the live finance.yeshua.academy service.
  { match: /\bopen\s*fund\b/gi, replace: "Open Fund (legacy)" },
  { match: /\bopenfund\b/gi, replace: "Open Fund (legacy)" },
];

function normalizeNREntityLabel(value?: string | null): string {
  if (!value) return "";
  return NR_ENTITY_LABEL_OVERRIDES.reduce(
    (current, rule) => current.replace(rule.match, rule.replace),
    value,
  );
}

function epochToIso(epochMs?: number): string | null {
  if (!epochMs) return null;
  return new Date(epochMs).toISOString();
}

function normalizeSyntheticError(err?: string | null): string | null {
  if (!err) return null;
  if (err.includes("DNS resolution failed")) return "DNS failure";
  const httpMatch = err.match(/HTTP\s+(\d{3})/i) ?? err.match(/HTTPError:.*?(\d{3})/i);
  if (httpMatch?.[1]) return `HTTP ${httpMatch[1]}`;
  return err;
}

async function getNRHealth(): Promise<NRHealth> {
  const apiKey = process.env.NEW_RELIC_USER_API_KEY;
  const accountId = process.env.NEW_RELIC_ACCOUNT_ID;
  if (!apiKey || !accountId) return { hosts: [], synthetics: [], error: "NR credentials not set" };

  const query = `{
    actor {
      hosts: entitySearch(query: "accountId = ${accountId} AND type = 'HOST' AND domain = 'INFRA'") {
        results { entities { name reporting alertSeverity } }
      }
      synthetics: entitySearch(query: "accountId = ${accountId} AND domain = 'SYNTH' AND type = 'MONITOR'") {
        results { entities { name reporting alertSeverity ... on SyntheticMonitorEntityOutline { monitorId } } }
      }
      account(id: ${accountId}) {
        hostSamples: nrql(query: "SELECT latest(timestamp) FROM SystemSample FACET hostname SINCE 15 minutes ago LIMIT 100") {
          results
        }
        syntheticChecks: nrql(query: "SELECT latest(result), latest(error), latest(timestamp) FROM SyntheticCheck FACET monitorName SINCE 1 day ago LIMIT 100") {
          results
        }
      }
    }
  }`;

  try {
    const { stdout } = await execAsync(
      `curl -s -X POST https://api.eu.newrelic.com/graphql \
        -H "Content-Type: application/json" \
        -H "API-Key: ${apiKey}" \
        -d ${JSON.stringify(JSON.stringify({ query }))}`,
      { timeout: 10_000 }
    );
    const data = JSON.parse(stdout) as {
      data?: {
        actor?: {
          hosts?: { results?: { entities?: NRHost[] } };
          synthetics?: { results?: { entities?: NRSynthetic[] } };
          account?: {
            hostSamples?: { results?: NRHostSample[] };
            syntheticChecks?: { results?: NRSyntheticCheck[] };
          };
        }
      }
    };
    const [syntheticsConditionsRaw, infraConditionsRaw, nrqlConditionsRaw] = await Promise.all([
      execAsync(
        `curl -s -X GET 'https://api.eu.newrelic.com/v2/alerts_synthetics_conditions.json' \
          -G --data-urlencode 'policy_id=1685919' \
          -H 'X-Api-Key: ${apiKey}'`,
        { timeout: 10_000 }
      ).then(({ stdout }) => stdout).catch(() => ""),
      execAsync(
        `curl -s -X GET 'https://infra-api.eu.newrelic.com/v2/alerts/conditions' \
          -G --data-urlencode 'policy_id=1685920' \
          -H 'Api-Key: ${apiKey}'`,
        { timeout: 10_000 }
      ).then(({ stdout }) => stdout).catch(() => ""),
      execAsync(
        `curl -s -X POST 'https://api.eu.newrelic.com/graphql' \
          -H 'API-Key: ${apiKey}' \
          -H 'Content-Type: application/json' \
          -d '{"query":"query{actor{account(id:7019441){alerts{nrqlConditionsSearch(searchCriteria:{policyId:\\"1685919\\"}){nrqlConditions{id name enabled nrql{query}}}}}}}"}'`,
        { timeout: 10_000 }
      ).then(({ stdout }) => stdout).catch(() => "{}"),
    ]);

    const hostSamples = data.data?.actor?.account?.hostSamples?.results ?? [];
    const syntheticChecks = data.data?.actor?.account?.syntheticChecks?.results ?? [];
    const syntheticsConditions = (() => {
      try {
        return (JSON.parse(syntheticsConditionsRaw) as { synthetics_conditions?: NRSyntheticCondition[] }).synthetics_conditions ?? [];
      } catch {
        return [];
      }
    })();
    const infraConditions = (() => {
      try {
        return (JSON.parse(infraConditionsRaw) as { data?: NRInfraCondition[] }).data ?? [];
      } catch {
        return [];
      }
    })();
    const hostLastSeen = new Map(
      hostSamples
        .filter((sample) => sample.facet && sample["latest.timestamp"])
        .map((sample) => [sample.facet as string, sample["latest.timestamp"] as number])
    );
    const syntheticStatus = new Map(
      syntheticChecks
        .filter((check) => check.facet)
        .map((check) => [check.facet as string, check])
    );
    // Extract monitor IDs from NRQL conditions that query SyntheticCheck
    const nrqlMonitorIds: string[] = (() => {
      try {
        const parsed = JSON.parse(nrqlConditionsRaw);
        const conditions = parsed?.data?.actor?.account?.alerts?.nrqlConditionsSearch?.nrqlConditions ?? [];
        return conditions
          .filter((condition: any) => condition.enabled && condition.nrql?.query?.includes("monitorId"))
          .flatMap((condition: any) => {
            const matches = (condition.nrql.query as string).match(/'([a-f0-9\-]+)'/g);
            return matches ? matches.map((m: string) => m.replace(/'/g, "")) : [];
          });
      } catch {
        return [];
      }
    })();

    const configuredSyntheticMonitorIds = new Set([
      ...syntheticsConditions
        .filter((condition) => condition.enabled && condition.monitor_id)
        .map((condition) => condition.monitor_id as string),
      ...nrqlMonitorIds,
    ]);
    const configuredHostNames = new Set(
      infraConditions
        .filter((condition) => condition.enabled && condition.type === "infra_host_not_reporting" && condition.where_clause)
        .flatMap((condition) => Array.from((condition.where_clause ?? "").matchAll(/'([^']+)'/g)).map((match) => match[1]))
    );
    return {
      hosts: (data.data?.actor?.hosts?.results?.entities ?? []).map((host) => {
        const lastSeen = hostLastSeen.get(host.name);
        const online = Boolean(lastSeen);
        return {
          ...host,
          name: normalizeNREntityLabel(host.name),
          online,
          alertConfigured: configuredHostNames.has(host.name) || configuredHostNames.has(normalizeNREntityLabel(host.name)),
          lastSeenAt: epochToIso(lastSeen),
        };
      }),
      synthetics: (data.data?.actor?.synthetics?.results?.entities ?? []).map((synthetic) => {
        const latest = syntheticStatus.get(synthetic.name);
        const lastResult = latest?.["latest.result"] ?? null;
        const online = lastResult === "SUCCESS" ? true : lastResult === "FAILED" ? false : null;
        return {
          ...synthetic,
          name: normalizeNREntityLabel(synthetic.name),
          // Synthetic alert severity can lag after a recovered check. Prefer the
          // latest check result so the dashboard reflects current health.
          alertSeverity: online === true ? null : synthetic.alertSeverity,
          online,
          alertConfigured: Boolean(synthetic.monitorId && configuredSyntheticMonitorIds.has(synthetic.monitorId)),
          lastCheckAt: epochToIso(latest?.["latest.timestamp"]),
          lastResult,
          lastError: normalizeNREntityLabel(normalizeSyntheticError(latest?.["latest.error"])),
        };
      }),
    };
  } catch (err) {
    return { hosts: [], synthetics: [], error: String(err) };
  }
}

// ─── Cloudflare domains helpers ──────────────────────────────────────────────

interface CloudflareDomain {
  name: string;
  status: string;
  createdAt: string;
  expiresAt: string | null;
  daysUntilExpiry: number | null;
}

interface CloudflareDomainsData {
  domains: CloudflareDomain[];
  error?: string;
  cachedAt?: string;
}

let _cfCache: { data: CloudflareDomainsData; ts: number } | null = null;

async function getCloudflareDomains(): Promise<CloudflareDomainsData> {
  if (_cfCache && Date.now() - _cfCache.ts < 60 * 60_000) return _cfCache.data;

  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) return { domains: [], error: "CLOUDFLARE_API_TOKEN not configured" };

  try {
    const { stdout: zonesRaw } = await execAsync(
      `curl -sL 'https://api.cloudflare.com/client/v4/zones?per_page=100' \
        -H 'Authorization: Bearer ${token}'`,
      { timeout: 15_000 }
    );
    const zonesResp = JSON.parse(zonesRaw) as {
      result?: Array<{ name: string; status: string; created_on: string }>;
    };
    const zones = zonesResp.result ?? [];

    const domains: CloudflareDomain[] = await Promise.all(
      zones.map(async (zone): Promise<CloudflareDomain> => {
        let expiresAt: string | null = null;
        try {
          const { stdout: rdapRaw } = await execAsync(
            `curl -sL --max-time 5 'https://rdap.org/domain/${zone.name}'`,
            { timeout: 7_000 }
          );
          if (rdapRaw.trim()) {
            const rdap = JSON.parse(rdapRaw) as { events?: Array<{ eventAction: string; eventDate: string }> };
            expiresAt = rdap.events?.find((e) => e.eventAction === "expiration")?.eventDate ?? null;
          }
        } catch { /* best-effort */ }

        const daysUntilExpiry = expiresAt
          ? Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000)
          : null;

        return { name: zone.name, status: zone.status, createdAt: zone.created_on, expiresAt, daysUntilExpiry };
      })
    );

    // Soonest expiry first; unknowns at end; alphabetical within group
    domains.sort((a, b) => {
      if (a.daysUntilExpiry !== null && b.daysUntilExpiry !== null) return a.daysUntilExpiry - b.daysUntilExpiry;
      if (a.daysUntilExpiry !== null) return -1;
      if (b.daysUntilExpiry !== null) return 1;
      return a.name.localeCompare(b.name);
    });

    const result: CloudflareDomainsData = { domains, cachedAt: new Date().toISOString() };
    _cfCache = { data: result, ts: Date.now() };
    return result;
  } catch (err) {
    return { domains: [], error: String(err) };
  }
}

// ─── Umami helpers ────────────────────────────────────────────────────────────

interface UmamiWebsiteStats {
  pageviews: number;
  visitors: number;
  visits: number;
  bounceRate: number;
  avgDurationSeconds: number;
}

interface UmamiWebsite {
  id: string;
  name: string;
  domain: string;
  active: number;
  stats: UmamiWebsiteStats | null;
  error?: string;
}

interface UmamiData {
  websites: UmamiWebsite[];
  error?: string;
}

let _umamiToken: { value: string; expiresAt: number } | null = null;

async function getUmamiData(): Promise<UmamiData> {
  const baseUrl = (process.env.UMAMI_URL ?? "").replace(/\/$/, "");
  if (!baseUrl) return { websites: [], error: "UMAMI_URL not configured" };

  const apiKey   = process.env.UMAMI_API_KEY ?? "";
  const username = process.env.UMAMI_USERNAME ?? "";
  const password = process.env.UMAMI_PASSWORD ?? "";

  if (!apiKey && (!username || !password)) {
    return { websites: [], error: "No credentials — set UMAMI_API_KEY or UMAMI_USERNAME + UMAMI_PASSWORD" };
  }

  let bearerToken = "";
  if (!apiKey) {
    if (_umamiToken && Date.now() < _umamiToken.expiresAt) {
      bearerToken = _umamiToken.value;
    } else {
      try {
        const { stdout } = await execAsync(
          `curl -s -X POST '${baseUrl}/api/auth/login' \
            -H 'Content-Type: application/json' \
            -d ${JSON.stringify(JSON.stringify({ username, password }))}`,
          { timeout: 10_000 }
        );
        const resp = JSON.parse(stdout) as { token?: string };
        if (!resp.token) throw new Error("Login failed — check credentials");
        _umamiToken = { value: resp.token, expiresAt: Date.now() + 55 * 60_000 };
        bearerToken = resp.token;
      } catch (err) {
        return { websites: [], error: `Auth failed: ${String(err)}` };
      }
    }
  }

  const authFlag = apiKey
    ? `-H 'x-umami-api-key: ${apiKey}'`
    : `-H 'Authorization: Bearer ${bearerToken}'`;

  const startAt = new Date().setHours(0, 0, 0, 0); // start of today, local time
  const endAt   = Date.now();

  try {
    const { stdout: listRaw } = await execAsync(
      `curl -s '${baseUrl}/api/websites?pageSize=100' ${authFlag}`,
      { timeout: 10_000 }
    );
    const listResp = JSON.parse(listRaw) as
      | Array<{ id: string; name: string; domain: string }>
      | { data?: Array<{ id: string; name: string; domain: string }> };
    const list = Array.isArray(listResp) ? listResp : (listResp.data ?? []);

    const websites: UmamiWebsite[] = await Promise.all(
      list.slice(0, 25).map(async (site): Promise<UmamiWebsite> => {
        try {
          const [statsRaw, activeRaw] = await Promise.all([
            execAsync(
              `curl -s '${baseUrl}/api/websites/${site.id}/stats?startAt=${startAt}&endAt=${endAt}' ${authFlag}`,
              { timeout: 10_000 }
            ).then(({ stdout }) => stdout),
            execAsync(
              `curl -s '${baseUrl}/api/websites/${site.id}/active' ${authFlag}`,
              { timeout: 10_000 }
            ).then(({ stdout }) => stdout),
          ]);

          // v3 returns flat numbers; v1/v2 return { value: N } — handle both
          const s = JSON.parse(statsRaw) as Record<string, number | { value?: number } | unknown>;
          const sv = (k: string): number => {
            const v = s[k];
            if (typeof v === "number") return v;
            if (v && typeof v === "object" && "value" in v) return (v as { value?: number }).value ?? 0;
            return 0;
          };
          // v3 returns { visitors: N }; v1 returns { x: N }; array form also seen in v1
          const activeResp = JSON.parse(activeRaw) as
            | { x?: number; visitors?: number }
            | number
            | Array<{ x?: number }>;
          const active = typeof activeResp === "number"
            ? activeResp
            : Array.isArray(activeResp)
              ? (activeResp[0]?.x ?? 0)
              : (activeResp?.visitors ?? activeResp?.x ?? 0);

          const visits = sv("visits");
          const bounceRate = visits > 0 ? Math.round((sv("bounces") / visits) * 100) : 0;
          const avgDurationSeconds = visits > 0 ? Math.round(sv("totaltime") / visits) : 0;

          return {
            id: site.id,
            name: site.name,
            domain: site.domain,
            active,
            stats: {
              pageviews: sv("pageviews"),
              visitors: sv("visitors"),
              visits,
              bounceRate,
              avgDurationSeconds,
            },
          };
        } catch {
          return { id: site.id, name: site.name, domain: site.domain, active: 0, stats: null, error: "fetch failed" };
        }
      })
    );

    websites.sort((a, b) => (b.stats?.visitors ?? 0) - (a.stats?.visitors ?? 0));
    return { websites };
  } catch (err) {
    return { websites: [], error: String(err) };
  }
}

// ─── Night scheduler helpers ──────────────────────────────────────────────────

const SCHEDULER_JOB_ORDER: Array<{ key: string; label: string }> = [
  { key: "stb-pipeline-batch",      label: "STB Pipeline" },
  { key: "n8n-backup",              label: "n8n Backup" },
  { key: "claude-session-cleanup",  label: "Claude Cleanup" },
  { key: "ing-bank-statement-download", label: "ING Bank Statement" },
  { key: "dance-of-life-sync",      label: "Dance of Life (1) Download" },
  { key: "bible-studies-pipeline",  label: "Dance of Life (2) Transcribe" },
  { key: "gemini-cleanup",          label: "Gemini Cleanup" },
  { key: "skill-prune",             label: "Skill Prune" },
];

interface SchedulerJob {
  key: string;
  label: string;
  status: "success" | "failed" | "timeout" | "never" | "running";
  exitCode: number | null;
  durationSeconds: number | null;
  lastRunAt: string | null;   // ISO string
  nextRunAt: string;          // ISO string — next 03:00 Lisbon
  errorMessage: string | null;
}

function nextSchedulerRun(): string {
  // Next 03:00 Europe/Lisbon — compute by formatting current time in that tz
  const now = new Date();
  const lisbonStr = now.toLocaleString("en-CA", { timeZone: "Europe/Lisbon", hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  // lisbonStr: "YYYY-MM-DD, HH:MM"
  const parts = lisbonStr.split(", ");
  const datePart = parts[0] ?? "";
  const timePart = parts[1] ?? "00:00";
  const lisbonHour = parseInt(timePart.split(":")[0] ?? "0", 10);
  const dateParts = datePart.split("-").map(Number);
  const yyyy = dateParts[0] ?? 2026;
  const mm   = dateParts[1] ?? 1;
  const dd   = dateParts[2] ?? 1;
  // If already past 03:00, next run is tomorrow
  const candidate = new Date(Date.UTC(yyyy, mm - 1, lisbonHour >= 3 ? dd + 1 : dd, 3, 0, 0));
  return candidate.toISOString();
}

/** Returns the key of the job currently running, or null if nothing is active. */
function getRunningJob(): string | null {
  // 1. bible-studies-pipeline manages its own lock (can run outside the nightly chain)
  const bibleLock = path.join(os.homedir(), ".local", "state", "bible-studies", "pipeline.lock");
  try {
    const pid = parseInt(fs.readFileSync(bibleLock, "utf8").trim(), 10);
    if (!isNaN(pid)) {
      try { process.kill(pid, 0); return "bible-studies-pipeline"; } catch {}
    }
  } catch {}

  // 2. Nightly scheduler chain lock — find which job via nightly.log
  const lockPidFile = path.join(os.homedir(), ".local", "state", "office-scheduler", "nightly.lock", "pid");
  try {
    const pid = parseInt(fs.readFileSync(lockPidFile, "utf8").trim(), 10);
    if (isNaN(pid)) return null;
    try { process.kill(pid, 0); } catch { return null; } // stale lock
    // Scheduler is live — find the last unfinished job in today's nightly.log
    const logFile = path.join(os.homedir(), "Library", "Logs", "office-scheduler", "nightly.log");
    const lines = fs.readFileSync(logFile, "utf8").trim().split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const m = lines[i]?.match(/starting job=(\S+)/);
      if (m) {
        const jobKey = m[1];
        const finished = lines.slice(i + 1).some(l => l.includes(`finished job=${jobKey}`));
        if (!finished) return jobKey ?? null;
        break;
      }
    }
  } catch {}

  return null;
}

function getNightScheduler(): SchedulerJob[] {
  const stateDir = path.join(os.homedir(), ".local", "state", "office-scheduler");
  const nextRun = nextSchedulerRun();
  const runningKey = getRunningJob();

  return SCHEDULER_JOB_ORDER.map(({ key, label }) => {
    const stateFile = path.join(stateDir, `${key}.last`);
    try {
      const raw = fs.readFileSync(stateFile, "utf8");
      const kv: Record<string, string> = {};
      for (const line of raw.trim().split("\n")) {
        const eq = line.indexOf("=");
        if (eq !== -1) kv[line.slice(0, eq)] = line.slice(eq + 1);
      }
      const status = (kv["status"] ?? "failed") as SchedulerJob["status"];
      const exitCode = kv["exit_code"] !== undefined ? parseInt(kv["exit_code"], 10) : null;
      const durationSeconds = kv["duration_seconds"] !== undefined ? parseInt(kv["duration_seconds"], 10) : null;
      // Parse "YYYY-MM-DD HH:MM:SS WEST/WET" — treat as Europe/Lisbon
      let lastRunAt: string | null = null;
      if (kv["updated_at_lisbon"]) {
        const cleaned = kv["updated_at_lisbon"].replace(/ (WEST|WET|CEST|CET)$/, "");
        const d = new Date(cleaned + " GMT+0000");
        // approximate: Lisbon is UTC or UTC+1 — parse as UTC then note it's close enough
        if (!isNaN(d.getTime())) lastRunAt = d.toISOString();
      }
      const errorMessage = kv["error_message"]?.trim() || null;
      const effectiveStatus = (runningKey === key ? "running" : status) as SchedulerJob["status"];
      return { key, label, status: effectiveStatus, exitCode, durationSeconds, lastRunAt, nextRunAt: nextRun, errorMessage };
    } catch {
      const effectiveStatus = (runningKey === key ? "running" : "never") as SchedulerJob["status"];
      return { key, label, status: effectiveStatus, exitCode: null, durationSeconds: null, lastRunAt: null, nextRunAt: nextRun, errorMessage: null };
    }
  });
}

// ─── Google Ads helpers ──────────────────────────────────────────────────────

interface GoogleAdsMetrics {
  error?: string;
  status: "ready" | "no_data" | "error";
  lastSync?: string | null;
  doctorStatus?: string | null;
  pendingMutations?: number;
  metrics: {
    dailyBudgetUSD: number;
    targetBudgetUSD: number;
    percentOfTarget: number;
    dayOfMonth: number;
    daysInMonth: number;
    lastMetricsDate?: string | null;
  };
  policyWatchStatus?: {
    sourcesChecked: number;
    sourcesChanged: number;
    lastCheck: string;
  } | null;
}

function getGoogleAdsMetrics(): GoogleAdsMetrics {
  const googleAdsDbPath = path.join(os.homedir(), "Repos", "stevewesthoek", "brain", "operations", "google-ads", "data", "google_ads.sqlite3");

  if (!fs.existsSync(googleAdsDbPath)) {
    return {
      status: "no_data",
      error: "Google Ads database not found",
      metrics: { dailyBudgetUSD: 0, targetBudgetUSD: 10000, percentOfTarget: 0, dayOfMonth: 0, daysInMonth: 30 },
    };
  }

  try {
    const db = new Database(googleAdsDbPath, { readonly: true });

    // Get latest metrics snapshot from daily_metrics_detail (account-level rollup)
    const latestMetricsRow = db.prepare(
      "SELECT metrics_date as snapshot_date, SUM(spend_usd) as spend_usd FROM daily_metrics_detail " +
      "WHERE campaign_id IS NULL AND metrics_date LIKE strftime('%Y-%m', 'now') || '%' " +
      "GROUP BY metrics_date ORDER BY metrics_date DESC LIMIT 1"
    ).get() as { snapshot_date: string; spend_usd: number } | undefined;

    // Get policy watch status
    const policyWatchRow = db.prepare(
      "SELECT COUNT(*) as checked, SUM(CASE WHEN changed = 1 THEN 1 ELSE 0 END) as changed, MAX(fetched_at) as lastCheck FROM policy_snapshots"
    ).get() as { checked: number; changed: number; lastCheck: string } | undefined;

    // Get latest doctor status
    const doctorRunRow = db.prepare(
      "SELECT command, status, created_at FROM runs WHERE command = 'doctor' ORDER BY id DESC LIMIT 1"
    ).get() as { command: string; status: string; created_at: string } | undefined;

    // Get pending mutations count
    let pendingMutationsCount = 0;
    try {
      const pendingMutationsRow = db.prepare(
        "SELECT COUNT(*) as count FROM pending_mutations WHERE status = 'pending'"
      ).get() as { count: number } | undefined;
      pendingMutationsCount = pendingMutationsRow?.count ?? 0;
    } catch {
      // Table may not exist in older databases
      pendingMutationsCount = 0;
    }

    db.close();

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();
    const targetMonthlyUSD = 10000;
    const targetDailyUSD = targetMonthlyUSD / daysInMonth;
    const dailySpendUSD = latestMetricsRow?.spend_usd ?? 0;
    const percentOfTarget = dailySpendUSD > 0 ? Math.round((dailySpendUSD / targetDailyUSD) * 100) : 0;

    return {
      status: "ready",
      lastSync: latestMetricsRow?.snapshot_date ?? null,
      doctorStatus: doctorRunRow?.status ?? null,
      pendingMutations: pendingMutationsCount,
      metrics: {
        dailyBudgetUSD: dailySpendUSD,
        targetBudgetUSD: targetDailyUSD,
        percentOfTarget,
        dayOfMonth,
        daysInMonth,
        lastMetricsDate: latestMetricsRow?.snapshot_date ?? null,
      },
      policyWatchStatus: policyWatchRow
        ? {
            sourcesChecked: policyWatchRow.checked,
            sourcesChanged: policyWatchRow.changed,
            lastCheck: policyWatchRow.lastCheck,
          }
        : null,
    };
  } catch (err) {
    return {
      status: "error",
      error: `Query error: ${err instanceof Error ? err.message : String(err)}`,
      metrics: { dailyBudgetUSD: 0, targetBudgetUSD: 10000, percentOfTarget: 0, dayOfMonth: 0, daysInMonth: 30 },
    };
  }
}

// ─── Mutations helpers ───────────────────────────────────────────────────────

interface MutationRecord {
  id: number;
  mutation_type: string;
  campaign_id: string | null;
  resource_type: string;
  resource_id: string | null;
  status: string;
  created_at: string;
  payload: any;
}

interface MutationsData {
  error?: string;
  status: "ready" | "no_data" | "error";
  mutations: MutationRecord[];
  statsByStatus: Record<string, number>;
}

function getMutationsData(): MutationsData {
  const googleAdsDbPath = path.join(os.homedir(), "Repos", "stevewesthoek", "brain", "operations", "google-ads", "data", "google_ads.sqlite3");

  if (!fs.existsSync(googleAdsDbPath)) {
    return {
      status: "no_data",
      error: "Google Ads database not found",
      mutations: [],
      statsByStatus: {},
    };
  }

  try {
    const db = new Database(googleAdsDbPath);

    // Fetch mutations ordered by id desc, limit to recent 50
    const mutations = db
      .prepare("SELECT id, mutation_type, campaign_id, resource_type, resource_id, status, created_at, payload FROM pending_mutations ORDER BY id DESC LIMIT 50")
      .all() as MutationRecord[];

    // Count by status
    const statsByStatus = db
      .prepare("SELECT status, COUNT(*) as cnt FROM pending_mutations GROUP BY status")
      .all()
      .reduce((acc: Record<string, number>, row: any) => {
        acc[row.status] = row.cnt;
        return acc;
      }, {});

    db.close();

    return {
      status: "ready",
      mutations,
      statsByStatus,
    };
  } catch (err) {
    return {
      status: "error",
      error: `Query error: ${err instanceof Error ? err.message : String(err)}`,
      mutations: [],
      statsByStatus: {},
    };
  }
}

// ─── Stripe helpers ──────────────────────────────────────────────────────────

interface StripeCliProfile {
  profileName: string;
  displayName: string;
  accountId?: string;
  liveModeApiKey?: string;
  testModeApiKey?: string;
}

interface StripeModeSummary {
  mode: "live" | "test" | "sandbox";
  accountId: string | null;
  currency: string | null;
  availableAmount: number;
  pendingAmount: number;
  recentGrossAmount: number;
  recentNetAmount: number;
  recentChargeCount: number;
  recentRefundAmount: number;
  productsCount: number;
  pricesCount: number;
  subscriptionsCount: number;
  customersCount: number;
  topProducts: string[];
  statusBreakdown: Record<string, number>;
  sampledChargeWindowDays: number;
  sampledObjects: {
    charges: number;
    customers: number;
    subscriptions: number;
    products: number;
    prices: number;
  };
  raw: {
    account: Record<string, unknown>;
    balance: Record<string, unknown>;
  };
}

interface StripeAccountCard {
  key: string;
  displayName: string;
  liveProfile: string;
  separateSandboxProfile: string | null;
  ownership: "workspace" | "delegated";
  live: StripeModeSummary | null;
  test: StripeModeSummary | null;
  sandbox: StripeModeSummary | null;
  notes: string[];
  error?: string;
}

interface StripeDashboardData {
  status: "ready" | "no_data" | "error";
  accounts: StripeAccountCard[];
  error?: string;
  cachedAt?: string;
}

interface StripeListResponse<T> {
  object: string;
  data: T[];
  has_more?: boolean;
}

interface StripeCharge {
  amount?: number;
  amount_captured?: number;
  amount_refunded?: number;
  created?: number;
  currency?: string;
  paid?: boolean;
  refunded?: boolean;
  status?: string;
}

interface StripeSubscription {
  status?: string;
}

interface StripeProduct {
  id?: string;
  name?: string;
  active?: boolean;
}

interface StripePrice {
  active?: boolean;
  currency?: string;
  product?: string | { id?: string; name?: string };
  recurring?: Record<string, unknown> | null;
}

interface StripeCustomer {
  id?: string;
}

const STRIPE_CONFIG_PATH = path.join(os.homedir(), ".config", "stripe", "config.toml");
const STRIPE_SAMPLE_LIMIT = 100;
const STRIPE_CACHE_MS = 5 * 60_000;
let _stripeCache: { data: StripeDashboardData; ts: number } | null = null;

function parseStripeConfig(): StripeCliProfile[] {
  if (!fs.existsSync(STRIPE_CONFIG_PATH)) return [];
  const content = fs.readFileSync(STRIPE_CONFIG_PATH, "utf8");
  const profiles: StripeCliProfile[] = [];
  let current: StripeCliProfile | null = null;

  const pushCurrent = () => {
    if (!current || !current.displayName) return;
    profiles.push(current);
  };

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      pushCurrent();
      const section = sectionMatch[1]?.replace(/^['"]|['"]$/g, "") ?? "";
      current = { profileName: section, displayName: "" };
      continue;
    }

    if (!current) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key === "profile_name") current.profileName = value;
    if (key === "display_name") current.displayName = value;
    if (key === "account_id") current.accountId = value;
    if (key === "live_mode_api_key") current.liveModeApiKey = value;
    if (key === "test_mode_api_key") current.testModeApiKey = value;
  }

  pushCurrent();
  return profiles.filter((profile) => profile.profileName !== "color" && profile.profileName !== "project-name");
}

function getStripeOwnership(displayName: string): "workspace" | "delegated" {
  const ownAccounts = new Set([
    "ProChat Studio",
    "ProChat (legacy)",
    "Says the Bible",
  ]);
  return ownAccounts.has(displayName) ? "workspace" : "delegated";
}

function formatCurrencyAmount(amountMinor: number): number {
  return Math.round((amountMinor / 100) * 100) / 100;
}

async function stripeJson(
  pathOrQuery: string,
  options: { profileName?: string; apiKey?: string; live?: boolean }
): Promise<Record<string, unknown>> {
  const args = ["get", pathOrQuery];
  if (options.profileName) args.push("-p", options.profileName);
  if (options.apiKey) args.push("--api-key", options.apiKey);
  if (options.live) args.push("--live");
  const { stdout } = await execFileAsync("stripe", args, {
    env: process.env,
    timeout: 20_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  return JSON.parse(stdout) as Record<string, unknown>;
}

async function getStripeModeSummary(params: {
  mode: "live" | "test" | "sandbox";
  profileName?: string;
  apiKey?: string;
}): Promise<StripeModeSummary> {
  const [account, balance, charges, products, prices, subscriptions, customers] = await Promise.all([
    stripeJson("/v1/account", { ...params, live: params.mode === "live" }),
    stripeJson("/v1/balance", { ...params, live: params.mode === "live" }),
    stripeJson(`/v1/charges?limit=${STRIPE_SAMPLE_LIMIT}`, { ...params, live: params.mode === "live" }),
    stripeJson(`/v1/products?limit=${STRIPE_SAMPLE_LIMIT}&active=true`, { ...params, live: params.mode === "live" }),
    stripeJson(`/v1/prices?limit=${STRIPE_SAMPLE_LIMIT}&active=true`, { ...params, live: params.mode === "live" }),
    stripeJson(`/v1/subscriptions?limit=${STRIPE_SAMPLE_LIMIT}&status=all`, { ...params, live: params.mode === "live" }),
    stripeJson(`/v1/customers?limit=${STRIPE_SAMPLE_LIMIT}`, { ...params, live: params.mode === "live" }),
  ]);

  const chargesList = ((charges as unknown) as StripeListResponse<StripeCharge>).data ?? [];
  const productsList = ((products as unknown) as StripeListResponse<StripeProduct>).data ?? [];
  const pricesList = ((prices as unknown) as StripeListResponse<StripePrice>).data ?? [];
  const subscriptionsList = ((subscriptions as unknown) as StripeListResponse<StripeSubscription>).data ?? [];
  const customersList = ((customers as unknown) as StripeListResponse<StripeCustomer>).data ?? [];
  const now = Date.now();
  const sampleWindowMs = 30 * 24 * 60 * 60 * 1000;

  const recentCharges = chargesList.filter((charge) => {
    const createdMs = (charge.created ?? 0) * 1000;
    return createdMs >= now - sampleWindowMs && charge.paid && charge.status === "succeeded";
  });

  const topProducts = new Map<string, number>();
  const productNames = new Map(
    productsList
      .filter((product) => product.id)
      .map((product) => [product.id as string, product.name ?? product.id ?? "Unnamed product"])
  );

  for (const price of pricesList) {
    const productField = price.product;
    const productId =
      typeof productField === "string"
        ? productField
        : typeof productField === "object" && productField !== null
          ? (productField.id ?? productField.name ?? "")
          : "";
    if (!productId) continue;
    topProducts.set(productId, (topProducts.get(productId) ?? 0) + 1);
  }

  const subscriptionStatuses = subscriptionsList.reduce((acc: Record<string, number>, subscription) => {
    const status = subscription.status ?? "unknown";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});

  const available =
    ((balance.available as Array<{ amount?: number; currency?: string }> | undefined) ?? []).reduce(
      (sum, entry) => sum + (entry.amount ?? 0),
      0
    );
  const pending =
    ((balance.pending as Array<{ amount?: number; currency?: string }> | undefined) ?? []).reduce(
      (sum, entry) => sum + (entry.amount ?? 0),
      0
    );

  return {
    mode: params.mode,
    accountId: (account.id as string | undefined) ?? null,
    currency: (account.default_currency as string | undefined) ?? null,
    availableAmount: formatCurrencyAmount(available),
    pendingAmount: formatCurrencyAmount(pending),
    recentGrossAmount: formatCurrencyAmount(
      recentCharges.reduce((sum, charge) => sum + (charge.amount_captured ?? charge.amount ?? 0), 0)
    ),
    recentNetAmount: formatCurrencyAmount(
      recentCharges.reduce(
        (sum, charge) => sum + ((charge.amount_captured ?? charge.amount ?? 0) - (charge.amount_refunded ?? 0)),
        0
      )
    ),
    recentChargeCount: recentCharges.length,
    recentRefundAmount: formatCurrencyAmount(
      recentCharges.reduce((sum, charge) => sum + (charge.amount_refunded ?? 0), 0)
    ),
    productsCount: productsList.length,
    pricesCount: pricesList.length,
    subscriptionsCount: subscriptionsList.length,
    customersCount: customersList.length,
    topProducts: Array.from(topProducts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([productId]) => productNames.get(productId) ?? productId),
    statusBreakdown: subscriptionStatuses,
    sampledChargeWindowDays: 30,
    sampledObjects: {
      charges: chargesList.length,
      customers: customersList.length,
      subscriptions: subscriptionsList.length,
      products: productsList.length,
      prices: pricesList.length,
    },
    raw: {
      account,
      balance,
    },
  };
}

async function getStripeDashboardData(): Promise<StripeDashboardData> {
  if (_stripeCache && Date.now() - _stripeCache.ts < STRIPE_CACHE_MS) return _stripeCache.data;

  const profiles = parseStripeConfig();
  if (!profiles.length) {
    return { status: "no_data", accounts: [], error: "Stripe CLI profiles not found" };
  }

  const liveProfiles = profiles.filter((profile) => profile.liveModeApiKey && profile.displayName);
  if (!liveProfiles.length) {
    return { status: "no_data", accounts: [], error: "No Stripe live profiles configured" };
  }

  const deduped = new Map<string, StripeCliProfile>();
  for (const profile of liveProfiles) {
    const key = profile.accountId ?? profile.displayName;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, profile);
      continue;
    }
    if (profile.profileName === "default") {
      deduped.set(key, profile);
    }
  }

  const accounts = await Promise.all(
    Array.from(deduped.values())
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .map(async (profile): Promise<StripeAccountCard> => {
        const separateSandbox = profiles.find((candidate) => {
          return (
            !candidate.liveModeApiKey &&
            candidate.testModeApiKey &&
            candidate.displayName.toLowerCase() === `${profile.displayName.toLowerCase()} sandbox`
          );
        }) ?? null;

        try {
          const [live, test, sandbox] = await Promise.all([
            profile.profileName
              ? getStripeModeSummary({ mode: "live", profileName: profile.profileName })
              : Promise.resolve(null),
            profile.testModeApiKey
              ? getStripeModeSummary({ mode: "test", apiKey: profile.testModeApiKey })
              : Promise.resolve(null),
            separateSandbox?.testModeApiKey
              ? getStripeModeSummary({ mode: "sandbox", apiKey: separateSandbox.testModeApiKey })
              : Promise.resolve(null),
          ]);

          const notes = [
            `${profile.profileName} profile`,
            getStripeOwnership(profile.displayName) === "workspace" ? "workspace-owned" : "delegated-access",
          ];
          if (separateSandbox) notes.push(`dedicated sandbox profile: ${separateSandbox.profileName}`);

          return {
            key: profile.accountId ?? profile.displayName,
            displayName: profile.displayName,
            liveProfile: profile.profileName,
            separateSandboxProfile: separateSandbox?.profileName ?? null,
            ownership: getStripeOwnership(profile.displayName),
            live,
            test,
            sandbox,
            notes,
          };
        } catch (err) {
          return {
            key: profile.accountId ?? profile.displayName,
            displayName: profile.displayName,
            liveProfile: profile.profileName,
            separateSandboxProfile: separateSandbox?.profileName ?? null,
            ownership: getStripeOwnership(profile.displayName),
            live: null,
            test: null,
            sandbox: null,
            notes: [`${profile.profileName} profile`],
            error: String(err),
          };
        }
      })
  );

  const data: StripeDashboardData = {
    status: "ready",
    accounts,
    cachedAt: new Date().toISOString(),
  };
  _stripeCache = { data, ts: Date.now() };
  return data;
}

// ─── Local Apps Status ───────────────────────────────────────────────────────

const LOCAL_APPS = [
  { name: "ProBot", port: 7070, url: "http://localhost:7070", check: "http://localhost:7070", start: "cd ~/Repos/stevewesthoek/brain/projects/probot && npm start > /tmp/probot.log 2>&1 &" },
  { name: "Firecrawl", port: 3051, url: "http://localhost:3051", check: "http://localhost:3051/health", start: "cd ~/Repos/stevewesthoek/brain/tools/firecrawl && docker compose up -d" },
  { name: "Google Ads API", port: 8001, url: "http://localhost:8001", check: "http://localhost:8001/health", start: "supervisorctl start google-ads-http-server" },
  { name: "ComfyUI", port: 8188, url: "http://localhost:8188", check: "http://localhost:8188", start: "echo 'Manual start required'" },
  { name: "Family Finance", port: 3060, url: "http://localhost:3060", check: "http://localhost:3060", start: "cd ~/Repos/stevewesthoek/family-finance && npm run dev > /tmp/family-finance.log 2>&1 &" },
  { name: "Fala", port: 3050, url: "http://localhost:3050", check: "http://localhost:3050", start: "echo 'Manual start required'" }
];

function getLocalAppPort(name: string): number | null {
  const app = LOCAL_APPS.find(a => a.name === name);
  return app ? app.port : null;
}

function getLocalAppStartCommand(name: string): string | null {
  const app = LOCAL_APPS.find(a => a.name === name);
  return app ? app.start : null;
}

async function getLocalAppsStatus() {
  const apps: any[] = [];
  for (const app of LOCAL_APPS) {
    let status = "stopped";
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1000);
      const r = await fetch(app.check, { signal: controller.signal });
      clearTimeout(timeout);
      if (r.ok) status = "running";
    } catch (e) {
      status = "stopped";
    }
    const appData: any = {
      name: app.name,
      port: app.port,
      url: app.url,
      status: status,
      lastSeen: null,
      lastDuration: null
    };
    apps.push(appData);
  }
  return { apps };
}

async function getDashboardData(app: AppContext) {
  const memTotal = os.totalmem();
  const memUsed  = memTotal - os.freemem();
  const load     = os.loadavg();
  const googleAds = getGoogleAdsMetrics();
  const mutations = getMutationsData();
  const [sessions, continuationCards, nrHealth, umami, domains, stripe, dokploy, tunnels] = await Promise.all([
    buildSessionOverview(
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    ).catch(() => []),
    buildRecentContinuationCards(app.config, 9).catch(() => []),
    getNRHealth(),
    getUmamiData(),
    getCloudflareDomains(),
    getStripeDashboardData(),
    getDokployStatus(),
    getCloudflareTunnels(),
  ]);
  const codexUsage = await getCodexUsage({
    codexSessionsDir: app.config.codexSessionsDir,
    dataDir: app.config.dataDir,
  });

  return {
    meta: {
      hostname:             app.config.hostname,
      updatedAt:            new Date().toISOString(),
      probotUptimeSeconds:  Math.floor((Date.now() - START_TIME) / 1000),
    },
    machine: {
      loadAvg1:    Math.round((load[0] ?? 0) * 100) / 100,
      cpuCount:    os.cpus().length,
      memUsedGB:   Math.round(memUsed  / 1073741824 * 10) / 10,
      memTotalGB:  Math.round(memTotal / 1073741824 * 10) / 10,
      memPercent:  Math.round((memUsed / memTotal) * 100),
    },
    codexUsage,
    nrHealth,
    umami,
    domains,
    stripe,
    googleAds,
    mutations,
    dokploy,
    tunnels,
    scheduler: getNightScheduler(),
    sessions: sessions.slice(0, 9).map((s) => ({
      tool: s.tool, projectLabel: s.projectLabel,
      age: s.age, headline: s.headline, activeInTmux: s.activeInTmux,
    })),
    continuations: continuationCards,
  };
}

// ─── HTML ────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ProBot</title>
<link rel="icon" href="/favicon.svg?v=20260415-3" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#07070f;--surface:#0b0b18;--card:#0f0f1d;
  --border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.11);
  --accent:#7c5af0;--accent-d:rgba(124,90,240,0.13);
  --green:#34d399;--green-d:rgba(52,211,153,0.11);
  --amber:#fbbf24;--amber-d:rgba(251,191,36,0.11);
  --red:#f87171;--red-d:rgba(248,113,113,0.11);
  --gray:#4b5563;--gray-d:rgba(75,85,99,0.15);
  --text:#f0f0f8;--muted:#6b7280;--subtle:#374151;
  --font:'Inter',system-ui,sans-serif;
  --mono:'JetBrains Mono','Fira Code',monospace;
}
html,body{height:100%;overflow:hidden;width:100%}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.5;display:flex;flex-direction:column;overflow-x:hidden}
/* ── header ── */
header{border-bottom:1px solid var(--border);background:var(--surface);flex-shrink:0;z-index:10;backdrop-filter:blur(16px)}
.h-inner{display:flex;align-items:center;justify-content:space-between;padding:11px 24px}
.logo{display:flex;align-items:center;gap:10px}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.logo-name{font-weight:700;font-size:15px;letter-spacing:-.4px}
.logo-host{font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:1px}
.h-right{display:flex;align-items:center;gap:10px}
.updated{font-size:11px;color:var(--muted);font-family:var(--mono)}
/* ── layout ── */
.layout{flex:1;min-height:0;display:flex;flex-direction:column;padding:14px 24px 0;width:100%;overflow-x:hidden}
/* ── metrics bar ── */
.metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px;margin-bottom:12px;flex-shrink:0}
@media(max-width:1100px){.metrics{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:640px){.metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}
.mc{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:9px 12px}
.mc-label{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:3px}
.mc-value{font-size:17px;font-weight:600;font-family:var(--mono);letter-spacing:-.5px;line-height:1.2}
.mc-sub{font-size:10px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bar{height:2px;background:var(--border);border-radius:2px;margin-top:6px;overflow:hidden}
.bar-fill{height:100%;border-radius:2px;transition:width .6s ease}
/* ── tabs ── */
.tab-nav{display:flex;border-bottom:1px solid var(--border);margin-bottom:14px;flex-shrink:0}
.tab-btn{padding:7px 15px;font-size:12px;font-weight:500;background:none;border:none;border-bottom:2px solid transparent;color:var(--muted);cursor:pointer;transition:color .15s,border-color .15s;font-family:var(--font);display:flex;align-items:center;gap:6px;margin-bottom:-1px;white-space:nowrap}
.tab-btn:hover{color:var(--text)}
.tab-btn.active{color:var(--accent);border-bottom-color:var(--accent)}
.tab-count{font-size:10px;font-family:var(--mono);background:var(--card);border:1px solid var(--border);padding:1px 5px;border-radius:4px;color:var(--subtle)}
.tab-panel{display:none;overflow-y:auto;overflow-x:hidden;flex:1;min-height:0;padding-bottom:20px}
.tab-panel.active{display:block}
/* ── unified badge (basis: repo card style) ── */
.badge{font-size:10px;font-weight:500;padding:2px 6px;border-radius:4px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;display:inline-block}
.b-fresh{background:var(--green-d);color:var(--green);border:1px solid rgba(52,211,153,.2)}
.b-stale{background:var(--amber-d);color:var(--amber);border:1px solid rgba(251,191,36,.2)}
.b-old{background:var(--red-d);color:var(--red);border:1px solid rgba(248,113,113,.2)}
.b-none{background:var(--gray-d);color:var(--gray);border:1px solid rgba(75,85,99,.2)}
.b-claude{background:var(--accent-d);color:var(--accent);border:1px solid rgba(124,90,240,.2)}
.b-codex{background:rgba(14,165,233,.1);color:#38bdf8;border:1px solid rgba(14,165,233,.2)}
.b-gemini{background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.2)}
.b-intent{background:rgba(124,90,240,.08);color:#b7a6ff;border:1px solid rgba(124,90,240,.15)}
.b-live{background:var(--green-d);color:var(--green);border:1px solid rgba(52,211,153,.2)}
/* ── unified small button (basis: repo card style) ── */
.btn-sm{font-size:11px;padding:4px 10px;border-radius:5px;border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;font-family:var(--font);white-space:nowrap}
.btn-sm:hover{background:var(--accent-d);border-color:var(--accent);color:var(--accent)}
.btn-sm.ok{background:var(--green-d);border-color:var(--green);color:var(--green)}
/* ── header refresh ── */
.btn{background:var(--card);border:1px solid var(--border2);color:var(--muted);padding:5px 12px;border-radius:5px;font-size:12px;cursor:pointer;transition:all .15s;font-family:var(--font)}
.btn:hover{background:var(--accent-d);border-color:var(--accent);color:var(--accent)}
/* ── section header ── */
.sec-hd{display:flex;align-items:center;gap:8px;margin-bottom:12px}
.sec-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)}
.sec-count{font-size:10px;font-family:var(--mono);color:var(--subtle);background:var(--card);border:1px solid var(--border);padding:1px 6px;border-radius:4px}
/* ── sessions ── */
.slist{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:1100px){.slist{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.slist{grid-template-columns:minmax(0,1fr)}}
.si{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:7px;transition:border-color .15s}
.si:hover{border-color:var(--border2)}
.si-hd{display:flex;align-items:center;gap:5px;flex-wrap:wrap}
.si-repo{font-size:12px;font-weight:500;font-family:var(--mono);color:var(--text);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.si-age{font-size:10px;color:var(--subtle);font-family:var(--mono);flex-shrink:0}
.si-hl{font-size:12px;color:var(--muted);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;line-height:1.4}
.si-ft{display:flex;align-items:center;gap:6px;padding-top:6px;border-top:1px solid var(--border);flex-wrap:wrap}
.si-cmd{font-size:11px;font-family:var(--mono);color:var(--subtle);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
/* ── new relic ── */
.nr-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}
@media(max-width:900px){.nr-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:500px){.nr-grid{grid-template-columns:minmax(0,1fr)}}
.nr-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:11px 13px;display:flex;align-items:center;gap:10px}
.nr-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0}
.nr-name{font-size:12px;font-weight:500;color:var(--text)}
.nr-sub{font-size:10px;color:var(--muted);margin-top:2px}
.nr-err{font-size:11px;color:var(--muted);padding:10px 0}
/* ── scheduler ── */
.sched-table{width:100%;border-collapse:collapse}
.sched-table th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--subtle);font-weight:500;text-align:left;padding:0 12px 8px}
.sched-table th:last-child{text-align:right}
.sched-row{background:var(--card);border-bottom:1px solid var(--border);transition:background .15s}
.sched-row:first-of-type td:first-child{border-radius:8px 0 0 0}
.sched-row:first-of-type td:last-child{border-radius:0 8px 0 0}
.sched-row:last-of-type td:first-child{border-radius:0 0 0 8px}
.sched-row:last-of-type td:last-child{border-radius:0 0 8px 0}
.sched-row:last-of-type{border-bottom:none}
.sched-row td{padding:10px 12px;font-size:12px;vertical-align:middle}
.sched-status{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;padding:2px 7px;border-radius:4px}
.sched-ok{background:var(--green-d);color:var(--green);border:1px solid rgba(52,211,153,.2)}
.sched-fail{background:var(--red-d);color:var(--red);border:1px solid rgba(248,113,113,.2)}
.sched-timeout{background:var(--amber-d);color:var(--amber);border:1px solid rgba(251,191,36,.2)}
.sched-never{background:var(--gray-d);color:var(--gray);border:1px solid rgba(75,85,99,.2)}
.sched-running{background:rgba(59,130,246,.12);color:#60a5fa;border:1px solid rgba(96,165,250,.3);animation:pulse-run 2s ease-in-out infinite}
@keyframes pulse-run{0%,100%{opacity:1}50%{opacity:.5}}
.sched-name{font-weight:500;color:var(--text);font-size:12px}
.sched-meta{font-size:10px;color:var(--subtle);font-family:var(--mono)}
.sched-dur{font-size:11px;font-family:var(--mono);color:var(--muted);text-align:right}
.sched-err-row td{padding:0 12px 8px;border-bottom:1px solid var(--border)}
.sched-err{font-size:10px;font-family:var(--mono);color:var(--red);background:var(--red-d);border:1px solid rgba(248,113,113,.2);border-radius:4px;padding:5px 8px;line-height:1.5;word-break:break-all}
/* ── misc ── */
.loading{display:flex;align-items:center;justify-content:center;padding:40px;color:var(--muted);font-size:13px;gap:10px}
.spin{width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fade{animation:fade .3s ease}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.empty{color:var(--subtle);font-size:12px;padding:24px;text-align:center;border:1px dashed var(--border);border-radius:8px}
/* ── umami ── */
.umami-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:1100px){.umami-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.umami-grid{grid-template-columns:minmax(0,1fr)}}
.uc{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 15px;display:flex;flex-direction:column;gap:10px;transition:border-color .15s}
.uc:hover{border-color:var(--border2)}
.uc-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.uc-info{display:flex;flex-direction:column;gap:2px;min-width:0}
.uc-name{font-weight:600;font-size:13px;letter-spacing:-.3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.uc-domain{font-size:11px;font-family:var(--mono);color:var(--muted)}
.uc-live{display:flex;align-items:center;gap:5px;font-size:11px;font-family:var(--mono);color:var(--green);flex-shrink:0}
.uc-live-dot{width:6px;height:6px;border-radius:50%;background:var(--green);box-shadow:0 0 5px var(--green)}
.uc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.uc-stat-val{font-size:16px;font-weight:600;font-family:var(--mono);letter-spacing:-.5px;line-height:1.2}
.uc-stat-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:var(--muted);margin-top:2px}
.uc-ft{display:flex;gap:14px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--muted);font-family:var(--mono)}
/* ── dokploy ── */
.dokploy-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
@media(max-width:1100px){.dokploy-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.dokploy-grid{grid-template-columns:minmax(0,1fr)}}
.dokploy-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 13px;display:flex;flex-direction:column;gap:8px}
.dokploy-card:hover{border-color:var(--border2)}
.dokploy-header{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.dokploy-info{flex:1;min-width:0}
.dokploy-name{font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dokploy-project{font-size:10px;color:var(--muted);font-family:var(--mono);margin-top:2px}
.dokploy-env{font-size:9px;color:var(--subtle);font-family:var(--mono);margin-top:1px}
.dokploy-status{display:flex;align-items:center;gap:6px}
.dokploy-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.dokploy-status-label{font-size:10px;font-weight:500;text-transform:uppercase;letter-spacing:.3px;min-width:fit-content}
.dokploy-done{color:var(--green)}
.dokploy-running{color:#60a5fa;animation:pulse-run 2s ease-in-out infinite}
.dokploy-failed{color:var(--red)}
.dokploy-stopped{color:var(--gray)}
.dokploy-unknown{color:var(--muted)}
/* ── domains ── */
.dom-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
@media(max-width:1200px){.dom-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:800px){.dom-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:500px){.dom-grid{grid-template-columns:minmax(0,1fr)}}
.dc{background:var(--card);border:1px solid var(--border);border-left:3px solid var(--gray);border-radius:8px;padding:12px 13px;display:flex;flex-direction:column;gap:3px}
.dc-name{font-size:11px;font-weight:600;font-family:var(--mono);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:5px}
.dc-days{font-size:28px;font-weight:700;font-family:var(--mono);letter-spacing:-1.5px;line-height:1}
.dc-lbl{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-top:1px}
.dc-date{font-size:10px;font-family:var(--mono);color:var(--subtle);margin-top:4px}
/* ── stripe ── */
.stripe-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media(max-width:1100px){.stripe-grid{grid-template-columns:minmax(0,1fr)}}
.stripe-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:14px}
.stripe-card:hover{border-color:var(--border2)}
.stripe-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
.stripe-name{font-size:16px;font-weight:700;letter-spacing:-.4px}
.stripe-sub{font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:3px}
.stripe-notes{display:flex;gap:6px;flex-wrap:wrap}
.b-stripe{background:rgba(99,102,241,.12);color:#a5b4fc;border:1px solid rgba(165,180,252,.25)}
.stripe-modes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
@media(max-width:800px){.stripe-modes{grid-template-columns:minmax(0,1fr)}}
.stripe-mode{border:1px solid var(--border);border-radius:10px;padding:12px;background:rgba(255,255,255,0.02);display:flex;flex-direction:column;gap:10px}
.stripe-mode.sandbox{grid-column:1 / -1}
.stripe-mode-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.stripe-mode-title{font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px}
.stripe-mode-sub{font-size:10px;color:var(--muted);font-family:var(--mono)}
.stripe-stats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.stripe-stat{padding:9px 10px;background:var(--surface);border:1px solid var(--border);border-radius:8px}
.stripe-stat-val{font-size:15px;font-weight:600;font-family:var(--mono);line-height:1.2}
.stripe-stat-lbl{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.4px;margin-top:3px}
.stripe-product-list{display:flex;flex-wrap:wrap;gap:6px}
.stripe-json details{border:1px solid var(--border);border-radius:8px;background:var(--surface)}
.stripe-json summary{padding:9px 11px;cursor:pointer;font-size:11px;color:var(--muted);font-family:var(--mono)}
.stripe-json pre{margin:0;padding:0 11px 11px;font-size:10px;line-height:1.5;color:#cbd5e1;white-space:pre-wrap;word-break:break-word;font-family:var(--mono)}
/* ── local apps ── */
.local-app-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-top:16px}
.local-app-card{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:8px}
.local-app-header{display:flex;align-items:center;gap:8px;font-weight:500}
.local-app-status{display:inline-flex;align-items:center;gap:6px;font-size:10px;color:var(--muted)}
.local-app-status.running{color:var(--green)}
.local-app-status.stopped{color:var(--red)}
.local-app-actions{display:flex;gap:6px;margin-top:4px;flex-wrap:wrap}
.local-app-btn{padding:5px 10px;font-size:10px;background:var(--border);border:1px solid var(--border);border-radius:4px;cursor:pointer;color:var(--text);transition:all .15s}
.local-app-btn:hover{background:var(--accent-d);border-color:var(--accent);color:var(--accent)}
.local-app-btn.danger{color:var(--red);border-color:rgba(248,113,113,.2)}
.local-app-btn.danger:hover{background:rgba(248,113,113,.1);border-color:var(--red)}
</style>
</head>
<body>
<header>
  <div class="h-inner">
    <div class="logo">
      <div class="logo-dot"></div>
      <div>
        <div class="logo-name">ProBot</div>
        <div class="logo-host" id="host">connecting...</div>
      </div>
    </div>
    <div class="h-right">
      <span class="updated" id="upd">—</span>
      <button class="btn" id="refresh-btn" onclick="refresh()">↻ Refresh</button>
    </div>
  </div>
</header>
<div class="layout">
  <div id="metrics"><div class="loading"><div class="spin"></div>Loading...</div></div>
  <nav class="tab-nav">
    <button class="tab-btn active" data-tab="sessions">Sessions <span class="tab-count" id="cnt-sessions"></span></button>
    <button class="tab-btn" data-tab="dokploy">Dokploy <span class="tab-count" id="cnt-dokploy"></span></button>
    <button class="tab-btn" data-tab="nr">New Relic</button>
    <button class="tab-btn" data-tab="scheduler">Scheduler <span class="tab-count" id="cnt-sched"></span></button>
    <button class="tab-btn" data-tab="umami">Analytics <span class="tab-count" id="cnt-umami"></span></button>
    <button class="tab-btn" data-tab="google-ads">Google Ads <span class="tab-count" id="cnt-google-ads"></span></button>
    <button class="tab-btn" data-tab="stripe">Stripe <span class="tab-count" id="cnt-stripe"></span></button>
    <button class="tab-btn" data-tab="domains">Domains <span class="tab-count" id="cnt-domains"></span></button>
    <button class="tab-btn" data-tab="tunnels">Tunnels <span class="tab-count" id="cnt-tunnels"></span></button>
    <button class="tab-btn" data-tab="local-apps">Local Apps <span class="tab-count" id="cnt-local-apps"></span></button>
  </nav>
  <div class="tab-panel active" id="tab-sessions"><div class="loading"><div class="spin"></div>Loading...</div></div>
  <div class="tab-panel" id="tab-dokploy"></div>
  <div class="tab-panel" id="tab-nr"></div>
  <div class="tab-panel" id="tab-scheduler"></div>
  <div class="tab-panel" id="tab-umami"></div>
  <div class="tab-panel" id="tab-google-ads"></div>
  <div class="tab-panel" id="tab-stripe"></div>
  <div class="tab-panel" id="tab-domains"></div>
  <div class="tab-panel" id="tab-tunnels"></div>
  <div class="tab-panel" id="tab-local-apps"></div>
</div>
<script>
let _d=null;
const esc=s=>String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function age(iso){
  if(!iso)return'never';
  const m=Math.floor((Date.now()-new Date(iso))/60000);
  if(m<1)return'just now';if(m<60)return m+'m ago';
  const h=Math.floor(m/60);if(h<24)return h+'h ago';
  return Math.floor(h/24)+'d ago';
}
function uptime(s){
  if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60);
  return h<24?h+'h '+m+'m':Math.floor(h/24)+'d '+(h%24)+'h';
}
function pctColor(p){return p>50?'var(--green)':p>20?'var(--amber)':'var(--red)';}
function fmtReset(iso){
  if(!iso)return'No data';
  const d=new Date(iso),now=new Date(),dm=Math.floor((d-now)/60000);
  if(dm<=0)return'Resetting…';
  return dm<60?'in '+dm+'m':'in '+Math.floor(dm/60)+'h '+String(dm%60).padStart(2,'0')+'m';
}
/* tab switching */
document.querySelectorAll('.tab-btn').forEach(b=>b.addEventListener('click',()=>{
  document.querySelectorAll('.tab-btn').forEach(x=>x.classList.toggle('active',x===b));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-'+b.dataset.tab));
}));
/* encode a value for use inside a double-quoted HTML attribute */
function attr(v){return String(v||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;');}
/* clipboard helper — works on HTTPS and HTTP alike */
function clipCopy(text){
  if(navigator.clipboard&&navigator.clipboard.writeText)return navigator.clipboard.writeText(text);
  const ta=document.createElement('textarea');ta.value=text;
  Object.assign(ta.style,{position:'fixed',top:0,left:'-9999px',width:'1px',height:'1px',opacity:0});
  document.body.appendChild(ta);ta.focus();ta.select();
  try{const ok=document.execCommand('copy');document.body.removeChild(ta);return ok?Promise.resolve():Promise.reject();}
  catch(e){document.body.removeChild(ta);return Promise.reject(e);}
}
function applyBtnCopy(btn,text){
  const o=btn.textContent;
  clipCopy(text)
    .then(()=>{btn.textContent='✓ Copied';btn.classList.add('ok');setTimeout(()=>{btn.textContent=o;btn.classList.remove('ok');},2000);})
    .catch(()=>{btn.textContent='Failed';setTimeout(()=>{btn.textContent=o;},2000);});
}
function copyCmd(btn,text){applyBtnCopy(btn,text);}
/* mutations — approve, reject, apply */
function getSelectedMutationIds(){
  const cbs=document.querySelectorAll('.mutation-cb:checked');
  return Array.from(cbs).map(cb=>parseInt(cb.value,10)).filter(id=>!isNaN(id));
}
function toggleMutationSelect(chk){
  document.querySelectorAll('.mutation-cb').forEach(cb=>cb.checked=chk.checked);
}
async function approveMutation(btn){
  const ids=getSelectedMutationIds();
  if(!ids.length){alert('Select mutations first');return;}
  btn.disabled=true;btn.textContent='Approving...';
  try{
    const r=await fetch('/api/mutations/batch-approve',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    fetchData();
  }catch(e){alert('Error: '+e.message);}
  btn.disabled=false;btn.textContent='Approve Selected';
}
async function rejectMutation(btn){
  const ids=getSelectedMutationIds();
  if(!ids.length){alert('Select mutations first');return;}
  const reason=prompt('Rejection reason:');
  if(!reason)return;
  btn.disabled=true;btn.textContent='Rejecting...';
  try{
    const r=await fetch('/api/mutations/batch-reject',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,reason})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    fetchData();
  }catch(e){alert('Error: '+e.message);}
  btn.disabled=false;btn.textContent='Reject Selected';
}
async function applyMutation(btn){
  const ids=getSelectedMutationIds();
  if(!ids.length){alert('Select mutations first');return;}
  btn.disabled=true;btn.textContent='Applying...';
  try{
    const r=await fetch('/api/mutations/batch-apply',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids,live:true})});
    if(!r.ok)throw new Error('HTTP '+r.status);
    alert('Mutations applied successfully');
    fetchData();
  }catch(e){alert('Error: '+e.message);}
  btn.disabled=false;btn.textContent='Apply Selected';
}
/* ghostty — no client-side localhost check; server handles auth via socket address */
async function openGhostty(btn,directCommand,cwd){
  const old=btn.textContent;btn.textContent='Opening…';
  try{
    const r=await fetch('/api/local/ghostty',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({directCommand,cwd})});
    if(r.status===403){btn.textContent='Desktop only';}
    else if(!r.ok)throw new Error('HTTP '+r.status);
    else btn.textContent='Opened ✓';
  }catch(e){btn.textContent='Failed';}
  setTimeout(()=>{btn.textContent=old;},2000);
}
/* rendering */
const fc={fresh:'b-fresh',stale:'b-stale',old:'b-old',none:'b-none'};
const fl={fresh:'fresh',stale:'stale',old:'old',none:'no handoff'};
const fco={fresh:'var(--green)',stale:'var(--amber)',old:'var(--red)',none:'var(--gray)'};
function toolBadge(t){
  if(!t||t==='Unknown')return'';
  const c=t.toLowerCase().includes('codex')?'b-codex':t.toLowerCase().includes('gemini')?'b-gemini':'b-claude';
  const l=t.toLowerCase().includes('codex')?'Codex':t.toLowerCase().includes('gemini')?'Gemini':'Claude';
  return'<span class="badge '+c+'">'+l+'</span>';
}
function statCard(l,v,s,p,c){
  return'<div class="mc"><div class="mc-label">'+l+'</div><div class="mc-value">'+v+'</div><div class="mc-sub">'+s+'</div>'
    +(p!==null?'<div class="bar"><div class="bar-fill" style="width:'+p+'%;background:'+c+'"></div></div>':'')
    +'</div>';
}
function codexCard(l,w){
  if(!w||!w.resetsAt)return'<div class="mc"><div class="mc-label">'+l+'</div><div class="mc-value" style="font-size:14px;color:var(--muted)">–</div><div class="mc-sub">No data yet</div></div>';
  const c=pctColor(w.remainingPercent);
  return'<div class="mc"><div class="mc-label">'+l+'</div><div class="mc-value" style="color:'+c+'">'+w.remainingPercent+'%</div>'
    +'<div class="mc-sub">'+fmtReset(w.resetsAt)+'</div>'
    +'<div class="bar"><div class="bar-fill" style="width:'+w.remainingPercent+'%;background:'+c+'"></div></div></div>';
}
function renderMetrics(m,mc,codex){
  const cpu=Math.min(100,Math.round((mc.loadAvg1/mc.cpuCount)*100));
  const cc=cpu>80?'var(--red)':cpu>50?'var(--amber)':'var(--accent)';
  const mc2=mc.memPercent>85?'var(--red)':mc.memPercent>60?'var(--amber)':'var(--accent)';
  return'<div class="metrics fade">'
    +statCard('CPU Load',mc.loadAvg1.toFixed(2),mc.cpuCount+'-core · '+cpu+'%',cpu,cc)
    +statCard('Memory',mc.memUsedGB+' GB',mc.memTotalGB+' GB · '+mc.memPercent+'%',mc.memPercent,mc2)
    +statCard('Uptime',uptime(m.probotUptimeSeconds),'ProBot daemon',null,null)
    +statCard('Host',esc(m.hostname),'local',null,null)
    +codexCard('Codex · 5h',codex.fiveHour)
    +codexCard('Codex · 7d',codex.sevenDay)
    +'</div>';
}
function continuationItem(s){
  const tc=s.tool==='claude'?'b-claude':s.tool==='codex'?'b-codex':'b-gemini';
  const tl=s.tool==='claude'?'Claude':s.tool==='codex'?'Codex':'Gemini';
  return'<div class="si">'
    +'<div class="si-hd">'
    +'<span class="badge '+tc+'">'+tl+'</span>'
    +'<span class="si-repo">'+esc(s.projectLabel)+'</span>'
    +'<span class="badge b-intent">'+esc(s.intentLabel)+'</span>'
    +(s.activeInTmux?'<span class="badge b-live">live</span>':'')
    +'<span class="si-age">'+esc(s.age)+'</span>'
    +'</div>'
    +'<div class="si-hl">'+esc(s.headline)+'</div>'
    +'<div class="si-ft">'
    +'<button class="btn-sm" data-cmd="'+attr(s.directCommand)+'" data-cwd="'+attr(s.cwd)+'" onclick="openGhostty(this,this.dataset.cmd,this.dataset.cwd)">Open in Ghostty</button>'
    +'</div></div>';
}
function dokployStatusColor(status){
  if(!status)return'var(--gray)';
  const s=String(status).toLowerCase();
  if(s==='done')return'var(--green)';
  if(s==='running')return'#60a5fa';
  if(s==='failed'||s==='error')return'var(--red)';
  if(s==='stopped')return'var(--gray)';
  return'var(--muted)';
}
function dokployCard(item){
  const c=dokployStatusColor(item.status);
  const stat=String(item.status||'unknown').toLowerCase();
  return'<div class="dokploy-card"><div class="dokploy-header"><div class="dokploy-info"><div class="dokploy-name">'+esc(item.name)+'</div><div class="dokploy-project">'+esc(item.project)+'</div><div class="dokploy-env">'+esc(item.environment)+'</div></div><div class="dokploy-status"><div class="dokploy-dot" style="background:'+c+'"></div><div class="dokploy-status-label dokploy-'+stat+'">'+esc(stat)+'</div></div></div></div>';
}
function renderDokploy(data){
  if(data.error)return'<div class="nr-err">Dokploy: '+esc(data.error)+'</div>';
  if(!data.apps.length&&!data.compose.length)return'<div class="empty">No Dokploy applications or services.</div>';
  let html='';
  if(data.apps.length){
    html+='<div class="sec-hd"><span class="sec-title">Applications</span><span class="sec-count">'+data.apps.length+'</span></div>';
    html+='<div class="dokploy-grid fade">'+data.apps.map(dokployCard).join('')+'</div>';
  }
  if(data.compose.length){
    html+=(data.apps.length?'<div class="sec-hd" style="margin-top:16px"><span class="sec-title">Docker Compose Services</span><span class="sec-count">'+data.compose.length+'</span></div>':'<div class="sec-hd"><span class="sec-title">Docker Compose Services</span><span class="sec-count">'+data.compose.length+'</span></div>');
    html+='<div class="dokploy-grid fade">'+data.compose.map(dokployCard).join('')+'</div>';
  }
  return html;
}
function nrDot(item){
  if(typeof item.online==='boolean')return item.online?'var(--green)':'var(--red)';
  if(item.reporting===false)return'var(--red)';
  return'var(--gray)';
}
function nrLabel(item){
  const parts=[];
  if(typeof item.online==='boolean'){parts.push(item.online?'online':'offline');}else{parts.push('unknown');}
  if(item.lastError&&item.online===false)parts.push(item.lastError);
  else if(item.alertSeverity==='CRITICAL'&&item.online!==false)parts.push('critical alert');
  else if(item.alertSeverity==='WARNING'&&item.online!==false)parts.push('warning alert');
  if(item.alertConfigured===false)parts.push('no alert policy');
  return parts.join(' · ');
}
function renderNRHealth(nr){
  if(nr.error&&!nr.hosts.length&&!nr.synthetics.length)return'<div class="nr-err">New Relic: '+esc(nr.error)+'</div>';
  const hCards=nr.hosts.map(h=>'<div class="nr-card"><div class="nr-dot" style="background:'+nrDot(h)+'"></div>'
    +'<div><div class="nr-name">'+esc(h.name)+'</div><div class="nr-sub">'+esc(nrLabel(h))+'</div></div></div>').join('');
  const sCards=nr.synthetics.map(s=>'<div class="nr-card"><div class="nr-dot" style="background:'+nrDot(s)+'"></div>'
    +'<div><div class="nr-name">'+esc(s.name)+'</div><div class="nr-sub">'+esc(nrLabel(s))+'</div></div></div>').join('');
  return(hCards?'<div class="sec-hd"><span class="sec-title">Servers</span><span class="sec-count">'+nr.hosts.length+'</span></div><div class="nr-grid fade">'+hCards+'</div>':'')
    +(sCards?'<div class="sec-hd" style="margin-top:16px"><span class="sec-title">Uptime Checks</span><span class="sec-count">'+nr.synthetics.length+'</span></div><div class="nr-grid fade">'+sCards+'</div>':'');
}
function renderScheduler(jobs){
  function sb(j){
    if(j.status==='running')return'<span class="sched-status sched-running">● running</span>';
    if(j.status==='success')return'<span class="sched-status sched-ok">✓ success</span>';
    if(j.status==='timeout')return'<span class="sched-status sched-timeout">⏱ timeout</span>';
    if(j.status==='failed')return'<span class="sched-status sched-fail">✗ failed'+(j.exitCode!==null?' ('+j.exitCode+')':\'\')+'</span>';
    return'<span class="sched-status sched-never">— never run</span>';
  }
  function dur(s){
    if(s===null)return'—';if(s<60)return s+'s';if(s<3600)return Math.floor(s/60)+'m '+(s%60)+'s';
    return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';
  }
  const rows=jobs.map(j=>{
    const err=(j.status==='failed'||j.status==='timeout')&&j.errorMessage
      ?'<tr><td colspan="5" style="padding:0 12px 8px;border-bottom:1px solid var(--border)"><div class="sched-err">'+esc(j.errorMessage)+'</div></td></tr>':'';
    return'<tr class="sched-row"><td><div class="sched-name">'+esc(j.label)+'</div></td>'
      +'<td>'+sb(j)+'</td>'
      +'<td><div class="sched-meta">'+(j.lastRunAt?age(j.lastRunAt):'—')+'</div></td>'
      +'<td><div class="sched-meta">'+fmtReset(j.nextRunAt)+'</div></td>'
      +'<td class="sched-dur">'+dur(j.durationSeconds)+'</td></tr>'+err;
  }).join('');
  return'<div class="fade"><table class="sched-table">'
    +'<thead><tr><th>Job</th><th>Status</th><th>Last run</th><th>Next run</th><th style="text-align:right">Duration</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div>';
}
function fmtN(n){if(n>=1e6)return(n/1e6).toFixed(1)+'M';if(n>=1000)return(n/1000).toFixed(1)+'k';return String(n);}
function fmtDur(s){if(!s||s===0)return'0s';if(s<60)return s+'s';return Math.floor(s/60)+'m '+(s%60)+'s';}
function umamiCard(site){
  const s=site.stats;
  if(!s)return'<div class="uc"><div class="uc-hd"><div class="uc-info"><div class="uc-name">'+esc(site.name)+'</div><div class="uc-domain">'+esc(site.domain)+'</div></div></div><div style="font-size:11px;color:var(--red)">'+esc(site.error||'Failed to load')+'</div></div>';
  const liveHtml=site.active>0?'<div class="uc-live"><div class="uc-live-dot"></div>'+site.active+' now</div>':'';
  return'<div class="uc">'
    +'<div class="uc-hd"><div class="uc-info"><div class="uc-name">'+esc(site.name)+'</div><div class="uc-domain">'+esc(site.domain)+'</div></div>'+liveHtml+'</div>'
    +'<div class="uc-stats">'
    +'<div><div class="uc-stat-val">'+fmtN(s.pageviews)+'</div><div class="uc-stat-lbl">Pageviews</div></div>'
    +'<div><div class="uc-stat-val">'+fmtN(s.visitors)+'</div><div class="uc-stat-lbl">Visitors</div></div>'
    +'<div><div class="uc-stat-val">'+fmtN(s.visits)+'</div><div class="uc-stat-lbl">Visits</div></div>'
    +'</div>'
    +'<div class="uc-ft"><span>'+s.bounceRate+'% bounce</span><span>'+fmtDur(s.avgDurationSeconds)+' avg session</span></div>'
    +'</div>';
}
function renderUmami(data){
  if(!data)return'<div class="nr-err">Umami not configured.</div>';
  if(data.error&&!data.websites.length)return'<div class="nr-err">Umami: '+esc(data.error)+'</div>';
  if(!data.websites.length)return'<div class="empty">No websites found in Umami.</div>';
  return'<div class="sec-hd"><span class="sec-title">Analytics · Today</span><span class="sec-count">'+data.websites.length+'</span></div>'
    +'<div class="umami-grid fade">'+data.websites.map(umamiCard).join('')+'</div>';
}
function expiryStyle(days){
  if(days===null)return{color:'var(--gray)',border:'#374151'};
  if(days<30)return{color:'var(--red)',border:'var(--red)'};
  if(days<90)return{color:'var(--amber)',border:'var(--amber)'};
  if(days<180)return{color:'#86efac',border:'#86efac'};
  return{color:'var(--green)',border:'var(--green)'};
}
function domainCard(d){
  const s=expiryStyle(d.daysUntilExpiry);
  const daysHtml=d.daysUntilExpiry!==null
    ?'<div class="dc-days" style="color:'+s.color+'">'+d.daysUntilExpiry+'</div><div class="dc-lbl">days left</div>'
    :'<div class="dc-days" style="color:var(--gray)">?</div><div class="dc-lbl">unknown</div>';
  const dateHtml=d.expiresAt
    ?'<div class="dc-date">expires '+d.expiresAt.slice(0,10)+'</div>'
    :'<div class="dc-date">no expiry data</div>';
  return'<div class="dc" style="border-left-color:'+s.border+'">'
    +'<div class="dc-name">'+esc(d.name)+'</div>'
    +daysHtml+dateHtml
    +'</div>';
}
function renderGoogleAds(data){
  if(!data)return'<div class="nr-err">Google Ads not configured.</div>';
  if(data.status==='no_data')return'<div class="nr-err">'+esc(data.error||'Google Ads database not found')+'</div>';
  if(data.status==='error')return'<div class="nr-err">Google Ads Error: '+esc(data.error||'Unknown error')+'</div>';
  let html='';
  const m=data.metrics;
  const pct=m.percentOfTarget;
  const pctColor=pct>100?'var(--amber)':pct>50?'var(--green)':'var(--red)';
  const statusBadge=pct<50?'b-old':pct<100?'b-stale':'b-live';
  html+='<div class="sec-hd"><span class="sec-title">Google Ads (Nonprofit)</span>';
  html+='<span class="badge '+statusBadge+'" style="margin-left:8px">'+pct+'% of daily target</span>';
  if(data.pendingMutations&&data.pendingMutations>0)html+='<span class="badge b-old" style="margin-left:4px">'+data.pendingMutations+' pending</span>';
  if(data.lastSync)html+='<span style="font-size:10px;color:var(--subtle);margin-left:auto">last metrics '+age(data.lastSync)+'</span>';
  html+='</div>';
  html+='<div class="ga-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px">';
  html+='<div class="mc"><div class="mc-label">Daily Spend (USD)</div><div class="mc-value" style="color:'+pctColor+'">$'+m.dailyBudgetUSD.toFixed(2)+'</div><div class="mc-sub">Target: $'+m.targetBudgetUSD.toFixed(2)+'/day</div></div>';
  html+='<div class="mc"><div class="mc-label">Day of Month</div><div class="mc-value">'+m.dayOfMonth+'/'+m.daysInMonth+'</div><div class="mc-sub">'+Math.round((m.dayOfMonth/m.daysInMonth)*100)+'% through month</div></div>';
  if(data.doctorStatus)html+='<div class="mc"><div class="mc-label">System Status</div><div class="mc-value">'+esc(data.doctorStatus)+'</div><div class="mc-sub">CLI health check</div></div>';
  html+='</div>';
  if(data.policyWatchStatus){
    const pw=data.policyWatchStatus;
    html+='<div class="sec-hd" style="margin-top:24px"><span class="sec-title">Policy Monitoring</span></div>';
    html+='<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:24px">';
    html+='<div class="mc"><div class="mc-label">Sources Tracked</div><div class="mc-value">'+pw.sourcesChecked+'</div><div class="mc-sub">Official Google docs</div></div>';
    const changeColor=pw.sourcesChanged>0?'var(--amber)':'var(--green)';
    html+='<div class="mc"><div class="mc-label">Changes Detected</div><div class="mc-value" style="color:'+changeColor+'">'+pw.sourcesChanged+'</div><div class="mc-sub">Ad Grants documentation</div></div>';
    if(pw.lastCheck)html+='<div class="mc"><div class="mc-label">Last Check</div><div class="mc-value" style="font-size:11px">'+age(pw.lastCheck)+'</div><div class="mc-sub">Policy watch</div></div>';
    html+='</div>';
  }
  return html;
}
function fmtMoney(amount,currency){
  if(amount===null||amount===undefined)return'—';
  const code=(currency||'usd').toUpperCase();
  try{return new Intl.NumberFormat('en-US',{style:'currency',currency:code,maximumFractionDigits:2}).format(amount);}
  catch{return code+' '+Number(amount).toFixed(2);}
}
function renderStripeMode(mode,label,kind){
  if(!mode)return'';
  const products=(mode.topProducts||[]).length
    ?'<div class="stripe-product-list">'+mode.topProducts.map(name=>'<span class="badge b-stripe">'+esc(name)+'</span>').join('')+'</div>'
    :'<div class="stripe-sub">No active products in sample.</div>';
  const breakdown=Object.entries(mode.statusBreakdown||{}).length
    ?Object.entries(mode.statusBreakdown).map(([status,count])=>'<span class="badge b-stale">'+esc(status)+': '+count+'</span>').join(' ')
    :'';
  return'<div class="stripe-mode '+(kind||'')+'">'
    +'<div class="stripe-mode-head"><div><div class="stripe-mode-title">'+esc(label)+'</div><div class="stripe-mode-sub">'+esc(mode.accountId||'unknown account')+' · '+esc((mode.currency||'usd').toUpperCase())+'</div></div>'
    +'<span class="badge '+(label==='Live'?'b-live':label==='Test'?'b-stale':'b-old')+'">'+esc(label)+'</span></div>'
    +'<div class="stripe-stats">'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+fmtMoney(mode.availableAmount,mode.currency)+'</div><div class="stripe-stat-lbl">Available balance</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+fmtMoney(mode.pendingAmount,mode.currency)+'</div><div class="stripe-stat-lbl">Pending balance</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+fmtMoney(mode.recentNetAmount,mode.currency)+'</div><div class="stripe-stat-lbl">Net revenue · '+mode.sampledChargeWindowDays+'d sample</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+mode.recentChargeCount+'</div><div class="stripe-stat-lbl">Succeeded charges · sample</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+mode.productsCount+'</div><div class="stripe-stat-lbl">Active products</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+mode.pricesCount+'</div><div class="stripe-stat-lbl">Active prices</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+mode.subscriptionsCount+'</div><div class="stripe-stat-lbl">Subscriptions sampled</div></div>'
    +'<div class="stripe-stat"><div class="stripe-stat-val">'+mode.customersCount+'</div><div class="stripe-stat-lbl">Customers sampled</div></div>'
    +'</div>'
    +(breakdown?'<div class="stripe-sub">'+breakdown+'</div>':'')
    +products
    +'<div class="stripe-json">'
    +'<details><summary>account JSON</summary><pre>'+esc(JSON.stringify(mode.raw.account,null,2))+'</pre></details>'
    +'<details><summary>balance JSON</summary><pre>'+esc(JSON.stringify(mode.raw.balance,null,2))+'</pre></details>'
    +'</div>'
    +'</div>';
}
function renderStripe(data){
  if(!data)return'<div class="nr-err">Stripe not configured.</div>';
  if(data.status==='no_data')return'<div class="nr-err">'+esc(data.error||'Stripe profiles not found')+'</div>';
  if(data.status==='error')return'<div class="nr-err">Stripe Error: '+esc(data.error||'Unknown error')+'</div>';
  if(!data.accounts||data.accounts.length===0)return'<div class="empty">No Stripe accounts indexed.</div>';
  let head='<div class="sec-hd"><span class="sec-title">Stripe Accounts</span><span class="sec-count">'+data.accounts.length+'</span>';
  if(data.cachedAt)head+='<span style="font-size:10px;color:var(--subtle);margin-left:auto">cached '+age(data.cachedAt)+'</span>';
  head+='</div>';
  const cards=data.accounts.map((account)=>{
    const notes=(account.notes||[]).map(note=>'<span class="badge '+(note.includes('workspace')?'b-live':'b-stripe')+'">'+esc(note)+'</span>').join('');
    const error=account.error?'<div class="nr-err">Fetch error: '+esc(account.error)+'</div>':'';
    return'<div class="stripe-card">'
      +'<div class="stripe-head"><div><div class="stripe-name">'+esc(account.displayName)+'</div><div class="stripe-sub">'+esc(account.liveProfile)+' · '+esc(account.ownership)+'</div></div><div class="stripe-notes">'+notes+'</div></div>'
      +error
      +'<div class="stripe-modes">'
      +renderStripeMode(account.live,'Live','')
      +renderStripeMode(account.test,'Test','')
      +renderStripeMode(account.sandbox,'Dedicated sandbox','sandbox')
      +'</div>'
      +'</div>';
  }).join('');
  return head+'<div class="stripe-grid fade">'+cards+'</div>';
}
function renderMutations(data){
  if(!data)return'<div class="nr-err">Mutations not available.</div>';
  if(data.status==='no_data')return'<div class="nr-err">'+esc(data.error||'Google Ads database not found')+'</div>';
  if(data.status==='error')return'<div class="nr-err">Mutations Error: '+esc(data.error||'Unknown error')+'</div>';
  if(!data.mutations||data.mutations.length===0)return'<div class="empty">No mutations found. <br/><small style="color:var(--muted)">Mutations will appear here after recommendations are queued and approved.</small></div>';
  const statuses=Object.entries(data.statsByStatus||{}).map(([s,c])=>'<span class="badge b-stale" style="margin-left:4px">'+esc(s)+': '+c+'</span>').join('');
  let html='<div class="sec-hd"><span class="sec-title">Pending Mutations</span><span class="sec-count">'+data.mutations.length+'</span>'+statuses+'</div>';
  html+='<div style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap">';
  html+='<button class="btn" onclick="approveMutation(this)" style="padding:6px 12px;font-size:11px;background:var(--green);color:white;border:none;border-radius:4px;cursor:pointer">Approve Selected</button>';
  html+='<button class="btn" onclick="rejectMutation(this)" style="padding:6px 12px;font-size:11px;background:var(--amber);color:white;border:none;border-radius:4px;cursor:pointer">Reject Selected</button>';
  html+='<button class="btn" onclick="applyMutation(this)" style="padding:6px 12px;font-size:11px;background:var(--accent);color:white;border:none;border-radius:4px;cursor:pointer">Apply Selected</button>';
  html+='</div>';
  html+='<div style="overflow-x:auto;margin-bottom:16px">';
  html+='<table style="width:100%;border-collapse:collapse;font-size:11px">';
  html+='<thead style="background:var(--card);border-bottom:1px solid var(--border)">';
  html+='<tr><th style="padding:8px;text-align:left"><input type="checkbox" onchange="toggleMutationSelect(this)" style="cursor:pointer"/></th><th style="padding:8px;text-align:left">Type</th><th style="padding:8px;text-align:left">Campaign</th><th style="padding:8px;text-align:left">Status</th><th style="padding:8px;text-align:left">Created</th></tr>';
  html+='</thead><tbody>';
  for(const m of data.mutations.slice(0,20)){
    html+='<tr style="border-bottom:1px solid var(--border);hover:background:var(--card)"><td style="padding:8px"><input type="checkbox" class="mutation-cb" value="'+m.id+'" style="cursor:pointer"/></td>';
    html+='<td style="padding:8px"><strong>'+esc(m.mutation_type)+'</strong></td>';
    html+='<td style="padding:8px;color:var(--muted);font-size:10px">'+esc(m.campaign_id||'N/A')+'</td>';
    html+='<td style="padding:8px"><span class="badge '+(m.status==='pending'?'b-old':m.status==='approved'?'b-stale':'b-live')+'">'+esc(m.status)+'</span></td>';
    html+='<td style="padding:8px;color:var(--muted);font-size:10px">'+age(m.created_at)+'</td></tr>';
  }
  html+='</tbody></table></div>';
  return html;
}
function renderGoogleAdsInfoBanner(){
  return '<div style="font-size:11px;color:var(--muted);margin-top:24px;padding:8px;background:var(--card);border-radius:4px;border:1px solid var(--border)">'
    +'<strong>Next phase:</strong> Live API integration will populate real campaign metrics, search terms, and recommendations once credentials are provisioned.<br/>'
    +'<strong>Account:</strong> Vila Solidária (592-920-2435) · Manager: Yeshua Academy Google Ads Manager (935-769-8503)<br/>'
    +'<strong>Program:</strong> Google Ad Grants (nonprofit) · Monthly budget: $10,000 USD'
    +'</div>';
}
function renderDomains(data){
  if(!data)return'<div class="nr-err">Cloudflare not configured.</div>';
  if(data.error&&!data.domains.length)return'<div class="nr-err">Domains: '+esc(data.error)+'</div>';
  if(!data.domains.length)return'<div class="empty">No domains found.</div>';
  const urgent=data.domains.filter(d=>d.daysUntilExpiry!==null&&d.daysUntilExpiry<30).length;
  const warning=data.domains.filter(d=>d.daysUntilExpiry!==null&&d.daysUntilExpiry>=30&&d.daysUntilExpiry<90).length;
  let hd='<div class="sec-hd"><span class="sec-title">Domains</span><span class="sec-count">'+data.domains.length+'</span>';
  if(urgent)hd+='<span class="badge b-old" style="margin-left:8px">'+urgent+' critical</span>';
  if(warning)hd+='<span class="badge b-stale" style="margin-left:4px">'+warning+' renewing soon</span>';
  if(data.cachedAt)hd+='<span style="font-size:10px;color:var(--subtle);margin-left:auto">cached '+age(data.cachedAt)+'</span>';
  hd+='</div>';
  return hd+'<div class="dom-grid fade">'+data.domains.map(domainCard).join('')+'</div>';
}
function tunnelStatusColor(status){
  if(!status)return'var(--gray)';
  if(status==='healthy')return'var(--green)';
  if(status==='down'||status==='degraded')return'var(--red)';
  return'var(--gray)';
}
function hostnameOnlineColor(online){
  if(online===true)return'var(--green)';
  if(online===false)return'var(--red)';
  return'var(--amber)';
}
function renderCloudflareTunnels(data){
  if(!data)return'<div class="empty">Cloudflare tunnels not configured.</div>';
  if(data.error&&!data.tunnels.length)return'<div class="nr-err">'+esc(data.error)+'</div>';
  if(!data.tunnels.length)return'<div class="empty">No tunnels found.</div>';
  let h='';
  data.tunnels.forEach(function(tunnel){
    const tCount=tunnel.hostnames.length;
    h+='<div class="sec-hd"><span class="sec-title">'+esc(tunnel.name)+'</span><span class="sec-count">'+tCount+'</span>';
    h+='<span class="nr-dot" style="background:'+tunnelStatusColor(tunnel.status)+';margin-left:8px"></span>';
    h+='<span style="color:var(--muted);font-size:10px;margin-left:4px">'+esc(tunnel.status)+'</span>';
    h+='</div>';
    if(!tunnel.hostnames||tunnel.hostnames.length===0){
      h+='<div class="empty" style="margin-bottom:16px">No public hostnames configured</div>';
    }else{
      h+='<div class="nr-grid fade">';
      tunnel.hostnames.forEach(function(hostname){
        h+='<div class="nr-card"><span class="nr-dot" style="background:'+hostnameOnlineColor(hostname.online)+'"></span>';
        h+='<div><div class="nr-name">'+esc(hostname.hostname)+'</div>';
        h+='<div class="nr-sub">'+esc(hostname.service)+'</div></div></div>';
      });
      h+='</div>';
    }
  });
  return h;
}
function renderLocalApps(data){
  if(!data)return'<div class="nr-err">Local apps data unavailable</div>';
  if(data.error)return'<div class="nr-err">'+esc(data.error)+'</div>';
  if(!data.apps||!Array.isArray(data.apps))return'<div class="empty">No local apps configured</div>';
  let html='<div class="sec-hd"><span class="sec-title">Local Applications</span><span class="sec-count">'+data.apps.length+'</span></div>';
  const running=data.apps.filter(a=>a.status==='running').length;
  if(running>0)html+='<span class="badge b-live" style="margin-left:8px">'+running+' running</span>';
  html+='<div class="local-app-grid">';
  data.apps.forEach(function(app){
    const isRunning=app.status==='running';
    const statusClass=isRunning?'running':'stopped';
    const statusDot=isRunning?'●':'○';
    html+='<div class="local-app-card">';
    html+='<div class="local-app-header">';
    html+='<span style="font-size:14px">'+statusDot+'</span>';
    html+='<span style="flex:1"><strong>'+esc(app.name)+'</strong></span>';
    html+='<span style="font-size:10px;color:var(--muted)">port '+app.port+'</span>';
    html+='</div>';
    html+='<div class="local-app-status '+statusClass+'">';
    html+='<span>'+esc(app.status.toUpperCase())+'</span>';
    if(app.lastSeen)html+=' · last '+esc(age(app.lastSeen));
    if(app.lastDuration)html+=' · '+esc(app.lastDuration);
    html+='</div>';
    html+='<div class="local-app-actions">';
    if(app.name!=='ProBot'){
      if(!isRunning){
        html+='<button class="local-app-btn" onclick="localAppStart(this,&quot;'+esc(app.name)+'&quot;)">Start</button>';
      }else{
        html+='<button class="local-app-btn danger" onclick="localAppStop(this,&quot;'+esc(app.name)+'&quot;)">Stop</button>';
      }
    }
    if(app.url){
      html+='<a href="'+esc(app.url)+'" target="_blank" class="local-app-btn" style="text-decoration:none;display:inline-block">Open ↗</a>';
    }
    html+='</div>';
    html+='</div>';
  });
  html+='</div>';
  return html;
}
function render(d){
  _d=d;
  document.getElementById('host').textContent=d.meta.hostname;
  document.getElementById('upd').textContent='updated '+age(d.meta.updatedAt);
  document.getElementById('metrics').innerHTML=renderMetrics(d.meta,d.machine,d.codexUsage);
  const sc=d.continuations.length;
  document.getElementById('cnt-sessions').textContent=sc?String(sc):'';
  document.getElementById('tab-sessions').innerHTML=sc===0
    ?'<div class="empty">No recent sessions found.</div>'
    :'<div class="slist fade">'+d.continuations.map(continuationItem).join('')+'</div>';
  const dkCount=d.dokploy&&d.dokploy.totalApps?d.dokploy.totalApps+(d.dokploy.totalCompose||0):0;
  document.getElementById('cnt-dokploy').textContent=dkCount?String(dkCount):'';
  document.getElementById('tab-dokploy').innerHTML=renderDokploy(d.dokploy);
  document.getElementById('tab-nr').innerHTML=renderNRHealth(d.nrHealth);
  const sj=d.scheduler||[];
  const ok=sj.filter(j=>j.status==='success').length;
  document.getElementById('cnt-sched').textContent=sj.length?ok+'/'+sj.length:'';
  document.getElementById('tab-scheduler').innerHTML=sj.length===0
    ?'<div class="empty">No scheduler jobs configured.</div>'
    :renderScheduler(sj);
  const uw=d.umami&&d.umami.websites?d.umami.websites.length:0;
  document.getElementById('cnt-umami').textContent=uw?String(uw):'';
  document.getElementById('tab-umami').innerHTML=renderUmami(d.umami);
  const gaPending=d.googleAds&&d.googleAds.pendingMutations?d.googleAds.pendingMutations:0;
  document.getElementById('cnt-google-ads').textContent=gaPending?String(gaPending):'';
  document.getElementById('tab-google-ads').innerHTML=renderGoogleAds(d.googleAds)+'<div style="margin-top:24px"></div>'+renderMutations(d.mutations)+'<div style="margin-top:0"></div>'+renderGoogleAdsInfoBanner();
  const stripeCount=d.stripe&&d.stripe.accounts?d.stripe.accounts.length:0;
  document.getElementById('cnt-stripe').textContent=stripeCount?String(stripeCount):'';
  document.getElementById('tab-stripe').innerHTML=renderStripe(d.stripe);
  const dw=d.domains&&d.domains.domains?d.domains.domains.length:0;
  document.getElementById('cnt-domains').textContent=dw?String(dw):'';
  document.getElementById('tab-domains').innerHTML=renderDomains(d.domains);
  const tcCount=(d.tunnels&&d.tunnels.tunnels||[]).reduce((n,t)=>n+(t.hostnames||[]).length,0);
  document.getElementById('cnt-tunnels').textContent=tcCount?String(tcCount):'';
  document.getElementById('tab-tunnels').innerHTML=renderCloudflareTunnels(d.tunnels);
}
async function fetchData(){
  try{
    const r=await fetch('/api/data');
    if(!r.ok)throw new Error('HTTP '+r.status);
    render(await r.json());
  }catch(e){
    document.getElementById('upd').textContent='fetch failed';
  }
}
function refresh(){
  const b=document.getElementById('refresh-btn');b.textContent='↻ Loading…';
  fetchData().finally(()=>{b.textContent='↻ Refresh';});
}
setInterval(fetchData,30000);
setInterval(()=>{if(_d)document.getElementById('upd').textContent='updated '+age(_d.meta.updatedAt);},60000);
fetchData();
async function localAppStart(btn,name){
  const o=btn.textContent;btn.disabled=true;btn.textContent='Starting...';
  try{
    const r=await fetch('/api/local-apps/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    const d=await r.json();
    btn.textContent=d.message||'Started';
    setTimeout(()=>{btn.disabled=false;btn.textContent=o;localAppsRefresh();},1500);
  }catch(e){btn.disabled=false;btn.textContent=o;alert('Error: '+e.message);}
}
async function localAppStop(btn,name){
  const o=btn.textContent;btn.disabled=true;btn.textContent='Stopping...';
  try{
    const r=await fetch('/api/local-apps/stop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name})});
    const d=await r.json();
    btn.textContent=d.message||'Stopped';
    setTimeout(()=>{btn.disabled=false;btn.textContent=o;localAppsRefresh();},1500);
  }catch(e){btn.disabled=false;btn.textContent=o;alert('Error: '+e.message);}
}
async function localAppsRefresh(){
  try{
    const r=await fetch('/api/local-apps');
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();
    document.getElementById('tab-local-apps').innerHTML=renderLocalApps(data);
  }catch(e){
    console.error('Local apps refresh failed:',e.message);
  }
}
</script>
</body>
</html>`;

// ─── Server ──────────────────────────────────────────────────────────────────

export function createDashboardServer(app: AppContext): http.Server {
  return http.createServer(async (req, res) => {
    const url = req.url ?? "/";

    if (req.method === "POST" && url === "/api/local/ghostty") {
      if (!isLocalDashboardRequest(req)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Ghostty actions are only enabled on localhost." }));
        return;
      }
      try {
        let body = "";
        for await (const chunk of req) body += chunk;
        const parsed = JSON.parse(body) as { directCommand?: string; cwd?: string; executeCommand?: boolean };
        if (!parsed.directCommand || !parsed.cwd || typeof parsed.directCommand !== "string" || typeof parsed.cwd !== "string") {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing directCommand or cwd." }));
          return;
        }
        // executeCommand defaults to true (auto-execute like sessions); false for review mode (like repos)
        const shouldExecute = parsed.executeCommand !== false;
        await openGhosttySession(parsed.directCommand, parsed.cwd, shouldExecute);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    // ─── Mutation API endpoints ───────────────────────────────────────────────
    if (req.method === "POST" && url.startsWith("/api/mutations/")) {
      if (!isLocalDashboardRequest(req)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Mutation actions are only enabled on localhost." }));
        return;
      }
      const googleAdsDbPath = path.join(os.homedir(), "Repos", "stevewesthoek", "brain", "operations", "google-ads", "data", "google_ads.sqlite3");
      try {
        let body = "";
        for await (const chunk of req) body += chunk;
        const payload = JSON.parse(body) as { ids?: number[]; reason?: string; live?: boolean };

        if (url === "/api/mutations/batch-approve" && payload.ids && Array.isArray(payload.ids)) {
          const db = new Database(googleAdsDbPath);
          const stmt = db.prepare("UPDATE pending_mutations SET status = 'approved', updated_at = ? WHERE id = ?");
          for (const id of payload.ids) {
            stmt.run(new Date().toISOString(), id);
          }
          db.close();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, approved: payload.ids.length }));
          return;
        }

        if (url === "/api/mutations/batch-reject" && payload.ids && Array.isArray(payload.ids)) {
          const db = new Database(googleAdsDbPath);
          const stmt = db.prepare("UPDATE pending_mutations SET status = 'rejected', updated_at = ?, payload = json_set(payload, '$.rejection_reason', ?) WHERE id = ?");
          for (const id of payload.ids) {
            stmt.run(new Date().toISOString(), payload.reason || "No reason provided", id);
          }
          db.close();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, rejected: payload.ids.length }));
          return;
        }

        if (url === "/api/mutations/batch-apply" && payload.ids && Array.isArray(payload.ids)) {
          const db = new Database(googleAdsDbPath);
          const stmt = db.prepare("UPDATE pending_mutations SET status = 'applied', applied_at = ?, updated_at = ? WHERE id = ? AND status = 'approved'");
          let applied = 0;
          for (const id of payload.ids) {
            const result = stmt.run(new Date().toISOString(), new Date().toISOString(), id);
            if (result.changes > 0) applied++;
          }
          db.close();
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true, applied, note: "Only approved mutations can be applied" }));
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Endpoint not found" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if (url === "/api/local-apps") {
      try {
        const status = await getLocalAppsStatus();
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
        res.end(JSON.stringify(status));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if (req.method === "POST" && url.startsWith("/api/local-apps/")) {
      if (!isLocalDashboardRequest(req)) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Local app actions are only enabled on localhost." }));
        return;
      }
      try {
        let body = "";
        for await (const chunk of req) body += chunk;
        const payload = JSON.parse(body);

        if (url === "/api/local-apps/start" && payload.name) {
          const cmd = getLocalAppStartCommand(payload.name);
          if (!cmd) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "App not found or cannot be started" }));
            return;
          }
          try {
            const { exec } = require("child_process");
            exec(cmd, { cwd: os.homedir() });
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, message: "Starting..." }));
          } catch (e) {
            throw new Error(`Failed to start ${payload.name}: ${String(e)}`);
          }
          return;
        }

        if (url === "/api/local-apps/stop" && payload.name) {
          const port = getLocalAppPort(payload.name);
          if (!port) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "App not found or cannot be stopped" }));
            return;
          }
          try {
            const { exec } = require("child_process");
            exec(`lsof -i :${port} | grep LISTEN | awk '{print $2}' | xargs kill -9`);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true, message: "Stopping..." }));
          } catch (e) {
            throw new Error(`Failed to stop ${payload.name}: ${String(e)}`);
          }
          return;
        }

        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Endpoint not found" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if (url === "/api/data") {
      try {
        const data = await getDashboardData(app);
        res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache", "Access-Control-Allow-Origin": "*" });
        res.end(JSON.stringify(data));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && url.startsWith("/favicon.svg")) {
      res.writeHead(200, {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      });
      res.end(req.method === "HEAD" ? undefined : FAVICON_SVG);
      return;
    }

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache, no-store, must-revalidate", "Pragma": "no-cache", "Expires": "0" });
      res.end(HTML);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
}
