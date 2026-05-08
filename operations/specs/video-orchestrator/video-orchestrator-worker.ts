/**
 * Video Orchestrator Phase 2B Worker
 * Manifest Generation & Job Queue Handler
 *
 * Responsibilities:
 * - Pull jobs from PostgreSQL queue
 * - Execute rendering, caption, thumbnail jobs
 * - Generate production package manifests per production-package.schema.json
 * - Track pipeline state and emit events
 * - Support mid-pipeline resumability
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
}

interface Video {
  video_id: string;
  project_id: string | null;
  series_id: string | null;
  source_script_path: string;
  source_audio_path: string;
  created_at: Date;
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
    adapter_status: string;
    video_path: string;
    captions: { primary_format: string };
    thumbnail_path: string;
    title: string;
    description: string;
    upload_ready: boolean;
  }>;
  verification: {
    status: 'complete' | 'incomplete' | 'errors' | 'warnings';
    completeness_percent: number;
  };
  errors: Array<Record<string, unknown>>;
  warnings: Array<Record<string, unknown>>;
}

/**
 * VideoOrchestratorWorker
 * Main worker class for Phase 2B execution
 */
export class VideoOrchestratorWorker {
  private db: Database.Database;
  private platformSpecs: Record<string, unknown>;
  private formatSpecs: Record<string, unknown>;
  private captionSpecs: Record<string, unknown>;
  private readonly MAX_RETRIES = 3;
  private readonly LEASE_DURATION_MS = 30000;

  constructor(dbPath: string = 'postgres://postgres:postgres@localhost:5450/video_orchestrator') {
    // In production, use connection pooling with pg or similar
    // For MVP, use better-sqlite3 for local testing
    this.db = new Database(':memory:'); // Will be replaced with actual PostgreSQL client
    this.loadSpecs();
  }

  private loadSpecs(): void {
    try {
      const specDir = '/Users/Office/Repos/stevewesthoek/brain/operations/specs/video-orchestrator';
      this.platformSpecs = JSON.parse(fs.readFileSync(path.join(specDir, 'platform-specs.json'), 'utf-8'));
      this.formatSpecs = JSON.parse(fs.readFileSync(path.join(specDir, 'format-specs.json'), 'utf-8'));
      this.captionSpecs = JSON.parse(fs.readFileSync(path.join(specDir, 'caption-specs.json'), 'utf-8'));
    } catch (err) {
      console.error('Failed to load specs:', err);
      throw err;
    }
  }

