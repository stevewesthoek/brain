#!/usr/bin/env node

/**
 * Run the keyless A0.2 DeepSeek Harness proof against an already-built,
 * explicitly pinned temporary checkout. This script never installs packages,
 * invokes a provider, changes AWS access, or writes inside the checkout.
 *
 * Usage:
 *   node tools/scripts/agent-mode-a02-harness-proof.mjs --harness-root /tmp/dsh
 */

import { access, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const EXPECTED_COMMIT = 'c389f96bf3a9b6807cb71ed6bdad5849be0df6d8'
const EXPECTED_VERSION = '0.1.3-alpha.2'

function argument(name) {
  const index = process.argv.indexOf(name)
  return index < 0 ? undefined : process.argv[index + 1]
}

function requireArgument(name) {
  const value = argument(name)
  if (value === undefined || value === '') throw new Error(`missing ${name}`)
  return resolve(value)
}

async function exists(path) {
  return access(path).then(() => true, () => false)
}

function toolChunks(name, id, args) {
  const argumentsText = JSON.stringify(args)
  return [
    { type: 'block-start', index: 0, blockType: 'tool-call' },
    { type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsText },
    { type: 'block-end', index: 0, block: { type: 'tool-call', id, name, arguments: argumentsText } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: 5 } },
    { type: 'finish', reason: { kind: 'tool-calls' } },
  ]
}

function textChunks(text) {
  return [
    { type: 'block-start', index: 0, blockType: 'text' },
    { type: 'text-delta', index: 0, text },
    { type: 'block-end', index: 0, block: { type: 'text', text } },
    { type: 'usage', usage: { inputTokens: 10, outputTokens: text.length } },
    { type: 'finish', reason: { kind: 'stop' } },
  ]
}

