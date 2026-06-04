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
}).passthrough();

export const recentVideoJobsSchema = z.object({
  ok: z.boolean().optional(),
  jobs: z.array(videoJobSchema).default([]),
});

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

export const videoExecutionResponseSchema = z.object({
  ok: z.boolean().optional(),
  data: z.record(z.unknown()).nullable().optional(),
}).passthrough();

export const videoStatusSchema = z.object({
  ok: z.boolean().optional(),
  data: z.record(z.unknown()).optional(),
}).passthrough();

export const videoActionResultSchema = z.record(z.unknown());

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
}).passthrough();

export type OpsMetric = z.infer<typeof opsMetricSchema>;
export type OpsSystemMetrics = z.infer<typeof opsSystemMetricsSchema>;
export type OpsAiUsageWindows = z.infer<typeof opsAiUsageWindowsSchema>;
export type OpsAiCosts = z.infer<typeof opsAiCostsSchema>;
export type AiModelSelectorHealthMatrix = z.output<typeof aiModelSelectorHealthMatrixSchema>;
export type AiModelSelectorHealthMatrixModel = AiModelSelectorHealthMatrix['models'][number];
export type LocalApp = z.infer<typeof localAppSchema>;
export type LocalAppsDashboard = z.infer<typeof localAppsDashboardSchema>;
export type VideoJob = z.infer<typeof videoJobSchema>;
export type VideoTimeline = z.infer<typeof videoTimelineSchema>;
