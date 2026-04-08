import http from "node:http";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { AppContext } from "../types/app.js";
import { buildSessionOverview } from "../services/sessions.js";
import { getCodexUsage } from "../services/codex-usage.js";

const execAsync = promisify(exec);

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

function getReposData(app: AppContext) {
  const repos = [];
  for (const [name, repoPath] of app.config.repoAliases) {
    const handoffPath = path.join(repoPath, ".ai", "current.md");
    const exists = fs.existsSync(handoffPath);
    let goal = "No goal set";
    let status = "No status recorded";
    let tool = "Unknown";
    let nextSteps: string[] = [];
    let resumePrompt = `Continue work on ${name}.`;
    let updatedAt: string | null = null;

    if (exists) {
      try {
        const content = fs.readFileSync(handoffPath, "utf8");
        const s = parseHandoffSections(content);
        goal         = s["Goal"]?.[0]        ?? goal;
        status       = s["Status"]?.[0]      ?? status;
        tool         = s["Tool"]?.[0]        ?? tool;
        nextSteps    = (s["Next steps"] ?? []).slice(0, 3).map((l) => l.replace(/^\d+\.\s*/, ""));
        resumePrompt = s["Resume prompt"]?.join("\n") ?? resumePrompt;
        updatedAt    = fs.statSync(handoffPath).mtime.toISOString();
      } catch { /* best-effort */ }
    }

    repos.push({
      name,
      handoff: { exists, goal, status, tool, nextSteps, resumePrompt, updatedAt, freshness: getFreshness(updatedAt) },
    });
  }
  return repos;
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
    const [syntheticsConditionsRaw, infraConditionsRaw] = await Promise.all([
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
    const configuredSyntheticMonitorIds = new Set(
      syntheticsConditions
        .filter((condition) => condition.enabled && condition.monitor_id)
        .map((condition) => condition.monitor_id as string)
    );
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
          online,
          alertConfigured: configuredHostNames.has(host.name),
          lastSeenAt: epochToIso(lastSeen),
        };
      }),
      synthetics: (data.data?.actor?.synthetics?.results?.entities ?? []).map((synthetic) => {
        const latest = syntheticStatus.get(synthetic.name);
        const lastResult = latest?.["latest.result"] ?? null;
        return {
          ...synthetic,
          online: lastResult === "SUCCESS" ? true : lastResult === "FAILED" ? false : null,
          alertConfigured: Boolean(synthetic.monitorId && configuredSyntheticMonitorIds.has(synthetic.monitorId)),
          lastCheckAt: epochToIso(latest?.["latest.timestamp"]),
          lastResult,
          lastError: normalizeSyntheticError(latest?.["latest.error"]),
        };
      }),
    };
  } catch (err) {
    return { hosts: [], synthetics: [], error: String(err) };
  }
}

// ─── Night scheduler helpers ──────────────────────────────────────────────────

const SCHEDULER_JOB_ORDER: Array<{ key: string; label: string }> = [
  { key: "stb-pipeline-batch",      label: "STB Pipeline" },
  { key: "n8n-backup",              label: "n8n Backup" },
  { key: "claude-session-cleanup",  label: "Claude Cleanup" },
  { key: "dance-of-life-sync",      label: "Dance of Life (1) Download" },
  { key: "bible-studies-pipeline",  label: "Dance of Life (2) Transcribe" },
  { key: "gemini-cleanup",          label: "Gemini Cleanup" },
  { key: "skill-prune",             label: "Skill Prune" },
];

interface SchedulerJob {
  key: string;
  label: string;
  status: "success" | "failed" | "timeout" | "never";
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

function getNightScheduler(): SchedulerJob[] {
  const stateDir = path.join(os.homedir(), ".local", "state", "office-scheduler");
  const nextRun = nextSchedulerRun();

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
      return { key, label, status, exitCode, durationSeconds, lastRunAt, nextRunAt: nextRun, errorMessage };
    } catch {
      return { key, label, status: "never" as const, exitCode: null, durationSeconds: null, lastRunAt: null, nextRunAt: nextRun, errorMessage: null };
    }
  });
}

