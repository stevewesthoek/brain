export interface BrainCoreStatus {
  service: 'brain-core';
  mode: 'read-only';
  ok: boolean;
  startedAt: string;
  uptimeSeconds: number;
  version: string;
  host: string;
}

export interface BrainCoreSessionSummary {
  id: string;
  tool: 'claude' | 'codex' | 'gemini' | 'unknown';
  repo?: string;
  title: string;
  updatedAt?: string;
  age?: string;
  intent?: string;
  score?: number;
  source: 'placeholder' | 'adapter';
}

export interface BrainCoreSkillSummary {
  id: string;
  name: string;
  sourcePath: string;
  status: 'indexed' | 'placeholder';
}

export interface BrainCoreRepoSummary {
  alias: string;
  path: string;
  exists: boolean;
  handoffPath?: string;
  handoffExists: boolean;
  source: 'env' | 'placeholder';
}

export interface BrainCoreSchedulerStatus {
  status: 'not-configured' | 'placeholder' | 'runtime-report';
  enabled: boolean;
  latestRunAt?: string;
  latestRunStatus?: 'ok' | 'failed' | 'unknown';
  source: 'placeholder' | 'runtime-report';
  message: string;
}

export interface BrainCoreSchedulerJobSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'disabled' | 'unknown' | 'ok' | 'failed';
  mutationRequired: boolean;
}

export interface BrainCoreLocalAppSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'unknown' | 'disabled' | 'running' | 'stopped';
  source: 'placeholder' | 'runtime-report';
  actionsSupported: boolean;
}

export interface BrainCoreVideoStatus {
  status: 'placeholder' | 'not-configured' | 'ok' | 'failed' | 'unknown';
  enabled: boolean;
  queueDepth: number;
  latestRunAt?: string;
  source: 'placeholder' | 'runtime-report';
  message: string;
}

export interface BrainCoreVideoQueueItem {
  id: string;
  title: string;
  status: 'placeholder' | 'queued' | 'running' | 'failed' | 'done';
  source: 'placeholder' | 'runtime-report';
}

export type BrainCoreHealth = 'ok' | 'warning' | 'error' | 'unknown';

export type BrainCoreLifecycleStatus = 'operational' | 'partial' | 'planned' | 'legacy' | 'migrating' | 'blocked' | 'unknown';

export type BrainCoreCurrentRole = 'primary' | 'legacy' | 'future' | 'supporting';

export interface BrainCoreOrchestratorSummary {
  id: string;
  name: string;
  status: 'placeholder' | 'unknown' | 'disabled';
  source: 'placeholder';
  actionsSupported: boolean;
  health?: BrainCoreHealth;
  lifecycle?: BrainCoreLifecycleStatus;
  role?: BrainCoreCurrentRole;
  description?: string;
}

export interface BrainCorePipelineMigration {
  sourcePipelineId?: string;
  targetPipelineId?: string;
  parityStatus?: 'ready' | 'in-progress' | 'blocked' | 'not-applicable';
  decommissionBlocked?: boolean;
}

export interface BrainCorePipelineSummary {
  id: string;
  name: string;
  status: BrainCoreLifecycleStatus;
  health: BrainCoreHealth;
  role: BrainCoreCurrentRole;
  description: string;
  stages?: string[];
  migration?: BrainCorePipelineMigration;
}

export interface BrainCoreProjectSummary {
  id: string;
  name: string;
  category: 'content' | 'infrastructure' | 'operations' | 'research' | 'other';
  status: BrainCoreLifecycleStatus;
  health: BrainCoreHealth;
  orchestratorIds?: string[];
  pipelineIds?: string[];
  platformIds?: string[];
}

export interface BrainCorePlatformSummary {
  id: string;
  name: string;
  category: 'social' | 'video' | 'storage' | 'local' | 'development' | 'other';
  status: BrainCoreLifecycleStatus;
  health: BrainCoreHealth;
  projectIds?: string[];
  pipelineIds?: string[];
}

