import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { thumbnailQueue } from '../adapters/thumbnail-queue.js';

// Helper: create mock artifact files
async function createMockArtifact(dir: string, filename: string): Promise<string> {
  const path = join(dir, filename);
  // Create a minimal JPEG header (magic bytes: FF D8 FF)
  await writeFile(path, Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
  return path;
}

test('queueThumbnail returns failed status if worker path does not exist', async () => {
  const originalHome = process.env.HOME;
  const tempHome = await mkdtemp(join(tmpdir(), 'test-home-'));
  process.env.HOME = tempHome;
  process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH = join(
    tempHome,
    '.local',
    'video-orchestrator',
    'worker',
    'cli_thumbnail_designer_basic.py',
  );

  try {
    const result = await thumbnailQueue.queueThumbnail({
      episode_id: 'test-ep-1',
      title: 'Test Episode',
      template_definition: { name: 'test' },
      color_scheme: { _name: 'default' },
      background_image_url: '/tmp/bg.jpg',
      platform: 'youtube',
    });

    assert.equal(result.status, 'failed');
    assert.ok(result.error_message?.includes('not found'));
  } finally {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('queueThumbnail handles worker process spawn errors gracefully', async () => {
  const originalHome = process.env.HOME;
  const tempHome = await mkdtemp(join(tmpdir(), 'test-home-spawn-error-'));
  process.env.HOME = tempHome;
  process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH = join(
    tempHome,
    '.local',
    'video-orchestrator',
    'worker',
    'cli_thumbnail_designer_basic.py',
  );

  try {
    const workerDir = join(tempHome, '.local', 'video-orchestrator', 'worker');
    await mkdir(workerDir, { recursive: true });

    // Create a non-executable file that will fail to run
    const cliScript = join(workerDir, 'cli_thumbnail_designer_basic.py');
    await writeFile(cliScript, 'not-executable-content');

    // This will attempt to spawn python3 with the script
    const result = await thumbnailQueue.queueThumbnail({
      episode_id: 'test-ep-spawn',
      title: 'Test Episode',
      template_definition: { name: 'test' },
      color_scheme: { _name: 'default' },
      background_image_url: '/tmp/bg.jpg',
    });

    // Should fail, either from exit code or parsing error
    assert.equal(result.status, 'failed');
    assert.ok(result.error_message);
  } finally {
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
    await rm(tempHome, { recursive: true, force: true });
  }
});




async function writeWorkerScript(home: string, body: string): Promise<void> {
  const workerDir = join(home, '.local', 'video-orchestrator', 'worker');
  await mkdir(workerDir, { recursive: true });
  await writeFile(join(workerDir, 'cli_thumbnail_designer_basic.py'), body, 'utf8');
}

const validJpeg1280x720Python = `
import json, os, sys
request = json.load(sys.stdin)
out_dir = os.path.join(os.path.expanduser('~'), '.local', 'video-orchestrator', 'artifacts', 'thumbnails')
os.makedirs(out_dir, exist_ok=True)
jpeg = bytes([0xff,0xd8,0xff,0xc0,0x00,0x0b,0x08,0x02,0xd0,0x05,0x00,0x01,0x01,0x11,0x00,0xff,0xd9])
variants = []
for index in (1, 2):
    path = os.path.join(out_dir, f"{request['episode_id']}_v{index}.jpg")
    with open(path, 'wb') as handle:
        handle.write(jpeg)
    variants.append({
        'variant_id': f'v{index}',
        'url': path,
        'confidence_score': 0.8,
        'template_applied': 'test',
        'colors_applied': 'test',
        'size_bytes': len(jpeg),
        'dimensions': '1280x720',
        'format': 'jpeg',
    })
json.dump({'status':'completed','job_id':'job-success','episode_id':request['episode_id'],'variants':variants}, sys.stdout)
`;

test('queueThumbnail accepts two verified 1280x720 JPEG artifacts', async () => {
  const originalHome = process.env.HOME;
  const tempHome = await mkdtemp(join(tmpdir(), 'test-home-success-'));
  process.env.HOME = tempHome;
  process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH = join(
    tempHome,
    '.local',
    'video-orchestrator',
    'worker',
    'cli_thumbnail_designer_basic.py',
  );

  try {
    await writeWorkerScript(tempHome, validJpeg1280x720Python);
    const result = await thumbnailQueue.queueThumbnail({
      episode_id: 'test-ep-success',
      title: 'Test Episode',
      template_definition: { name: 'test' },
      color_scheme: { _name: 'default' },
      background_image_url: '/tmp/bg.jpg',
      platform: 'youtube',
    });

    assert.equal(result.status, 'completed');
    assert.equal(result.variants?.length, 2);
    assert.deepEqual(result.variants?.map((variant) => variant.variant_id), ['v1', 'v2']);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await rm(tempHome, { recursive: true, force: true });
  }
});

test('queueThumbnail rejects existing files that are not valid 1280x720 JPEG artifacts', async () => {
  const originalHome = process.env.HOME;
  const tempHome = await mkdtemp(join(tmpdir(), 'test-home-invalid-artifact-'));
  process.env.HOME = tempHome;
  process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH = join(
    tempHome,
    '.local',
    'video-orchestrator',
    'worker',
    'cli_thumbnail_designer_basic.py',
  );

  try {
    await writeWorkerScript(tempHome, `
import json, os, sys
request = json.load(sys.stdin)
out_dir = os.path.join(os.path.expanduser('~'), '.local', 'video-orchestrator', 'artifacts', 'thumbnails')
os.makedirs(out_dir, exist_ok=True)
variants = []
for index in (1, 2):
    path = os.path.join(out_dir, f"{request['episode_id']}_v{index}.jpg")
    with open(path, 'wb') as handle:
        handle.write(bytes([0xff,0xd8,0xff,0xe0]))
    variants.append({'variant_id':f'v{index}','url':path,'confidence_score':0.8,'template_applied':'test','colors_applied':'test','size_bytes':4,'dimensions':'1280x720','format':'jpeg'})
json.dump({'status':'completed','job_id':'job-invalid','episode_id':request['episode_id'],'variants':variants}, sys.stdout)
`);

    const result = await thumbnailQueue.queueThumbnail({
      episode_id: 'test-ep-invalid',
      title: 'Test Episode',
      template_definition: { name: 'test' },
      color_scheme: { _name: 'default' },
      background_image_url: '/tmp/bg.jpg',
      platform: 'youtube',
    });

    assert.equal(result.status, 'failed');
    assert.match(result.error_message ?? '', /Expected at least 2 variants/);
  } finally {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    await rm(tempHome, { recursive: true, force: true });
  }
});




test('queueThumbnail invokes the repo-owned FFmpeg worker and returns two real JPEG artifacts', async () => {
  const originalWorkerPath = process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH;
  const originalOutputDir = process.env.BRAIN_CORE_THUMBNAIL_OUTPUT_DIR;
  const outputDir = await mkdtemp(join(tmpdir(), 'brain-core-thumbnail-live-'));

  delete process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH;
  process.env.BRAIN_CORE_THUMBNAIL_OUTPUT_DIR = outputDir;

  try {
    const result = await thumbnailQueue.queueThumbnail({
      episode_id: 'live-repo-worker',
      title: 'Live Repo Worker Test',
      template_definition: { name: 'youtube-default' },
      color_scheme: {
        _name: 'test-brand',
        primary: '#182440',
        accent: '#EBB434',
      },
      background_image_url: '',
      platform: 'youtube',
    });

    assert.equal(result.status, 'completed');
    assert.equal(result.variants?.length, 2);
    assert.deepEqual(result.variants?.map((variant) => variant.variant_id), ['v1', 'v2']);
    assert.ok(result.variants?.every((variant) => variant.url.startsWith(outputDir)));
    assert.ok(result.variants?.every((variant) => variant.dimensions === '1280x720'));
    assert.ok(result.variants?.every((variant) => variant.format === 'jpeg'));
  } finally {
    if (originalWorkerPath === undefined) delete process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH;
    else process.env.BRAIN_CORE_THUMBNAIL_WORKER_PATH = originalWorkerPath;

    if (originalOutputDir === undefined) delete process.env.BRAIN_CORE_THUMBNAIL_OUTPUT_DIR;
    else process.env.BRAIN_CORE_THUMBNAIL_OUTPUT_DIR = originalOutputDir;

    await rm(outputDir, { recursive: true, force: true });
  }
});
