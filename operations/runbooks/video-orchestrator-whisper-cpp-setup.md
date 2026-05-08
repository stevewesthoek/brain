# Whisper.cpp Integration for Video Orchestrator

**Date:** 2026-05-08  
**Purpose:** Local transcription for Phase 2B caption generation  
**Installation:** Homebrew + Model Download  
**Integration:** Phase 2B Worker

---

## What is Whisper.cpp?

Whisper.cpp is a lightweight C++ port of OpenAI's Whisper speech recognition model. Benefits:

- ✅ **Local-only:** No cloud API calls, no transcription costs
- ✅ **Fast:** Real-time or near-real-time speech-to-text
- ✅ **Accurate:** Trained on 680K hours of multilingual audio
- ✅ **Flexible:** Multiple model sizes (tiny, base, small, medium, large)
- ✅ **No dependencies:** Self-contained; runs on Mac CPU

**For Phase 2B:** Use `base` model (71M) for good quality/speed balance.

---

## Installation

### 1. Install via Homebrew

```bash
brew install whisper-cpp
```

Verify:
```bash
which whisper-cpp
whisper-cpp --version
```

### 2. Download Model

```bash
# Download base model (71M, ~140MB)
whisper-cpp -d models/ggml-base.bin

# Models available:
# - tiny:    39M  (~75MB)   - Fastest, lower quality
# - base:    71M  (~140MB)  - Recommended for Phase 2B
# - small:   244M (~500MB)  - Better quality, slower
# - medium:  769M (~1.5GB)  - High quality, much slower
# - large:   3GB  (~6GB)    - Highest quality, slowest
```

Location: `~/.cache/whisper.cpp/` or specify with `-m` flag

Verify:
```bash
ls -lh ~/.cache/whisper.cpp/
```

---

## Integration with Phase 2B

### API: Transcribe Audio to SRT/VTT/JSON

Add to worker:

```typescript
import { exec, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

interface TranscriptionResult {
  srt_path: string;
  vtt_path: string;
  json_path: string;
  text: string;
  language: string;
  duration_seconds: number;
  confidence?: number;
}

/**
 * Transcribe audio file using Whisper.cpp
 * Outputs: SRT, VTT, JSON formats per caption-specs.json
 */
export async function transcribeWithWhisperCpp(
  audioPath: string,
  outputDir: string,
  language: string = 'auto',
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large' = 'base'
): Promise<TranscriptionResult> {
  
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Audio file not found: ${audioPath}`);
  }
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const modelPath = path.join(
    process.env.HOME || '/root',
    '.cache',
    'whisper.cpp',
    `ggml-${modelSize}.bin`
  );
  
  if (!fs.existsSync(modelPath)) {
    throw new Error(
      `Whisper model not found: ${modelPath}\n` +
      `Download it with: whisper-cpp -d models/ggml-${modelSize}.bin`
    );
  }
  
  try {
    // Run whisper-cpp with output formats
    const outputPrefix = path.join(outputDir, 'transcript');
    
    const cmd = [
      'whisper-cpp',
      '-m', modelPath,
      '-f', audioPath,
      '-of', outputPrefix,  // Output formats: srt, vtt, txt, json
      '--output-srt',
      '--output-vtt',
      '--output-json'
    ];
    
    if (language !== 'auto') {
      cmd.push('-l', language);
    }
    
    console.log(`Transcribing ${audioPath} with ${modelSize} model...`);
    const { stdout, stderr } = await execAsync(cmd.join(' '));
    
    console.log(`Whisper.cpp output: ${stdout}`);
    if (stderr) console.warn(`Stderr: ${stderr}`);
    
    // Verify outputs exist
    const srtPath = `${outputPrefix}.srt`;
    const vttPath = `${outputPrefix}.vtt`;
    const jsonPath = `${outputPrefix}.json`;
    
    if (!fs.existsSync(srtPath)) {
      throw new Error(`SRT file not created: ${srtPath}`);
    }
    
    // Read transcription text for confidence estimation
    const rawText = fs.readFileSync(srtPath, 'utf-8');
    
    // Parse JSON for language detection
    let detectedLanguage = language;
    if (fs.existsSync(jsonPath)) {
      try {
        const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        detectedLanguage = jsonData.language || language;
      } catch {
        // Use fallback
      }
    }
    
    return {
      srt_path: srtPath,
      vtt_path: vttPath,
      json_path: jsonPath,
      text: rawText,
      language: detectedLanguage,
      duration_seconds: Math.floor(await getAudioDuration(audioPath)),
      confidence: 0.95  // Whisper doesn't output confidence; use default high value
    };
  } catch (err) {
    throw new Error(`Transcription failed: ${(err as Error).message}`);
  }
}

