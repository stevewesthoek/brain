import fs from 'node:fs';
import os from 'node:os';
import type {
  BrainCoreCredentialListResponse,
  BrainCoreCredentialSetResult,
  BrainCoreCredentialCatalogResponse,
  BrainCoreInfraCredentialGroup,
  BrainCoreCredentialRevokeResult,
} from '../types/api.js';

type CredType = 'app_id' | 'secret' | 'token' | 'board_id' | 'api_key' | 'url' | 'other';
type StorageBackend = 'env_file' | 'plist' | 'keychain';

interface SchemaEntry {
  key: string;
  label: string;
  type: CredType;
  required: boolean;
  hint?: string;
  /** Where the value physically lives — 'env_file' is the default */
  storage?: StorageBackend;
  /** Human-readable write instruction shown in the UI when storage !== 'env_file' */
  writeInstructions?: string;
  /** OAuth callback instructions (shown next to a connect button) */
  oauthInstructions?: string;
}

interface PlatformSchema {
  platformId: string;
  platformName: string;
  /** 'social' = project-level social media account, 'infra' = infrastructure service */
  platformCategory: 'social' | 'infra';
  credentials: SchemaEntry[];
}

// ── Project-level .env schemas ─────────────────────────────────────────────

const PROJECT_ENV_MAP: Record<string, string> = {
  'says-the-bible': expandHome('~/Repos/prochattools/web/says-the-bible/.env.pipeline.production'),
};