async function getDashboardData(app: AppContext) {
  const memTotal = os.totalmem();
  const memUsed  = memTotal - os.freemem();
  const load     = os.loadavg();
  const [sessions, nrHealth] = await Promise.all([
    buildSessionOverview(
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    ).catch(() => []),
    getNRHealth(),
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
    scheduler: getNightScheduler(),
    repos: getReposData(app),
    sessions: sessions.slice(0, 8).map((s) => ({
      tool: s.tool, projectLabel: s.projectLabel,
      age: s.age, headline: s.headline, activeInTmux: s.activeInTmux,
    })),
  };
}

// ─── HTML ────────────────────────────────────────────────────────────────────

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ProBot</title>
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
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.5;min-height:100vh}
header{border-bottom:1px solid var(--border);background:var(--surface);position:sticky;top:0;z-index:10;backdrop-filter:blur(16px)}
.h-inner{display:flex;align-items:center;justify-content:space-between;padding:13px 24px;max-width:1320px;margin:0 auto}
.logo{display:flex;align-items:center;gap:10px}
.logo-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 8px var(--green);animation:pulse 2.5s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.logo-name{font-weight:700;font-size:15px;letter-spacing:-.4px}
.logo-host{font-size:11px;color:var(--muted);font-family:var(--mono);margin-top:1px}
.h-right{display:flex;align-items:center;gap:12px}
.updated{font-size:11px;color:var(--muted);font-family:var(--mono)}
.btn{background:var(--card);border:1px solid var(--border2);color:var(--muted);padding:6px 13px;border-radius:6px;font-size:12px;cursor:pointer;transition:all .15s;font-family:var(--font)}
.btn:hover{background:var(--accent-d);border-color:var(--accent);color:var(--accent)}
main{padding:28px 24px 80px;max-width:1320px;margin:0 auto}
/* stats */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:36px}
@media(max-width:700px){.stats{grid-template-columns:repeat(2,1fr)}}
.sc{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px}
.sc-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);margin-bottom:5px}
.sc-value{font-size:22px;font-weight:600;font-family:var(--mono);letter-spacing:-.5px}
.sc-sub{font-size:11px;color:var(--muted);margin-top:3px}
.bar{height:3px;background:var(--border);border-radius:2px;margin-top:9px;overflow:hidden}
.bar-fill{height:100%;border-radius:2px;transition:width .6s ease}
/* section */
.sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.sec-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)}
.sec-count{font-size:11px;font-family:var(--mono);color:var(--subtle);background:var(--card);border:1px solid var(--border);padding:2px 8px;border-radius:4px}
/* repos */
.repos{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:40px}
@media(max-width:1100px){.repos{grid-template-columns:repeat(2,1fr)}}
@media(max-width:640px){.repos{grid-template-columns:1fr}}
.rc{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:11px;transition:border-color .2s,transform .15s}
.rc:hover{border-color:var(--border2);transform:translateY(-1px)}
.rc-hd{display:flex;align-items:flex-start;justify-content:space-between;gap:8px}
.rc-name{font-weight:600;font-size:14px;font-family:var(--mono);letter-spacing:-.3px}
.badges{display:flex;align-items:center;gap:5px;flex-shrink:0}
.badge{font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:.3px}
.b-fresh{background:var(--green-d);color:var(--green);border:1px solid rgba(52,211,153,.2)}
.b-stale{background:var(--amber-d);color:var(--amber);border:1px solid rgba(251,191,36,.2)}
.b-old{background:var(--red-d);color:var(--red);border:1px solid rgba(248,113,113,.2)}
.b-none{background:var(--gray-d);color:var(--gray);border:1px solid rgba(75,85,99,.2)}
.b-claude{background:var(--accent-d);color:var(--accent);border:1px solid rgba(124,90,240,.2)}
.b-codex{background:rgba(14,165,233,.1);color:#38bdf8;border:1px solid rgba(14,165,233,.2)}
.rc-goal{font-size:13px;color:var(--text);line-height:1.55;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.rc-status{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:6px}
.dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.steps{display:flex;flex-direction:column;gap:4px}
.step{font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:flex-start}
.step-n{font-family:var(--mono);font-size:10px;color:var(--subtle);padding-top:1px;flex-shrink:0}
.rc-ft{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);margin-top:auto}
.rc-age{font-size:11px;color:var(--muted);font-family:var(--mono)}
.btn-copy{font-size:11px;padding:4px 10px;border-radius:5px;border:1px solid var(--border2);background:transparent;color:var(--muted);cursor:pointer;transition:all .15s;font-family:var(--font)}
.btn-copy:hover{background:var(--accent-d);border-color:var(--accent);color:var(--accent)}
.btn-copy.ok{background:var(--green-d);border-color:var(--green);color:var(--green)}
/* sessions */
.slist{display:flex;flex-direction:column;gap:8px}
.si{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 16px;display:flex;align-items:center;gap:12px;transition:border-color .15s}
.si:hover{border-color:var(--border2)}
.si-tool{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;padding:2px 7px;border-radius:4px;flex-shrink:0}
.si-tc{background:var(--accent-d);color:var(--accent)}
.si-tx{background:rgba(14,165,233,.1);color:#38bdf8}
.si-info{flex:1;min-width:0}
.si-repo{font-size:12px;font-weight:500;font-family:var(--mono)}
.si-hl{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.si-meta{display:flex;align-items:center;gap:8px;flex-shrink:0}
.si-age{font-size:11px;color:var(--subtle);font-family:var(--mono)}
.tmux{font-size:10px;padding:1px 6px;border-radius:3px;background:var(--green-d);color:var(--green);border:1px solid rgba(52,211,153,.2)}
/* ai usage */
.ai-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:36px}
@media(max-width:1200px){.ai-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.ai-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.ai-grid{grid-template-columns:1fr}}
.ac{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:6px}
.ac-label{font-size:11px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)}
.ac-value{font-size:22px;font-weight:600;font-family:var(--mono);letter-spacing:-.5px}
.ac-reset{font-size:11px;color:var(--muted);margin-top:2px}
.ac-err{font-size:11px;color:var(--red);margin-top:2px}
.ac-row{display:flex;gap:6px;align-items:baseline}
.ac-unit{font-size:13px;color:var(--muted);font-weight:400;font-family:var(--font)}
/* night scheduler */
.sched-table{width:100%;border-collapse:collapse;margin-bottom:36px}
.sched-table th{font-size:10px;text-transform:uppercase;letter-spacing:.5px;color:var(--subtle);font-weight:500;text-align:left;padding:0 12px 8px}
.sched-table th:last-child{text-align:right}
.sched-row{background:var(--card);border-bottom:1px solid var(--border);transition:background .15s}
.sched-row:first-of-type td:first-child{border-radius:10px 0 0 0}
.sched-row:first-of-type td:last-child{border-radius:0 10px 0 0}
.sched-row:last-of-type td:first-child{border-radius:0 0 0 10px}
.sched-row:last-of-type td:last-child{border-radius:0 0 10px 0}
.sched-row:last-of-type{border-bottom:none}
.sched-row:hover{background:var(--card2)}
.sched-row td{padding:12px 12px;font-size:13px;vertical-align:middle}
.sched-status{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.4px;padding:3px 8px;border-radius:5px}
.sched-ok{background:var(--green-d);color:var(--green);border:1px solid rgba(52,211,153,.2)}
.sched-fail{background:var(--red-d);color:var(--red);border:1px solid rgba(248,113,113,.2)}
.sched-timeout{background:var(--amber-d);color:var(--amber);border:1px solid rgba(251,191,36,.2)}
.sched-never{background:var(--gray-d);color:var(--gray);border:1px solid rgba(75,85,99,.2)}
.sched-name{font-weight:500;color:var(--text)}
.sched-meta{font-size:11px;color:var(--subtle);font-family:var(--mono);margin-top:2px}
.sched-dur{font-size:12px;font-family:var(--mono);color:var(--muted);text-align:right}
.sched-err-row{background:var(--card)}
.sched-err-row td{padding:0 12px 10px;border-bottom:1px solid var(--border)}
.sched-err-row:last-of-type td{border-bottom:none}
.sched-err{font-size:11px;font-family:var(--mono);color:var(--red);background:var(--red-d);border:1px solid rgba(248,113,113,.2);border-radius:5px;padding:6px 10px;line-height:1.5;word-break:break-all}
/* loading */
.loading{display:flex;align-items:center;justify-content:center;padding:60px;color:var(--muted);font-size:13px;gap:10px}
.spin{width:16px;height:16px;border:2px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.fade{animation:fade .3s ease}
@keyframes fade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
.empty{color:var(--subtle);font-size:13px;padding:24px;text-align:center;border:1px dashed var(--border);border-radius:8px}
/* nr health */
.nr-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:36px}
@media(max-width:900px){.nr-grid{grid-template-columns:repeat(2,1fr)}}
@media(max-width:500px){.nr-grid{grid-template-columns:1fr}}
.nr-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;align-items:center;gap:12px}
.nr-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.nr-name{font-size:13px;font-weight:500;color:var(--text)}
.nr-sub{font-size:11px;color:var(--muted);margin-top:2px}
.nr-err{font-size:11px;color:var(--muted);padding:12px 0}
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
      <button class="btn" onclick="refresh()">↻ Refresh</button>
    </div>
  </div>
