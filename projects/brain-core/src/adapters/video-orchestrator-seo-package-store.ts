import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { BrainCoreVideoSeoPackage, BrainCoreVideoSeoPackageResponse } from './video-orchestrator-seo-package.js';

const DEFAULT_SEO_STORE_PATH = process.env.BRAIN_CORE_VO_SEO_PACKAGE_STORE_PATH?.trim() || '';

export type StoredSeoPackage = BrainCoreVideoSeoPackageResponse;

function storePath(): string | null {
  return DEFAULT_SEO_STORE_PATH || null;
}

export async function saveVideoOrchestratorSeoPackage(record: StoredSeoPackage): Promise<StoredSeoPackage> {
  const path = storePath();
  if (!path) {
    return record;
  }

  const safePath = resolve(path);
  await mkdir(dirname(safePath), { recursive: true });
  let current: Record<string, StoredSeoPackage> = {};
  try {
    const existing = await readFile(safePath, 'utf8');
    const parsed = JSON.parse(existing) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      current = parsed as Record<string, StoredSeoPackage>;
    }
  } catch {
    current = {};
  }

  current[record.slug] = record;
  await writeFile(safePath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  return record;
}

export async function loadStoredVideoOrchestratorSeoPackage(slug: string): Promise<StoredSeoPackage | undefined> {
  const path = storePath();
  if (!path) {
    return undefined;
  }

  try {
    const raw = await readFile(resolve(path), 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    const record = (parsed as Record<string, StoredSeoPackage>)[slug];
    return record;
  } catch {
    return undefined;
  }
}

