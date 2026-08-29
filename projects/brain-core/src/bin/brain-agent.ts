#!/usr/bin/env node

import { analyzeVideo } from '../adapters/video-analysis-service.js';

const BASE_URL = process.env.BRAIN_CORE_URL ?? 'http://localhost:3000';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'video' && args[1] === 'analyze') {
    const source = args[2];
    if (!source) {
      console.error('Usage: brain-agent video analyze <url-or-path> [--focus "..."] [--save-to-mind]');
      process.exitCode = 1;
      return;
    }
    let focus: string | undefined;
    let persistToMind = false;
    let caller: 'codex' | 'claude-code' = 'codex';
    for (let index = 3; index < args.length; index += 1) {
      const argument = args[index];
      if (argument === '--save-to-mind') {
        persistToMind = true;
      } else if (argument === '--focus') {
        focus = args[index + 1];
        index += 1;
      } else if (argument === '--caller') {
        const requested = args[index + 1];
        if (requested !== 'codex' && requested !== 'claude-code') {
          console.error('--caller must be codex or claude-code');
          process.exitCode = 1;
          return;
        }
        caller = requested;
        index += 1;
      } else {
        console.error(`Unknown video argument: ${argument}`);
        process.exitCode = 1;
        return;
      }
    }
    try {
      const result = await analyzeVideo({
        source,
        caller,
        allow_local_file: true,
        persist_to_mind: persistToMind,
        ...(focus ? { focus } : {}),
      });
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
      process.exitCode = result.ok ? 0 : 1;
    } catch (error) {
      console.error(`brain-agent video analyze failed: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  if (command !== 'capabilities') {
    console.error('Usage: brain-agent capabilities | brain-agent video analyze <url-or-path> [--focus "..."] [--save-to-mind]');
    process.exitCode = 1;
    return;
  }

  try {
    const response = await fetch(`${BASE_URL}/api/agent/capabilities`, {
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Brain Core returned ${response.status}`);
    }

    const body = (await response.json()) as unknown;
    process.stdout.write(`${JSON.stringify(body, null, 2)}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`brain-agent capabilities failed: ${message}`);
    process.exitCode = 1;
  }
}

void main();
