import { existsSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type BrainServiceIdentity = { serviceId: string; secret: string };

type IdentityResolutionInput = {
  argvPath?: string;
  env?: NodeJS.ProcessEnv;
};

const SECRET_FILE_NAME = 'secrets.env';

function unique(values: readonly (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0))];
}

function absolutePath(value: string | undefined, home: string): string | undefined {
  if (!value) return undefined;
  if (value === '~') return home;
  if (value.startsWith('~/')) return path.join(home, value.slice(2));
  return path.isAbsolute(value) ? path.normalize(value) : undefined;
}

function installMetadataConfigPath(argvPath: string, home: string): string | undefined {
  const binDirectory = path.dirname(path.resolve(argvPath));
  const metadataCandidates = [
    path.resolve(binDirectory, '../../../../../install.json'),
    path.resolve(binDirectory, '../../../../../../install.json'),
  ];
  for (const metadataPath of unique(metadataCandidates)) {
    try {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as { configPath?: unknown };
      const configPath = absolutePath(typeof metadata.configPath === 'string' ? metadata.configPath : undefined, home);
      if (configPath) return configPath;
    } catch {
      // Try the next bounded installed-layout candidate.
    }
  }
  return undefined;
}

export function brainServiceSecretCandidates(input: IdentityResolutionInput = {}): string[] {
  const env = input.env ?? process.env;
  const home = absolutePath(env.HOME, os.homedir()) ?? os.homedir();
  const argvPath = input.argvPath ?? process.argv[1] ?? '';
  const configPaths = [
    absolutePath(env.BRAIN_RUNTIME_CONFIG_PATH, home),
    installMetadataConfigPath(argvPath, home),
  ].filter((value): value is string => value !== undefined);
  const configSecrets = configPaths.map((configPath) => path.join(path.dirname(configPath), SECRET_FILE_NAME));
  const installedRelativeSecret = argvPath.length > 0
    ? path.resolve(path.dirname(path.resolve(argvPath)), '../../../../../config', SECRET_FILE_NAME)
    : undefined;
  return unique([
    absolutePath(env.BRAIN_SECRETS_FILE, home),
    ...configSecrets,
    ...(installedRelativeSecret ? [installedRelativeSecret] : []),
  ]);
}

function readIdentityFile(filePath: string): BrainServiceIdentity | undefined {
  if (!existsSync(filePath)) return undefined;
  const mode = statSync(filePath).mode & 0o777;
  if ((mode & 0o077) !== 0) throw new Error('Brain service secret file permissions are too broad');
  const values = new Map<string, string>();
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(.*)$/u.exec(line.trim());
    if (match) values.set(match[1]!, match[2]!.replace(/^['"]|['"]$/gu, ''));
  }
  const serviceId = values.get('BRAIN_CORE_SERVICE_ID');
  const secret = values.get('BRAIN_CORE_SERVICE_SECRET');
  return serviceId && secret ? { serviceId, secret } : undefined;
}

export function resolveBrainServiceIdentity(input: IdentityResolutionInput = {}): BrainServiceIdentity {
  const env = input.env ?? process.env;
  if (env.BRAIN_CORE_SERVICE_ID && env.BRAIN_CORE_SERVICE_SECRET) return { serviceId: env.BRAIN_CORE_SERVICE_ID, secret: env.BRAIN_CORE_SERVICE_SECRET };
  for (const candidate of brainServiceSecretCandidates(input)) {
    const identity = readIdentityFile(candidate);
    if (identity) return identity;
  }
  throw new Error('Brain Core local service identity is unavailable');
}