const CREDENTIAL_SCHEMA: Record<string, PlatformSchema[]> = {
  'says-the-bible': [
    {
      platformId: 'youtube',
      platformName: 'YouTube',
      platformCategory: 'social',
      credentials: [
        { key: 'YOUTUBE_CLIENT_ID',     label: 'OAuth Client ID',     type: 'app_id', required: true,
          hint: 'From Google Cloud Console → Credentials → OAuth 2.0 Client IDs' },
        { key: 'YOUTUBE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'secret', required: true },
        { key: 'YOUTUBE_TOKEN_PATH',    label: 'Token file path',     type: 'other',  required: false,
          hint: 'Defaults to ./data/youtube-token.json' },
      ],
    },
    {
      platformId: 'pinterest',
      platformName: 'Pinterest',
      platformCategory: 'social',
      credentials: [
        { key: 'PINTEREST_APP_ID',       label: 'App ID',              type: 'app_id',   required: true,  hint: 'Register at developers.pinterest.com' },
        { key: 'PINTEREST_APP_SECRET',   label: 'App Secret',          type: 'secret',   required: true },
        { key: 'PINTEREST_BOARD_PROBLEM',label: 'Board ID: Problem',   type: 'board_id', required: false, hint: 'Get from pinterest.com/{user}/{board}/{id}/' },
        { key: 'PINTEREST_BOARD_SOLUTION',label:'Board ID: Solution',  type: 'board_id', required: false },
        { key: 'PINTEREST_BOARD_STORY',  label: 'Board ID: Story',     type: 'board_id', required: false },
        { key: 'PINTEREST_TOKEN_PATH',   label: 'Token file path',     type: 'other',    required: false, hint: 'Defaults to ./data/pinterest-token.json' },
      ],
    },
    {
      platformId: 'facebook',
      platformName: 'Facebook',
      platformCategory: 'social',
      credentials: [
        { key: 'FACEBOOK_PAGE_ID',                    label: 'Page ID',                  type: 'app_id', required: false },
        { key: 'FACEBOOK_PAGE_ACCESS_TOKEN',          label: 'Page Access Token',        type: 'token',  required: false },
        { key: 'FACEBOOK_APP_ID',                     label: 'App ID',                   type: 'app_id', required: false },
        { key: 'FACEBOOK_APP_SECRET',                 label: 'App Secret',               type: 'secret', required: false },
        { key: 'N8N_FACEBOOK_AUTOPUBLISH_WEBHOOK_URL',label: 'Autopublish Webhook URL',  type: 'url',    required: false },
        { key: 'N8N_FACEBOOK_AUTOPUBLISH_SECRET',     label: 'Autopublish Secret',       type: 'secret', required: false },
      ],
    },
    {
      platformId: 'azure',
      platformName: 'Azure TTS',
      platformCategory: 'infra',
      credentials: [
        { key: 'AZURE_SPEECH_KEY',    label: 'Speech API Key', type: 'api_key', required: true },
        { key: 'AZURE_SPEECH_REGION', label: 'Region',         type: 'other',   required: true, hint: 'e.g. eastus' },
      ],
    },
  ],
};

// ── Infrastructure credential schema ──────────────────────────────────────
// These are global infrastructure credentials, not per-project .env files.
// Storage is 'plist' (worker plist XML) or 'keychain' (macOS keychain).
// The UI shows read-only status + instructions for manual update.

const INFRA_SCHEMA: PlatformSchema[] = [
  {
    platformId: 'cloudflare',
    platformName: 'Cloudflare',
    platformCategory: 'infra',
    credentials: [
      {
        key: 'CF_ACCESS_CLIENT_ID',
        label: 'CF Access Client ID',
        type: 'app_id',
        required: true,
        storage: 'plist',
        hint: 'Zero Trust → Access → Service Auth → Service Tokens → Create Token (name: video-orchestrator-worker)',
        writeInstructions: 'Set in ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist under CF_ACCESS_CLIENT_ID, then reload with launchctl.',
      },
      {
        key: 'CF_ACCESS_CLIENT_SECRET',
        label: 'CF Access Client Secret',
        type: 'secret',
        required: true,
        storage: 'plist',
        writeInstructions: 'Set in ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist under CF_ACCESS_CLIENT_SECRET, then reload with launchctl.',
      },
    ],
  },
  {
    platformId: 'n8n',
    platformName: 'n8n',
    platformCategory: 'infra',
    credentials: [
      {
        key: 'VO_N8N_WEBHOOK_URL',
        label: 'Webhook URL',
        type: 'url',
        required: true,
        storage: 'plist',
        hint: 'Base URL of the VO webhook endpoint on n8n (e.g. https://n8n.prochat.tools/webhook/...)',
        writeInstructions: 'Set in ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist under VO_N8N_WEBHOOK_URL.',
      },
    ],
  },
  {
    platformId: 'youtube-worker',
    platformName: 'YouTube (VO Worker)',
    platformCategory: 'infra',
    credentials: [
      {
        key: 'yt-oauth-client-@says-the-bible',
        label: 'OAuth Client (@says-the-bible)',
        type: 'secret',
        required: true,
        storage: 'keychain',
        hint: 'macOS keychain: service=video-orchestrator, account=yt-oauth-client-@says-the-bible',
        oauthInstructions: 'Run: youtube_uploader.py auth-url --account @says-the-bible\nVisit the URL, authorize access, then run:\nyoutube_uploader.py auth-exchange --account @says-the-bible --code <CODE>',
        writeInstructions: 'Use youtube_uploader.py auth-url and auth-exchange commands to add OAuth token to keychain.',
      },
    ],
  },
];

// ── Plist reader (reads worker plist for status, never writes) ─────────────

function readPlistEnv(): Record<string, string> {
  const plistPath = expandHome('~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist');
  if (!fs.existsSync(plistPath)) return {};
  try {
    const xml = fs.readFileSync(plistPath, 'utf8');
    const env: Record<string, string> = {};
    const envMatch = /<key>EnvironmentVariables<\/key>\s*<dict>([\s\S]*?)<\/dict>/.exec(xml);
    if (!envMatch) return {};
    const block = envMatch[1] ?? '';
    const pairs = [...block.matchAll(/<key>([^<]+)<\/key>\s*<string>([^<]*)<\/string>/g)];
    for (const [, k, v] of pairs) {
      if (k) env[k] = v ?? '';
    }
    return env;
  } catch {
    return {};
  }
}

function isPlaceholderValue(val: string): boolean {
  if (!val) return false;
  return /^<.+>$/.test(val) || /^(example|placeholder|your[-_]|changeme|todo)/i.test(val) || val.includes('PLACEHOLDER') || val.includes('_example') || val.includes('_test');
}

// ── Keychain reader (no -g flag — account names only, no passwords) ────────

function getKeychainAccounts(): string[] {
  try {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    const out = execFileSync('security', ['find-generic-password', '-s', 'video-orchestrator'], {
      encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 5000,
    }) as string;
    const accounts: string[] = [];
    for (const line of out.split('\n')) {
      const m = /"acct"<blob>="(yt-oauth-client-[^"]+)"/.exec(line) ?? /acct.*"(yt-oauth-client-[^"]+)"/.exec(line);
      if (m?.[1]) accounts.push(m[1]);
    }
    return accounts;
  } catch {
    return [];
  }
}

// ── Infra credential status ────────────────────────────────────────────────

function buildInfraGroups(): BrainCoreInfraCredentialGroup[] {
  const plistEnv = readPlistEnv();
  const keychainAccounts = getKeychainAccounts();

  return INFRA_SCHEMA.map((platform) => {
    let allRequiredSet = true;
    const credentials = platform.credentials.map((entry) => {
      let isSet = false;
      let hasPlaceholder = false;

      if (entry.storage === 'plist') {
        const val = plistEnv[entry.key] ?? '';
        isSet = val.length > 0 && !isPlaceholderValue(val);
        hasPlaceholder = val.length > 0 && isPlaceholderValue(val);
      } else if (entry.storage === 'keychain') {
        isSet = keychainAccounts.includes(entry.key);
        hasPlaceholder = false;
      }

      if (entry.required && (!isSet || hasPlaceholder)) allRequiredSet = false;

      return {
        key: entry.key,
        label: entry.label,
        type: entry.type,
        required: entry.required,
        storage: entry.storage ?? 'env_file',
        isSet,
        hasPlaceholder,
        ...(entry.hint !== undefined ? { hint: entry.hint } : {}),
        ...(entry.writeInstructions !== undefined ? { writeInstructions: entry.writeInstructions } : {}),
        ...(entry.oauthInstructions !== undefined ? { oauthInstructions: entry.oauthInstructions } : {}),
      };
    });

    return {
      platformId: platform.platformId,
      platformName: platform.platformName,
      credentials,
      allRequiredSet,
    };
  });
}

// ── Exports ────────────────────────────────────────────────────────────────

export function getCredentialCatalog(): BrainCoreCredentialCatalogResponse {
  const infraGroups = buildInfraGroups();
  const projects: BrainCoreCredentialCatalogResponse['projects'] = Object.entries(CREDENTIAL_SCHEMA).map(([projectId, platforms]) => {
    return {
      projectId,
      displayName: PROJECT_DISPLAY_NAMES[projectId] ?? projectId,
      envFilePath: PROJECT_ENV_MAP[projectId] ?? '',
      platforms: platforms.map((platform) => {
        const envMap = PROJECT_ENV_MAP[projectId] ? parseEnvFile(PROJECT_ENV_MAP[projectId] ?? '') : new Map<string, string>();
        let allRequiredSet = true;
        const credentials = platform.credentials.map((entry) => {
          const rawVal = envMap.get(entry.key) ?? '';
          const isSet = rawVal.length > 0;
          const hasPlaceholder = isPlaceholder(rawVal);
          if (entry.required && (!isSet || hasPlaceholder)) allRequiredSet = false;
          return {
            key: entry.key,
            label: entry.label,
            type: entry.type,
            required: entry.required,
            storage: 'env_file' as StorageBackend,
            isSet,
            hasPlaceholder,
            ...(entry.hint !== undefined ? { hint: entry.hint } : {}),
          };
        });
        return {
          platformId: platform.platformId,
          platformName: platform.platformName,
          platformCategory: platform.platformCategory,
          credentials,
          allRequiredSet,
        };
      }),
    };
  });

  return { projects, infra: infraGroups };
}

const PROJECT_DISPLAY_NAMES: Record<string, string> = {
  'says-the-bible': 'Says the Bible',
};

export function listProjectCredentials(projectId: string): BrainCoreCredentialListResponse {
  const envFilePath = PROJECT_ENV_MAP[projectId] ?? '';
  const schema = CREDENTIAL_SCHEMA[projectId] ?? [];
  const envMap = envFilePath ? parseEnvFile(envFilePath) : new Map<string, string>();

  let totalRequired = 0;
  let totalRequiredSet = 0;
  let totalOptional = 0;
  let totalOptionalSet = 0;

  const platforms = schema.map((platform) => {
    const credentials = platform.credentials.map((entry) => {
      const rawVal = envMap.get(entry.key) ?? '';
      const isSet = rawVal.length > 0;
      const hasPlaceholder = isPlaceholder(rawVal);
      if (entry.required) {
        totalRequired++;
        if (isSet && !hasPlaceholder) totalRequiredSet++;
      } else {
        totalOptional++;
        if (isSet && !hasPlaceholder) totalOptionalSet++;
      }
      return { key: entry.key, label: entry.label, type: entry.type, required: entry.required, ...(entry.hint !== undefined ? { hint: entry.hint } : {}), isSet, hasPlaceholder };
    });
    const allRequiredSet = credentials.filter(c => c.required).every(c => c.isSet && !c.hasPlaceholder);
    return { platformId: platform.platformId, platformName: platform.platformName, credentials, allRequiredSet };
  });

  return { projectId, envFilePath, platforms, summary: { totalRequired, totalRequiredSet, totalOptional, totalOptionalSet } };
}

const ALLOWED_KEYS_BY_PROJECT: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(CREDENTIAL_SCHEMA).map(([pid, platforms]) => [
    pid,
    new Set(platforms.flatMap(p => p.credentials.map(c => c.key))),
  ])
);

