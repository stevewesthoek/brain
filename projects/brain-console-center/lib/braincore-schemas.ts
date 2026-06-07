import { z } from 'zod';

export const freshnessSchema = z.enum(['fresh', 'stale', 'unavailable', 'not_instrumented']);

export const opsMetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number().nullable(),
  unit: z.string().nullable(),
  status: freshnessSchema,
  generatedAt: z.string(),
  source: z.string(),
  message: z.string().optional(),
});

export const opsSystemMetricsSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  status: z.string(),
  data: z.object({
    cpuLoad: opsMetricSchema,
    memoryPressure: opsMetricSchema,
    gpuLoad: opsMetricSchema,
    uptime: opsMetricSchema,
  }),
});

export const opsAiUsageWindowsSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  status: z.string(),
  data: z.object({
    codexCurrentWindow: opsMetricSchema,
    codexFiveHourWindow: opsMetricSchema,
    codexSevenDayWindow: opsMetricSchema,
  }),
});

export const opsAiCostsSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  status: z.string(),
  data: z.object({
    claudeCodeHaiku: opsMetricSchema,
    claudeCodeSonnet: opsMetricSchema,
    claudeCodeOpus: opsMetricSchema,
  }),
});

export const brainCoreStatusSchema = z.record(z.unknown());

export const aiModelSelectorHealthMatrixSchema = z.object({
  id: z.literal('ai-model-selector-health-matrix'),
  generated_at: z.string(),
  status: z.string(),
  probe_mode: z.string(),
  selector: z.object({
    service: z.string(),
    port: z.number(),
    provider_count: z.number(),
    model_count: z.number(),
    selectable_model_count: z.number(),
  }),
  policy: z.object({
    selection_endpoint: z.string(),
    health_matrix_endpoint: z.string(),
    consumers_use_selector: z.boolean(),
    consumer_provider_probes_allowed: z.boolean(),
  }),
  providers: z.array(z.unknown()).default([]),
  models: z.array(z.object({
    provider_id: z.string(),
    provider_type: z.string(),
    model_id: z.string(),
    model_key: z.string(),
    label: z.string(),
    enabled: z.boolean(),
    selectable: z.boolean(),
    status: z.string(),
    capabilities: z.array(z.string()).default([]),
    roles: z.array(z.string()).default([]),
    region: z.string().nullable().optional(),
    last_checked_at: z.number().nullable().optional(),
    probe: z.object({
      status: z.string(),
      checked_at: z.number().nullable().optional(),
      error: z.unknown().optional(),
      response_preview: z.string().optional(),
    }),
    outcome: z.record(z.unknown()).default({}),
    cost: z.object({
      input_per_1m: z.number().nullable().optional(),
      output_per_1m: z.number().nullable().optional(),
    }),
    provider_healthy: z.boolean().optional(),
    rate_limited: z.boolean().optional(),
    loaded: z.boolean().optional(),
  })).default([]),
  error: z.string().optional(),
});

export const localAppSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  health: z.string().optional(),
  source: z.string().optional(),
  managed: z.boolean().optional(),
  startSupported: z.boolean().optional(),
  stopSupported: z.boolean().optional(),
  restartSupported: z.boolean().optional(),
  actionEnabled: z.boolean().optional(),
  actionDisabledReason: z.string().optional(),
  actionDisabledReasons: z.union([z.array(z.string()), z.record(z.string())]).optional(),
  lastCheckedAt: z.string().optional(),
  notes: z.string().optional(),
  url: z.string().optional(),
  port: z.number().nullable().optional(),
  servicePorts: z.array(z.number()).optional(),
  databasePort: z.number().nullable().optional(),
  containerName: z.string().optional(),
  containerStatus: z.enum(['running', 'stopped', 'unknown']).optional(),
});

export const localAppsDashboardSchema = z.object({
  id: z.string().optional(),
  status: z.string().optional(),
  appCount: z.number().optional(),
  runningCount: z.number().optional(),
  stoppedCount: z.number().optional(),
  unknownCount: z.number().optional(),
  managedCount: z.number().optional(),
  unmanagedCount: z.number().optional(),
  apps: z.array(localAppSchema).default([]),
  actionPolicy: z.record(z.unknown()).optional(),
  safety: z.record(z.unknown()).optional(),
  blockers: z.array(z.string()).optional(),
  nextSafeStep: z.string().optional(),
});

export const localAppsActionStatusSchema = z.record(z.unknown());
export const localAppsActionReadinessSchema = z.record(z.unknown());
export const localAppsActionResultSchema = z.record(z.unknown());

