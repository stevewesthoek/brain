import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
      { key: 'CF_ACCESS_CLIENT_ID',     label: 'CF Access Client ID',     type: 'app_id', required: true,  storage: 'plist' },
      { key: 'CF_ACCESS_CLIENT_SECRET', label: 'CF Access Client Secret', type: 'secret', required: true,  storage: 'plist' },
    ],
  },
  {
    platformId: 'n8n',
    platformName: 'n8n',
    platformCategory: 'infra',
    credentials: [
      { key: 'VO_N8N_WEBHOOK_URL', label: 'Webhook URL', type: 'url', required: true, storage: 'plist',
        hint: 'e.g. https://n8n.prochat.tools/webhook/...' },
    ],
  },
  {
    platformId: 'youtube-worker',
    platformName: 'YouTube (VO Worker)',
    platformCategory: 'infra',
    credentials: [
      { key: 'yt-oauth-client-@says-the-bible', label: '@says-the-bible', type: 'secret', required: true, storage: 'keychain' },
    ],
  },
];

// ── Available platform templates (pick list for new projects) ─────────────

const AVAILABLE_PLATFORMS: Record<string, PlatformSchema> = {
  youtube: {
    platformId: 'youtube', platformName: 'YouTube', platformCategory: 'social',
    credentials: [
      { key: 'YOUTUBE_CLIENT_ID',     label: 'OAuth Client ID',     type: 'app_id', required: true,  hint: 'From Google Cloud Console → Credentials → OAuth 2.0 Client IDs' },
      { key: 'YOUTUBE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'secret', required: true },
      { key: 'YOUTUBE_TOKEN_PATH',    label: 'Token file path',     type: 'other',  required: false, hint: 'Defaults to ./data/youtube-token.json' },
    ],
  },
  pinterest: {
    platformId: 'pinterest', platformName: 'Pinterest', platformCategory: 'social',
    credentials: [
      { key: 'PINTEREST_APP_ID',        label: 'App ID',             type: 'app_id',   required: true,  hint: 'Register at developers.pinterest.com' },
      { key: 'PINTEREST_APP_SECRET',    label: 'App Secret',         type: 'secret',   required: true },
      { key: 'PINTEREST_BOARD_PROBLEM', label: 'Board ID: Problem',  type: 'board_id', required: false },
      { key: 'PINTEREST_BOARD_SOLUTION',label: 'Board ID: Solution', type: 'board_id', required: false },
      { key: 'PINTEREST_BOARD_STORY',   label: 'Board ID: Story',    type: 'board_id', required: false },
      { key: 'PINTEREST_TOKEN_PATH',    label: 'Token file path',    type: 'other',    required: false },
    ],
  },
  facebook: {
    platformId: 'facebook', platformName: 'Facebook', platformCategory: 'social',
    credentials: [
      { key: 'FACEBOOK_PAGE_ID',                    label: 'Page ID',               type: 'app_id', required: false },
      { key: 'FACEBOOK_PAGE_ACCESS_TOKEN',          label: 'Page Access Token',     type: 'token',  required: false },
      { key: 'FACEBOOK_APP_ID',                     label: 'App ID',                type: 'app_id', required: false },
      { key: 'FACEBOOK_APP_SECRET',                 label: 'App Secret',            type: 'secret', required: false },
      { key: 'N8N_FACEBOOK_AUTOPUBLISH_WEBHOOK_URL',label: 'Autopublish Webhook URL',type: 'url',   required: false },
      { key: 'N8N_FACEBOOK_AUTOPUBLISH_SECRET',     label: 'Autopublish Secret',    type: 'secret', required: false },
    ],
  },
  instagram: {
    platformId: 'instagram', platformName: 'Instagram', platformCategory: 'social',
    credentials: [
      { key: 'INSTAGRAM_ACCESS_TOKEN', label: 'Access Token', type: 'token',  required: true },
      { key: 'INSTAGRAM_ACCOUNT_ID',   label: 'Account ID',   type: 'app_id', required: false },
    ],
  },
  tiktok: {
    platformId: 'tiktok', platformName: 'TikTok', platformCategory: 'social',
    credentials: [
      { key: 'TIKTOK_ACCESS_TOKEN', label: 'Access Token', type: 'token',  required: true },
      { key: 'TIKTOK_OPEN_ID',      label: 'Open ID',      type: 'app_id', required: true },
    ],
  },
  linkedin: {
    platformId: 'linkedin', platformName: 'LinkedIn', platformCategory: 'social',
    credentials: [
      { key: 'LINKEDIN_ACCESS_TOKEN',    label: 'Access Token',    type: 'token',  required: true },
      { key: 'LINKEDIN_ORGANIZATION_ID', label: 'Organization ID', type: 'app_id', required: false },
    ],
  },
  twitter: {
    platformId: 'twitter', platformName: 'X / Twitter', platformCategory: 'social',
    credentials: [
      { key: 'TWITTER_API_KEY',               label: 'API Key',             type: 'api_key', required: true },
      { key: 'TWITTER_API_SECRET',            label: 'API Secret',          type: 'secret',  required: true },
      { key: 'TWITTER_ACCESS_TOKEN',          label: 'Access Token',        type: 'token',   required: false },
      { key: 'TWITTER_ACCESS_TOKEN_SECRET',   label: 'Access Token Secret', type: 'secret',  required: false },
    ],
  },
  azure: {
    platformId: 'azure', platformName: 'Azure TTS', platformCategory: 'infra',
    credentials: [
      { key: 'AZURE_SPEECH_KEY',    label: 'Speech API Key', type: 'api_key', required: true },
      { key: 'AZURE_SPEECH_REGION', label: 'Region',         type: 'other',   required: true, hint: 'e.g. eastus' },
    ],
  },
};

export function getAvailablePlatforms(): Array<{ platformId: string; platformName: string; platformCategory: 'social' | 'infra' }> {
  return Object.values(AVAILABLE_PLATFORMS)
    .map(p => ({ platformId: p.platformId, platformName: p.platformName, platformCategory: p.platformCategory }))
    .sort((a, b) => a.platformName.localeCompare(b.platformName));
}

// ── User-registered projects (persisted to ~/.brain-console/credential-projects.json) ──

export interface UserProjectEntry {
  projectId: string;
  displayName: string;
  repoPath: string;
  envFileName: string;
  platforms: string[];
}

const USER_PROJECTS_CONFIG = expandHome('~/.brain-console/credential-projects.json');

function readUserProjects(): UserProjectEntry[] {
  try {
    if (!fs.existsSync(USER_PROJECTS_CONFIG)) return [];
    const raw = fs.readFileSync(USER_PROJECTS_CONFIG, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidUserProjectEntry);
  } catch {
    return [];
  }
}

function isValidUserProjectEntry(e: unknown): e is UserProjectEntry {
  if (!e || typeof e !== 'object') return false;
  const obj = e as Record<string, unknown>;
  return typeof obj['projectId'] === 'string' && typeof obj['displayName'] === 'string'
    && typeof obj['repoPath'] === 'string' && typeof obj['envFileName'] === 'string'
    && Array.isArray(obj['platforms']);
}

export function registerUserProject(entry: UserProjectEntry): { ok: boolean; error?: string } {
  if (!entry.projectId || !entry.displayName || !entry.repoPath || !entry.envFileName || entry.platforms.length === 0) {
    return { ok: false, error: 'invalid_entry' };
  }
  const existing = readUserProjects();
  if (existing.some(e => e.projectId === entry.projectId) || CREDENTIAL_SCHEMA[entry.projectId]) {
    return { ok: false, error: 'duplicate_id' };
  }
  const configDir = expandHome('~/.brain-console');
  if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(USER_PROJECTS_CONFIG, JSON.stringify([...existing, entry], null, 2));
  return { ok: true };
}

export function deleteUserProject(projectId: string): { ok: boolean; error?: string } {
  const existing = readUserProjects();
  const filtered = existing.filter(e => e.projectId !== projectId);
  if (filtered.length === existing.length) return { ok: false, error: 'not_found' };
  fs.writeFileSync(USER_PROJECTS_CONFIG, JSON.stringify(filtered, null, 2));
  return { ok: true };
}

// ── Plist read/write (worker plist EnvironmentVariables) ──────────────────

const WORKER_PLIST_PATH = expandHome('~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist');

// Keys that are allowed to be written via the API (allowlist — never allow arbitrary plist keys)
const PLIST_WRITABLE_KEYS = new Set(['CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET', 'VO_N8N_WEBHOOK_URL']);

function readPlistEnv(): Record<string, string> {
  if (!fs.existsSync(WORKER_PLIST_PATH)) return {};
  try {
    const xml = fs.readFileSync(WORKER_PLIST_PATH, 'utf8');
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

export function setPlistCredential(key: string, value: string): { ok: boolean; action?: 'created' | 'updated'; error?: string } {
  if (!PLIST_WRITABLE_KEYS.has(key)) {
    return { ok: false, error: 'key_not_allowed' };
  }
  if (!fs.existsSync(WORKER_PLIST_PATH)) {
    return { ok: false, error: 'plist_not_found' };
  }

  let xml = fs.readFileSync(WORKER_PLIST_PATH, 'utf8');

  // Check if key already exists inside EnvironmentVariables dict
  const existingPattern = new RegExp(`(<key>${key}<\\/key>\\s*<string>)[^<]*(<\\/string>)`);
  let action: 'created' | 'updated';

  if (existingPattern.test(xml)) {
    // Update existing value — replace the string content only
    xml = xml.replace(existingPattern, `$1${escapeXml(value)}$2`);
    action = 'updated';
  } else {
    // Insert new key/value pair into the EnvironmentVariables dict
    const envDictPattern = /(<key>EnvironmentVariables<\/key>\s*<dict>)([\s\S]*?)(<\/dict>)/;
    const m = envDictPattern.exec(xml);
    if (!m) return { ok: false, error: 'plist_env_dict_not_found' };
    const newEntry = `\n\t\t<key>${key}</key>\n\t\t<string>${escapeXml(value)}</string>`;
    xml = xml.replace(envDictPattern, `$1$2${newEntry}\n\t$3`);
    action = 'created';
  }

  fs.writeFileSync(WORKER_PLIST_PATH, xml);

  // Reload the worker — unload then load
  try {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    execFileSync('launchctl', ['unload', WORKER_PLIST_PATH], { timeout: 5000, stdio: 'pipe' });
    execFileSync('launchctl', ['load', WORKER_PLIST_PATH], { timeout: 5000, stdio: 'pipe' });
  } catch {
    // Worker reload is best-effort — the write succeeded, worker reload failure is non-fatal
  }

  return { ok: true, action };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function isPlaceholderValue(val: string): boolean {
  if (!val) return false;
  return /^<.+>$/.test(val) || /^(example|placeholder|your[-_]|changeme|todo)/i.test(val) || val.includes('PLACEHOLDER') || val.includes('_example') || val.includes('_test');
}

// ── YouTube OAuth two-step flow ────────────────────────────────────────────

const YT_UPLOADER_SCRIPT = expandHome('~/.local/video-orchestrator/scripts/youtube_uploader.py');
const YT_VENV_PYTHON = expandHome('~/.local/video-orchestrator/.venv/bin/python3');

export function getYouTubeOAuthUrl(account: string): { ok: boolean; url?: string; error?: string } {
  if (!fs.existsSync(YT_VENV_PYTHON) || !fs.existsSync(YT_UPLOADER_SCRIPT)) {
    return { ok: false, error: 'youtube_uploader_not_installed' };
  }
  try {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    const out = execFileSync(YT_VENV_PYTHON, [YT_UPLOADER_SCRIPT, 'auth-url', '--account', account], {
      encoding: 'utf8', timeout: 10000, stdio: ['pipe', 'pipe', 'pipe'],
    }) as string;
    // Extract the URL from the output
    const urlMatch = /(https:\/\/accounts\.google\.com\/o\/oauth2\/[^\s]+)/.exec(out) ?? /(https:\/\/[^\s]+)/.exec(out);
    if (!urlMatch || !urlMatch[1]) return { ok: false, error: 'url_not_found_in_output' };
    return { ok: true, url: urlMatch[1] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'auth_url_failed' };
  }
}

export function exchangeYouTubeOAuthCode(account: string, code: string): { ok: boolean; error?: string } {
  if (!fs.existsSync(YT_VENV_PYTHON) || !fs.existsSync(YT_UPLOADER_SCRIPT)) {
    return { ok: false, error: 'youtube_uploader_not_installed' };
  }
  try {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process');
    execFileSync(YT_VENV_PYTHON, [YT_UPLOADER_SCRIPT, 'auth-exchange', '--account', account, '--code', code], {
      encoding: 'utf8', timeout: 15000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : 'auth_exchange_failed' };
  }
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

function buildProjectEntry(
  projectId: string,
  displayName: string,
  envFilePath: string,
  platforms: PlatformSchema[],
): BrainCoreCredentialCatalogResponse['projects'][number] {
  return {
    projectId,
    displayName,
    envFilePath,
    platforms: platforms.map((platform) => {
      const envMap = envFilePath ? parseEnvFile(envFilePath) : new Map<string, string>();
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
      return { platformId: platform.platformId, platformName: platform.platformName, platformCategory: platform.platformCategory, credentials, allRequiredSet };
    }),
  };
}

export function getCredentialCatalog(): BrainCoreCredentialCatalogResponse {
  const infraGroups = buildInfraGroups();

  // Hardcoded projects
  const hardcoded = Object.entries(CREDENTIAL_SCHEMA).map(([projectId, platforms]) =>
    buildProjectEntry(projectId, PROJECT_DISPLAY_NAMES[projectId] ?? projectId, PROJECT_ENV_MAP[projectId] ?? '', platforms)
  );

  // User-registered projects (config file)
  const userProjects = readUserProjects().map((entry) => {
    const envFilePath = path.join(entry.repoPath, entry.envFileName);
    const platforms = entry.platforms
      .map(pid => AVAILABLE_PLATFORMS[pid])
      .filter((p): p is PlatformSchema => p !== undefined);
    return buildProjectEntry(entry.projectId, entry.displayName, envFilePath, platforms);
  });

  const availablePlatforms = getAvailablePlatforms();

  return { projects: [...hardcoded, ...userProjects], infra: infraGroups, availablePlatforms };
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

function resolveProjectEnvFile(projectId: string): string | undefined {
  if (PROJECT_ENV_MAP[projectId]) return PROJECT_ENV_MAP[projectId];
  const userEntry = readUserProjects().find(e => e.projectId === projectId);
  if (userEntry) return path.join(userEntry.repoPath, userEntry.envFileName);
  return undefined;
}

function resolveAllowedKeys(projectId: string): Set<string> | undefined {
  const hardcoded = ALLOWED_KEYS_BY_PROJECT[projectId];
  if (hardcoded) return hardcoded;
  const userEntry = readUserProjects().find(e => e.projectId === projectId);
  if (!userEntry) return undefined;
  const keys = new Set<string>();
  for (const pid of userEntry.platforms) {
    const p = AVAILABLE_PLATFORMS[pid];
    if (p) p.credentials.forEach(c => keys.add(c.key));
  }
  return keys;
}

export function setProjectCredential(projectId: string, key: string, value: string): BrainCoreCredentialSetResult {
  const allowed = resolveAllowedKeys(projectId);
  if (!allowed || !allowed.has(key)) {
    return { ok: false, projectId, key, error: 'key_not_allowed' };
  }

  const envFilePath = resolveProjectEnvFile(projectId);
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
  const allowed = resolveAllowedKeys(projectId);
  if (!allowed || !allowed.has(key)) {
    return { ok: false, projectId, key, error: 'key_not_allowed' };
  }

  const envFilePath = resolveProjectEnvFile(projectId);
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
