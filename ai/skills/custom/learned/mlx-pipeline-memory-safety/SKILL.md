---
name: mlx-pipeline-memory-safety
description: When a pipeline spawns mlx_whisper (or any large MLX model) in a loop on Apple Silicon, it will exhaust swap and trigger a kernel watchdog panic — here's the memory gate pattern that prevents it.
---

# MLX Pipeline Memory Safety (Apple Silicon)

## The insight
mlx_whisper loads the full model (~3 GB for large-v3) from scratch on every
subprocess spawn. In a loop over hundreds of files, macOS has no time to
reclaim memory between spawns. Swap fills to 100% segments (66+ swapfiles),
watchdogd stops getting heartbeats, and the kernel panics. The fix is not
a memory limit — it's a gate that checks available RAM before each spawn
and waits until macOS has naturally reclaimed enough.

## When this applies
- Spawning `mlx_whisper` (or any MLX/CoreML model loader) in a for-loop
- Kernel panic: `watchdog timeout: no checkins from watchdogd in N seconds`
- Compressor line in panic report: `100% of segments limit (BAD) with 66 swapfiles`
- Pipeline exits 0 but produces zero output ("No JSON output from mlx_whisper")
  — this means mlx_whisper is failing silently on every file

## The approach
Check three things before each spawn:
1. Is enough RAM available? (free + speculative + purgeable + 50% inactive)
2. Is the process running at reduced priority so the watchdog stays responsive?
3. Is there a cooldown after each spawn so macOS can reclaim?

For the concurrency problem: a long-running pipeline that spans multiple
nightly scheduler windows will get a second instance spawned on top of it.
Always add a PID lock file.

## The fix

**Memory gate** (add before each `spawnSync` call):
```js
function getAvailableMemoryGB() {
  const vmstat = spawnSync('vm_stat', [], { encoding: 'utf8' }).stdout;
  const PAGE = 16384; // Apple Silicon
  const parse = (label) =>
    parseInt(vmstat.match(new RegExp(label + '\\s+(\\d+)'))?.[1] ?? '0');
  const bytes = (
    parse('Pages free:') + parse('Pages speculative:') +
    parse('Pages purgeable:') + Math.floor(parse('Pages inactive:') * 0.5)
  ) * PAGE;
  return bytes / (1024 ** 3);
}

async function waitForMemory(requiredGB = 4, intervalMs = 30_000, maxWaitMs = 1_800_000) {
  const deadline = Date.now() + maxWaitMs;
  while (getAvailableMemoryGB() < requiredGB) {
    if (Date.now() >= deadline) return; // proceed anyway after 30 min
    await new Promise(r => setTimeout(r, intervalMs));
  }
}
```

**In the transcription loop:**
```js
await waitForMemory(4);                         // wait for 4 GB headroom
spawnSync('nice', ['-n', '10', mlxBin, ...]);   // reduced priority
await new Promise(r => setTimeout(r, 5_000));    // cooldown after each spawn
```

**Concurrency lock** (in the shell wrapper):
```bash
LOCK_FILE="$HOME/.local/state/<job>/pipeline.lock"
if [[ -f "$LOCK_FILE" ]]; then
  PID=$(cat "$LOCK_FILE")
  kill -0 "$PID" 2>/dev/null && exit 0   # already running — skip
  rm -f "$LOCK_FILE"                      # stale lock — clear it
fi
printf '%s\n' "$$" > "$LOCK_FILE"
trap 'rm -f "$LOCK_FILE"' EXIT
```

## Gotchas
- `mlx-community/whisper-large-v3` does **not** exist on HuggingFace —
  correct name is `mlx-community/whisper-large-v3-mlx`. Always verify the
  repo ID before setting it as a constant; a 404 returns immediately with
  no JSON output, which looks identical to a memory failure.
- HuggingFace token required even for public model downloads if not cached.
  Token path: `~/.cache/huggingface/token`. Without it: `401 Unauthorized`.
- The threshold of 4 GB is calibrated for the large-v3-mlx model. Adjust
  for smaller models (2 GB for medium, 1 GB for small/base).
- Don't count all inactive pages as available — the OS may need them for
  active processes. 50% of inactive is a conservative safe estimate.

## Context
Repo: brain  
Discovered: 2026-04-09  
Area: `tools/scripts/bible-studies/pipeline.mjs`, `tools/scripts/bible-studies-pipeline.sh`
