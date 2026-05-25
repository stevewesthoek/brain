import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

import type { BrainCoreVideoThumbnailPackageResponse } from './video-orchestrator-thumbnail-package.js';

const DEFAULT_THUMBNAIL_STORE_PATH = process.env.BRAIN_CORE_VO_THUMBNAIL_PACKAGE_STORE_PATH?.trim() || '';

export type StoredThumbnailPackage = BrainCoreVideoThumbnailPackageResponse;

function storePath(): string | null {
  return DEFAULT_THUMBNAIL_STORE_PATH || null;
}

export async function saveVideoOrchestratorThumbnailPackage(record: StoredThumbnailPackage): Promise<StoredThumbnailPackage> {
  const path = storePath();
  if (!path) {
    return record;
  }

  const safePath = resolve(path);
  await mkdir(dirname(safePath), { recursive: true });
  let current: Record<string, StoredThumbnailPackage> = {};
  try {
    const existing = await readFile(safePath, 'utf8');
    const parsed = JSON.parse(existing) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      current = parsed as Record<string, StoredThumbnailPackage>;
    }
  } catch {
    current = {};
  }

  current[record.slug] = record;
  await writeFile(safePath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  return record;
}

export async function loadStoredVideoOrchestratorThumbnailPackage(slug: string): Promise<StoredThumbnailPackage | undefined> {
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
    const record = (parsed as Record<string, StoredThumbnailPackage>)[slug];
    return record;
  } catch {
    return undefined;
  }
}
