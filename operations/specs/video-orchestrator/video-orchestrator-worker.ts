/**
 * Video Orchestrator Phase 2B Worker
 *
 * Executes the PostgreSQL-backed job queue and writes durable Phase 2B records.
 * Rendering, transcription, and thumbnail engines are adapter hooks; until those
 * commands are supplied in task_config, the worker writes explicit placeholder
 * artifacts so downstream manifest generation remains resumable and inspectable.
 */

import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

type JobType = 'render' | 'caption' | 'thumbnail' | 'manifest' | 'post' | 'analytics';
type JobStatus = 'pending' | 'leased' | 'running' | 'succeeded' | 'failed' | 'dead';

interface Job {
  job_id: string;
  video_id: string | null;
  job_type: JobType;
  job_status: JobStatus;
  task_config: Record<string, unknown>;
  output_path: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

interface VideoWithAssets {
  video_id: string;
  project_id: string | null;
  series_id: string | null;
  source_script_path: string;
  source_audio_path: string;
  renders: Array<Record<string, unknown>>;
  captions: Array<Record<string, unknown>>;
  thumbnails: Array<Record<string, unknown>>;
}

interface ProductionPackageManifest {
  video_id: string;
  project_id?: string;
  series_id?: string;
  created_at: string;
  source_script_path: string;
  source_audio_path: string;
  render_outputs: Array<{
    format_key: string;
    path: string;
    resolution: string;
    duration_seconds: number;
  }>;
  caption_outputs: Array<{
    format: 'srt' | 'vtt' | 'json';
    language: string;
    path: string;
  }>;
  thumbnail_outputs: Array<{
    format_key: string;
    path: string;
  }>;
  package_targets: Array<{
    platform: string;
    package_target: string;
    adapter_mode: string;
    adapter_status: string;
    video_path: string;
    captions: { primary_format: string; caption_files: Array<{ language: string; format: string; path: string }>; caption_note: string };
    thumbnail_path: string;
    title: string;
    description: string;
    hashtags: string[];
    tags: string[];
    upload_ready: boolean;
    manual_steps: string[];
    known_limitations: string[];
    last_verified_at: string;
  }>;
  adapter_status: {
    last_verified_at: string;
    all_adapters_ready: boolean;
    manual_fallback_available: boolean;
  };
  manual_upload_instructions: Record<string, {
    platform: string;
    package_target: string;
    steps: string[];
    required_fields: string[];
    optional_fields: string[];
  }>;
  verification: {
    status: 'complete' | 'incomplete' | 'errors' | 'warnings';
    completeness_percent: number;
  };
  errors: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
}

type FormatSpec = {
  format_key: string;
  target_platforms: string[];
  resolution: string;
  aspect_ratio: string;
  bitrate_target_kbps?: number;
  rendering_mode_default?: string;
};

type PlatformSpec = {
  platform: string;
  package_target: string;
  adapter_status: string;
  posting_modes?: string[];
  manual_fallback?: boolean;
  last_verified_at?: string;
  known_failure_modes?: string[];
  manual_upload_instructions?: string;
  title_rules?: { max_length?: number };
  description_rules?: { max_length?: number; allows_hashtags?: boolean };
  hashtags_rules?: { max_count?: number };
};

export class VideoOrchestratorWorker {
  private platformSpecs: { platforms: PlatformSpec[] };
  private formatSpecs: { formats: FormatSpec[] };
  private captionSpecs: Record<string, unknown>;
  private readonly maxRetries = 3;
  private readonly dbUrl: string;
  private readonly artifactRoot: string;

  constructor(
    dbUrl: string = process.env.VIDEO_ORCHESTRATOR_DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5450/video_orchestrator',
    artifactRoot: string = process.env.VIDEO_ORCHESTRATOR_ARTIFACT_ROOT ?? '/Users/Office/projects/video-orchestrator',
  ) {
    this.dbUrl = dbUrl;
    this.artifactRoot = artifactRoot;
    this.platformSpecs = this.readJson('platform-specs.json');
    this.formatSpecs = this.readJson('format-specs.json');
    this.captionSpecs = this.readJson('caption-specs.json');
  }