  /**
   * Poll for pending jobs and execute them
   */
  async run(): Promise<void> {
    console.log('Video Orchestrator Worker started');

    while (true) {
      try {
        const job = await this.pullNextJob();
        if (!job) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        console.log(`Processing job ${job.job_id}: ${job.job_type}`);

        try {
          await this.executeJob(job);
        } catch (err) {
          await this.handleJobFailure(job, err as Error);
        }
      } catch (err) {
        console.error('Worker error:', err);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  /**
   * Pull next job from queue with leasing
   */
  private async pullNextJob(): Promise<Job | null> {
    // TODO: Implement PostgreSQL query to lease next pending job
    // SELECT * FROM jobs WHERE job_status = 'pending'
    //   ORDER BY created_at ASC LIMIT 1 FOR UPDATE
    // UPDATE jobs SET job_status = 'leased', started_at = NOW() WHERE job_id = $1
    return null;
  }

  /**
   * Execute job based on type
   */
  private async executeJob(job: Job): Promise<void> {
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
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }
  }

  /**
   * Execute render job using format-specs.json
   */
  private async executeRenderJob(job: Job): Promise<void> {
    const config = job.task_config as any;
    const { video_id, format_key, source_timeline, output_path } = config;

    // TODO: Implement actual rendering logic
    // 1. Load format spec from format-specs.json
    // 2. Choose rendering mode (canonical_timeline vs simple_transform)
    // 3. Call FFmpeg or Remotion composition
    // 4. Save render output
    // 5. Update database with render record
    // 6. Mark job succeeded

    console.log(`Rendering ${format_key} for video ${video_id} → ${output_path}`);

    // Stub: mark succeeded
    await this.markJobSucceeded(job, output_path);
  }

  /**
   * Execute caption job using caption-specs.json
   */
  private async executeCaptionJob(job: Job): Promise<void> {
    const config = job.task_config as any;
    const { video_id, audio_path, output_dir, language } = config;

    // TODO: Implement Whisper.cpp integration
    // 1. Load caption spec (Whisper.cpp config)
    // 2. Call Whisper.cpp on audio_path
    // 3. Generate SRT, VTT, JSON in output_dir
    // 4. Calculate transcription confidence
    // 5. Store in captions table
    // 6. Handle fallback to API if quality insufficient

    console.log(`Transcribing audio for ${video_id} (${language}) → ${output_dir}`);

    // Stub: mark succeeded
    await this.markJobSucceeded(job, output_dir);
  }

  /**
   * Execute thumbnail job
   */
  private async executeThumbnailJob(job: Job): Promise<void> {
    const config = job.task_config as any;
    const { video_id, format_key, method, output_path } = config;

    // TODO: Implement thumbnail generation
    // 1. If method === 'generated': call SDXL/FLUX
    // 2. If method === 'extracted': extract frame from video
    // 3. Resize to format_key spec
    // 4. Save to output_path
    // 5. Update database

    console.log(`Generating thumbnail for ${format_key} → ${output_path}`);

    // Stub: mark succeeded
    await this.markJobSucceeded(job, output_path);
  }

  /**
   * Execute manifest generation job
   * Core Phase 2B responsibility
   */
  private async executeManifestJob(job: Job): Promise<void> {
    const config = job.task_config as any;
    const { video_id } = config;

    try {
      // 1. Load all video assets from database
      const video = await this.loadVideoWithAssets(video_id);
      if (!video) throw new Error(`Video not found: ${video_id}`);

      // 2. Build manifest per production-package.schema.json
      const manifest = await this.buildProductionPackageManifest(video);

      // 3. Validate against schema
      this.validateManifest(manifest);

      // 4. Save manifest JSON
      const manifestPath = await this.saveManifest(video_id, manifest);

      // 5. Update production_packages table
      await this.updateProductionPackage(video_id, manifestPath, manifest);

      // 6. Mark job succeeded
      await this.markJobSucceeded(job, manifestPath);

      console.log(`Manifest generated for ${video_id} → ${manifestPath}`);
    } catch (err) {
      throw new Error(`Manifest generation failed: ${(err as Error).message}`);
    }
  }

  /**
   * Execute posting job (placeholder for Phase 3)
   */
  private async executePostingJob(job: Job): Promise<void> {
    // TODO: Phase 3 - implement adapter routing
    // For now, just stub it
    console.log(`Posting job (Phase 3): ${job.job_id}`);
    await this.markJobSucceeded(job, null);
  }

  /**
   * Load video with all assets from database
   */
  private async loadVideoWithAssets(video_id: string): Promise<any | null> {
    // TODO: Query database for:
    // - Video metadata
    // - Scripts
    // - Source assets
    // - Captions (all formats)
    // - Renders (all formats)
    // - Thumbnails (all formats)
    return null;
  }

  /**
   * Build production package manifest
   * Core MVP: generate manifest per production-package.schema.json
   */
  private async buildProductionPackageManifest(video: any): Promise<ProductionPackageManifest> {
    const manifest: ProductionPackageManifest = {
      video_id: video.video_id,
      project_id: video.project_id,
      series_id: video.series_id,
      created_at: new Date().toISOString(),
      source_script_path: video.source_script_path,
      source_audio_path: video.source_audio_path,
      render_outputs: [],
      caption_outputs: [],
      thumbnail_outputs: [],
      package_targets: [],
      verification: {
        status: 'incomplete',
        completeness_percent: 0,
      },
      errors: [],
      warnings: [],
    };

    // TODO: Populate from video assets
    // 1. Map renders to render_outputs
    // 2. Map captions to caption_outputs
    // 3. Map thumbnails to thumbnail_outputs
    // 4. Generate package_targets for all 9 platform targets (from platform-specs.json)
    // 5. Set adapter_status, adapter_mode, manual_steps for each target
    // 6. Calculate completeness

    return manifest;
  }

  /**
   * Validate manifest against schema
   */
  private validateManifest(manifest: ProductionPackageManifest): void {
    // TODO: Use jsonschema or similar to validate against production-package.schema.json
    // For MVP, do basic checks:
    if (!manifest.video_id) throw new Error('Missing video_id');
    if (!Array.isArray(manifest.package_targets)) throw new Error('Missing package_targets');
    if (!manifest.verification) throw new Error('Missing verification');
  }

  /**
   * Save manifest JSON to filesystem
   */
  private async saveManifest(video_id: string, manifest: ProductionPackageManifest): Promise<string> {
    const manifestDir = `/Users/Office/projects/video-orchestrator/manifests/${video_id}`;
    const manifestPath = path.join(manifestDir, 'production-package.json');

    // TODO: Create directory if needed
    // TODO: Write manifest to file
    // await fs.promises.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    return manifestPath;
  }

  /**
   * Update production_packages table
   */
  private async updateProductionPackage(
    video_id: string,
    manifestPath: string,
    manifest: ProductionPackageManifest,
  ): Promise<void> {
    // TODO: INSERT or UPDATE production_packages
    // INSERT INTO production_packages (video_id, manifest_path, manifest_content, completeness_percent, package_status)
    // VALUES ($1, $2, $3, $4, $5)
    // ON CONFLICT (video_id) DO UPDATE SET manifest_path = $2, manifest_content = $3, ...
  }

  /**
   * Mark job as succeeded
   */
  private async markJobSucceeded(job: Job, output_path: string | null): Promise<void> {
    // TODO: UPDATE jobs SET job_status = 'succeeded', completed_at = NOW(), output_path = $1
    // WHERE job_id = $2
    console.log(`Job ${job.job_id} succeeded`);
  }

  /**
   * Handle job failure with retry logic
   */
  private async handleJobFailure(job: Job, err: Error): Promise<void> {
    if (job.retry_count < this.MAX_RETRIES) {
      console.log(`Job ${job.job_id} failed, retrying (${job.retry_count + 1}/${this.MAX_RETRIES})`);
      // TODO: UPDATE jobs SET job_status = 'pending', retry_count = retry_count + 1
      // WHERE job_id = $1
    } else {
      console.log(`Job ${job.job_id} failed permanently`);
      // TODO: UPDATE jobs SET job_status = 'dead', error_message = $1, completed_at = NOW()
      // WHERE job_id = $2
    }
  }
}

/**
 * Main entry point
 */
if (import.meta.main) {
  const worker = new VideoOrchestratorWorker();
  worker.run().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

export default VideoOrchestratorWorker;
