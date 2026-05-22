#!/usr/bin/env node

const BASE_URL = process.env.BRAIN_CORE_URL ?? 'http://localhost:3000';

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command !== 'capabilities') {
    console.error('Usage: brain-agent capabilities');
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