  async run(): Promise<void> {
    console.log('Video Orchestrator Worker started');
    while (true) {
      const job = await this.pullNextJob();
      if (!job) {
        await this.sleep(1000);
        continue;
      }

      try {
        await this.executeJob(job);
      } catch (err) {
        await this.handleJobFailure(job, err as Error);
      }
    }
  }

  private readJson<T>(fileName: string): T {
    const specDir = '/Users/Office/Repos/stevewesthoek/brain/operations/specs/video-orchestrator';
    return JSON.parse(fs.readFileSync(path.join(specDir, fileName), 'utf-8')) as T;
  }

  private async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const sqlFile = await this.writeTempSql(`SELECT COALESCE(json_agg(row_to_json(q)), '[]'::json) FROM (${sql}) q;`);
    const args = [
      this.dbUrl,
      '--no-align',
      '--tuples-only',
      '--quiet',
      '-v',
      'ON_ERROR_STOP=1',
      ...this.psqlVariables(params),
      '-f',
      sqlFile,
    ];
    try {
      const { stdout } = await execFileAsync('psql', args, { maxBuffer: 10 * 1024 * 1024 });
      return JSON.parse(stdout.trim() || '[]') as T[];
    } finally {
      await fs.promises.rm(path.dirname(sqlFile), { force: true, recursive: true });
    }
  }