export const infraTunnelHostnameSchema = z.object({
  hostname: z.string(),
  service: z.string(),
  online: z.boolean().nullable(),
});
export type InfraTunnelHostname = z.infer<typeof infraTunnelHostnameSchema>;

export const infraTunnelSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  hostnames: z.array(infraTunnelHostnameSchema).default([]),
});
export type InfraTunnel = z.infer<typeof infraTunnelSchema>;

export const infraCloudflareTunnelsStatusSchema = z.object({
  status: z.enum(['ok', 'not-configured', 'error']),
  tunnels: z.array(infraTunnelSchema).default([]),
  error: z.string().optional(),
});
export type InfraCloudflareTunnelsStatus = z.infer<typeof infraCloudflareTunnelsStatusSchema>;

export const infraNewRelicHostSchema = z.object({
  name: z.string(),
  reporting: z.boolean(),
  alertSeverity: z.string().nullable(),
  online: z.boolean().nullable(),
  lastSeenAt: z.string().nullable(),
});
export type InfraNewRelicHost = z.infer<typeof infraNewRelicHostSchema>;

export const infraNewRelicSyntheticSchema = z.object({
  name: z.string(),
  reporting: z.boolean(),
  alertSeverity: z.string().nullable(),
  monitorId: z.string().optional(),
  online: z.boolean().nullable(),
  lastCheckAt: z.string().nullable(),
  lastResult: z.string().nullable(),
  lastError: z.string().nullable(),
});
export type InfraNewRelicSynthetic = z.infer<typeof infraNewRelicSyntheticSchema>;

export const infraNewRelicStatusSchema = z.object({
  status: z.enum(['ok', 'not-configured', 'error']),
  hosts: z.array(infraNewRelicHostSchema).default([]),
  synthetics: z.array(infraNewRelicSyntheticSchema).default([]),
  error: z.string().optional(),
});
export type InfraNewRelicStatus = z.infer<typeof infraNewRelicStatusSchema>;

export const infraOfficeSchedulerJobSchema = z.object({
  key: z.string(),
  label: z.string(),
  planned: z.literal(true),
  executed: z.boolean(),
  status: z.enum(['success', 'failed', 'timeout', 'never', 'running']),
  exitCode: z.number().nullable(),
  durationSeconds: z.number().nullable(),
  lastRunAt: z.string().nullable(),
  nextRunAt: z.string(),
  errorMessage: z.string().nullable(),
});
export type InfraOfficeSchedulerJob = z.infer<typeof infraOfficeSchedulerJobSchema>;

export const infraOfficeSchedulerReportSchema = z.object({
  available: z.boolean(),
  path: z.string(),
  summary: z.string(),
  generatedAt: z.string().nullable(),
  failureCount: z.number(),
});
export type InfraOfficeSchedulerReport = z.infer<typeof infraOfficeSchedulerReportSchema>;

export const infraOfficeSchedulerStatusSchema = z.object({
  status: z.enum(['ok', 'not-configured', 'error']),
  jobs: z.array(infraOfficeSchedulerJobSchema).default([]),
  totalJobs: z.number(),
  plannedJobs: z.number(),
  executedJobs: z.number(),
  runningJobs: z.number(),
  successfulJobs: z.number(),
  failedJobs: z.number(),
  timeoutJobs: z.number(),
  neverRunJobs: z.number(),
  nextRunAt: z.string(),
  report: infraOfficeSchedulerReportSchema,
  error: z.string().optional(),
});
export type InfraOfficeSchedulerStatus = z.infer<typeof infraOfficeSchedulerStatusSchema>;

export const infraDokployAppSchema = z.object({
  project: z.string(),
  environment: z.string(),
  name: z.string(),
  status: z.string(),
});
export type InfraDokployApp = z.infer<typeof infraDokployAppSchema>;

export const infraDokployComposeSchema = z.object({
  project: z.string(),
  environment: z.string(),
  name: z.string(),
  status: z.string(),
});
export type InfraDokployCompose = z.infer<typeof infraDokployComposeSchema>;

export const infraDokployStatusSchema = z.object({
  status: z.enum(['ok', 'not-configured', 'error']),
  apps: z.array(infraDokployAppSchema).default([]),
  compose: z.array(infraDokployComposeSchema).default([]),
  totalApps: z.number(),
  totalCompose: z.number(),
  appsByStatus: z.record(z.number()).default({}),
  composeByStatus: z.record(z.number()).default({}),
  error: z.string().optional(),
});
export type InfraDokployStatus = z.infer<typeof infraDokployStatusSchema>;