</header>
<main>
  <div id="stats"><div class="loading"><div class="spin"></div>Loading...</div></div>
  <div id="aiusage"></div>
  <div id="nrhealth"></div>
  <div id="scheduler"></div>
  <div id="repos"></div>
  <div id="sessions"></div>
</main>
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
const fc={fresh:'b-fresh',stale:'b-stale',old:'b-old',none:'b-none'};
const fl={fresh:'fresh',stale:'stale',old:'old',none:'no handoff'};
const fco={fresh:'var(--green)',stale:'var(--amber)',old:'var(--red)',none:'var(--gray)'};
function toolBadge(t){
  if(!t||t==='Unknown')return'';
  const c=t.toLowerCase().includes('codex')?'b-codex':'b-claude';
  const l=t.toLowerCase().includes('codex')?'Codex':'Claude';
  return'<span class="badge '+c+'">'+l+'</span>';
}
function renderStats(m,mc){
  const cpu=Math.min(100,Math.round((mc.loadAvg1/mc.cpuCount)*100));
  const cc=cpu>80?'var(--red)':cpu>50?'var(--amber)':'var(--accent)';
  const mc2=mc.memPercent>85?'var(--red)':mc.memPercent>60?'var(--amber)':'var(--accent)';
  return'<div class="stats fade">'
    +sc('CPU Load',mc.loadAvg1.toFixed(2),mc.cpuCount+'-core · '+cpu+'% avg',cpu,cc)
    +sc('Memory',mc.memUsedGB+' GB',mc.memTotalGB+' GB total · '+mc.memPercent+'%',mc.memPercent,mc2)
    +sp('Uptime',uptime(m.probotUptimeSeconds),'ProBot daemon')
    +sp('Machine',m.hostname,'local')
    +'</div>';
}
function sc(l,v,s,p,c){
  return'<div class="sc"><div class="sc-label">'+l+'</div><div class="sc-value">'+v+'</div><div class="sc-sub">'+s+'</div>'
    +'<div class="bar"><div class="bar-fill" style="width:'+p+'%;background:'+c+'"></div></div></div>';
}
function sp(l,v,s){
  return'<div class="sc"><div class="sc-label">'+l+'</div><div class="sc-value">'+esc(v)+'</div><div class="sc-sub">'+s+'</div></div>';
}
function repoCard(r){
  const h=r.handoff;
  const steps=(h.nextSteps||[]).slice(0,2).map((s,i)=>
    '<div class="step"><span class="step-n">'+(i+1)+'.</span><span>'+esc(s)+'</span></div>'
  ).join('');
  return'<div class="rc">'
    +'<div class="rc-hd"><div class="rc-name">'+esc(r.name)+'</div>'
    +'<div class="badges">'+toolBadge(h.tool)+'<span class="badge '+fc[h.freshness]+'">'+fl[h.freshness]+'</span></div></div>'
    +(h.exists
      ?'<div class="rc-goal">'+esc(h.goal)+'</div>'
       +'<div class="rc-status"><div class="dot" style="background:'+fco[h.freshness]+'"></div><span>'+esc(h.status)+'</span></div>'
       +(steps?'<div class="steps">'+steps+'</div>':'')
      :'<div class="rc-status"><span style="color:var(--subtle)">No handoff yet</span></div>'
    )
    +'<div class="rc-ft"><span class="rc-age">'+age(h.updatedAt)+'</span>'
    +(h.exists?'<button class="btn-copy" onclick="copyResume(this,'+JSON.stringify(h.resumePrompt)+')">Copy resume</button>':'')
    +'</div></div>';
}
function fmtReset(iso){
  if(!iso)return'No data yet';
  const d=new Date(iso);
  const now=new Date();
  const diffMs=d-now;
  if(diffMs<=0)return'Resetting…';
  const diffM=Math.floor(diffMs/60000);
  const timeStr=diffM<60?'in '+diffM+'m':'in '+Math.floor(diffM/60)+'h '+String(diffM%60).padStart(2,'0')+'m';
  const sameDay=d.toDateString()===now.toDateString();
  const clockStr=d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const dateStr=sameDay?'today':d.toLocaleDateString([],{month:'short',day:'numeric'});
  return'Resets '+dateStr+' at '+clockStr+' ('+timeStr+')';
}
function pctColor(pct){
  return pct>50?'var(--green)':pct>20?'var(--amber)':'var(--red)';
}
function pctBar(pct,color){
  return'<div class="bar" style="margin-top:10px"><div class="bar-fill" style="width:'+pct+'%;background:'+color+'"></div></div>';
}
function codexCard(label,w){
  if(!w.resetsAt)return'<div class="ac"><div class="ac-label">'+label+'</div>'
    +'<div class="ac-value" style="font-size:15px;color:var(--muted)">No data</div>'
    +'<div class="ac-reset">Start a Codex session first</div></div>';
  const c=pctColor(w.remainingPercent);
  return'<div class="ac">'
    +'<div class="ac-label">'+label+'</div>'
    +'<div class="ac-row"><div class="ac-value" style="color:'+c+'">'+w.remainingPercent+'%</div>'
    +'<div class="ac-unit">remaining</div></div>'
    +pctBar(w.remainingPercent,c)
    +'<div class="ac-reset" style="margin-top:8px">'+fmtReset(w.resetsAt)+'</div>'
    +'</div>';
}
function renderAIUsage(codex){
  const asOf=codex.asOf?'<div style="font-size:10px;color:var(--subtle);margin-top:4px">as of '+age(codex.asOf)+'</div>':'';
  return'<div class="sec-hd" style="margin-bottom:16px"><span class="sec-title">AI Usage</span>'
    +'<span class="sec-count" style="font-size:10px">'+asOf+'</span></div>'
    +'<div class="ai-grid fade">'
    +codexCard('Codex · 5h Window',codex.fiveHour)
    +codexCard('Codex · 7d Window',codex.sevenDay)
    +'</div>';
}
function nrDot(item){
  if(typeof item.online==='boolean')return item.online?'var(--green)':'var(--red)';
  if(item.reporting===false)return'var(--red)';
  return'var(--gray)';
}
function nrLabel(item){
  const parts=[];
  if(typeof item.online==='boolean'){
    parts.push(item.online?'online':'offline');
  }else{
    parts.push('unknown');
  }
  if(item.lastError&&item.online===false)parts.push(item.lastError);
  else if(item.alertSeverity==='CRITICAL'&&item.online!==false)parts.push('critical alert');
  else if(item.alertSeverity==='WARNING'&&item.online!==false)parts.push('warning alert');
  if(item.alertConfigured===false)parts.push('no alert policy');
  return parts.join(' · ');
}
function renderNRHealth(nr){
  if(nr.error&&!nr.hosts.length&&!nr.synthetics.length){
    return'<div class="nr-err">New Relic: '+esc(nr.error)+'</div>';
  }
  const hostCards=nr.hosts.map(h=>{
    const dot=nrDot(h);
    const lbl=nrLabel(h);
    return'<div class="nr-card"><div class="nr-dot" style="background:'+dot+'"></div>'
      +'<div><div class="nr-name">'+esc(h.name)+'</div><div class="nr-sub">'+lbl+'</div></div></div>';
  }).join('');
  const synCards=nr.synthetics.map(s=>{
    const dot=nrDot(s);
    const lbl=nrLabel(s);
    return'<div class="nr-card"><div class="nr-dot" style="background:'+dot+'"></div>'
      +'<div><div class="nr-name">'+esc(s.name)+'</div><div class="nr-sub">'+lbl+'</div></div></div>';
  }).join('');
  const hostSection=hostCards
    ?'<div class="sec-hd" style="margin-bottom:12px"><span class="sec-title">Servers</span><span class="sec-count">'+nr.hosts.length+'</span></div>'
     +'<div class="nr-grid fade">'+hostCards+'</div>':''
  const synSection=synCards
    ?'<div class="sec-hd" style="margin-bottom:12px"><span class="sec-title">Uptime Checks</span><span class="sec-count">'+nr.synthetics.length+'</span></div>'
     +'<div class="nr-grid fade">'+synCards+'</div>':''
  return'<div class="sec-hd" style="margin-bottom:16px"><span class="sec-title">New Relic</span></div>'
    +hostSection+synSection;
}
function copyResume(btn,p){
  navigator.clipboard.writeText(p).then(()=>{
    const o=btn.textContent;btn.textContent='✓ Copied';btn.classList.add('ok');
    setTimeout(()=>{btn.textContent=o;btn.classList.remove('ok');},2000);
  }).catch(()=>{btn.textContent='Failed';setTimeout(()=>{btn.textContent='Copy resume';},2000);});
}
function sessionItem(s){
  const tc=s.tool==='claude'?'si-tc':'si-tx';
  return'<div class="si"><span class="si-tool '+tc+'">'+s.tool+'</span>'
    +'<div class="si-info"><div class="si-repo">'+esc(s.projectLabel)+'</div>'
    +'<div class="si-hl">'+esc(s.headline)+'</div></div>'
    +'<div class="si-meta"><span class="si-age">'+s.age+'</span>'
    +(s.activeInTmux?'<span class="tmux">tmux</span>':'')
    +'</div></div>';
}
function renderScheduler(jobs){
  function statusBadge(j){
    if(j.status==='success')return'<span class="sched-status sched-ok">✓ success</span>';
    if(j.status==='timeout')return'<span class="sched-status sched-timeout">⏱ timeout</span>';
    if(j.status==='failed')return'<span class="sched-status sched-fail">✗ failed'+(j.exitCode!==null?' ('+j.exitCode+')':\'\')+'</span>';
    return'<span class="sched-status sched-never">— never run</span>';
  }
  function fmtDur(s){
    if(s===null)return'—';
    if(s<60)return s+'s';
    if(s<3600)return Math.floor(s/60)+'m '+( s%60)+'s';
    return Math.floor(s/3600)+'h '+Math.floor((s%3600)/60)+'m';
  }
  const rows=jobs.map(j=>{
    const errRow=(j.status==='failed'||j.status==='timeout')&&j.errorMessage
      ?'<tr class="sched-err-row"><td colspan="5"><div class="sched-err">'+esc(j.errorMessage)+'</div></td></tr>'
      :'';
    return'<tr class="sched-row">'
      +'<td><div class="sched-name">'+esc(j.label)+'</div></td>'
      +'<td>'+statusBadge(j)+'</td>'
      +'<td><div class="sched-meta">'+(j.lastRunAt?age(j.lastRunAt):'—')+'</div></td>'
      +'<td><div class="sched-meta">'+fmtReset(j.nextRunAt)+'</div></td>'
      +'<td class="sched-dur">'+fmtDur(j.durationSeconds)+'</td>'
      +'</tr>'+errRow;
  }).join('');
  const ok=jobs.filter(j=>j.status==='success').length;
  return'<div class="sec-hd" style="margin-bottom:12px"><span class="sec-title">Night Scheduler</span>'
    +'<span class="sec-count">'+ok+'/'+jobs.length+'</span></div>'
    +'<div class="fade"><table class="sched-table">'
    +'<thead><tr><th>Job</th><th>Status</th><th>Last run</th><th>Next run</th><th style="text-align:right">Duration</th></tr></thead>'
    +'<tbody>'+rows+'</tbody></table></div>';
}
function render(d){
  _d=d;
  document.getElementById('host').textContent=d.meta.hostname;
  document.getElementById('upd').textContent='updated '+age(d.meta.updatedAt);
  document.getElementById('stats').innerHTML=renderStats(d.meta,d.machine);
  document.getElementById('aiusage').innerHTML=renderAIUsage(d.codexUsage);
  document.getElementById('nrhealth').innerHTML=renderNRHealth(d.nrHealth);
  document.getElementById('scheduler').innerHTML=renderScheduler(d.scheduler||[]);
  const rhtml=d.repos.length===0
    ?'<div class="empty">No repo aliases configured.</div>'
    :'<div class="repos fade">'+d.repos.map(repoCard).join('')+'</div>';
  document.getElementById('repos').innerHTML=
    '<div class="sec-hd"><span class="sec-title">Repositories</span><span class="sec-count">'+d.repos.length+'</span></div>'+rhtml;
  const shtml=d.sessions.length===0
    ?'<div class="empty">No recent sessions found.</div>'
    :'<div class="slist fade">'+d.sessions.map(sessionItem).join('')+'</div>';
  document.getElementById('sessions').innerHTML=
    '<div class="sec-hd" style="margin-top:36px"><span class="sec-title">Recent Sessions</span><span class="sec-count">'+d.sessions.length+'</span></div>'+shtml;
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
  const b=document.querySelector('.btn');b.textContent='↻ Loading…';
  fetchData().finally(()=>{b.textContent='↻ Refresh';});
}
setInterval(fetchData,30000);
setInterval(()=>{if(_d)document.getElementById('upd').textContent='updated '+age(_d.meta.updatedAt);},60000);
fetchData();
</script>
</body>
</html>`;

// ─── Server ──────────────────────────────────────────────────────────────────

export function createDashboardServer(app: AppContext): http.Server {
  return http.createServer(async (req, res) => {
    const url = req.url ?? "/";

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

    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(HTML);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });
}