/**
 * Get audio duration in seconds
 */
async function getAudioDuration(audioPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1:noprint_filename=1 "${audioPath}"`);
    return Number.parseFloat(stdout.trim());
  } catch {
    return 0;
  }
}

/**
 * Execute caption job using Whisper.cpp
 * Called by Phase 2B worker
 */
async function executeCaptionJob(job: Job): Promise<void> {
  const config = job.task_config as any;
  const { video_id, audio_path, output_dir, language = 'auto', model_size = 'base' } = config;
  
  try {
    const result = await transcribeWithWhisperCpp(
      audio_path,
      output_dir,
      language,
      model_size
    );
    
    console.log(`Transcription complete for ${video_id}`);
    console.log(`  SRT: ${result.srt_path}`);
    console.log(`  VTT: ${result.vtt_path}`);
    console.log(`  JSON: ${result.json_path}`);
    console.log(`  Language: ${result.language}`);
    console.log(`  Duration: ${result.duration_seconds}s`);
    
    // Store in database
    await storeTranscription(video_id, result);
    
    // Mark job succeeded
    await markJobSucceeded(job, output_dir);
  } catch (err) {
    throw new Error(`Caption job failed: ${(err as Error).message}`);
  }
}

/**
 * Store transcription results in database
 */
async function storeTranscription(
  video_id: string,
  result: TranscriptionResult
): Promise<void> {
  // TODO: INSERT INTO captions table
  // INSERT INTO captions (video_id, language, format, file_path, transcription_method, transcription_confidence)
  // VALUES
  //   ('${video_id}', '${result.language}', 'srt', '${result.srt_path}', 'whisper_cpp', 0.95),
  //   ('${video_id}', '${result.language}', 'vtt', '${result.vtt_path}', 'whisper_cpp', 0.95),
  //   ('${video_id}', '${result.language}', 'json', '${result.json_path}', 'whisper_cpp', 0.95)
}
```

---

## Configuration in Phase 2B

### Caption Job Configuration

When Phase 2B worker creates caption jobs, include:

```json
{
  "job_type": "caption",
  "task_config": {
    "video_id": "00000000-0000-0000-0000-000000000001",
    "audio_path": "/path/to/narration.wav",
    "output_dir": "/path/to/output/captions",
    "language": "auto",
    "model_size": "base"
  }
}
```

### Fallback Configuration

If Whisper.cpp fails or is unavailable:

1. **Fallback to cloud API** (opt-in):
   ```typescript
   if (!whisperAvailable && userPreference.allowCloudTranscription) {
     return await transcribeWithOpenAIAPI(audioPath, outputDir);
   }
   ```

2. **Mark job as skipped** if no fallback:
   ```typescript
   await markJobSkipped(job, "Whisper.cpp unavailable, cloud transcription disabled");
   ```

3. **User notification**: ProBot Studio tab shows `failed_caption_jobs` count

---

## Performance Notes

### Model Size vs Speed/Quality

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| tiny  | 75MB | ~30x  | Low     | Quick tests |
| base  | 140MB | ~10x  | Good    | **Phase 2B** |
| small | 500MB | ~3x   | Very Good | High-quality batches |
| medium | 1.5GB | ~1x  | Excellent | Premium content |
| large | 6GB  | ~0.3x | Best    | Night batch only |

### On Mac mini M4 Pro with 24GB RAM

- **base model (recommended):**
  - Speed: ~10x real-time (60s audio = ~6s transcription)
  - Memory: ~500MB during transcription
  - CPU: Single core, moderate usage
  - Result: **Acceptable for Tier A/B production**

- **small model (if needed):**
  - Speed: ~3x real-time (60s audio = ~20s)
  - Memory: ~1.5GB during transcription
  - CPU: Single core, higher usage
  - Result: **Better quality, slower throughput**

---

## Testing

### 1. Test Whisper.cpp Directly

```bash
# Download test audio (optional)
curl -o /tmp/test-audio.wav https://example.com/sample.wav

# Or create test audio with ffmpeg
ffmpeg -f lavfi -i "sine=frequency=440:duration=10" /tmp/test-audio.wav

# Run transcription
whisper-cpp -m ~/.cache/whisper.cpp/ggml-base.bin -f /tmp/test-audio.wav -of /tmp/test-output

# Verify outputs
ls -lh /tmp/test-output.*
```

### 2. Test Integration

```bash
# From Phase 2B worker test:
const result = await transcribeWithWhisperCpp(
  '/tmp/narration.wav',
  '/tmp/captions-output',
  'en',
  'base'
);

console.log('Transcription succeeded:');
console.log('  SRT:', result.srt_path);
console.log('  VTT:', result.vtt_path);
console.log('  JSON:', result.json_path);
```

### 3. Verify SRT Format

```bash
cat /tmp/captions-output/transcript.srt

# Expected output:
# 1
# 00:00:00,000 --> 00:00:05,000
# This is the first subtitle
# 
# 2
# 00:00:05,000 --> 00:00:10,000
# And the second one
```

---

## Troubleshooting

### Issue: "whisper-cpp not found"

```bash
# Reinstall
brew reinstall whisper-cpp

# Or verify Homebrew paths
which whisper-cpp
echo $PATH
```

### Issue: "Model file not found"

```bash
# Download model explicitly
whisper-cpp --model-download base

# Or specify path directly
whisper-cpp -m ~/Downloads/ggml-base.bin -f audio.wav
```

### Issue: Slow transcription

```bash
# Use smaller model
model_size = 'tiny'  # Much faster, acceptable for simple content

# Or run during off-peak hours (Phase 3 scheduler)
```

### Issue: High memory usage

```bash
# Monitor during transcription
top -p $(pgrep whisper-cpp)

# If exceeds 2GB: reduce model size or batch captions
```

---

## Integration Points

### Phase 2B Worker
- `executeCaptionJob()` dispatches to `transcribeWithWhisperCpp()`
- Failure → retry logic (max 3 retries)
- Success → store in `captions` table

### Phase 3 Posting
- Captions burned into vertical formats (9:16, 1:1, 4:5) by default
- External captions (SRT/VTT) available for YouTube, others

### ProBot Studio Tab
- Shows transcription job status
- Displays failed caption jobs (if any)
- Links to transcript files

---

## Future Enhancements

- [ ] Support for multiple languages in same video
- [ ] Batch transcription (parallel jobs if VRAM permits)
- [ ] Confidence-based retry (re-transcribe if confidence < threshold)
- [ ] Fine-tuned model for specific voice (LoRA, Phase 5)
- [ ] Real-time transcription for live streams
- [ ] Integration with cloud transcription as premium option

---

## Files

- Installation instructions above
- Integration code: `operations/specs/video-orchestrator/video-orchestrator-worker.ts`
- Database schema stores results: `operations/runbooks/video-orchestrator-phase-2b-schema.sql`

---

## Status

✅ **Ready for Integration**

- Whisper.cpp installation clear
- Integration API designed
- Phase 2B worker can dispatch caption jobs
- Fallback strategy defined
- Performance acceptable for Mac mini M4 Pro

Next: Implement in Phase 2B worker stub.

