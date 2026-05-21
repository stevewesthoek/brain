import fs from 'node:fs';
import os from 'node:os';
import type {
  BrainCoreCredentialListResponse,
  BrainCoreCredentialSetResult,
} from '../types/api.js';

type CredType = 'app_id' | 'secret' | 'token' | 'board_id' | 'api_key' | 'url' | 'other';

interface SchemaEntry {
  key: string;
  label: string;
  type: CredType;
  required: boolean;
  hint?: string;
}

interface PlatformSchema {
  platformId: string;
  platformName: string;
  credentials: SchemaEntry[];
}

const PROJECT_ENV_MAP: Record<string, string> = {
  'says-the-bible': expandHome('~/Repos/prochattools/web/says-the-bible/.env.pipeline.production'),
};

const CREDENTIAL_SCHEMA: Record<string, PlatformSchema[]> = {
  'says-the-bible': [
    {
      platformId: 'pinterest',
      platformName: 'Pinterest',
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
      platformId: 'youtube',
      platformName: 'YouTube',
      credentials: [
        { key: 'YOUTUBE_CLIENT_ID',     label: 'OAuth Client ID',     type: 'app_id', required: true },
        { key: 'YOUTUBE_CLIENT_SECRET', label: 'OAuth Client Secret', type: 'secret', required: true },
        { key: 'YOUTUBE_TOKEN_PATH',    label: 'Token file path',     type: 'other',  required: false },
      ],
    },
    {
      platformId: 'facebook',
      platformName: 'Facebook',
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
      credentials: [
        { key: 'AZURE_SPEECH_KEY',    label: 'Speech API Key', type: 'api_key', required: true },
        { key: 'AZURE_SPEECH_REGION', label: 'Region',         type: 'other',   required: true, hint: 'e.g. eastus' },
      ],
    },
  ],
};

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
