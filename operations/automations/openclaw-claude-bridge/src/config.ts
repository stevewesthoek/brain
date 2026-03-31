import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function opt(key: string, fallback: string): string {
  return process.env[key] || fallback;
}

function optBool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v.toLowerCase() === 'true' || v === '1';
}

function optInt(key: string, fallback: number): number {
  const v = process.env[key];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  return isNaN(n) ? fallback : n;
}

export const config = {
  bridge: {
    host: opt('BRIDGE_HOST', '100.86.124.66'),
    port: optInt('BRIDGE_PORT', 3457),
    secret: opt('BRIDGE_SECRET', ''),
    allowedIps: opt('ALLOWED_IPS', '100.101.212.108')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean),
  },
  openclaw: {
    gatewayUrl: opt('OPENCLAW_GATEWAY_URL', 'http://100.101.212.108:18789'),
    agentId: opt('OPENCLAW_AGENT_ID', 'main'),
    bearerToken: opt('OPENCLAW_BEARER_TOKEN', ''),
  },
  repos: {
    root: opt('REPOS_ROOT', '/Users/Office/Repos'),
    allowlistPath: path.resolve(__dirname, '..', 'repos.allowlist.json'),
  },
  session: {
    outputTruncateChars: optInt('OUTPUT_TRUNCATE_CHARS', 4000),
    pollIntervalMs: optInt('POLL_INTERVAL_MS', 2000),
    pollMaxAttempts: optInt('POLL_MAX_ATTEMPTS', 60),
    stabilityRequiredPolls: optInt('STABILITY_REQUIRED_POLLS', 3),
    claudeStartupWaitMs: optInt('CLAUDE_STARTUP_WAIT_MS', 4000),
  },
  shell: {
    allowExec: optBool('ALLOW_SHELL_EXEC', false),
  },
  skills: {
    activeDir: opt('SKILLS_DIR', '/Users/Office/Repos/stevewesthoek/brain/ai/skills/active'),
  },
  log: {
    level: opt('LOG_LEVEL', 'info'),
  },
} as const;