export interface BrainCoreStbPipelineStatus {
  id: 'stb-pipeline-status';
  pipelineId: 'stb-daily-pipeline';
  projectId: 'says-the-bible';
  source: 'runtime-file' | 'probot-status' | 'static-registry' | 'unavailable';
  status: 'operational' | 'stale' | 'error' | 'unknown';
  health: BrainCoreHealth;
  lastRunAt?: string;
  lastRunAgeHours?: number;
  queueCount?: number;
  failureCount?: number;
  currentItem?: string;
  summary: string;
  evidence: Array<{ label: string; path?: string; value: string }>;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreVideoOrchestratorStatus {
  id: 'video-orchestrator-status';
  orchestratorId: 'video-orchestrator';
  pipelineId: 'video-upload-pipeline';
  status: 'operational' | 'partial' | 'planned' | 'blocked' | 'unknown';
  health: BrainCoreHealth;
  moduleProgress: { total: number; implemented: number; partial: number; planned: number; blocked: number; percent: number };
  modules: Array<{ id: string; name: string; status: 'implemented' | 'partial' | 'planned' | 'blocked' | 'unknown'; summary: string }>;
  supportedProjects: string[];
  supportedPlatforms: string[];
  queueCount?: number;
  lastRunAt?: string;
  summary: string;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreStbVideoMigrationStatus {
  id: 'stb-to-video-migration-status';
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
  status: 'mapping' | 'partial' | 'dual-run' | 'ready' | 'complete' | 'blocked';
  health: BrainCoreHealth;
  parityPercent: number;
  decommissionBlocked: true;
  nextSafeTask: string;
  modules: Array<{ stbConcept: string; videoModule: string; status: 'mapped' | 'partial' | 'planned' | 'blocked'; validation: string }>;
  summary: string;
  blockers: string[];
}

export interface BrainCoreVideoIntakeSource {
  id: string;
  source: 'stb-fixture' | 'manual-fixture' | 'runtime-evidence';
  stbSlug?: string;
  title: string;
  durationTargetMinutes: number;
  platformTargets: string[];
  status: 'available' | 'blocked';
  evidence: string[];
}

export interface BrainCoreVideoIntakePlan {
  id: string;
  sourceId: string;
  projectId: string;
  title: string;
  status: 'preview-ready' | 'blocked';
  normalizedInputs: {
    storySlug?: string;
    title: string;
    durationTargetMinutes: number;
    platforms: string[];
    requiredStages: string[];
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoOrchestratorIntakeResponse {
  id: 'video-orchestrator-intake';
  generatedAt: string;
  version: string;
  sources: BrainCoreVideoIntakeSource[];
  plans: BrainCoreVideoIntakePlan[];
  summary: {
    sourceCount: number;
    planCount: number;
    availableCount: number;
    blockedCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
}

export interface BrainCoreVideoResearchBrief {
  id: string;
  intakePlanId: string;
  sourceId: string;
  title: string;
  status: 'preview-ready' | 'blocked';
  generatedAt: string;
  theologicalTheme?: string;
  narrativeSummary?: string;
  researchedPassages: Array<{ book: string; chapter: number; verses: string; title?: string }>;
  keyBiblicalConcepts: string[];
  estimatedReadTime?: number;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
}

export interface BrainCoreVideoResearchQuestion {
  sequence: number;
  question: string;
  expectedAnswerLength: 'brief' | 'medium' | 'detailed';
  relatedPassages: string[];
}

export interface BrainCoreVideoResearchSource {
  id: string;
  type: 'bible-passage' | 'commentary' | 'theological-note';
  reference: string;
  summary: string;
  relevance: 'primary' | 'supporting' | 'contextual';
  stbEvidence?: { testedAt: string; matchesStbResearch: boolean };
}

export interface BrainCoreVideoOrchestratorResearchResponse {
  id: string;
  generatedAt: string;
  version: string;
  intakePlan: {
    id: string;
    title: string;
    durationTargetMinutes: number;
    platforms: string[];
  };
  researchBrief: BrainCoreVideoResearchBrief;
  questions: BrainCoreVideoResearchQuestion[];
  sources: BrainCoreVideoResearchSource[];
  summary: {
    passageCount: number;
    questionCount: number;
    sourceCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  validation?: {
    dualRunStatus: 'passed' | 'in-progress';
    stbResearchMatches: boolean;
    passageSelectionParity: number;
    testedAt?: string;
  };
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoResearchListResponse {
  id: 'video-orchestrator-research';
  generatedAt: string;
  version: string;
  briefs: BrainCoreVideoResearchBrief[];
  summary: {
    total: number;
    readyCount: number;
    blockedCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
}

export interface BrainCoreVideoScriptSection {
  sequence: number;
  name: string;
  contentType: 'narration' | 'passage' | 'visual-cue' | 'transition';
  estimatedDurationSeconds: number;
  keyPoints: string[];
  sampleNarration?: string;
}

export interface BrainCoreVideoScriptOutline {
  id: string;
  intakePlanId: string;
  researchId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'generated' | 'blocked';
  sections: BrainCoreVideoScriptSection[];
  totalEstimatedSeconds: number;
  formatConfirm: boolean;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoScriptNarrationSection {
  sequence: number;
  sectionName: string;
  type: 'intro' | 'body' | 'passage' | 'application' | 'outro';
  narration: string;
  passageReference?: { book: string; chapter: number; verses: string; text?: string };
  timingNotes?: string;
  visualCues?: string[];
}

export interface BrainCoreVideoScriptDraft {
  id: string;
  intakePlanId: string;
  outlineId: string;
  researchId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'generated' | 'blocked';
  sections: BrainCoreVideoScriptNarrationSection[];
  metadata: {
    wordCount: number;
    estimatedNarrationMinutes: number;
    tone: 'devotional' | 'educational' | 'story' | 'mixed';
    targetAudience: 'bedtime-story' | 'family' | 'faith-focused';
    speakerNotes: string;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoScriptPlan {
  id: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'available' | 'blocked';
  outline: BrainCoreVideoScriptOutline;
  draft: BrainCoreVideoScriptDraft;
  nextStage: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  blockers: string[];
}

export interface BrainCoreVideoScriptResponse {
  id: string;
  generatedAt: string;
  version: string;
  type: 'outline' | 'draft' | 'plan';
  intakePlan: {
    id: string;
    title: string;
    durationTargetMinutes: number;
    platforms: string[];
  };
  outline?: BrainCoreVideoScriptOutline;
  draft?: BrainCoreVideoScriptDraft;
  plan?: BrainCoreVideoScriptPlan;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  nextSafeStep: string;
  blockers: string[];
}

export interface BrainCoreVideoScriptListResponse {
  id: 'video-orchestrator-script';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoScriptPlan[];
  summary: {
    total: number;
    availableCount: number;
    blockedCount: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
    callsExternalAI: false;
  };
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
}

export interface BrainCoreVideoAssetRequirement {
  id: string;
  kind: 'thumbnail' | 'title-card' | 'passage-card' | 'scene-visual' | 'b-roll' | 'platform-derivative' | 'metadata-visual';
  label: string;
  status: 'planned' | 'blocked';
  requiredForStages: string[];
  placeholder: string;
  designDependency: 'design-orchestrator' | 'manual-design' | 'none';
  blockers: string[];
  safety: {
    readOnly: true;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssetPlan {
  id: string;
  intakePlanId: string;
  researchId?: string;
  scriptId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  requirements: BrainCoreVideoAssetRequirement[];
  summary: {
    totalRequirements: number;
    thumbnailCount: number;
    sceneVisualCount: number;
    platformDerivativeCount: number;
    blockedCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssetPlanListResponse {
  id: 'video-orchestrator-asset-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoAssetPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalRequirements: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssetPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoAssetPlan;
  upstream: {
    intakePlanId: string;
    researchId?: string;
    scriptId?: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoDesignSpec {
  id: string;
  assetRequirementId: string;
  kind: 'thumbnail-design' | 'title-card-design' | 'passage-card-design' | 'scene-style' | 'platform-layout' | 'metadata-visual-layout';
  label: string;
  status: 'planned' | 'blocked';
  placeholder: string;
  designSystem: {
    format: 'static-card' | 'overlay' | 'layout' | 'style-guide';
    aspectRatio: '16:9' | '1:1' | '9:16' | '4:5' | 'mixed';
    platformTargets: string[];
  };
  dependency: 'design-orchestrator' | 'manual-design' | 'none';
  blockers: string[];
  safety: {
    readOnly: true;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoDesignPlanSummary {
  totalSpecs: number;
  plannedCount: number;
  blockedCount: number;
  platformLayoutCount: number;
}

export interface BrainCoreVideoDesignPlan {
  id: string;
  assetPlanId: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  specs: BrainCoreVideoDesignSpec[];
  summary: BrainCoreVideoDesignPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoDesignPlanListResponse {
  id: 'video-orchestrator-design-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoDesignPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalSpecs: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoDesignPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoDesignPlan;
  upstream: {
    assetPlanId: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVoiceoverSegment {
  id: string;
  scriptSectionId?: string;
  sequence: number;
  label: string;
  kind: 'intro' | 'body' | 'passage' | 'application' | 'outro' | 'transition';
  status: 'planned' | 'blocked';
  placeholder: string;
  estimatedDurationSeconds: number;
  voiceRequirements: {
    tone: 'calm' | 'educational' | 'story' | 'neutral';
    pacing: 'slow' | 'medium' | 'measured';
    emphasis: string[];
  };
  pronunciationNotes: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVoiceoverPlanSummary {
  totalSegments: number;
  plannedCount: number;
  blockedCount: number;
  estimatedDurationSeconds: number;
  estimatedDurationMinutes: number;
}

export interface BrainCoreVideoVoiceoverPlan {
  id: string;
  scriptPlanId: string;
  intakePlanId: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  segments: BrainCoreVideoVoiceoverSegment[];
  summary: BrainCoreVideoVoiceoverPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVoiceoverPlanListResponse {
  id: 'video-orchestrator-voiceover-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoVoiceoverPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalSegments: number;
    estimatedDurationMinutes: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVoiceoverPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoVoiceoverPlan;
  upstream: {
    scriptPlanId: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesAudio: false;
    callsTts: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVisualSequenceItem {
  id: string;
  voiceoverSegmentId: string;
  designSpecId: string;
  assetRequirementId: string;
  sequence: number;
  label: string;
  kind: 'scene' | 'overlay' | 'transition' | 'text-card' | 'title-card' | 'passage-card' | 'platform-crop';
  status: 'planned' | 'blocked';
  startSecond: number;
  durationSeconds: number;
  transitionType?: 'fade' | 'cut' | 'slide' | 'dissolve' | 'none';
  aspectRatio: '16:9' | '1:1' | '9:16' | '4:5' | 'mixed';
  platformTargets: string[];
  placeholder: string;
  requiredForStages: string[];
  designDependency: 'design-orchestrator' | 'manual-design' | 'none';
  blockers: string[];
  safety: {
    readOnly: true;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVisualsPlanSummary {
  totalSequenceItems: number;
  plannedCount: number;
  blockedCount: number;
  estimatedTotalDurationSeconds: number;
  estimatedTotalDurationMinutes: number;
  platformTargetCount: number;
  uniqueKinds: string[];
}

export interface BrainCoreVideoVisualsPlan {
  id: string;
  projectId: string;
  title: string;
  generatedAt: string;
  voiceoverPlanId: string;
  designPlanId: string;
  assetPlanId: string;
  scriptPlanId: string;
  intakePlanId: string;
  status: 'preview-ready' | 'blocked';
  sequence: BrainCoreVideoVisualSequenceItem[];
  summary: BrainCoreVideoVisualsPlanSummary;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVisualsPlanListResponse {
  id: 'video-orchestrator-visuals-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoVisualsPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalSequenceItems: number;
    estimatedTotalDurationMinutes: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoVisualsPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoVisualsPlan;
  upstream: {
    voiceoverPlanId: string;
    designPlanId: string;
    assetPlanId: string;
    scriptPlanId: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesImage: false;
    generatesVideo: false;
    generatesPrompt: false;
    callsExternalAI: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssemblyTimelineItem {
  id: string;
  sequence: number;
  voiceoverSegmentId?: string;
  visualSequenceItemId?: string;
  assetRequirementId?: string;
  designSpecId?: string;
  kind: 'intro' | 'main-segment' | 'passage-card' | 'overlay' | 'transition' | 'outro' | 'platform-derivative';
  label: string;
  status: 'planned' | 'blocked';
  placeholder: string;
  timing: {
    startSecond: number;
    durationSeconds: number;
    endSecond: number;
  };
  sync: {
    requiresVoiceover: boolean;
    requiresVisual: boolean;
    requiresOverlay: boolean;
  };
  compositionRequirements: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssemblyPlan {
  id: string;
  intakePlanId: string;
  voiceoverPlanId?: string;
  visualsPlanId?: string;
  assetPlanId?: string;
  designPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  timeline: BrainCoreVideoAssemblyTimelineItem[];
  summary: {
    totalTimelineItems: number;
    plannedCount: number;
    blockedCount: number;
    estimatedDurationSeconds: number;
    estimatedDurationMinutes: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssemblyPlanListResponse {
  id: 'video-orchestrator-assembly-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoAssemblyPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalTimelineItems: number;
    estimatedDurationMinutes: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoAssemblyPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoAssemblyPlan;
  upstream: {
    voiceoverPlanId?: string;
    visualsPlanId?: string;
    assetPlanId?: string;
    designPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    rendersVideo: false;
    callsFfmpeg: false;
    generatesFiles: false;
    callsExternalAI: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlatformItem {
  id: string;
  platform: 'youtube' | 'facebook' | 'pinterest' | 'blog' | 'generic';
  status: 'planned' | 'blocked';
  titlePlaceholder: string;
  descriptionPlaceholder: string;
  tagPlaceholders: string[];
  categoryPlaceholder?: string;
  locale: string;
  requiredAssets: string[];
  complianceChecklist: string[];
  blockers: string[];
  safety: {
    readOnly: true;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlan {
  id: string;
  intakePlanId: string;
  researchId?: string;
  scriptPlanId?: string;
  assetPlanId?: string;
  assemblyPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  platforms: BrainCoreVideoMetadataPlatformItem[];
  summary: {
    totalPlatforms: number;
    plannedCount: number;
    blockedCount: number;
    requiredAssetCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlanListResponse {
  id: 'video-orchestrator-metadata-plan';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoMetadataPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalPlatformItems: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoMetadataPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoMetadataPlan;
  upstream: {
    researchId?: string;
    scriptPlanId?: string;
    assetPlanId?: string;
    assemblyPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    generatesSeoCopy: false;
    callsExternalAI: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepChecklistItem {
  id: string;
  label: string;
  status: 'planned' | 'blocked' | 'missing';
  category: 'metadata' | 'asset' | 'assembly' | 'policy' | 'platform' | 'manual-review';
  placeholder: string;
  blockers: string[];
  safety: {
    readOnly: true;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlatform {
  id: string;
  platform: 'youtube' | 'facebook' | 'pinterest' | 'blog' | 'generic';
  status: 'planned' | 'blocked';
  checklist: BrainCoreVideoPublishingPrepChecklistItem[];
  requiredArtifactRefs: string[];
  requiredMetadataRefs: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlan {
  id: string;
  intakePlanId: string;
  metadataPlanId?: string;
  assemblyPlanId?: string;
  assetPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  platforms: BrainCoreVideoPublishingPrepPlatform[];
  summary: {
    totalPlatforms: number;
    plannedCount: number;
    blockedCount: number;
    checklistItemCount: number;
    missingItemCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlanListResponse {
  id: 'video-orchestrator-publishing-prep';
  generatedAt: string;
  version: string;
  plans: BrainCoreVideoPublishingPrepPlan[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalPlatforms: number;
    totalChecklistItems: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoPublishingPrepPlanDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  plan: BrainCoreVideoPublishingPrepPlan;
  upstream: {
    metadataPlanId?: string;
    assemblyPlanId?: string;
    assetPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesFiles: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackageItem {
  id: string;
  label: string;
  kind: 'metadata-bundle' | 'asset-reference' | 'assembly-reference' | 'publishing-checklist' | 'manual-review' | 'platform-note' | 'validation-note';
  status: 'planned' | 'blocked' | 'missing';
  placeholder: string;
  sourceRef?: string;
  blockers: string[];
  safety: {
    readOnly: true;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackage {
  id: string;
  intakePlanId: string;
  publishingPrepPlanId?: string;
  metadataPlanId?: string;
  assemblyPlanId?: string;
  assetPlanId?: string;
  projectId: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  items: BrainCoreVideoManualExportPackageItem[];
  summary: {
    totalItems: number;
    plannedCount: number;
    blockedCount: number;
    missingCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackageListResponse {
  id: 'video-orchestrator-manual-export-package';
  generatedAt: string;
  version: string;
  packages: BrainCoreVideoManualExportPackage[];
  summary: {
    total: number;
    previewReadyCount: number;
    blockedCount: number;
    totalItems: number;
  };
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreVideoManualExportPackageDetailResponse {
  id: string;
  generatedAt: string;
  version: string;
  package: BrainCoreVideoManualExportPackage;
  upstream: {
    publishingPrepPlanId?: string;
    metadataPlanId?: string;
    assemblyPlanId?: string;
    assetPlanId?: string;
    intakePlanId: string;
  };
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    createsDownload: false;
    writesClipboard: false;
    callsPlatformApi: false;
    schedulesPost: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoParityMatrixEntry {
  id: string;
  stbStage: string;
  stbStageIndex: number;
  videoModule: string;
  videoModuleIndex: number;
  status: 'mapped' | 'partial' | 'planned' | 'blocked';
  deterministic: boolean;
  skipCondition?: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  validationStatus: 'not-tested' | 'preview-only' | 'tested' | 'blocked';
  validationEvidence?: string[];
  blockerReason?: string;
}

export interface BrainCoreStbVideoParityMatrix {
  id: 'stb-video-parity-matrix';
  generatedAt: string;
  version: string;
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
  stbStageCount: number;
  videoModuleCount: number;
  entries: BrainCoreStbVideoParityMatrixEntry[];
  summary: {
    totalEntries: number;
    mappedCount: number;
    partialCount: number;
    plannedCount: number;
    blockedCount: number;
    parityPercent: number;
    readinessScore: number;
  };
  risksAndMitigations: Array<{ risk: string; mitigation: string; priority: 'critical' | 'high' | 'medium' | 'low' }>;
  nextSteps: string[];
}

export interface BrainCoreStbVideoDualRunValidation {
  entryId: string;
  stbStage: string;
  videoModule: string;
  status: 'not-started' | 'in-progress' | 'passed' | 'failed' | 'blocked';
  testCount: number;
  passCount: number;
  passPercent: number;
  failureReason?: string;
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  lastTestedAt?: string;
}

export interface BrainCoreStbVideoDualRunStatus {
  id: 'stb-video-dual-run-status';
  generatedAt: string;
  version: string;
  sourcePipelineId: 'stb-daily-pipeline';
  targetPipelineId: 'video-upload-pipeline';
  executesStb: boolean;
  executesVideo: boolean;
  status: 'not-started' | 'in-progress' | 'partial-passed' | 'ready' | 'blocked' | 'decommissioned';
  health: BrainCoreHealth;
  dualRunEnabled: boolean;
  validations: BrainCoreStbVideoDualRunValidation[];
  summary: {
    totalValidations: number;
    notStartedCount: number;
    inProgressCount: number;
    passedCount: number;
    failedCount: number;
    blockedCount: number;
    readinessPercent: number;
  };
  nextSafeTask: string;
  blockers: string[];
  evidence: Array<{ label: string; path?: string; timestamp?: string; value: string }>;
  limitations: string[];
  actions: { canPreview: boolean; canRequestRun: boolean; canRetry: boolean; requiresApproval: boolean };
}

export interface BrainCoreStbVideoDualRunEvidenceItem {
  id: string;
  label: string;
  source: 'stb-status' | 'stb-parity' | 'video-planning' | 'manual-export-package' | 'runtime-status' | 'fixture';
  status: 'available' | 'missing' | 'blocked';
  value: string;
  blockers: string[];
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoDualRunEvidenceStage {
  id: string;
  stage: 'intake' | 'research' | 'script' | 'asset-plan' | 'design-plan' | 'voiceover-plan' | 'visuals-plan' | 'assembly-plan' | 'metadata-plan' | 'publishing-prep' | 'manual-export-package';
  status: 'evidence-available' | 'evidence-partial' | 'blocked' | 'missing';
  stbEvidence: BrainCoreStbVideoDualRunEvidenceItem[];
  videoEvidence: BrainCoreStbVideoDualRunEvidenceItem[];
  comparison: {
    hasStbEvidence: boolean;
    hasVideoEvidence: boolean;
    parityReady: boolean;
    notes: string[];
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoDualRunEvidenceReport {
  id: 'stb-video-dual-run-evidence';
  generatedAt: string;
  status: 'not-ready' | 'evidence-partial' | 'candidate-ready' | 'blocked';
  stages: BrainCoreStbVideoDualRunEvidenceStage[];
  summary: {
    totalStages: number;
    evidenceAvailableCount: number;
    partialCount: number;
    blockedCount: number;
    missingCount: number;
    parityReadyCount: number;
  };
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesStb: false;
    executesVideo: false;
    writesFiles: false;
    publishesContent: false;
    decommissionsStb: false;
    writesToMind: false;
  };
}

export interface BrainCoreStbVideoDualRunEvidenceResponse {
  evidence: BrainCoreStbVideoDualRunEvidenceReport;
}

export type BrainCorePostOrchestratorStatus = 'planned' | 'partial' | 'ready' | 'blocked' | 'disabled';

export type BrainCorePostProviderStatus =
  | 'not-integrated'
  | 'planned'
  | 'contract-defined'
  | 'stubbed'
  | 'ready'
  | 'blocked';

export type BrainCorePostContractStatus = 'draft' | 'defined' | 'validated' | 'implemented' | 'blocked';

export interface BrainCorePostOrchestratorModule {
  id: string;
  name: string;
  internalName?: string;
  legacySource?: 'proofly' | 'xgrow';
  status: BrainCorePostOrchestratorStatus;
  summary: string;
  owner: 'brain' | 'proofly' | 'xgrow' | 'platform' | 'external';
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCorePostOrchestratorContract {
  id: string;
  name: string;
  status: BrainCorePostContractStatus;
  version: string;
  owner: 'brain' | 'proofly' | 'xgrow';
  summary: string;
  fields: string[];
  implementedInBrain: boolean;
  implementedInProvider: boolean;
  executionEnabled: false;
}

export interface BrainCorePostOrchestratorIntegration {
  id: string;
  provider: 'proofly' | 'xgrow' | 'brain' | 'platform';
  legacySource?: 'proofly' | 'xgrow';
  name: string;
  internalName?: string;
  status: BrainCorePostProviderStatus;
  role: string;
  summary: string;
  contractIds: string[];
  executionEnabled: false;
  publishingEnabled: false;
  schedulingEnabled: false;
  safety: {
    readsSecrets: false;
    usesCookies: boolean;
    usesPlaywright: boolean;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresApproval: boolean;
  };
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCorePostOrchestratorRecoveryItem {
  id: string;
  severity: 'info' | 'warning' | 'error';
  source: 'brain' | 'proofly' | 'xgrow' | 'platform' | 'contract';
  title: string;
  summary: string;
  blocker: string;
  nextSafeStep: string;
  canAutoFix: false;
  executionEnabled: false;
}

export type BrainCorePostPlatform = 'x' | 'github' | 'linkedin' | 'facebook' | 'youtube' | 'blog' | 'internal';

export type BrainCorePostFlowStatus = 'stubbed' | 'planned' | 'blocked' | 'ready-read-only' | 'disabled';

export type BrainCorePostDraftStatus = 'fixture' | 'preview' | 'requires-approval' | 'blocked' | 'disabled';

export interface BrainCorePostFlowFixture {
  id: string;
  name: string;
  platform: BrainCorePostPlatform;
  status: BrainCorePostFlowStatus;
  summary: string;
  eventTypes: string[];
  outputFormats: string[];
  usesSocialProofAssetFlow: boolean;
  usesGrowthOptimizationFlow: boolean;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
}

export interface BrainCorePostDraftFixture {
  id: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  sourceEventType: string;
  title: string;
  copyPreview: string;
  format: 'single-post' | 'thread' | 'carousel' | 'release-note' | 'short-video-caption' | 'blog-summary';
  status: BrainCorePostDraftStatus;
  approvalRequired: true;
  assetFlowRequired: boolean;
  optimizationFlowRequired: boolean;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  safety: {
    generatedFromFixture: true;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
  };
}

export type BrainCorePostEventType =
  | 'github-commit'
  | 'pr-merged'
  | 'release-published'
  | 'repo-launch'
  | 'product-milestone'
  | 'mrr-milestone'
  | 'github-achievement'
  | 'video-rendered'
  | 'blog-published'
  | 'research-summary'
  | 'manual-request';

export type BrainCorePostEventSource =
  | 'github'
  | 'video-orchestrator'
  | 'manual'
  | 'analytics'
  | 'internal'
  | 'blog'
  | 'product';

export interface BrainCorePostEventFixture {
  id: string;
  source: BrainCorePostEventSource;
  eventType: BrainCorePostEventType;
  occurredAt: string;
  projectId: string;
  title: string;
  payloadSummary: string;
  priority: 'low' | 'normal' | 'high';
  suggestedPlatforms: BrainCorePostPlatform[];
  suggestedFlowIds: string[];
  safety: {
    fixtureOnly: true;
    readsExternalPlatform: false;
    writesExternalPlatform: false;
    writesToMind: false;
    containsSecrets: false;
  };
}

export type BrainCorePostPlanStatus = 'planned-preview' | 'blocked' | 'unsupported' | 'requires-approval';

export interface BrainCorePostDraftPlan {
  id: string;
  eventId: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  title: string;
  format: BrainCorePostDraftFixture['format'];
  copyPreview: string;
  assetFlowRequired: boolean;
  optimizationFlowRequired: boolean;
  approvalRequired: true;
  status: BrainCorePostPlanStatus;
  blockers: string[];
  nextSafeStep: string;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  safety: {
    dryRunOnly: true;
    generatedFromFixture: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
  };
}

export interface BrainCorePostDryRunPlan {
  id: string;
  event: BrainCorePostEventFixture;
  generatedAt: string;
  status: 'preview' | 'blocked';
  drafts: BrainCorePostDraftPlan[];
  unsupportedFlowIds: string[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    dryRunOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
  };
}

export interface BrainCorePostOrchestratorStatusResponse {
  id: 'post-orchestrator';
  name: 'Post Orchestrator';
  status: BrainCorePostOrchestratorStatus;
  summary: string;
  phase: 'P1-read-only-status-scaffold';
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  socialProofFlowLabel: string;
  growthOptimizationFlowLabel: string;
  modules: BrainCorePostOrchestratorModule[];
  nextSafeStep: string;
  updatedAt: string;
}

export interface BrainCorePostOrchestratorContractsResponse {
  contracts: BrainCorePostOrchestratorContract[];
}

export interface BrainCorePostOrchestratorIntegrationsResponse {
  integrations: BrainCorePostOrchestratorIntegration[];
}

export interface BrainCorePostOrchestratorRecoveryResponse {
  items: BrainCorePostOrchestratorRecoveryItem[];
}

export interface BrainCorePostFlowFixturesResponse {
  flows: BrainCorePostFlowFixture[];
}

export interface BrainCorePostDraftFixturesResponse {
  drafts: BrainCorePostDraftFixture[];
}

export interface BrainCorePostEventFixturesResponse {
  events: BrainCorePostEventFixture[];
}

export interface BrainCorePostDryRunPlanResponse {
  plan: BrainCorePostDryRunPlan;
}

export type BrainCorePostDraftReviewStatus = 'review-ready' | 'approval-requested' | 'blocked' | 'disabled';
export type BrainCorePostDraftReviewRisk = 'low' | 'medium' | 'high';

export interface BrainCorePostDraftReviewItem {
  id: string;
  draftPlanId: string;
  eventId: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  title: string;
  format: BrainCorePostDraftFixture['format'];
  copyPreview: string;
  status: BrainCorePostDraftReviewStatus;
  risk: BrainCorePostDraftReviewRisk;
  approvalRequired: true;
  approvalId?: string;
  canRequestApproval: boolean;
  canApproveForPublishing: false;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    reviewOnly: true;
    dryRunOnly: true;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
    callsExternalAI: false;
  };
}

export interface BrainCorePostDraftReviewQueue {
  id: string;
  status: 'preview' | 'blocked';
  generatedAt: string;
  eventId: string;
  itemCount: number;
  approvalRequestedCount: number;
  blockedCount: number;
  items: BrainCorePostDraftReviewItem[];
  safety: {
    reviewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostDraftReviewQueueResponse {
  queue: BrainCorePostDraftReviewQueue;
}

export interface BrainCorePostDraftReviewApprovalRequest {
  id: string;
  reviewItemId: string;
  approvalId?: string;
  status: 'requested' | 'blocked' | 'invalid';
  executionDidRun: false;
  summary: string;
  nextSafeStep: string;
  safety: BrainCorePostDraftReviewItem['safety'];
}

export type BrainCorePostSchedulePreviewStatus = 'preview-ready' | 'approval-requested' | 'blocked' | 'disabled';
export type BrainCorePostScheduleWindow = 'morning' | 'midday' | 'afternoon' | 'evening' | 'manual-review';

export interface BrainCorePostSchedulePreviewItem {
  id: string;
  reviewItemId: string;
  draftPlanId: string;
  eventId: string;
  flowId: string;
  platform: BrainCorePostPlatform;
  title: string;
  scheduledWindow: BrainCorePostScheduleWindow;
  suggestedLocalTime: string;
  timezone: string;
  rationale: string;
  status: BrainCorePostSchedulePreviewStatus;
  approvalRequired: true;
  approvalId?: string;
  canRequestApproval: boolean;
  canCreateSchedulerJob: false;
  canPublish: false;
  publishingEnabled: false;
  schedulingEnabled: false;
  executionEnabled: false;
  blockers: string[];
  nextSafeStep: string;
  safety: {
    previewOnly: true;
    writesScheduler: false;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
    callsExternalAI: false;
  };
}

export interface BrainCorePostSchedulePreviewQueue {
  id: string;
  eventId: string;
  status: 'preview' | 'blocked';
  generatedAt: string;
  itemCount: number;
  approvalRequestedCount: number;
  blockedCount: number;
  items: BrainCorePostSchedulePreviewItem[];
  safety: {
    previewOnly: true;
    schedulingEnabled: false;
    publishingEnabled: false;
    executionEnabled: false;
    writesScheduler: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostSchedulePreviewQueueResponse {
  queue: BrainCorePostSchedulePreviewQueue;
}

export interface BrainCorePostSchedulePreviewApprovalRequest {
  id: string;
  schedulePreviewItemId: string;
  approvalId?: string;
  status: 'requested' | 'blocked' | 'invalid';
  executionDidRun: false;
  summary: string;
  nextSafeStep: string;
  safety: BrainCorePostSchedulePreviewItem['safety'];
}

export type BrainCorePostAnalyticsMetric =
  | 'impressions'
  | 'clicks'
  | 'likes'
  | 'comments'
  | 'shares'
  | 'saves'
  | 'watchSeconds'
  | 'ctr'
  | 'engagementRate';

export interface BrainCorePostAnalyticsFixture {
  id: string;
  platform: BrainCorePostPlatform;
  flowId: string;
  draftPlanId?: string;
  title: string;
  capturedAt: string;
  source: 'fixture';
  metrics: Record<BrainCorePostAnalyticsMetric, number>;
  interpretation: string;
  feedbackForFlow: string;
  safety: {
    fixtureOnly: true;
    callsExternalAnalyticsApi: false;
    readsCookies: false;
    readsSecrets: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostAnalyticsFixturesResponse {
  analytics: BrainCorePostAnalyticsFixture[];
}

export type BrainCorePostPipelineStepId =
  | 'event'
  | 'dry-run'
  | 'review'
  | 'schedule-preview'
  | 'analytics-feedback'
  | 'readiness';

export type BrainCorePostPipelineStepStatus =
  | 'available'
  | 'preview'
  | 'blocked'
  | 'disabled'
  | 'missing';

export interface BrainCorePostPipelineStepSummary {
  id: BrainCorePostPipelineStepId;
  label: string;
  status: BrainCorePostPipelineStepStatus;
  itemCount: number;
  blockedCount: number;
  approvalRequiredCount: number;
  summary: string;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    previewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostPipelineSummary {
  id: string;
  eventId: string;
  title: string;
  status: 'preview' | 'blocked';
  generatedAt: string;
  steps: BrainCorePostPipelineStepSummary[];
  totals: {
    draftCount: number;
    reviewItemCount: number;
    schedulePreviewItemCount: number;
    analyticsFixtureCount: number;
    blockerCount: number;
    approvalRequiredCount: number;
  };
  nextSafeStep: string;
  blockers: string[];
  safety: {
    endToEndPreviewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    callsExternalApi: false;
    callsExternalAI: false;
    usesCookies: false;
    usesPlaywright: false;
  };
}

export interface BrainCorePostPipelineSummaryResponse {
  pipeline: BrainCorePostPipelineSummary;
}

export type BrainCorePostReadinessSeverity = 'info' | 'warning' | 'error';

export interface BrainCorePostReadinessBlocker {
  id: string;
  severity: BrainCorePostReadinessSeverity;
  source:
    | 'event'
    | 'dry-run'
    | 'review'
    | 'schedule-preview'
    | 'analytics'
    | 'publishing'
    | 'security'
    | 'contracts';
  title: string;
  summary: string;
  nextSafeStep: string;
  blocksPublishing: true;
  canAutoFix: false;
}

export interface BrainCorePostReadinessScore {
  id: string;
  eventId: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'blocked';
  status: 'preview' | 'blocked';
  generatedAt: string;
  blockers: BrainCorePostReadinessBlocker[];
  checks: Array<{
    id: string;
    label: string;
    passed: boolean;
    summary: string;
  }>;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    callsExternalApi: false;
    callsExternalAI: false;
    canAutoFix: false;
  };
}

export interface BrainCorePostReadinessScoreResponse {
  readiness: BrainCorePostReadinessScore;
}

export type BrainCorePostPlatformPolicyStatus =
  | 'not-reviewed'
  | 'review-required'
  | 'blocked'
  | 'approved-for-preview'
  | 'approved-for-manual-export'
  | 'approved-for-api-publishing';

export type BrainCorePostPlatformPublishingMode =
  | 'disabled'
  | 'manual-export-only'
  | 'api-required'
  | 'browser-automation-prohibited'
  | 'pending-security-review';

export type BrainCorePostPlatformRiskLevel = 'low' | 'medium' | 'high' | 'blocked';

export interface BrainCorePostPlatformPolicy {
  id: string;
  platform: BrainCorePostPlatform;
  label: string;
  status: BrainCorePostPlatformPolicyStatus;
  publishingMode: BrainCorePostPlatformPublishingMode;
  riskLevel: BrainCorePostPlatformRiskLevel;
  summary: string;
  allowedInCurrentPhase: {
    fixturePreview: true;
    draftReview: true;
    schedulePreview: true;
    manualExport: boolean;
    apiPublishing: false;
    browserAutomation: false;
  };
  securityReview: {
    required: boolean;
    completed: false;
    reason: string;
    blockers: string[];
  };
  complianceNotes: string[];
  nextSafeStep: string;
  safety: {
    readsCookies: false;
    readsSecrets: false;
    usesPlaywright: false;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostPlatformPoliciesResponse {
  policies: BrainCorePostPlatformPolicy[];
}

export type BrainCorePostDecommissionTarget =
  | 'legacy-asset-system'
  | 'legacy-growth-system'
  | 'legacy-schedulers'
  | 'legacy-publishing'
  | 'legacy-analytics';

export type BrainCorePostDecommissionStatus =
  | 'not-started'
  | 'blocked'
  | 'in-progress'
  | 'ready-for-review'
  | 'approved'
  | 'decommissioned';

export interface BrainCorePostDecommissionGate {
  id: string;
  label: string;
  passed: boolean;
  required: true;
  summary: string;
  nextSafeStep: string;
}

export interface BrainCorePostDecommissionReadinessItem {
  id: string;
  target: BrainCorePostDecommissionTarget;
  label: string;
  status: BrainCorePostDecommissionStatus;
  summary: string;
  gates: BrainCorePostDecommissionGate[];
  blockerCount: number;
  nextSafeStep: string;
  safety: {
    decommissionStarted: false;
    deletesFiles: false;
    modifiesLegacyRepo: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresExplicitUserApproval: true;
  };
}

export interface BrainCorePostDecommissionReadinessResponse {
  items: BrainCorePostDecommissionReadinessItem[];
  overall: {
    status: 'blocked' | 'not-ready' | 'ready-for-review';
    readyCount: number;
    blockedCount: number;
    decommissionStarted: false;
    nextSafeStep: string;
  };
}

export type BrainCorePostOperatorGuidanceSeverity = 'info' | 'warning' | 'blocked';
export type BrainCorePostOperatorGuidanceCategory =
  | 'review'
  | 'policy'
  | 'security'
  | 'decommission'
  | 'manual-export'
  | 'readiness'
  | 'analytics'
  | 'scheduling'
  | 'publishing';

export interface BrainCorePostOperatorGuidanceStep {
  id: string;
  label: string;
  summary: string;
  completed: boolean;
  required: boolean;
  actionType: 'read' | 'review' | 'manual-check' | 'request-approval' | 'wait' | 'blocked';
  safety: {
    executesCode: false;
    writesFiles: false;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresHumanReview: boolean;
  };
}

export interface BrainCorePostOperatorGuidanceItem {
  id: string;
  title: string;
  category: BrainCorePostOperatorGuidanceCategory;
  severity: BrainCorePostOperatorGuidanceSeverity;
  summary: string;
  source: 'pipeline' | 'readiness' | 'platform-policy' | 'decommission' | 'review-queue' | 'schedule-preview' | 'analytics';
  relatedEventId?: string;
  relatedFlowId?: string;
  relatedPlatform?: BrainCorePostPlatform;
  steps: BrainCorePostOperatorGuidanceStep[];
  nextSafeStep: string;
  blocksPublishing: boolean;
  safety: {
    readOnly: true;
    autoFixEnabled: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostOperatorGuidanceResponse {
  items: BrainCorePostOperatorGuidanceItem[];
  summary: {
    itemCount: number;
    blockedCount: number;
    warningCount: number;
    nextSafeStep: string;
  };
}

export type BrainCorePostManualExportFormat = 'plain-text' | 'markdown' | 'json-preview' | 'checklist';

export interface BrainCorePostManualExportItem {
  id: string;
  eventId: string;
  draftPlanId: string;
  platform: BrainCorePostPlatform;
  title: string;
  format: BrainCorePostManualExportFormat;
  contentPreview: string;
  checklist: string[];
  reviewNotes: string[];
  status: 'preview-ready' | 'blocked';
  safety: {
    previewOnly: true;
    writesFiles: false;
    downloadsFile: false;
    copiesToClipboard: false;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostManualExportPackage {
  id: string;
  eventId: string;
  title: string;
  generatedAt: string;
  status: 'preview' | 'blocked';
  itemCount: number;
  items: BrainCorePostManualExportItem[];
  nextSafeStep: string;
  safety: {
    previewOnly: true;
    writesFiles: false;
    downloadsFile: false;
    copiesToClipboard: false;
    writesExternalPlatform: false;
    writesToMind: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
  };
}

export interface BrainCorePostManualExportPackageResponse {
  package: BrainCorePostManualExportPackage;
}

export type BrainCorePostAcceptanceCheckStatus =
  | 'passed'
  | 'failed'
  | 'blocked'
  | 'not-applicable';

export type BrainCorePostAcceptanceCheckCategory =
  | 'api'
  | 'dashboard'
  | 'safety'
  | 'policy'
  | 'migration'
  | 'operator'
  | 'docs';

export interface BrainCorePostAcceptanceCheck {
  id: string;
  category: BrainCorePostAcceptanceCheckCategory;
  label: string;
  status: BrainCorePostAcceptanceCheckStatus;
  required: boolean;
  summary: string;
  evidence: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    executesCode: false;
    writesFiles: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostAcceptanceChecklist {
  id: string;
  title: string;
  generatedAt: string;
  status: 'preview-ready' | 'blocked';
  passedCount: number;
  blockedCount: number;
  failedCount: number;
  requiredCount: number;
  checks: BrainCorePostAcceptanceCheck[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    decommissionStarted: false;
  };
}

export interface BrainCorePostAcceptanceChecklistResponse {
  checklist: BrainCorePostAcceptanceChecklist;
}

export type BrainCorePostMigrationCapabilityStatus =
  | 'not-started'
  | 'preview-only'
  | 'partial'
  | 'blocked'
  | 'parity-ready';

export type BrainCorePostMigrationCapabilityArea =
  | 'asset-generation'
  | 'growth-optimization'
  | 'scheduler'
  | 'publishing'
  | 'analytics'
  | 'approval'
  | 'dashboard'
  | 'policy'
  | 'manual-export';

export interface BrainCorePostMigrationParityCapability {
  id: string;
  area: BrainCorePostMigrationCapabilityArea;
  label: string;
  status: BrainCorePostMigrationCapabilityStatus;
  summary: string;
  currentBrainSupport: string[];
  remainingGaps: string[];
  parityScore: number;
  nextSafeStep: string;
  safety: {
    previewOnly: boolean;
    modifiesLegacyRepo: false;
    decommissionStarted: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostMigrationParityReport {
  id: string;
  generatedAt: string;
  status: 'blocked' | 'in-progress' | 'preview-ready';
  overallParityScore: number;
  capabilities: BrainCorePostMigrationParityCapability[];
  blockers: string[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    modifiesLegacyRepo: false;
    decommissionStarted: false;
    deletesFiles: false;
    publishingEnabled: false;
    schedulingEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    requiresExplicitUserApprovalForDecommission: true;
  };
}

export interface BrainCorePostMigrationParityReportResponse {
  report: BrainCorePostMigrationParityReport;
}

export interface BrainCorePostRoadmapCheckpointPhase {
  id: string;
  label: string;
  status: 'complete' | 'in-progress' | 'blocked' | 'not-started';
  summary: string;
  evidence: string[];
}

export interface BrainCorePostRoadmapCheckpoint {
  id: string;
  generatedAt: string;
  currentPhase: string;
  completedPhaseCount: number;
  blockedPhaseCount: number;
  phases: BrainCorePostRoadmapCheckpointPhase[];
  nextRecommendedPhase: string;
  nextPhaseRequiresUserApproval: true;
  nextPhaseSummary: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    requiresExplicitUserApprovalBeforePublishingDesign: true;
  };
}

export interface BrainCorePostRoadmapCheckpointResponse {
  checkpoint: BrainCorePostRoadmapCheckpoint;
}

export interface BrainCorePostOrchestratorOverview {
  id: 'post-orchestrator-overview';
  generatedAt: string;
  phase: 'preview-checkpoint';
  status: 'preview-ready' | 'blocked';
  summary: string;
  counts: {
    flows: number;
    eventFixtures: number;
    draftFixtures: number;
    reviewItems: number;
    schedulePreviewItems: number;
    analyticsFixtures: number;
    policyItems: number;
    decommissionItems: number;
    guidanceItems: number;
    acceptanceChecks: number;
    migrationCapabilities: number;
    roadmapPhases: number;
  };
  keyStates: {
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    decommissionStarted: false;
    externalApiCallsEnabled: false;
    externalAiCallsEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
    usesCookies: false;
    usesPlaywright: false;
  };
  blockers: Array<{
    id: string;
    label: string;
    severity: 'info' | 'warning' | 'blocked';
    source: 'readiness' | 'policy' | 'decommission' | 'roadmap' | 'acceptance';
    nextSafeStep: string;
  }>;
  nextSafeStep: string;
  safety: {
    readOnly: true;
    previewOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    decommissionStarted: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostOrchestratorOverviewResponse {
  overview: BrainCorePostOrchestratorOverview;
}

export interface BrainCoreAgentSummary {
  id: string;
  name: string;
  role: 'orchestrator' | 'executor' | 'researcher' | 'maintainer' | 'reviewer' | 'dashboard' | 'unknown';
  status: 'available' | 'planned' | 'external' | 'blocked' | 'unknown';
  health: BrainCoreHealth;
  owner: 'brain-core' | 'model-router' | 'external-tool' | 'planned';
  description: string;
  relatedOrchestratorId?: string;
  skills: string[];
  actions: { canRun: boolean; canRequestRun: boolean; requiresApproval: boolean };
}

export interface BrainCoreAgentRunSummary {
  id: string;
  agentId: string;
  title: string;
  kind: string;
  status: 'queued' | 'running' | 'blocked' | 'completed' | 'failed' | 'cancelled' | 'planned' | 'unknown';
  startedAt?: string;
  completedAt?: string;
  ageMinutes?: number;
  durationSeconds?: number;
  targetType: string;
  targetId: string;
  source: 'approval' | 'scheduler' | 'placeholder';
  summary: string;
  relatedApprovalId?: string;
  relatedActionId?: string;
  relatedReportId?: string;
  relatedPipelineId?: string;
  blockers: string[];
  safety: {
    writesToMind: false;
    executesShell: boolean;
    mutatesRuntime: boolean;
    requiresApproval: boolean;
    executionEnabled: false;
  };
}

export interface BrainCoreAgentEventSummary {
  id: string;
  runId?: string;
  agentId?: string;
  type: 'requested' | 'approved' | 'rejected' | 'executed' | 'failed' | 'blocked' | 'unknown';
  createdAt: string;
  status: 'pending' | 'completed' | 'failed' | 'unknown';
  summary: string;
  severity: 'info' | 'warning' | 'error';
  relatedApprovalId?: string;
  relatedActionId?: string;
  relatedReportId?: string;
}

export interface BrainCoreRecoveryItemSummary {
  id: string;
  severity: 'info' | 'warning' | 'error';
  source: 'action' | 'approval' | 'report' | 'stb' | 'video' | 'scheduler' | 'maintenance' | 'system';
  title: string;
  summary: string;
  blocker: string;
  nextSafeStep: string;
  relatedActionId?: string;
  relatedApprovalId?: string;
  relatedEndpoint?: string;
  safety: {
    canAutoFix: false;
    requiresApproval: boolean;
    writesToMind: false;
  };
}

export interface BrainCoreCapabilitySummary {
  readEndpoints: string[];
  approvalRequestEndpoints: string[];
  executableActionsEnabled: false;
  approvalAuditPersistenceSupported: boolean;
  runtimeReportsSupported: boolean;
  runtimeReportEndpoint: '/runtime/reports';
  modelRouterReportSupported: boolean;
  obsidianPluginInstalled: boolean;
  liveSchedulerVerified: boolean;
  mindWorkspace: {
    legacyTaskMigrationStatus: 'completed' | 'pending' | 'skipped';
    legacyTaskMigrationCommit?: string;
    cleanupInventory: string;
    workspaceIsolationRunbook: string;
    remainingKnownDirtyCategories: string[];
  };
  brainConsole: {
    scaffoldStatus: 'validated' | 'pending' | 'blocked';
    installedInMindVault: false;
    projectPath: string;
    packageStatus?: 'buildable' | 'pending' | 'blocked';
    manualInstallRequired?: true;
  };
  probot: {
    thinClientStatus: 'wired' | 'pending' | 'blocked';
    commandAliasesEnabled: boolean;
    actionsEnabled: false;
  };
  executionGate: {
    executionEnabled: false;
    modelRouterDryRunExecutionFlagEnabled: boolean;
    modelRouterDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
    candidateActionKinds: string[];
    readinessEndpoint: '/execution/readiness';
    plansEndpoint: '/execution/plans';
    firstCandidate: 'scheduler-run-model-router-dry-run';
  };
  notes: string[];
}

export interface BrainCorePostQaEndpointCoverageItem {
  id: string;
  endpoint: string;
  purpose: string;
  expectedInDashboard: boolean;
  status: 'covered' | 'manual-check' | 'planned';
  safety: {
    readOnly: true;
    hasPost: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostQaChecklistItem {
  id: string;
  label: string;
  status: 'manual-check';
  summary: string;
}

export interface BrainCorePostQaStatus {
  id: 'post-orchestrator-qa-status';
  generatedAt: string;
  status: 'ready-for-manual-qa' | 'needs-attention';
  endpointCount: number;
  coveredCount: number;
  manualCheckCount: number;
  endpoints: BrainCorePostQaEndpointCoverageItem[];
  checklist: BrainCorePostQaChecklistItem[];
  nextSafeStep: string;
  safety: {
    readOnly: true;
    publishingEnabled: false;
    schedulingEnabled: false;
    executionEnabled: false;
    writesExternalPlatform: false;
    writesToMind: false;
  };
}

export interface BrainCorePostQaStatusResponse {
  qaStatus: BrainCorePostQaStatus;
}

export interface BrainCoreApprovalSummary {
  id: string;
  kind: string;
  status: 'placeholder' | 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  source: 'placeholder' | 'memory';
}

export interface BrainCoreApprovalPreview {
  kind: string;
  summary: string;
  wouldExecute: boolean;
  requiresApproval: true;
  writesToMind: false;
  externalSideEffects: false;
  commands: string[];
}

export interface BrainCoreExecutionGatePolicy {
  executionEnabled: boolean;
  executionGate: 'disabled-until-explicit-enable' | 'enabled-for-model-router-dry-run';
  requiresDurableAudit: true;
  requiresRollbackPlan: true;
}

export type BrainCoreApprovalStoreStatus = 'memory' | 'available' | 'invalid' | 'unsafe';

export interface BrainCoreApprovalRecord {
  createdAt: string;
  updatedAt: string;
  requestedBy: string;
  reason?: string;
  message?: string;
  id: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  expiresAt?: string;
  executed: boolean;
  execution?: BrainCoreApprovalExecutionSummary;
  preview: BrainCoreApprovalPreview;
  policy: BrainCoreExecutionGatePolicy;
  source: 'memory' | 'json';
  ageMinutes?: number;
  expired?: boolean;
}

export interface BrainCoreApprovalStoreSummary {
  enabled: boolean;
  status: BrainCoreApprovalStoreStatus;
  path: string;
  recordCount: number;
  writesToMind: false;
  executableActions: false;
}

export interface BrainCoreApprovalExecutionSummary {
  status: 'ok' | 'error' | 'blocked';
  command: 'bash tools/scripts/model-router-dry-run-report.sh';
  outputPath?: string;
  exitCode?: number;
  message: string;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreExecutionPlanStep {
  id: string;
  description: string;
  commandPreview: string;
  willRunNow: false;
}

export interface BrainCoreMindPreviewPolicySummary {
  status: 'preview-only';
  firstProposedAction: 'model-router-update-current-context';
  firstProposedTarget: 'router/current.md';
  writesToMind: false;
  externalSideEffects: false;
  applyRouteEnabled: false;
  allowedTargets: string[];
  blockedPrefixes: string[];
  requiredGates: string[];
}

export interface BrainCoreExecutionPlan {
  kind: 'scheduler-run-model-router-dry-run';
  candidate: true;
  executionEnabled: false;
  modelRouterDryRunExecutionFlagEnabled: boolean;
  modelRouterDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
  wouldExecute: false;
  executed: false;
  riskLevel: 'low';
  writesToMind: false;
  externalSideEffects: false;
  requiresApproval: true;
  requiresDurableApprovalStore: true;
  requiresDurableAudit: true;
  requiresRollbackPlan: true;
  rollbackPlan: string;
  summary: string;
  mindPreviewPolicy: BrainCoreMindPreviewPolicySummary;
  steps: BrainCoreExecutionPlanStep[];
}

export interface BrainCoreMindPreviewPolicyDocument {
  path: string;
  description: string;
}

export interface BrainCoreMindPreviewPolicy {
  status: 'preview-only';
  firstProposedAction: 'model-router-update-current-context';
  firstProposedTarget: 'router/current.md';
  applyRouteEnabled: false;
  writesToMind: false;
  externalSideEffects: false;
  allowedTargets: string[];
  blockedPrefixes: string[];
  requiredGates: string[];
  docs: BrainCoreMindPreviewPolicyDocument[];
}

export interface BrainCoreMindPreviewSummary {
  id: string;
  actionKind: 'model-router-update-current-context';
  targetPath: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  allowedRoot: boolean;
  blockedRoot: boolean;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreMindPreviewDetail extends BrainCoreMindPreviewSummary {
  operation: 'patch' | 'overwrite' | 'create';
  oldHash: string | null;
  newHash: string;
  lineCountBefore: number;
  lineCountAfter: number;
  maxLines: number | null;
  unifiedDiff: string;
  policyReasons: string[];
}

export interface BrainCoreMaintenancePreviewSummary {
  queueId: string;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  actionCount: number;
  lowRiskCount: number;
  mediumRiskCount: number;
  highRiskCount: number;
  approvalRequiredCount: number;
  writesToMind: false;
  externalSideEffects: false;
}

export interface BrainCoreMaintenancePreviewDetail extends BrainCoreMaintenancePreviewSummary {
  topActions: Array<{
    kind: string;
    title: string;
    risk: string;
  }>;
}

export interface BrainCoreExecutionReadiness {
  executionEnabled: false;
  modelRouterDryRunExecutionFlagEnabled: boolean;
  modelRouterDryRunExecutionFlagName: 'BRAIN_CORE_ENABLE_MODEL_ROUTER_DRY_RUN_EXECUTION';
  candidateCount: number;
  readyCandidateCount: number;
  blockers: string[];
  writesToMind: false;
  executableActions: false;
}

export type BrainCoreActionKind =
  | 'model-router-dry-run'
  | 'stb-status-refresh'
  | 'video-status-refresh'
  | 'stb-video-migration-review'
  | 'agent-readiness-review'
  | 'local-app-start'
  | 'local-app-stop'
  | 'local-app-restart'
  | 'orchestrator-run'
  | 'pipeline-dry-run'
  | 'mind-write-apply';

export type BrainCoreActionRisk = 'low' | 'medium' | 'high' | 'blocked';

export type BrainCoreActionStatus =
  | 'available'
  | 'approval-required'
  | 'planned'
  | 'blocked'
  | 'disabled';

export interface BrainCoreActionSafety {
  writesToMind: boolean;
  executesShell: boolean;
  mutatesRuntime: boolean;
  touchesStb: boolean;
  touchesVideo: boolean;
  requiresHumanReview: boolean;
}

export interface BrainCoreActionReadiness {
  status: 'ready' | 'blocked';
  blockers: string[];
  executionWillWriteToMind: false;
  executionWillApplyChanges: false;
  executionKind: 'report-only' | 'unknown';
  latestApprovalStatus?: 'pending' | 'approved' | 'rejected' | 'expired';
  latestApprovalId?: string;
  latestRequestAgeMinutes?: number;
  latestPreviewReportPath?: string;
  latestPreviewReportAgeMinutes?: number;
}

export interface BrainCoreActionSummary {
  id: string;
  kind: BrainCoreActionKind;
  label: string;
  description: string;
  targetType: 'system' | 'agent' | 'orchestrator' | 'pipeline' | 'project' | 'platform' | 'mind' | 'local-app';
  targetId: string;
  status: BrainCoreActionStatus;
  risk: BrainCoreActionRisk;
  requiresApproval: boolean;
  canRequestApproval: boolean;
  canExecuteNow: false;
  reason: string;
  safety: BrainCoreActionSafety;
  readiness?: BrainCoreActionReadiness;
}

export interface BrainCoreActionRequest {
  id: string;
  actionId: string;
  requestedAt: string;
  status: 'requested' | 'blocked' | 'invalid';
  summary: string;
  approvalId?: string | undefined;
  executionDidRun: false;
  safety: BrainCoreActionSafety;
}

export interface BrainCoreActionRequestResult {
  approval?: BrainCoreApprovalSummary;
  preview?: BrainCoreApprovalPreview;
  policy?: BrainCoreExecutionGatePolicy;
  accepted: boolean;
  executed: false;
  message: string;
}

export interface BrainCoreApprovalDecisionResult {
  approval: BrainCoreApprovalSummary;
  preview?: BrainCoreApprovalPreview;
  policy?: BrainCoreExecutionGatePolicy;
  execution?: BrainCoreApprovalExecutionSummary;
  accepted: true;
  executed: boolean;
  message: string;
}

export interface BrainCoreApprovalAuditEvent {
  id: string;
  approvalId: string;
  event: 'requested' | 'approved' | 'rejected' | 'missing' | 'executed';
  kind: string;
  createdAt: string;
  persisted: boolean;
  executed: boolean;
  execution?: BrainCoreApprovalExecutionSummary;
  source: 'memory' | 'jsonl';
}

export interface BrainCoreErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export type BrainCoreRuntimeReportId = 'model-router' | 'approval-audit' | 'video' | 'local-apps';

export type BrainCoreRuntimeReportStatus = 'available' | 'missing' | 'invalid';

export interface BrainCoreRuntimeReportSummary {
  id: BrainCoreRuntimeReportId;
  status: BrainCoreRuntimeReportStatus;
  path: string;
  latestRunStatus: 'ok' | 'failed' | 'unknown';
  message: string;
  writesToMind: false;
  executableActions: false;
  wikiHealth?: {
    status: 'available' | 'unavailable';
    ok: boolean;
    errorCount: number;
    warningCount: number;
  };
}

export interface BrainCoreRoutes {
  '/status': BrainCoreStatus;
  '/sessions': {
    sessions: BrainCoreSessionSummary[];
  };
  '/skills': {
    skills: BrainCoreSkillSummary[];
  };
  '/repos': {
    repos: BrainCoreRepoSummary[];
  };
  '/scheduler/status': BrainCoreSchedulerStatus;
  '/scheduler/latest-run': BrainCoreSchedulerStatus;
  '/scheduler/jobs': {
    jobs: BrainCoreSchedulerJobSummary[];
  };
  '/local-apps': {
    apps: BrainCoreLocalAppSummary[];
  };
  '/video/status': BrainCoreVideoStatus;
  '/video/queue': {
    queue: BrainCoreVideoQueueItem[];
  };
  '/approvals': {
    approvals: BrainCoreApprovalSummary[];
  };
  '/approvals/store': BrainCoreApprovalStoreSummary;
  '/execution/plans': {
    plans: BrainCoreExecutionPlan[];
  };
  '/execution/mind-preview-policy': BrainCoreMindPreviewPolicy;
  '/execution/mind-previews': {
    previews: BrainCoreMindPreviewSummary[];
  };
  '/execution/mind-previews/latest': {
    preview?: BrainCoreMindPreviewDetail;
    status: 'empty' | 'available';
  };
  '/execution/mind-previews/:id': {
    preview: BrainCoreMindPreviewDetail;
  };
  '/execution/readiness': BrainCoreExecutionReadiness;
  '/execution/plans/:kind': {
    plan?: BrainCoreExecutionPlan;
  };
  '/orchestrators': {
    orchestrators: BrainCoreOrchestratorSummary[];
  };
  '/orchestrators/:id': {
    orchestrator: BrainCoreOrchestratorSummary;
  };
  '/pipelines': {
    pipelines: BrainCorePipelineSummary[];
  };
  '/pipelines/:id': {
    pipeline: BrainCorePipelineSummary;
  };
  '/projects': {
    projects: BrainCoreProjectSummary[];
  };
  '/platforms': {
    platforms: BrainCorePlatformSummary[];
  };
  '/stb/status': BrainCoreStbPipelineStatus;
  '/video-orchestrator/status': BrainCoreVideoOrchestratorStatus;
  '/video-orchestrator/intake': BrainCoreVideoOrchestratorIntakeResponse;
  '/video-orchestrator/intake/:id': BrainCoreVideoIntakePlan;
  '/stb-video-migration/status': BrainCoreStbVideoMigrationStatus;
  '/stb-video/parity-matrix': BrainCoreStbVideoParityMatrix;
  '/stb-video/dual-run-status': BrainCoreStbVideoDualRunStatus;
  '/agents': {
    agents: BrainCoreAgentSummary[];
  };
  '/agents/:id': {
    agent: BrainCoreAgentSummary;
  };
  '/capabilities': BrainCoreCapabilitySummary;
  '/approvals/audit': {
    events: BrainCoreApprovalAuditEvent[];
  };
  '/runtime/reports': {
    reports: BrainCoreRuntimeReportSummary[];
  };
  '/actions/request': BrainCoreActionRequestResult;
  '/scheduler/jobs/:id/request-run': BrainCoreActionRequestResult;
  '/skills/profile': BrainCoreActionRequestResult;
  '/sessions/:id/resume': BrainCoreActionRequestResult;
  '/local-apps/:id/start': BrainCoreActionRequestResult;
  '/local-apps/:id/stop': BrainCoreActionRequestResult;
  '/local-apps/:id/restart': BrainCoreActionRequestResult;
  '/approvals/:id/approve': BrainCoreApprovalDecisionResult;
  '/approvals/:id/reject': BrainCoreApprovalDecisionResult;
  '/actions': {
    actions: BrainCoreActionSummary[];
  };
  '/actions/:id': {
    action: BrainCoreActionSummary;
  };
  '/actions/:id/request-approval': BrainCoreActionRequest;
}