export const videoJobSchema = z.object({
  jobId: z.string(),
  channelId: z.string().optional().default('unknown'),
  title: z.string().optional().default('Untitled job'),
  status: z.string().optional().default('unknown'),
  currentStep: z.string().nullable().optional(),
  progress: z.number().optional().default(0),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
  approval: z.record(z.unknown()).optional(),
  generation: z.record(z.unknown()).optional(),
  publishing: z.record(z.unknown()).optional(),
  error: z.record(z.unknown()).optional(),
  artifacts: z.record(z.unknown()).optional(),
  clientActionId: z.string().optional().nullable(),
}).passthrough();

export const videoJobsDiagnosticsSchema = z.object({
  repoRoot: z.string().optional().default(''),
  jobsRoot: z.string().optional().default(''),
  jobDirectoryExists: z.boolean().optional().default(false),
  jobDirectoryReadable: z.boolean().optional().default(false),
  localJobFolderCount: z.number().optional().default(0),
  localDiscoveredJobCount: z.number().optional().default(0),
  s3DiscoveryAttempted: z.boolean().optional().default(false),
  s3DiscoveredJobCount: z.number().optional().default(0),
  hydratedJobCount: z.number().optional().default(0),
  skippedJobCount: z.number().optional().default(0),
  skippedJobs: z.array(z.object({
    jobId: z.string(),
    reason: z.string(),
  }).passthrough()).optional().default([]),
  warnings: z.array(z.string()).optional().default([]),
  error: z.string().nullable().optional().default(null),
}).passthrough();

export const recentVideoJobsSchema = z.object({
  ok: z.boolean().optional(),
  jobs: z.array(videoJobSchema).default([]),
  diagnostics: videoJobsDiagnosticsSchema.optional(),
}).passthrough();

export const videoJobResponseSchema = z.object({
  ok: z.boolean().optional(),
  data: videoJobSchema,
});

export const videoTimelineSchema = z.object({
  jobId: z.string().optional(),
  events: z.array(z.object({
    step: z.string().optional().default('step'),
    status: z.string().optional().default('unknown'),
    timestamp: z.string().nullable().optional(),
    message: z.string().optional().default(''),
  }).passthrough()).default([]),
}).passthrough();

export const videoTimelineResponseSchema = z.object({
  ok: z.boolean().optional(),
  data: videoTimelineSchema,
});

export const videoArtifactsResponseSchema = z.object({
  ok: z.boolean().optional(),
  data: z.record(z.unknown()).nullable().optional(),
}).passthrough();

export const videoMotionPlanSchema = z.object({
  jobId: z.string(),
  provider: z.literal('local-ffmpeg-motion'),
  mode: z.literal('ken-burns'),
  sceneCount: z.number(),
  generatedClipKeys: z.array(z.string()).default([]),
  generatedFrameKeys: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  fallbackUsed: z.boolean(),
  fallbackReason: z.string().nullable(),
}).passthrough();

export const videoExecutionResponseSchema = z.object({
  ok: z.boolean().optional(),
  data: z.record(z.unknown()).nullable().optional(),
}).passthrough();

export const videoReviewSchema = z.object({
  ok: z.boolean().optional(),
  review: z.object({
    jobId: z.string(),
    reviewStatus: z.enum(['pending', 'approved', 'changes_requested']),
    createdAt: z.string(),
    updatedAt: z.string(),
    reviewedAt: z.string().nullable(),
    reviewedBy: z.string().nullable(),
    notes: z.string().nullable(),
    media: z.object({
      scenePlanKey: z.string().nullable(),
      narrationScriptKey: z.string().nullable(),
      audioKey: z.string().nullable(),
      sceneImageKeys: z.array(z.string()),
      videoKey: z.string().nullable(),
      thumbnailKey: z.string().nullable(),
      publishKey: z.string().nullable(),
      youtubePackageKey: z.string().nullable(),
      overlayPlanKey: z.string().nullable().optional(),
    }),
    finalization: z.object({
      attempted: z.boolean(),
      ok: z.boolean(),
      missing: z.array(z.string()),
      repaired: z.array(z.string()),
    }).optional(),
  }),
}).passthrough();

