import assert from 'node:assert/strict';
import { access, chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = resolve(import.meta.dirname, '..');
const wrapperPath = join(repoRoot, 'tools/n8n-api.sh');
const candidatePath = join(
  repoRoot,
  'operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json',
);
const rollbackPath = join(
  repoRoot,
  'operations/reports/artifacts/b1-0a-live-workflow-rollback.json',
);
const workflowId = 'FwP5INe9qoo1OwGC';

test('update-workflow validates the full artifact and sends only public API update fields', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'n8n-api-contract-'));
  const fakeCurlPath = join(fixtureDir, 'curl');
  const capturedPayloadPath = join(fixtureDir, 'captured-request.json');
  const fakeCurl = `#!/usr/bin/env bash
set -euo pipefail
output_file=""
payload_file=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --output)
      output_file="$2"
      shift 2
      ;;
    --data-binary)
      payload_file="\${2#@}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done
cp "$payload_file" "$N8N_TEST_CAPTURE_PATH"
printf '{"id":"${workflowId}"}' >"$output_file"
printf '200'
`;

  try {
    await writeFile(fakeCurlPath, fakeCurl, { mode: 0o700 });
    await chmod(fakeCurlPath, 0o700);
    for (const artifactPath of [candidatePath, rollbackPath]) {
      const result = spawnSync(wrapperPath, ['update-workflow', workflowId, artifactPath], {
        cwd: repoRoot,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fixtureDir}:${process.env.PATH}`,
          N8N_API_URL: 'https://n8n.invalid/api/v1',
          N8N_API_KEY: 'test-only-key',
          N8N_TEST_CAPTURE_PATH: capturedPayloadPath,
        },
      });

      assert.equal(result.status, 0, JSON.stringify({
        artifactPath,
        signal: result.signal,
        error: result.error?.message,
        stdout: result.stdout,
        stderr: result.stderr,
      }));
      assert.deepEqual(JSON.parse(result.stdout), {
        contractVersion: 1,
        operation: 'update-workflow',
        classification: 'succeeded',
        workflowId,
        requestSent: true,
        responseReceived: true,
        httpStatus: 200,
        responseWorkflowId: workflowId,
        failurePhase: 'none',
        errorCode: 'NONE',
      });

      const source = JSON.parse(await readFile(artifactPath, 'utf8'));
      const transmitted = JSON.parse(await readFile(capturedPayloadPath, 'utf8'));
      assert.deepEqual(Object.keys(transmitted).sort(), [
        'connections',
        'name',
        'nodes',
        'settings',
        'staticData',
      ]);
      assert.deepEqual(transmitted, {
        name: source.name,
        nodes: source.nodes,
        connections: source.connections,
        settings: source.settings,
        staticData: source.staticData,
      });
      assert.equal(Object.hasOwn(transmitted, 'id'), false);
      assert.equal(Object.hasOwn(transmitted, 'active'), false);
      assert.equal(Object.hasOwn(transmitted, 'tags'), false);
      assert.equal(Object.hasOwn(transmitted, 'activeVersion'), false);
    }
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});

test('update-workflow rejects literal authorization material before transmission', async () => {
  const fixtureDir = await mkdtemp(join(tmpdir(), 'n8n-api-auth-'));
  const unsafeCandidatePath = join(fixtureDir, 'unsafe-candidate.json');
  const fakeCurlPath = join(fixtureDir, 'curl');
  const curlCalledPath = join(fixtureDir, 'curl-called');
  const source = JSON.parse(await readFile(candidatePath, 'utf8'));
  let changed = false;
  const replaceAuthorization = (value) => {
    if (!value || typeof value !== 'object') return;
    if (!changed && value.name === 'Authorization' && typeof value.value === 'string') {
      value.value = 'Bearer test-literal-must-not-pass';
      changed = true;
      return;
    }
    for (const child of Object.values(value)) replaceAuthorization(child);
  };
  replaceAuthorization(source);
  assert.equal(changed, true);

  try {
    await writeFile(unsafeCandidatePath, JSON.stringify(source));
    await writeFile(fakeCurlPath, '#!/usr/bin/env bash\ntouch "$N8N_TEST_CURL_CALLED"\nexit 99\n', { mode: 0o700 });
    await chmod(fakeCurlPath, 0o700);
    const result = spawnSync(wrapperPath, ['update-workflow', workflowId, unsafeCandidatePath], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${fixtureDir}:${process.env.PATH}`,
        N8N_API_URL: 'https://n8n.invalid/api/v1',
        N8N_API_KEY: 'test-only-key',
        N8N_TEST_CURL_CALLED: curlCalledPath,
      },
    });
    assert.equal(result.status, 10);
    assert.equal(result.stderr, '');
    assert.equal(JSON.parse(result.stdout).errorCode, 'PAYLOAD_CREDENTIAL_MATERIAL_REJECTED');
    assert.equal(JSON.parse(result.stdout).requestSent, false);
    await assert.rejects(access(curlCalledPath));
  } finally {
    await rm(fixtureDir, { recursive: true, force: true });
  }
});
