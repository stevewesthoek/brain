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
  artifact_provenance?: Record<string, string>;
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

type CommandResult = {
  stdout: string;
  stderr: string;
};

type MediaMetadata = {
  format?: { duration?: string; size?: string; format_name?: string };
  streams?: Array<{ codec_type?: string; width?: number; height?: number; duration?: string }>;
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

    let provenance = 'placeholder';
    if (Array.isArray(config.render_command) && config.render_command.length > 0) {
      await this.runOptionalCommand(config.render_command);
      if (await this.isRealMediaFile(outputPath, { requireVideo: true })) provenance = 'custom_command';
    } else if (await this.renderWithFfmpeg(config, spec, outputPath)) {
      provenance = 'real_ffmpeg_render';
    }

    if (provenance === 'placeholder') {
      await this.ensurePlaceholderFile(outputPath, `Render placeholder for ${videoId} ${formatKey}\n`);
    }

    const stat = await fs.promises.stat(outputPath);
    const metadata = await this.probeMedia(outputPath);
    const duration = Number(metadata?.format?.duration ?? config.duration_seconds ?? 0);

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

    await this.emitEvent(job, 'render_artifact_ready', { output_path: outputPath, provenance, real_media: provenance !== 'placeholder' }, provenance === 'placeholder' ? 'warning' : 'info');
    await this.markJobSucceeded(job, outputPath);
  }

  private async executeCaptionJob(job: Job): Promise<void> {
    const config = job.task_config;
    const videoId = String(config.video_id ?? job.video_id ?? '');
    const language = String(config.language ?? 'auto');
    const outputDir = String(config.output_dir ?? path.join(this.artifactRoot, 'captions', videoId));
    if (!videoId) throw new Error(`Invalid caption config for job ${job.job_id}`);

    await fs.promises.mkdir(outputDir, { recursive: true });
    let provenance = 'placeholder';
    if (Array.isArray(config.caption_command) && config.caption_command.length > 0) {
      await this.runOptionalCommand(config.caption_command);
      provenance = await this.captionOutputsExist(outputDir, language) ? 'custom_command' : 'placeholder';
    } else if (await this.transcribeWithWhisperCpp(config, outputDir, language)) {
      provenance = 'real_whisper_cpp_caption';
    }

    const outputs = await this.ensureCaptionOutputs(outputDir, language, provenance === 'placeholder');

    for (const output of outputs) {
      await this.execute(`
        INSERT INTO captions (video_id, language, format, file_path, transcription_method, transcription_confidence)
        VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2)}, ${this.sqlParam(3)}, ${this.sqlParam(4)}, ${this.sqlParam(5)}, ${this.sqlParam(6, 'float')})
        ON CONFLICT (video_id, language, format) DO UPDATE SET
          file_path = EXCLUDED.file_path,
          transcription_method = EXCLUDED.transcription_method,
          transcription_confidence = EXCLUDED.transcription_confidence,
          created_at = NOW()
      `, [videoId, language, output.format, output.path, provenance === 'placeholder' ? 'manual' : 'whisper_cpp', Number(config.transcription_confidence ?? (provenance === 'placeholder' ? 0 : 0.8))]);
    }

    await this.emitEvent(job, 'caption_artifacts_ready', { output_dir: outputDir, provenance }, provenance === 'placeholder' ? 'warning' : 'info');
    await this.markJobSucceeded(job, outputDir);
  }

  private async executeThumbnailJob(job: Job): Promise<void> {
    const config = job.task_config;
    const videoId = String(config.video_id ?? job.video_id ?? '');
    const formatKey = String(config.format_key ?? 'landscape_1920x1080_16x9');
    const method = String(config.method ?? 'manual');
    const outputPath = String(config.output_path ?? path.join(this.artifactRoot, 'thumbnails', videoId, `${formatKey}.jpg`));
    const spec = this.getFormatSpec(formatKey);
    if (!videoId) throw new Error(`Invalid thumbnail config for job ${job.job_id}`);

    let provenance = 'placeholder';
    if (Array.isArray(config.thumbnail_command) && config.thumbnail_command.length > 0) {
      await this.runOptionalCommand(config.thumbnail_command);
      if (await this.isReadableImage(outputPath)) provenance = 'custom_command';
    } else if (spec && await this.createThumbnailWithFfmpeg(config, spec, outputPath)) {
      provenance = 'real_ffmpeg_thumbnail';
    }

    if (provenance === 'placeholder') {
      await this.ensurePlaceholderFile(outputPath, `Thumbnail placeholder for ${videoId} ${formatKey}\n`);
    }

    const stat = await fs.promises.stat(outputPath);
    const generationMethod = provenance === 'real_ffmpeg_thumbnail' ? 'extracted_frame' : ['generated_sdxl', 'generated_flux', 'extracted_frame', 'manual'].includes(method) ? method : 'manual';

    await this.execute(`
      INSERT INTO thumbnails (video_id, format_key, file_path, generation_method, extraction_timecode, file_size_bytes)
      VALUES (${this.sqlParam(1, 'uuid')}, ${this.sqlParam(2)}, ${this.sqlParam(3)}, ${this.sqlParam(4)}, ${this.sqlParam(5)}, ${this.sqlParam(6, 'bigint')})
      ON CONFLICT (video_id, format_key) DO UPDATE SET
        file_path = EXCLUDED.file_path,
        generation_method = EXCLUDED.generation_method,
        extraction_timecode = EXCLUDED.extraction_timecode,
        file_size_bytes = EXCLUDED.file_size_bytes,
        created_at = NOW()
    `, [videoId, formatKey, outputPath, generationMethod, config.timecode ?? config.extraction_timecode ?? null, stat.size]);

    await this.emitEvent(job, 'thumbnail_artifact_ready', { output_path: outputPath, provenance, real_image: provenance !== 'placeholder' }, provenance === 'placeholder' ? 'warning' : 'info');
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
    const nonProductionPaths = new Set<string>();
    const captionPlaceholderPaths = new Set<string>();
    const artifactProvenance: Record<string, string> = {};
    for (const item of renderOutputs) {
      if (await this.isRealMediaFile(item.path, { requireVideo: true })) {
        artifactProvenance[item.path] = 'real_local_media';
      } else {
        nonProductionPaths.add(item.path);
        artifactProvenance[item.path] = await this.isPlaceholderArtifact(item.path) ? 'placeholder' : 'invalid_media';
      }
    }
    for (const item of thumbnailOutputs) {
      if (await this.isReadableImage(item.path)) {
        artifactProvenance[item.path] = 'real_local_media';
      } else {
        nonProductionPaths.add(item.path);
        artifactProvenance[item.path] = await this.isPlaceholderArtifact(item.path) ? 'placeholder' : 'invalid_image';
      }
    }
    for (const item of captionOutputs) {
      if (await this.isPlaceholderArtifact(item.path)) {
        captionPlaceholderPaths.add(item.path);
        artifactProvenance[item.path] = 'placeholder';
      } else {
        artifactProvenance[item.path] = 'caption_file';
      }
    }

    const packageTargets = this.platformSpecs.platforms.map((platform) => {
      const format = this.formatSpecs.formats.find((item) => item.target_platforms.includes(`${platform.platform}/${platform.package_target}`));
      const render = renderOutputs.find((item) => item.format_key === format?.format_key) ?? renderOutputs[0];
      const caption = captionOutputs.find((item) => item.format === 'srt') ?? captionOutputs[0];
      const thumbnail = thumbnailOutputs.find((item) => item.format_key === format?.format_key) ?? thumbnailOutputs[0];
      const renderIsProduction = render?.path ? !nonProductionPaths.has(render.path) : false;
      const thumbnailIsProduction = thumbnail?.path ? !nonProductionPaths.has(thumbnail.path) : false;
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
        upload_ready: Boolean(render?.path && thumbnail?.path && renderIsProduction && thumbnailIsProduction),
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
    if (nonProductionPaths.size > 0) {
      warnings.push({
        severity: 'warning',
        stage: 'manifest',
        message: 'Placeholder or invalid artifacts are present. They are not production-ready media and were excluded from upload-ready completeness.',
        affected_format_keys: [
          ...renderOutputs.filter((item) => nonProductionPaths.has(item.path)).map((item) => item.format_key),
          ...thumbnailOutputs.filter((item) => nonProductionPaths.has(item.path)).map((item) => item.format_key),
        ],
      });
    }
    if (captionPlaceholderPaths.size > 0) {
      warnings.push({
        severity: 'warning',
        stage: 'caption',
        message: 'Placeholder captions are present. Configure local Whisper.cpp and a model path for production caption files.',
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
      artifact_provenance: artifactProvenance,
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

  private async commandExists(command: string): Promise<boolean> {
    try {
      await execFileAsync('/usr/bin/which', [command]);
      return true;
    } catch {
      return false;
    }
  }

  private async runCommandChecked(command: string, args: string[], options: { cwd?: string } = {}): Promise<CommandResult> {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: options.cwd,
      maxBuffer: 100 * 1024 * 1024,
    });
    return { stdout, stderr };
  }

  private async probeMedia(filePath: string): Promise<MediaMetadata | null> {
    if (!await this.fileExists(filePath) || !await this.commandExists('ffprobe')) return null;
    try {
      const result = await this.runCommandChecked('ffprobe', [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        filePath,
      ]);
      return JSON.parse(result.stdout || '{}') as MediaMetadata;
    } catch {
      return null;
    }
  }

  private async isRealMediaFile(
    filePath: string,
    requirements: { requireVideo?: boolean; requireAudio?: boolean } = {},
  ): Promise<boolean> {
    const stat = await this.safeStat(filePath);
    if (!stat || stat.size <= 0 || await this.isPlaceholderArtifact(filePath)) return false;
    const metadata = await this.probeMedia(filePath);
    if (!metadata?.streams?.length) return false;
    if (requirements.requireVideo && !metadata.streams.some((stream) => stream.codec_type === 'video')) return false;
    if (requirements.requireAudio && !metadata.streams.some((stream) => stream.codec_type === 'audio')) return false;
    return true;
  }

  private async isReadableImage(filePath: string): Promise<boolean> {
    return this.isRealMediaFile(filePath, { requireVideo: true });
  }

  private async renderWithFfmpeg(config: Record<string, unknown>, spec: FormatSpec, outputPath: string): Promise<boolean> {
    if (!await this.commandExists('ffmpeg') || !await this.commandExists('ffprobe')) return false;
    const inputVideoPath = this.optionalString(config.input_video_path);
    const inputAudioPath = this.optionalString(config.input_audio_path);
    const inputImagePath = this.optionalString(config.input_image_path);
    const durationSeconds = Number(config.duration_seconds ?? 0);
    const [width, height] = this.parseResolution(spec.resolution);
    const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
    const tmpPath = this.tempOutputPath(outputPath);

    try {
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      if (inputVideoPath && await this.isRealMediaFile(inputVideoPath, { requireVideo: true })) {
        const sourceHasAudio = await this.mediaHasStream(inputVideoPath, 'audio');
        const args = ['-y', '-i', inputVideoPath];
        if (inputAudioPath && await this.isRealMediaFile(inputAudioPath, { requireAudio: true })) args.push('-i', inputAudioPath);
        args.push('-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(this.fpsFor(spec)));
        if (inputAudioPath && await this.isRealMediaFile(inputAudioPath, { requireAudio: true })) {
          args.push('-map', '0:v:0', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '192k', '-shortest');
        } else if (sourceHasAudio) {
          args.push('-map', '0:v:0', '-map', '0:a:0?', '-c:a', 'aac', '-b:a', '192k');
        } else {
          args.push('-an');
        }
        if (durationSeconds > 0) args.push('-t', String(durationSeconds));
        args.push('-movflags', '+faststart', tmpPath);
        await this.runCommandChecked('ffmpeg', args);
      } else if (
        inputImagePath &&
        inputAudioPath &&
        await this.isReadableImage(inputImagePath) &&
        await this.isRealMediaFile(inputAudioPath, { requireAudio: true })
      ) {
        const args = [
          '-y',
          '-loop',
          '1',
          '-i',
          inputImagePath,
          '-i',
          inputAudioPath,
          '-vf',
          `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`,
          '-c:v',
          'libx264',
          '-preset',
          'veryfast',
          '-tune',
          'stillimage',
          '-c:a',
          'aac',
          '-b:a',
          '192k',
          '-pix_fmt',
          'yuv420p',
          '-r',
          String(this.fpsFor(spec)),
          '-shortest',
        ];
        if (durationSeconds > 0) args.push('-t', String(durationSeconds));
        args.push('-movflags', '+faststart', tmpPath);
        await this.runCommandChecked('ffmpeg', args);
      } else {
        return false;
      }

      if (!await this.isRealMediaFile(tmpPath, { requireVideo: true })) return false;
      await fs.promises.rename(tmpPath, outputPath);
      return true;
    } catch {
      return false;
    } finally {
      await fs.promises.rm(tmpPath, { force: true });
    }
  }

  private async transcribeWithWhisperCpp(config: Record<string, unknown>, outputDir: string, language: string): Promise<boolean> {
    const modelPath = this.optionalString(config.whisper_model_path) ?? process.env.VIDEO_ORCHESTRATOR_WHISPER_MODEL;
    if (!modelPath || !await this.fileExists(modelPath)) return false;

    const configuredCommand = this.optionalString(config.whisper_command);
    const candidates = configuredCommand ? [configuredCommand] : ['whisper-cli', 'whisper-cpp', 'main'];
    const whisperCommand = await this.findWhisperCommand(candidates);
    if (!whisperCommand) return false;

    const audioPath = await this.resolveCaptionAudio(config, outputDir);
    if (!audioPath) return false;

    const outputPrefix = path.join(outputDir, language);
    const args = ['-m', modelPath, '-f', audioPath, '-of', outputPrefix, '-osrt', '-ovtt', '-oj'];
    if (language && language !== 'auto') args.push('-l', language);
    try {
      await this.runCommandChecked(whisperCommand, args);
      return this.captionOutputsExist(outputDir, language);
    } catch {
      return false;
    }
  }

  private async createThumbnailWithFfmpeg(config: Record<string, unknown>, spec: FormatSpec, outputPath: string): Promise<boolean> {
    if (!await this.commandExists('ffmpeg') || !await this.commandExists('ffprobe')) return false;
    const inputVideoPath = this.optionalString(config.input_video_path);
    const inputImagePath = this.optionalString(config.input_image_path);
    const timecode = String(config.timecode ?? config.extraction_timecode ?? '00:00:03');
    const [width, height] = this.parseResolution(spec.resolution);
    const vf = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1`;
    const tmpPath = this.tempOutputPath(outputPath);

    try {
      await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
      if (inputVideoPath && await this.isRealMediaFile(inputVideoPath, { requireVideo: true })) {
        await this.runCommandChecked('ffmpeg', ['-y', '-ss', timecode, '-i', inputVideoPath, '-frames:v', '1', '-vf', vf, '-q:v', '2', tmpPath]);
      } else if (inputImagePath && await this.isReadableImage(inputImagePath)) {
        await this.runCommandChecked('ffmpeg', ['-y', '-i', inputImagePath, '-frames:v', '1', '-vf', vf, '-q:v', '2', tmpPath]);
      } else {
        return false;
      }
      if (!await this.isReadableImage(tmpPath)) return false;
      await fs.promises.rename(tmpPath, outputPath);
      return true;
    } catch {
      return false;
    } finally {
      await fs.promises.rm(tmpPath, { force: true });
    }
  }

  private async runOptionalCommand(command: unknown): Promise<void> {
    if (!Array.isArray(command) || command.length === 0) return;
    const [bin, ...args] = command.map(String);
    await this.runCommandChecked(bin, args);
  }

  private async ensureCaptionOutputs(outputDir: string, language: string, placeholder: boolean): Promise<Array<{ format: 'srt' | 'vtt' | 'json'; path: string }>> {
    await fs.promises.mkdir(outputDir, { recursive: true });
    const outputs = [
      { format: 'srt' as const, path: path.join(outputDir, `${language}.srt`) },
      { format: 'vtt' as const, path: path.join(outputDir, `${language}.vtt`) },
      { format: 'json' as const, path: path.join(outputDir, `${language}.json`) },
    ];
    if (placeholder) {
      await fs.promises.writeFile(outputs[0].path, '1\n00:00:00,000 --> 00:00:01,000\nCaption placeholder pending local Whisper.cpp transcription.\n');
      await fs.promises.writeFile(outputs[1].path, 'WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nCaption placeholder pending local Whisper.cpp transcription.\n');
      await fs.promises.writeFile(outputs[2].path, `${JSON.stringify([{ start: 0, end: 1, text: 'Caption placeholder pending local Whisper.cpp transcription.' }], null, 2)}\n`);
      return outputs;
    }

    if (!await this.fileExists(outputs[1].path) && await this.fileExists(outputs[0].path)) {
      const srt = await fs.promises.readFile(outputs[0].path, 'utf-8');
      await fs.promises.writeFile(outputs[1].path, this.srtToVtt(srt));
    }
    if (!await this.fileExists(outputs[2].path)) {
      await fs.promises.writeFile(outputs[2].path, `${JSON.stringify({ generated_from: 'whisper_cpp', language, note: 'JSON transcript was not emitted by the local command.' }, null, 2)}\n`);
    }
    return outputs;
  }

  private async captionOutputsExist(outputDir: string, language: string): Promise<boolean> {
    return this.fileExists(path.join(outputDir, `${language}.srt`));
  }

  private async findWhisperCommand(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
      if (!await this.commandExists(candidate)) continue;
      try {
        const help = await this.runCommandChecked(candidate, ['--help']);
        const text = `${help.stdout}\n${help.stderr}`;
        if (text.includes('-osrt') && text.includes('-ovtt') && text.includes('-oj')) return candidate;
      } catch {
        if (candidate !== 'main') return candidate;
      }
    }
    return null;
  }

  private async resolveCaptionAudio(config: Record<string, unknown>, outputDir: string): Promise<string | null> {
    const inputAudioPath = this.optionalString(config.input_audio_path);
    if (inputAudioPath && await this.isRealMediaFile(inputAudioPath, { requireAudio: true })) return inputAudioPath;
    const inputVideoPath = this.optionalString(config.input_video_path);
    if (!inputVideoPath || !await this.isRealMediaFile(inputVideoPath, { requireVideo: true }) || !await this.commandExists('ffmpeg')) return null;
    const extractedPath = path.join(outputDir, 'extracted-audio-16khz-mono.wav');
    try {
      await this.runCommandChecked('ffmpeg', ['-y', '-i', inputVideoPath, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', extractedPath]);
      return await this.isRealMediaFile(extractedPath, { requireAudio: true }) ? extractedPath : null;
    } catch {
      return null;
    }
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

  private async mediaHasStream(filePath: string, type: 'audio' | 'video'): Promise<boolean> {
    const metadata = await this.probeMedia(filePath);
    return metadata?.streams?.some((stream) => stream.codec_type === type) ?? false;
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  private async safeStat(filePath: string): Promise<fs.Stats | null> {
    try {
      return await fs.promises.stat(filePath);
    } catch {
      return null;
    }
  }

  private optionalString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private parseResolution(resolution: string): [number, number] {
    const match = resolution.match(/^(\d+)x(\d+)$/);
    if (!match) return [1920, 1080];
    return [Number(match[1]), Number(match[2])];
  }

  private fpsFor(spec: FormatSpec): number {
    const maybeFps = Number((spec as FormatSpec & { fps?: number }).fps);
    return Number.isFinite(maybeFps) && maybeFps > 0 ? maybeFps : 24;
  }

  private tempOutputPath(outputPath: string): string {
    const parsed = path.parse(outputPath);
    return path.join(parsed.dir, `${parsed.name}.tmp-${process.pid}-${Date.now()}${parsed.ext}`);
  }

  private srtToVtt(srt: string): string {
    return `WEBVTT\n\n${srt.replace(/^\d+\s*$/gm, '').replace(/,/g, '.')}`;
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