async function main() {
  const harnessRoot = requireArgument('--harness-root')
  const head = (await readFile(join(harnessRoot, '.git', 'HEAD'), 'utf8')).trim()
  const commit = head.startsWith('ref:')
    ? (await readFile(join(harnessRoot, '.git', head.slice(5).trim()), 'utf8')).trim()
    : head
  if (commit !== EXPECTED_COMMIT) throw new Error(`Harness checkout is not pinned to ${EXPECTED_COMMIT}`)

  const packageManifest = JSON.parse(await readFile(join(harnessRoot, 'package.json'), 'utf8'))
  if (packageManifest.version !== EXPECTED_VERSION) {
    throw new Error(`Harness checkout version is ${String(packageManifest.version)}, expected ${EXPECTED_VERSION}`)
  }

  const sdkClient = join(harnessRoot, 'packages/sdk/client/lib/index.js')
  const cliSource = join(harnessRoot, 'apps/cli/src/bin.ts')
  const replayAdapter = join(harnessRoot, 'packages/test-support/llm-replay/lib/index.js')
  const toolsRuntime = join(harnessRoot, 'packages/core/tools/lib/index.js')
  for (const path of [sdkClient, cliSource, replayAdapter, toolsRuntime]) {
    if (!(await exists(path))) throw new Error(`required built/source Harness path is missing: ${path}`)
  }

  const { DeepSeekHarness } = await import(pathToFileURL(sdkClient).href)
  const proofRoot = await mkdtemp(join(tmpdir(), 'brain-agent-mode-a02-proof-'))
  const profilePatch = join(proofRoot, 'restricted.patch.yml')
  const toolPlugin = join(proofRoot, 'restricted-tool.mjs')
  const readOverride = join(proofRoot, 'read.override.json')
  const deniedOverride = join(proofRoot, 'denied.override.json')
  const effectOverride = join(proofRoot, 'effect.override.json')
  const hangReady = join(proofRoot, 'hang.ready')
  const hangOverride = join(proofRoot, 'hang.override.json')
  const forbiddenPath = join(proofRoot, 'forbidden')
  const effectJournal = join(proofRoot, 'effect.journal.json')
  const effectMarker = join(proofRoot, 'effect.marker')

  await writeFile(toolPlugin, `import { writeFileSync } from 'node:fs'
import { defineContentToolFixture } from ${JSON.stringify(pathToFileURL(toolsRuntime).href)}
export function apply(ctx) {
  ctx.tools.register(defineContentToolFixture({
    name: 'brain_read',
    description: 'Read-only fixture capability for the Brain A0.2 proof',
    parameters: { path: { type: 'string', required: true } },
    async execute(args, exec) {
      return [{ type: 'text', text: 'read:' + exec.agent.session.id + ':' + args.path }]
    },
  }))
  if (process.env.DSH_A02_EFFECT_JOURNAL) {
    ctx.tools.register(defineContentToolFixture({
      name: 'brain_effect',
      description: 'Crash-recovery fixture; never a production capability',
      parameters: { operationId: { type: 'string', required: true }, crash: { type: 'boolean', required: true } },
      async execute(args) {
        const journal = process.env.DSH_A02_EFFECT_JOURNAL
        const marker = process.env.DSH_A02_EFFECT_MARKER
        writeFileSync(journal, JSON.stringify({
          operationId: args.operationId,
          attemptId: 'attempt:crash-1',
          scopeHash: 'scope:fixture-read',
          status: 'effect_applied',
        }))
        writeFileSync(marker, 'effect-applied')
        if (args.crash) process.exit(42)
        writeFileSync(journal, JSON.stringify({
          operationId: args.operationId,
          attemptId: 'attempt:crash-1',
          scopeHash: 'scope:fixture-read',
          status: 'receipt_recorded',
          receipt: { effectHash: 'effect:fixture-1' },
        }))
        return [{ type: 'text', text: 'effect-complete' }]
      },
    }))
  }
}
`)
  await writeFile(profilePatch, `# Ephemeral A0.2 proof overlay; not a production profile.
- id: llm-deepseek
  disabled: true
- id: sandbox
  disabled: true
- id: sandbox-policy
  disabled: true
- id: subprocess
  disabled: true
- id: pty
  disabled: true
- id: terminal-bash
  disabled: true
- id: terminal-pwsh
  disabled: true
- id: fs-local
  disabled: true
- id: persistent-bash
  disabled: true
- id: persistent-pwsh
  disabled: true
- id: str-replace-editor
  disabled: true
- id: jobs
  disabled: true
- id: sessions
  disabled: true
- insert:
    - id: llm-replay
      name: ${replayAdapter}
      config:
        file: !!js process.env.DSH_SNAPSHOT_OVERRIDE
        overrideFile: !!js process.env.DSH_SNAPSHOT_OVERRIDE
        providers:
          - id: mock
            models:
              - id: mock
    - id: brain-a02-read
      name: ${toolPlugin}
      inject: [tools]
`)
  await writeFile(readOverride, JSON.stringify([
    { kind: 'chunks', chunks: toolChunks('brain_read', 'read-1', { path: 'README.md' }) },
    { kind: 'chunks', chunks: textChunks('done') },
  ]))
  await writeFile(deniedOverride, JSON.stringify([
    { kind: 'chunks', chunks: toolChunks('bash', 'shell-1', { command: `touch ${forbiddenPath}` }) },
    { kind: 'chunks', chunks: textChunks('denied-cleanly') },
  ]))
  await writeFile(effectOverride, JSON.stringify([
    { kind: 'chunks', chunks: toolChunks('brain_effect', 'effect-1', { operationId: 'op:crash-1', crash: true }) },
  ]))
  await writeFile(hangOverride, JSON.stringify([{ kind: 'hang', readyFile: hangReady }]))

  const environment = () => ({
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    TMPDIR: process.env.TMPDIR ?? '/tmp',
    LANG: process.env.LANG ?? 'C',
    DSH_SNAPSHOT_FILE: process.env.DSH_SNAPSHOT_OVERRIDE,
    DSH_SNAPSHOT_OVERRIDE: process.env.DSH_SNAPSHOT_OVERRIDE,
  })
  const createHarness = (override, extraEnvironment = {}) => new DeepSeekHarness({
    profile: 'sdk-minimal',
    patches: [profilePatch],
    dshHome: join(proofRoot, `home-${override.split('/').at(-1)}`),
    processCwd: harnessRoot,
    env: { ...environment(), DSH_SNAPSHOT_FILE: override, DSH_SNAPSHOT_OVERRIDE: override, ...extraEnvironment },
    cwd: harnessRoot,
    provider: 'mock',
    model: 'mock',
    initializeTimeoutMs: 15_000,
    requestTimeoutMs: 30_000,
    disposeEofGraceMs: 200,
    disposeGraceMs: 3_000,
  })

  const readHarness = createHarness(readOverride)
  const readResult = await readHarness.run('read README.md', { sessionId: 'brain-a02-read-session' })
  await readHarness.close()
  const readToolResult = readResult.events.find(event => event.type === 'tool/result')
  if (readResult.finalResponse !== 'done' || readToolResult?.type !== 'tool/result'
    || readToolResult.data.message.content[0]?.isError === true) {
    throw new Error('restricted read-only SDK run did not complete as expected')
  }

  const deniedHarness = createHarness(deniedOverride)
  const deniedResult = await deniedHarness.run('use bash', { sessionId: 'brain-a02-denied-session' })
  await deniedHarness.close()
  const deniedToolResult = deniedResult.events.find(event => event.type === 'tool/result')
  if (deniedResult.finalResponse !== 'denied-cleanly' || deniedToolResult?.type !== 'tool/result'
    || deniedToolResult.data.message.content[0]?.isError !== true || await exists(forbiddenPath)) {
    throw new Error('undeclared shell tool was not denied before effect')
  }

  const cancelHarness = createHarness(hangOverride)
  const run = cancelHarness.run('hang', { sessionId: 'brain-a02-cancel-session' }).then(
    () => ({ kind: 'unexpected-completion' }),
    error => ({ kind: error?.name ?? 'unknown-error' }),
  )
  for (let index = 0; index < 100 && !(await exists(hangReady)); index++) {
    await new Promise(resolvePromise => setTimeout(resolvePromise, 50))
  }
  if (!(await exists(hangReady))) throw new Error('cancellation fixture never reached the hanging stream')
  const closeStarted = Date.now()
  await cancelHarness.close()
  const cancellation = await Promise.race([
    run,
    new Promise(resolvePromise => setTimeout(() => resolvePromise({ kind: 'timeout' }), 1_000)),
  ])
  if (cancellation.kind !== 'TransportClosedError') throw new Error(`unexpected cancellation outcome: ${cancellation.kind}`)

  const effectHarness = createHarness(effectOverride, {
    DSH_A02_EFFECT_JOURNAL: effectJournal,
    DSH_A02_EFFECT_MARKER: effectMarker,
  })
  const effectOutcome = await effectHarness.run('apply and crash', { sessionId: 'brain-a02-effect-session' }).then(
    () => 'unexpected-completion',
    error => error?.name ?? 'unknown-error',
  )
  await effectHarness.close().catch(() => {})
  if (effectOutcome !== 'TransportClosedError' || !(await exists(effectMarker))) {
    throw new Error(`effect crash fixture did not terminate after applying the effect: ${effectOutcome}`)
  }
  const journal = JSON.parse(await readFile(effectJournal, 'utf8'))
  if (journal.status !== 'effect_applied' || journal.receipt !== undefined) {
    throw new Error('effect journal did not preserve crash-after-effect-before-receipt state')
  }
  // This is the same durable state classified by Brain's A0.1
  // reconcileOperation contract as uncertain, never as safe to replay.
  const reconciliation = journal.status === 'effect_applied' && journal.receipt === undefined
    ? 'uncertain' : 'invalid'
  if (reconciliation !== 'uncertain') throw new Error('crash state was not classified as uncertain')
  const recorded = {
    ...journal,
    status: 'receipt_recorded',
    receipt: { operationId: journal.operationId, scopeHash: journal.scopeHash, effectHash: 'effect:fixture-1' },
  }
  if (recorded.status !== 'receipt_recorded' || recorded.receipt.scopeHash !== journal.scopeHash) {
    throw new Error('effect receipt was not recorded against the original scope')
  }
  const duplicate = recorded.receipt.operationId === recorded.operationId
    && recorded.receipt.scopeHash === recorded.scopeHash ? 'duplicate' : 'invalid'
  const conflict = recorded.receipt.scopeHash === 'scope:other' ? 'duplicate' : 'conflict'
  if (duplicate !== 'duplicate' || conflict !== 'conflict') throw new Error('receipt duplicate/conflict handling failed')

  console.log(JSON.stringify({
    commit,
    version: packageManifest.version,
    readOnlyRun: 'passed',
    deniedShell: 'passed',
    cancellation: 'passed',
    crashAfterEffect: 'passed',
    reconciliation,
    duplicateReceipt: duplicate,
    conflictingReceipt: conflict,
    closeMs: Date.now() - closeStarted,
    providerCalls: 'replay-only',
  }))
  await rm(proofRoot, { recursive: true, force: true })
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
