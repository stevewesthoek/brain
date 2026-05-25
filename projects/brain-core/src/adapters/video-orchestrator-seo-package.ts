import { existsSync, readFileSync } from 'node:fs';

export interface BrainCoreVideoSeoPackage {
  primaryKeyword: string;
  secondaryKeywords: string[];
  titleOptions: string[];
  selectedTitle: string;
  thumbnailHeadline: string;
  shortDescription: string;
  fullDescription: string;
  chapters: string[];
  tags: string[];
  hashtags: string[];
  pinnedComment: string;
  playlistRecommendations: string[];
  bibleReference: string;
  storyThemes: string[];
  audienceIntent: string;
  searchIntent: string;
}

export interface BrainCoreVideoSeoPackageResponse {
  slug: string;
  projectId: string;
  generatedAt: string;
  source: 'fixture' | 'file';
  seo: BrainCoreVideoSeoPackage;
}

const DEFAULT_SEO_PACKAGE_PATH = process.env.BRAIN_CORE_VO_SEO_PACKAGE_PATH?.trim() || '';

const seoPackageFixtures: Record<string, Omit<BrainCoreVideoSeoPackageResponse, 'slug' | 'generatedAt'>> = {
  'story-052-genesis-creation': {
    projectId: 'says-the-bible',
    source: 'fixture',
    seo: {
      primaryKeyword: 'Genesis creation story',
      secondaryKeywords: ['Bible bedtime story', 'creation in Genesis', 'restful Bible narration'],
      titleOptions: [
        'The Story of Creation for Deep Sleep | Bible Bedtime Story',
        'Genesis Creation Story for Deep Sleep | Bible Bedtime Story',
        'Creation in Genesis | Bible Bedtime Story',
      ],
      selectedTitle: 'The Story of Creation for Deep Sleep | Bible Bedtime Story',
      thumbnailHeadline: 'Genesis Story',
      shortDescription: 'A gentle reading of Creation in Genesis for peaceful nighttime listening.',
      fullDescription: 'This package presents the creation narrative in a calm, reflective format designed for deep sleep listening, with scripture-grounded pacing and a clear bedtime-story structure.',
      chapters: ['Introduction', 'Days of Creation', 'Seventh Day Rest', 'Closing Prayer'],
      tags: ['genesis creation story', 'creation bible story', 'genesis sleep story', 'book of genesis'],
      hashtags: ['#genesis', '#biblestory', '#sleepstory', '#creation'],
      pinnedComment: 'Which part of Creation stands out most to you tonight?',
      playlistRecommendations: ['Bible Bedtime Stories', 'Genesis Stories', 'Stories for Deep Sleep'],
      bibleReference: 'Genesis 1:1-2:3',
      storyThemes: ['creation', 'order', 'rest', 'worship'],
      audienceIntent: 'deep sleep / bedtime listening',
      searchIntent: 'Viewers searching for a calm Bible bedtime story about Creation in Genesis.',
    },
  },
  'story-053-noah-flood': {
    projectId: 'says-the-bible',
    source: 'fixture',
    seo: {
      primaryKeyword: 'Noah and the flood story',
      secondaryKeywords: ['Bible bedtime story', 'Noah ark story', 'Genesis flood narration'],
      titleOptions: [
        'Noah and the Flood Story for Deep Sleep | Bible Bedtime Story',
        'The Flood Story in Genesis | Bible Bedtime Story',
        'Noah Builds the Ark | Bible Bedtime Story',
      ],
      selectedTitle: 'Noah and the Flood Story for Deep Sleep | Bible Bedtime Story',
      thumbnailHeadline: "Noah's Flood",
      shortDescription: 'A peaceful retelling of Noah, the ark, and God’s covenant after the flood.',
      fullDescription: 'This package frames Noah’s story as a calm, scripture-based bedtime narrative with a gentle arc from warning to waiting to covenant peace.',
      chapters: ['Introduction', 'The Warning', 'The Ark', 'The Flood', 'The Covenant'],
      tags: ['noah and the flood', 'noah ark bible story', 'noah sleep story', 'genesis noah'],
      hashtags: ['#noah', '#ark', '#biblestory', '#sleepstory'],
      pinnedComment: 'What do you notice most in Noah’s story: faith, patience, or covenant?',
      playlistRecommendations: ['Bible Bedtime Stories', 'Genesis Stories', 'Stories for Deep Sleep'],
      bibleReference: 'Genesis 6:9-9:17',
      storyThemes: ['faith', 'obedience', 'judgment', 'covenant'],
      audienceIntent: 'deep sleep / bedtime listening',
      searchIntent: 'Viewers searching for a calm Bible bedtime story about Noah and the flood.',
    },
  },
};

function readSeoPackageFile(): Record<string, Omit<BrainCoreVideoSeoPackageResponse, 'slug' | 'generatedAt'>> | null {
  if (!DEFAULT_SEO_PACKAGE_PATH) {
    return null;
  }

  if (!existsSync(DEFAULT_SEO_PACKAGE_PATH)) {
    return null;
  }

  try {
    const raw = readFileSync(DEFAULT_SEO_PACKAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if ('slug' in parsed && 'seo' in parsed) {
      const candidate = parsed as BrainCoreVideoSeoPackageResponse;
      return candidate.slug && candidate.seo ? { [candidate.slug]: { projectId: candidate.projectId, source: candidate.source, seo: candidate.seo } } : null;
    }

    return parsed as Record<string, Omit<BrainCoreVideoSeoPackageResponse, 'slug' | 'generatedAt'>>;
  } catch {
    return null;
  }
}

function isSeoPackage(candidate: unknown): candidate is BrainCoreVideoSeoPackage {
  if (!candidate || typeof candidate !== 'object') {
    return false;
  }

  const value = candidate as Record<string, unknown>;
  return typeof value.primaryKeyword === 'string'
    && Array.isArray(value.secondaryKeywords)
    && Array.isArray(value.titleOptions)
    && typeof value.selectedTitle === 'string'
    && typeof value.thumbnailHeadline === 'string'
    && typeof value.shortDescription === 'string'
    && typeof value.fullDescription === 'string'
    && Array.isArray(value.chapters)
    && Array.isArray(value.tags)
    && Array.isArray(value.hashtags)
    && typeof value.pinnedComment === 'string'
    && Array.isArray(value.playlistRecommendations)
    && typeof value.bibleReference === 'string'
    && Array.isArray(value.storyThemes)
    && typeof value.audienceIntent === 'string'
    && typeof value.searchIntent === 'string';
}

export function readVideoOrchestratorSeoPackage(slug: string): BrainCoreVideoSeoPackageResponse | undefined {
  const filePackages = readSeoPackageFile();
  const fileEntry = filePackages?.[slug];
  if (fileEntry && isSeoPackage(fileEntry.seo)) {
    return {
      slug,
      projectId: fileEntry.projectId,
      generatedAt: new Date().toISOString(),
      source: fileEntry.source,
      seo: fileEntry.seo,
    };
  }

  const fixtureEntry = seoPackageFixtures[slug];
  if (fixtureEntry && isSeoPackage(fixtureEntry.seo)) {
    return {
      slug,
      projectId: fixtureEntry.projectId,
      generatedAt: new Date().toISOString(),
      source: fixtureEntry.source,
      seo: fixtureEntry.seo,
    };
  }

  return undefined;
}