export function setProjectCredential(projectId: string, key: string, value: string): BrainCoreCredentialSetResult {
  const allowed = ALLOWED_KEYS_BY_PROJECT[projectId];
  if (!allowed || !allowed.has(key)) {
    return { ok: false, projectId, key, error: 'key_not_allowed' };
  }

  const envFilePath = PROJECT_ENV_MAP[projectId];
  if (!envFilePath) {
    return { ok: false, projectId, key, error: 'project_not_found' };
  }

  let content = fs.existsSync(envFilePath) ? fs.readFileSync(envFilePath, 'utf8') : '';
  const lines = content.split('\n');
  const pattern = new RegExp(`^(${key})=.*$`);
  const idx = lines.findIndex(l => pattern.test(l));

  let action: 'created' | 'updated';
  if (idx !== -1) {
    lines[idx] = `${key}=${value}`;
    action = 'updated';
    content = lines.join('\n');
  } else {
    content = content.endsWith('\n') || content === '' ? content + `${key}=${value}\n` : content + `\n${key}=${value}\n`;
    action = 'created';
  }

  fs.writeFileSync(envFilePath, content);
  return { ok: true, projectId, key, action };
}

export function revokeProjectCredential(projectId: string, key: string): BrainCoreCredentialRevokeResult {
  const allowed = ALLOWED_KEYS_BY_PROJECT[projectId];
  if (!allowed || !allowed.has(key)) {
    return { ok: false, projectId, key, error: 'key_not_allowed' };
  }

  const envFilePath = PROJECT_ENV_MAP[projectId];
  if (!envFilePath) {
    return { ok: false, projectId, key, error: 'project_not_found' };
  }

  if (!fs.existsSync(envFilePath)) {
    return { ok: false, projectId, key, error: 'env_file_not_found' };
  }

  const lines = fs.readFileSync(envFilePath, 'utf8').split('\n');
  const pattern = new RegExp(`^${key}=.*$`);
  const filtered = lines.filter(l => !pattern.test(l));

  if (filtered.length === lines.length) {
    return { ok: false, projectId, key, error: 'key_not_found_in_file' };
  }

  fs.writeFileSync(envFilePath, filtered.join('\n'));
  return { ok: true, projectId, key, action: 'revoked' };
}

// ── Private helpers ────────────────────────────────────────────────────────

function expandHome(p: string): string {
  return p.startsWith('~/') ? os.homedir() + p.slice(1) : p;
}

function parseEnvFile(filePath: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!fs.existsSync(filePath)) return map;
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    map.set(key, val);
  }
  return map;
}

function isPlaceholder(val: string): boolean {
  if (!val) return false;
  return /^<.+>$/.test(val) || /^(example|placeholder|your[-_]|changeme|todo)/i.test(val) || val.includes('_example') || val.includes('_test');
}