export const videoStatusSchema = z.object({
  ok: z.boolean().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

export const videoControlPlaneSchema = z.object({
  ok: z.boolean().optional(),
  data: z.object({
    jobId: z.string(),
    prompt: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    canonicalPhase: z.string(),
    phaseStatus: z.string(),
    progress: z.number().nullable().optional(),
    execution: z.object({
      status: z.string().nullable(),
      unavailableReason: z.string().optional(),
    }),
    artifacts: z.object({
      status: z.string().nullable(),
      unavailableReason: z.string().optional(),
    }),
    review: z.object({
      status: z.string().nullable(),
      reviewStatus: z.string().nullable().optional(),
      media: z.record(z.unknown()).nullable().optional(),
    }),
    publish: z.object({
      status: z.string().nullable(),
      publishStatus: z.string().nullable().optional(),
    }),
    finalization: z.object({
      status: z.enum(['pending', 'complete', 'failed']).nullable(),
      reason: z.string().optional(),
    }),
    allowedActions: z.array(z.object({
      action: z.string(),
      enabled: z.boolean(),
      reason: z.string().optional(),
    })),
    missingRequirements: z.array(z.object({
      field: z.string(),
      label: z.string(),
    })),
    warnings: z.array(z.string()),
    errors: z.array(z.string()),
    updatedAt: z.string(),
  }).optional(),
}).passthrough();

export const videoActionResultSchema = z.record(z.unknown());

export const videoAnalysisAiSummarySchema = z.object({
  topic: z.string().nullable().optional(),
  speaker: z.string().nullable().optional(),
  key_claims: z.array(z.string()).default([]),
  evidence_type: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  research_hooks: z.array(z.string()).default([]),
}).passthrough();

export const videoAnalysisResponseSchema = z.object({
  ok: z.boolean(),
  title: z.string().nullable().optional(),
  channel: z.string().nullable().optional(),
  transcript: z.string().nullable().optional(),
  human_summary: z.string().nullable().optional(),
  ai_summary: videoAnalysisAiSummarySchema.nullable().optional(),
  mind_path: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
  step: z.string().nullable().optional(),
}).passthrough();

export const videoAnalysisHistoryAiSummarySchema = z.object({
  topic: z.string().nullable(),
  speaker: z.string().nullable(),
  keyClaims: z.array(z.string()).default([]),
  evidenceType: z.string().nullable(),
  confidence: z.string().nullable(),
  researchHooks: z.array(z.string()).default([]),
});

export const videoAnalysisHistoryEntrySchema = z.object({
  id: z.string(),
  analyzedAt: z.string(),
  url: z.string(),
  focus: z.string().nullable(),
  ok: z.boolean(),
  title: z.string().nullable(),
  channel: z.string().nullable(),
  transcript: z.string().nullable(),
  humanSummary: z.string().nullable(),
  aiSummary: videoAnalysisHistoryAiSummarySchema.nullable(),
  mindPath: z.string().nullable(),
  error: z.string().nullable(),
  step: z.string().nullable(),
});

export const videoAnalysisHistoryResponseSchema = z.object({
  status: z.enum(['ok', 'empty', 'invalid']),
  path: z.string(),
  total: z.number(),
  returned: z.number(),
  entries: z.array(videoAnalysisHistoryEntrySchema).default([]),
  latestAnalyzedAt: z.string().nullable(),
  error: z.string().optional(),
});

export const youtubePublishResultSchema = z.object({
  ok: z.boolean(),
  jobId: z.string().optional(),
  dryRun: z.boolean().optional(),
  publishStatus: z.string().optional(),
  videoId: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  stdout: z.string().optional(),
  stderr: z.string().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
}).passthrough();

const metadataQualitySchema = z.object({
  warnings: z.array(z.string()).default([]),
  titleLength: z.number(),
  tagCount: z.number(),
  descriptionLength: z.number(),
  hasInternalTerms: z.boolean(),
}).optional();

export const youtubePackageSchema = z.object({
  jobId: z.string(),
  sourcePrompt: z.string().optional(),
  generationMode: z.string().optional(),
  title: z.string(),
  description: z.string(),
  shortDescription: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  searchKeywords: z.array(z.string()).optional().default([]),
  categoryId: z.string().optional().default('22'),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).optional().default('private'),
  thumbnailKey: z.string().nullable().optional(),
  videoKey: z.string().nullable().optional(),
  scenePlanKey: z.string().nullable().optional(),
  narrationScriptKey: z.string().nullable().optional(),
  youtubePackageKey: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  metadataQuality: metadataQualitySchema,
}).passthrough();

export const thumbnailMetadataSchema = z.object({
  jobId: z.string(),
  thumbnailStatus: z.enum(['generated', 'pending', 'failed']),
  createdAt: z.string(),
  updatedAt: z.string(),
  provider: z.string(),
  source: z.object({
    kind: z.string(),
    key: z.string().nullable(),
  }),
  thumbnailKey: z.string(),
  previewKey: z.string().nullable().optional(),
  width: z.number(),
  height: z.number(),
  mimeType: z.string(),
  titleOverlay: z.string().nullable().optional(),
  prompt: z.string().nullable().optional(),
  warnings: z.array(z.string()).optional().default([]),
}).passthrough();

export type OpsMetric = z.infer<typeof opsMetricSchema>;
export type OpsSystemMetrics = z.infer<typeof opsSystemMetricsSchema>;
export type OpsAiUsageWindows = z.infer<typeof opsAiUsageWindowsSchema>;
export type OpsAiCosts = z.infer<typeof opsAiCostsSchema>;
export type AiModelSelectorHealthMatrix = z.output<typeof aiModelSelectorHealthMatrixSchema>;
export type AiModelSelectorHealthMatrixModel = AiModelSelectorHealthMatrix['models'][number];
export type LocalApp = z.infer<typeof localAppSchema>;
export type LocalAppsDashboard = z.infer<typeof localAppsDashboardSchema>;
export type VideoJob = z.output<typeof videoJobSchema>;
export type VideoJobsDiagnostics = z.output<typeof videoJobsDiagnosticsSchema>;
export type VideoTimeline = z.output<typeof videoTimelineSchema>;
export type VideoReview = z.output<typeof videoReviewSchema>['review'];
export type VideoAnalysisResponse = z.output<typeof videoAnalysisResponseSchema>;
export type VideoAnalysisHistoryEntry = z.output<typeof videoAnalysisHistoryEntrySchema>;
export type VideoAnalysisHistoryResponse = z.output<typeof videoAnalysisHistoryResponseSchema>;
export type YouTubePackage = z.infer<typeof youtubePackageSchema>;
export type ThumbnailMetadata = z.infer<typeof thumbnailMetadataSchema>;

// Control-plane data type (used in dashboard, defined by brain-core)
// Flexible type for backward compatibility during transition
export type VideoControlPlaneData = Record<string, unknown> | null;

export const mindStewardReportStatusSchema = z.object({
  available: z.boolean(),
  fileName: z.string(),
  status: z.string(),
  message: z.string().nullable(),
  mode: z.string().nullable(),
  writesToMind: z.boolean().nullable(),
  executableActions: z.boolean().nullable(),
  endedAtLisbon: z.string().nullable(),
  durationSeconds: z.number().nullable(),
});

export const mindStewardSchedulerStatusSchema = z.object({
  status: z.string(),
  source: z.string(),
  reportCount: z.number(),
  availableCount: z.number(),
  reports: z.object({
    dryRun: mindStewardReportStatusSchema,
    inbox: mindStewardReportStatusSchema,
    classifier: mindStewardReportStatusSchema,
    queue: mindStewardReportStatusSchema,
  }),
});

export type MindStewardSchedulerStatus = z.infer<typeof mindStewardSchedulerStatusSchema>;



export const graphifyOutputValidationSchema = z.object({
  status: z.string(),
  requiredCount: z.number(),
  availableCount: z.number(),
  missing: z.array(z.string()),
}).nullable();

export const graphifySafetySchema = z.object({
  runsGraphify: z.boolean().optional(),
  callsAiModelSelector: z.boolean().optional(),
  writesTargetRepo: z.boolean().optional(),
  hardcodesModelFallback: z.boolean().optional(),
}).nullable();

export const graphifyReportStatusSchema = z.object({
  available: z.boolean(),
  fileName: z.string(),
  status: z.string(),
  generatedAt: z.string().nullable(),
  repoPath: z.string().nullable(),
  profile: z.string().nullable(),
  repoRole: z.string().nullable(),
  modes: z.array(z.string()),
  operation: z.string().nullable(),
  executeRequested: z.boolean().nullable(),
  executionEnabled: z.boolean().nullable(),
  plannedOnly: z.boolean().nullable(),
  graphifyCommand: z.string().nullable(),
  blockedReason: z.string().nullable(),
  selectorStatus: z.string().nullable(),
  selectorResolutionRequested: z.boolean().nullable(),
  selectorResolutionEnabled: z.boolean().nullable(),
  selectedProvider: z.string().nullable(),
  selectedModel: z.string().nullable(),
  outputValidation: graphifyOutputValidationSchema,
  safety: graphifySafetySchema,
});

export const graphifyStatusSchema = z.object({
  status: z.string(),
  source: z.string(),
  reportCount: z.number(),
  availableCount: z.number(),
  reports: z.object({
    mindKnowledge: graphifyReportStatusSchema,
    brainRuntime: graphifyReportStatusSchema,
  }),
});

export type GraphifyStatus = z.infer<typeof graphifyStatusSchema>;
