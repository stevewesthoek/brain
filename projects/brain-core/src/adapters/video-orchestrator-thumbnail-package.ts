import { existsSync, readFileSync } from 'node:fs';

export interface BrainCoreVideoThumbnailOverlayLineStyle {
  fontSize: number;
  x: number;
  y: number;
  scrimOpacity: number;
  textColor: string;
  alignment: 'left' | 'center' | 'right';
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface BrainCoreVideoThumbnailOverlayTemplate {
  headline: string;
  supportLine: string;
  brandLine: string;
  blendMode: 'none' | 'difference' | 'exclusion';
  maxLines: number;
  wordLimit: number;
  scrimColor: string;
  panelWidth: number;
  panelRadius: number;
  panelPaddingX: number;
  panelPaddingY: number;
  unifiedPanel: boolean;
  lineStyles: {
    headline: BrainCoreVideoThumbnailOverlayLineStyle;
    supportLine: BrainCoreVideoThumbnailOverlayLineStyle;
    brandLine: BrainCoreVideoThumbnailOverlayLineStyle;
  };
}

export interface BrainCoreVideoThumbnailPackage {
  slug: string;
  episodeTitle: string;
  activePromptTemplate: string;
  selectedTemplateName: string | null;
  selectedOverlayPlatform: string;
  overlayTemplates: Record<string, BrainCoreVideoThumbnailOverlayTemplate>;
  generatedImages: Record<string, string | null>;
}

export interface BrainCoreVideoThumbnailPackageResponse {
  slug: string;
  projectId: string;
  generatedAt: string;
  source: 'fixture' | 'file';
  thumbnail: BrainCoreVideoThumbnailPackage;
}

const DEFAULT_THUMBNAIL_PACKAGE_PATH = process.env.BRAIN_CORE_VO_THUMBNAIL_PACKAGE_PATH?.trim() || '';

const thumbnailPackageFixtures: Record<string, Omit<BrainCoreVideoThumbnailPackageResponse, 'slug' | 'generatedAt'>> = {
  'story-052-genesis-creation': {
    projectId: 'says-the-bible',
    source: 'fixture',
    thumbnail: {
      slug: 'story-052-genesis-creation',
      episodeTitle: 'The Story of Creation',
      activePromptTemplate: 'Genesis creation story thumbnail prompt',
      selectedTemplateName: 'genesis-studio',
      selectedOverlayPlatform: 'youtube',
      overlayTemplates: {},
      generatedImages: {
        website: null,
        youtube: null,
        youtube_video: null,
        facebook: null,
        pinterest: null,
      },
    },
  },
};

function readThumbnailPackageFile(): Record<string, Omit<BrainCoreVideoThumbnailPackageResponse, 'slug' | 'generatedAt'>> | null {
  if (!DEFAULT_THUMBNAIL_PACKAGE_PATH) {
    return null;
  }

  if (!existsSync(DEFAULT_THUMBNAIL_PACKAGE_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(DEFAULT_THUMBNAIL_PACKAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if ('slug' in parsed && 'thumbnail' in parsed) {
      const candidate = parsed as BrainCoreVideoThumbnailPackageResponse;
      return candidate.slug && candidate.thumbnail ? { [candidate.slug]: { projectId: candidate.projectId, source: candidate.source, thumbnail: candidate.thumbnail } } : null;
    }

    return parsed as Record<string, Omit<BrainCoreVideoThumbnailPackageResponse, 'slug' | 'generatedAt'>>;
  } catch {
    return null;
  }
}

function isLineStyle(candidate: unknown): candidate is BrainCoreVideoThumbnailOverlayLineStyle {
  if (!candidate || typeof candidate !== 'object') return false;
  const value = candidate as Record<string, unknown>;
  return typeof value.fontSize === 'number'
    && typeof value.x === 'number'
    && typeof value.y === 'number'
    && typeof value.scrimOpacity === 'number'
    && typeof value.textColor === 'string'
    && (value.alignment === 'left' || value.alignment === 'center' || value.alignment === 'right')
    && typeof value.bold === 'boolean'
    && typeof value.italic === 'boolean'
    && typeof value.underline === 'boolean';
}

function isOverlayTemplate(candidate: unknown): candidate is BrainCoreVideoThumbnailOverlayTemplate {
  if (!candidate || typeof candidate !== 'object') return false;
  const value = candidate as Record<string, unknown>;
  return typeof value.headline === 'string'
    && typeof value.supportLine === 'string'
    && typeof value.brandLine === 'string'
    && (value.blendMode === 'none' || value.blendMode === 'difference' || value.blendMode === 'exclusion')
    && typeof value.maxLines === 'number'
    && typeof value.wordLimit === 'number'
    && typeof value.scrimColor === 'string'
    && typeof value.panelWidth === 'number'
    && typeof value.panelRadius === 'number'
    && typeof value.panelPaddingX === 'number'
    && typeof value.panelPaddingY === 'number'
    && typeof value.unifiedPanel === 'boolean'
    && isLineStyle((value.lineStyles as Record<string, unknown> | undefined)?.headline)
    && isLineStyle((value.lineStyles as Record<string, unknown> | undefined)?.supportLine)
    && isLineStyle((value.lineStyles as Record<string, unknown> | undefined)?.brandLine);
}

function isThumbnailPackage(candidate: unknown): candidate is BrainCoreVideoThumbnailPackage {
  if (!candidate || typeof candidate !== 'object') return false;
  const value = candidate as Record<string, unknown>;
  const selectedTemplateName = value.selectedTemplateName
  const overlayTemplates = value.overlayTemplates
  const generatedImages = value.generatedImages

  return typeof value.slug === 'string'
    && typeof value.episodeTitle === 'string'
    && typeof value.activePromptTemplate === 'string'
    && (typeof selectedTemplateName === 'string' || selectedTemplateName === null)
    && typeof value.selectedOverlayPlatform === 'string'
    && Boolean(overlayTemplates)
    && typeof overlayTemplates === 'object'
    && !Array.isArray(overlayTemplates)
    && Boolean(generatedImages)
    && typeof generatedImages === 'object'
    && !Array.isArray(generatedImages)
    && Object.values(overlayTemplates as Record<string, unknown>).every((entry) => isOverlayTemplate(entry));
}

export function readVideoOrchestratorThumbnailPackage(slug: string): BrainCoreVideoThumbnailPackageResponse | undefined {
  const filePackages = readThumbnailPackageFile();
  const fileEntry = filePackages?.[slug];
  if (fileEntry && isThumbnailPackage(fileEntry.thumbnail)) {
    return {
      slug,
      projectId: fileEntry.projectId,
      generatedAt: new Date().toISOString(),
      source: fileEntry.source,
      thumbnail: fileEntry.thumbnail,
    };
  }

  const fixtureEntry = thumbnailPackageFixtures[slug];
  if (fixtureEntry && isThumbnailPackage(fixtureEntry.thumbnail)) {
    return {
      slug,
      projectId: fixtureEntry.projectId,
      generatedAt: new Date().toISOString(),
      source: fixtureEntry.source,
      thumbnail: fixtureEntry.thumbnail,
    };
  }

  return undefined;
}