  private async queryJson<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
    const sqlFile = await this.writeTempSql(sql);
    try {
      const { stdout } = await execFileAsync('psql', [
        this.dbUrl,
        '--no-align',
        '--tuples-only',
        '--quiet',
        '-v',
        'ON_ERROR_STOP=1',
        ...this.psqlVariables(params),
        '-f',
        sqlFile,
      ], { maxBuffer: 10 * 1024 * 1024 });
      return JSON.parse(stdout.trim() || '[]') as T[];
    } finally {
      await fs.promises.rm(path.dirname(sqlFile), { force: true, recursive: true });
    }
  }

  private async execute(sql: string, params: unknown[] = []): Promise<void> {
    const sqlFile = await this.writeTempSql(`${sql};`);
    try {
      await execFileAsync('psql', [this.dbUrl, '--quiet', '-v', 'ON_ERROR_STOP=1', ...this.psqlVariables(params), '-f', sqlFile], {
        maxBuffer: 10 * 1024 * 1024,
      });
    } finally {
      await fs.promises.rm(path.dirname(sqlFile), { force: true, recursive: true });
    }
  }

  private async writeTempSql(sql: string): Promise<string> {
    const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'video-orchestrator-'));
    const filePath = path.join(dir, 'query.sql');
    await fs.promises.writeFile(filePath, sql);
    return filePath;
  }

  private psqlVariables(params: unknown[]): string[] {
    return params.flatMap((param, index) => ['-v', `param_${index + 1}=${JSON.stringify(param)}`]);
  }

  private sqlParam(index: number, cast: string = 'text'): string {
    return `(:'param_${index}'::jsonb #>> '{}')::${cast}`;
  }

  private sqlJsonParam(index: number): string {
    return `:'param_${index}'::jsonb`;
  }

  private async pullNextJob(): Promise<Job | null> {
    const rows = await this.queryJson<Job>(`
      WITH next_job AS (
        SELECT job_id
        FROM jobs
        WHERE job_status = 'pending'
        ORDER BY created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      ),
      leased AS (
        UPDATE jobs j
        SET job_status = 'leased', started_at = COALESCE(started_at, NOW())
        FROM next_job
        WHERE j.job_id = next_job.job_id
        RETURNING j.*
      )
      SELECT COALESCE(json_agg(row_to_json(leased)), '[]'::json) FROM leased;
    `);
    return rows[0] ?? null;
  }

  private async executeJob(job: Job): Promise<void> {
    await this.execute(`UPDATE jobs SET job_status = 'running', started_at = COALESCE(started_at, NOW()) WHERE job_id = ${this.sqlParam(1, 'uuid')}`, [job.job_id]);
    await this.emitEvent(job, 'job_started', { job_type: job.job_type });

    switch (job.job_type) {
      case 'render':
        await this.executeRenderJob(job);
        break;
      case 'caption':
        await this.executeCaptionJob(job);
        break;
      case 'thumbnail':
        await this.executeThumbnailJob(job);
        break;
      case 'manifest':
        await this.executeManifestJob(job);
        break;
      case 'post':
        await this.executePostingJob(job);
        break;
      case 'analytics':
        await this.executeAnalyticsJob(job);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }

  private async executeRenderJob(job: Job): Promise<void> {
    const config = job.task_config;
    const videoId = String(config.video_id ?? job.video_id ?? '');
    const formatKey = String(config.format_key ?? '');
    const outputPath = String(config.output_path ?? path.join(this.artifactRoot, 'renders', videoId, `${formatKey}.mp4`));
    const spec = this.getFormatSpec(formatKey);
    if (!videoId || !spec) throw new Error(`Invalid render config for job ${job.job_id}`);

    await this.runOptionalCommand(config.render_command);
    await this.ensurePlaceholderFile(outputPath, `Render placeholder for ${videoId} ${formatKey}\n`);
    const stat = await fs.promises.stat(outputPath);
    const duration = Number(config.duration_seconds ?? 0);

    await this.execute(`
      INSERT INTO renders (video_id, format_key, file_path, resolution, aspect_ratio, duration_seconds, file_size_bytes, bitrate_kbps, rendering_mode)
      VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2)}, ${this.sqlParam(3)}, ${this.sqlParam(4)}, ${this.sqlParam(5)}, ${this.sqlParam(6, 'int')}, ${this.sqlParam(7, 'bigint')}, ${this.sqlParam(8, 'int')}, ${this.sqlParam(9)})
      ON CONFLICT (video_id, format_key) DO UPDATE SET
        file_path = EXCLUDED.file_path,
        resolution = EXCLUDED.resolution,
        aspect_ratio = EXCLUDED.aspect_ratio,
        duration_seconds = EXCLUDED.duration_seconds,
        file_size_bytes = EXCLUDED.file_size_bytes,
        bitrate_kbps = EXCLUDED.bitrate_kbps,
        rendering_mode = EXCLUDED.rendering_mode,
        created_at = NOW()
    `, [videoId, formatKey, outputPath, spec.resolution, spec.aspect_ratio, duration, stat.size, spec.bitrate_target_kbps ?? 0, spec.rendering_mode_default ?? 'canonical_timeline']);

    await this.markJobSucceeded(job, outputPath);
  }

  private async executeCaptionJob(job: Job): Promise<void> {
    const config = job.task_config;
    const videoId = String(config.video_id ?? job.video_id ?? '');
    const language = String(config.language ?? 'auto');
    const outputDir = String(config.output_dir ?? path.join(this.artifactRoot, 'captions', videoId));
    if (!videoId) throw new Error(`Invalid caption config for job ${job.job_id}`);

    await this.runOptionalCommand(config.caption_command);
    await fs.promises.mkdir(outputDir, { recursive: true });
    const outputs = [
      { format: 'srt' as const, path: path.join(outputDir, `${language}.srt`), content: '1\n00:00:00,000 --> 00:00:01,000\nCaption pending transcription review.\n' },
      { format: 'vtt' as const, path: path.join(outputDir, `${language}.vtt`), content: 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nCaption pending transcription review.\n' },
      { format: 'json' as const, path: path.join(outputDir, `${language}.json`), content: JSON.stringify([{ start: 0, end: 1, text: 'Caption pending transcription review.' }], null, 2) },
    ];

    for (const output of outputs) {
      await this.ensurePlaceholderFile(output.path, output.content);
      await this.execute(`
        INSERT INTO captions (video_id, language, format, file_path, transcription_method, transcription_confidence)
        VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2)}, ${this.sqlParam(3)}, ${this.sqlParam(4)}, ${this.sqlParam(5)}, ${this.sqlParam(6, 'float')})
        ON CONFLICT (video_id, language, format) DO UPDATE SET
          file_path = EXCLUDED.file_path,
          transcription_method = EXCLUDED.transcription_method,
          transcription_confidence = EXCLUDED.transcription_confidence,
          created_at = NOW()
      `, [videoId, language, output.format, output.path, 'whisper_cpp', Number(config.transcription_confidence ?? 0)]);
    }

    await this.markJobSucceeded(job, outputDir);
  }

  private async executeThumbnailJob(job: Job): Promise<void> {
    const config = job.task_config;
    const videoId = String(config.video_id ?? job.video_id ?? '');
    const formatKey = String(config.format_key ?? 'landscape_1920x1080_16x9');
    const method = String(config.method ?? 'manual');
    const outputPath = String(config.output_path ?? path.join(this.artifactRoot, 'thumbnails', videoId, `${formatKey}.jpg`));
    if (!videoId) throw new Error(`Invalid thumbnail config for job ${job.job_id}`);

    await this.runOptionalCommand(config.thumbnail_command);
    await this.ensurePlaceholderFile(outputPath, `Thumbnail placeholder for ${videoId} ${formatKey}\n`);
    const stat = await fs.promises.stat(outputPath);
    const generationMethod = ['generated_sdxl', 'generated_flux', 'extracted_frame', 'manual'].includes(method) ? method : 'manual';

    await this.execute(`
      INSERT INTO thumbnails (video_id, format_key, file_path, generation_method, extraction_timecode, file_size_bytes)
      VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2)}, ${this.sqlParam(3)}, ${this.sqlParam(4)}, ${this.sqlParam(5)}, ${this.sqlParam(6, 'bigint')})
      ON CONFLICT (video_id, format_key) DO UPDATE SET
        file_path = EXCLUDED.file_path,
        generation_method = EXCLUDED.generation_method,
        extraction_timecode = EXCLUDED.extraction_timecode,
        file_size_bytes = EXCLUDED.file_size_bytes,
        created_at = NOW()
    `, [videoId, formatKey, outputPath, generationMethod, config.extraction_timecode ?? null, stat.size]);

    await this.markJobSucceeded(job, outputPath);
  }

  private async executeManifestJob(job: Job): Promise<void> {
    const videoId = String(job.task_config.video_id ?? job.video_id ?? '');
    const video = await this.loadVideoWithAssets(videoId);
    if (!video) throw new Error(`Video not found: ${videoId}`);

    const manifest = await this.buildProductionPackageManifest(video);
    this.validateManifest(manifest);
    const manifestPath = await this.saveManifest(videoId, manifest);
    await this.updateProductionPackage(videoId, manifestPath, manifest);
    await this.markJobSucceeded(job, manifestPath);
  }

  private async executePostingJob(job: Job): Promise<void> {
    await this.emitEvent(job, 'posting_skipped_phase_3', { reason: 'Posting adapters are Phase 3; package remains upload-ready/manual.' });
    await this.markJobSucceeded(job, null);
  }

  private async executeAnalyticsJob(job: Job): Promise<void> {
    await this.emitEvent(job, 'analytics_skipped_phase_5', { reason: 'Analytics collection is Phase 5; no external platform metrics fetched in Phase 2B.' });
    await this.markJobSucceeded(job, null);
  }

  private async loadVideoWithAssets(videoId: string): Promise<VideoWithAssets | null> {
    const rows = await this.query<VideoWithAssets>(`
      SELECT
        v.video_id::text,
        v.project_id::text,
        v.series_id::text,
        v.source_script_path,
        v.source_audio_path,
        COALESCE((SELECT json_agg(r.*) FROM renders r WHERE r.video_id = v.video_id), '[]'::json) AS renders,
        COALESCE((SELECT json_agg(c.*) FROM captions c WHERE c.video_id = v.video_id), '[]'::json) AS captions,
        COALESCE((SELECT json_agg(t.*) FROM thumbnails t WHERE t.video_id = v.video_id), '[]'::json) AS thumbnails
      FROM videos v
      WHERE v.video_id = ${this.sqlParam(1, 'uuid')}
    `, [videoId]);
    return rows[0] ?? null;
  }

  private async buildProductionPackageManifest(video: VideoWithAssets): Promise<ProductionPackageManifest> {
    const renderOutputs = video.renders.map((render) => ({
      format_key: String(render.format_key),
      path: String(render.file_path),
      resolution: String(render.resolution),
      duration_seconds: Number(render.duration_seconds ?? 0),
    }));
    const captionOutputs = video.captions.map((caption) => ({
      format: String(caption.format) as 'srt' | 'vtt' | 'json',
      language: String(caption.language),
      path: String(caption.file_path),
    }));
    const thumbnailOutputs = video.thumbnails.map((thumbnail) => ({
      format_key: String(thumbnail.format_key),
      path: String(thumbnail.file_path),
    }));
    const placeholderPaths = new Set<string>();
    for (const filePath of [
      ...renderOutputs.map((item) => item.path),
      ...captionOutputs.map((item) => item.path),
      ...thumbnailOutputs.map((item) => item.path),
    ]) {
      if (await this.isPlaceholderArtifact(filePath)) placeholderPaths.add(filePath);
    }

    const packageTargets = this.platformSpecs.platforms.map((platform) => {
      const format = this.formatSpecs.formats.find((item) => item.target_platforms.includes(`${platform.platform}/${platform.package_target}`));
      const render = renderOutputs.find((item) => item.format_key === format?.format_key) ?? renderOutputs[0];
      const caption = captionOutputs.find((item) => item.format === 'srt') ?? captionOutputs[0];
      const thumbnail = thumbnailOutputs.find((item) => item.format_key === format?.format_key) ?? thumbnailOutputs[0];
      const renderIsPlaceholder = render?.path ? placeholderPaths.has(render.path) : false;
      const thumbnailIsPlaceholder = thumbnail?.path ? placeholderPaths.has(thumbnail.path) : false;
      const adapterMode = this.selectAdapterMode(platform);
      const manualSteps = this.manualStepsFor(platform, render?.path ?? '', thumbnail?.path ?? '');
      const captionFiles = captionOutputs.map((item) => ({ language: item.language, format: item.format, path: item.path }));
      const hashtagCount = Math.min(platform.hashtags_rules?.max_count ?? 5, 5);
      const hashtags = Array.from({ length: hashtagCount }, (_, index) => `#video${index + 1}`);
      return {
        platform: platform.platform,
        package_target: platform.package_target,
        adapter_mode: adapterMode,
        adapter_status: platform.adapter_status,
        video_path: render?.path ?? '',
        captions: {
          primary_format: caption?.format ?? 'none',
          caption_files: captionFiles,
          caption_note: caption ? `Use ${caption.format} captions where supported; otherwise use burned-in captions/manual upload notes.` : 'No captions available yet.',
        },
        thumbnail_path: thumbnail?.path ?? '',
        title: this.truncate(path.basename(video.source_script_path, path.extname(video.source_script_path)), platform.title_rules?.max_length ?? 100),
        description: this.truncate(`Generated package for ${video.video_id}`, platform.description_rules?.max_length ?? 5000),
        hashtags,
        tags: [],
        upload_ready: Boolean(render?.path && thumbnail?.path && !renderIsPlaceholder && !thumbnailIsPlaceholder),
        manual_steps: manualSteps,
        known_limitations: platform.known_failure_modes ?? [],
        last_verified_at: this.toIsoDateTime(platform.last_verified_at),
      };
    });

    const ready = packageTargets.filter((target) => target.upload_ready).length;
    const completeness = packageTargets.length ? Math.round((ready / packageTargets.length) * 100) : 0;
    const manualUploadInstructions = Object.fromEntries(
      this.platformSpecs.platforms.map((platform) => [
        `${platform.platform}_${platform.package_target}`.replace(/[^a-z0-9]+/gi, '_').toLowerCase(),
        {
          platform: platform.platform,
          package_target: platform.package_target,
          steps: this.manualStepsFor(platform, '', ''),
          required_fields: ['video_file', 'description'],
          optional_fields: ['thumbnail', 'captions', 'hashtags', 'tags'],
        },
      ]),
    );
    const manualFallbackAvailable = this.platformSpecs.platforms.every((platform) => platform.manual_fallback !== false);
    const allAdaptersReady = this.platformSpecs.platforms.every((platform) => ['supported', 'partially_supported'].includes(platform.adapter_status));
    const warnings: Array<Record<string, unknown>> = [];
    if (completeness < 100) {
      warnings.push({ severity: 'warning', stage: 'manifest', message: 'One or more package targets are missing production render or thumbnail assets.' });
    }
    if (placeholderPaths.size > 0) {
      warnings.push({
        severity: 'warning',
        stage: 'manifest',
        message: 'Placeholder artifacts are present. They are not production-ready media and were excluded from upload-ready completeness.',
        affected_format_keys: [
          ...renderOutputs.filter((item) => placeholderPaths.has(item.path)).map((item) => item.format_key),
          ...thumbnailOutputs.filter((item) => placeholderPaths.has(item.path)).map((item) => item.format_key),
        ],
      });
    }
    return {
      video_id: video.video_id,
      project_id: video.project_id ?? undefined,
      series_id: video.series_id ?? undefined,
      created_at: new Date().toISOString(),
      source_script_path: video.source_script_path,
      source_audio_path: video.source_audio_path,
      render_outputs: renderOutputs,
      caption_outputs: captionOutputs,
      thumbnail_outputs: thumbnailOutputs,
      package_targets: packageTargets,
      adapter_status: {
        last_verified_at: new Date().toISOString(),
        all_adapters_ready: allAdaptersReady,
        manual_fallback_available: manualFallbackAvailable,
      },
      manual_upload_instructions: manualUploadInstructions,
      verification: {
        status: completeness === 100 && warnings.length === 0 ? 'complete' : warnings.length > 0 ? 'warnings' : 'incomplete',
        completeness_percent: completeness,
      },
      errors: [],
      warnings,
    };
  }

  private validateManifest(manifest: ProductionPackageManifest): void {
    if (!manifest.video_id) throw new Error('Missing video_id');
    if (!manifest.source_script_path) throw new Error('Missing source_script_path');
    if (!Array.isArray(manifest.package_targets) || manifest.package_targets.length === 0) throw new Error('Missing package_targets');
    if (!manifest.verification) throw new Error('Missing verification');
  }

  private async saveManifest(videoId: string, manifest: ProductionPackageManifest): Promise<string> {
    const manifestDir = path.join(this.artifactRoot, 'manifests', videoId);
    const manifestPath = path.join(manifestDir, 'production-package.json');
    await fs.promises.mkdir(manifestDir, { recursive: true });
    await fs.promises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return manifestPath;
  }

  private async updateProductionPackage(videoId: string, manifestPath: string, manifest: ProductionPackageManifest): Promise<void> {
    await this.execute(`
      INSERT INTO production_packages (video_id, manifest_path, manifest_content, completeness_percent, package_status)
      VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2)}, ${this.sqlJsonParam(3)}, ${this.sqlParam(4, 'int')}, ${this.sqlParam(5)})
      ON CONFLICT (video_id) DO UPDATE SET
        manifest_path = EXCLUDED.manifest_path,
        manifest_content = EXCLUDED.manifest_content,
        completeness_percent = EXCLUDED.completeness_percent,
        package_status = EXCLUDED.package_status,
        updated_at = NOW()
    `, [videoId, manifestPath, manifest, manifest.verification.completeness_percent, manifest.verification.status]);
  }

  private async markJobSucceeded(job: Job, outputPath: string | null): Promise<void> {
    await this.execute(`
      UPDATE jobs
      SET job_status = 'succeeded', output_path = ${this.sqlParam(1)}, completed_at = NOW(), error_message = NULL
      WHERE job_id = ${this.sqlParam(2, 'uuid')}
    `, [outputPath, job.job_id]);
    await this.emitEvent(job, 'job_succeeded', { output_path: outputPath });
  }

  private async handleJobFailure(job: Job, err: Error): Promise<void> {
    if (job.retry_count < this.maxRetries) {
      await this.execute(`
        UPDATE jobs
        SET job_status = 'pending', retry_count = retry_count + 1, error_message = ${this.sqlParam(1)}
        WHERE job_id = ${this.sqlParam(2, 'uuid')}
      `, [err.message, job.job_id]);
      await this.emitEvent(job, 'job_retry', { error: err.message, retry_count: job.retry_count + 1 }, 'warning');
      return;
    }

    await this.execute(`
      UPDATE jobs
      SET job_status = 'dead', error_message = ${this.sqlParam(1)}, completed_at = NOW()
      WHERE job_id = ${this.sqlParam(2, 'uuid')}
    `, [err.message, job.job_id]);
    await this.emitEvent(job, 'job_dead', { error: err.message }, 'error');
  }

  private async emitEvent(job: Job, eventType: string, eventData: Record<string, unknown>, severity: 'info' | 'warning' | 'error' = 'info'): Promise<void> {
    await this.execute(`
      INSERT INTO events (job_id, video_id, event_type, event_data, severity)
      VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2, 'uuid')}, ${this.sqlParam(3)}, ${this.sqlJsonParam(4)}, ${this.sqlParam(5)})
    `, [job.job_id, job.video_id, eventType, eventData, severity]);
  }

  private getFormatSpec(formatKey: string): FormatSpec | undefined {
    return this.formatSpecs.formats.find((spec) => spec.format_key === formatKey);
  }

  private selectAdapterMode(platform: PlatformSpec): string {
    const modes = platform.posting_modes ?? ['manual'];
    if (platform.adapter_status === 'manual_only') return 'manual';
    if (modes.includes('api') && ['supported', 'partially_supported'].includes(platform.adapter_status)) return 'api';
    if (modes.includes('n8n')) return 'n8n';
    if (modes.includes('browser_assisted')) return 'browser_assisted';
    return platform.manual_fallback === false ? 'disabled' : 'manual';
  }

  private manualStepsFor(platform: PlatformSpec, videoPath: string, thumbnailPath: string): string[] {
    const base = platform.manual_upload_instructions
      ? platform.manual_upload_instructions.split('→').map((step) => step.trim()).filter(Boolean)
      : [`Open ${platform.platform}`, 'Create a new post', 'Upload the prepared video package', 'Review metadata and publish manually'];
    const withFiles = [...base];
    if (videoPath) withFiles.push(`Use video file: ${videoPath}`);
    if (thumbnailPath) withFiles.push(`Use thumbnail/cover file: ${thumbnailPath}`);
    return withFiles;
  }

  private toIsoDateTime(value: string | undefined): string {
    if (!value) return new Date().toISOString();
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00Z`;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  }

  private async runOptionalCommand(command: unknown): Promise<void> {
    if (!Array.isArray(command) || command.length === 0) return;
    const [bin, ...args] = command.map(String);
    await execFileAsync(bin, args, { maxBuffer: 20 * 1024 * 1024 });
  }

  private async ensurePlaceholderFile(filePath: string, content: string): Promise<void> {
    await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
    } catch {
      await fs.promises.writeFile(filePath, content);
    }
  }

  private async isPlaceholderArtifact(filePath: string): Promise<boolean> {
    try {
      const handle = await fs.promises.open(filePath, 'r');
      try {
        const buffer = Buffer.alloc(512);
        const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
        return buffer.subarray(0, bytesRead).toString('utf-8').toLowerCase().includes('placeholder');
      } finally {
        await handle.close();
      }
    } catch {
      return false;
    }
  }

  private truncate(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, Math.max(0, maxLength - 1)) : value;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith('video-orchestrator-worker')) {
  const worker = new VideoOrchestratorWorker();
  worker.run().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export default VideoOrchestratorWorker;
