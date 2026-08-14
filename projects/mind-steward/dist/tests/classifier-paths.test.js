import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyMindCaptureInbox, converseWithBedrockAws, discoverMindFailedCaptures, resolveMindCaptureExecutionMode, } from '../classifier.js';
function createMindFixture() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-paths-'));
    fs.mkdirSync(path.join(root, 'inbox/new'), { recursive: true });
    fs.mkdirSync(path.join(root, 'inbox/failed'), { recursive: true });
    fs.mkdirSync(path.join(root, 'capture/inbox'), { recursive: true });
    return root;
}
function writeCapture(file, title) {
    fs.writeFileSync(file, `---\ntype: capture\n---\n\n# ${title}\n\nFixture content.\n`);
}
function installFixtureBedrock(t) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = String(input);
        assert.ok(url.endsWith('/select'));
        const request = JSON.parse(String(init?.body ?? '{}'));
        assert.equal(request.local_only, undefined);
        assert.equal(request.task_metadata?.private, true);
        assert.equal(request.task_metadata?.sensitive, true);
        assert.deepEqual(request.task_metadata?.allowed_providers, ['claude-bedrock']);
        assert.deepEqual(request.task_metadata?.allowed_models, ['us.anthropic.claude-sonnet-4-6']);
        assert.equal(request.task_metadata?.fallback_policy, 'none');
        return new Response(JSON.stringify({
            provider_id: 'claude-bedrock',
            model: 'us.anthropic.claude-sonnet-4-6',
            base_url: '',
            timeout_inference_sec: 5,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    return async (route, prompt) => {
        assert.equal(route.provider_id, 'claude-bedrock');
        assert.equal(route.model, 'us.anthropic.claude-sonnet-4-6');
        assert.match(prompt, /Classify this Mind capture/);
        return JSON.stringify({
            title: 'Current',
            para_type: 'inbox',
            confidence: 0.8,
            signal_quality: 0.7,
            summary: 'Fixture summary.',
            key_points: ['fixture'],
            tags: ['fixture'],
        });
    };
}
test('classifier discovers only inbox/new and ignores retired capture/inbox', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    writeCapture(path.join(mindRoot, 'inbox/new/current.md'), 'Current');
    writeCapture(path.join(mindRoot, 'capture/inbox/retired.md'), 'Retired');
    const bedrockConverse = installFixtureBedrock(t);
    const result = await classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
        bedrockConverse,
    });
    assert.equal(result.ok, true);
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.writesToMind, false);
    assert.equal(result.processed, 1);
    assert.equal(result.classified, 1);
    assert.equal(result.results[0]?.file, path.join('inbox', 'new', 'current.md'));
    assert.equal(result.results.some((entry) => entry.file.includes('capture/inbox')), false);
    assert.equal(fs.readFileSync(path.join(mindRoot, 'inbox/new/current.md'), 'utf8').includes('mind_steward_classified'), false);
});
test('classifier returns empty results for missing inbox/new and empty inbox/new', async (t) => {
    const missingMindRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-missing-'));
    const emptyMindRoot = createMindFixture();
    t.after(() => fs.rmSync(missingMindRoot, { recursive: true, force: true }));
    t.after(() => fs.rmSync(emptyMindRoot, { recursive: true, force: true }));
    const missingResult = await classifyMindCaptureInbox({
        mindRoot: missingMindRoot,
        selectorUrl: 'http://selector.invalid',
    });
    const emptyResult = await classifyMindCaptureInbox({
        mindRoot: emptyMindRoot,
        selectorUrl: 'http://selector.invalid',
    });
    for (const result of [missingResult, emptyResult]) {
        assert.equal(result.ok, true);
        assert.equal(result.processed, 0);
        assert.equal(result.classified, 0);
        assert.equal(result.skipped, 0);
        assert.equal(result.failed, 0);
        assert.equal(result.results.length, 0);
        assert.equal(result.writesToMind, false);
    }
});
test('classifier processes one markdown file and excludes README', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    const bedrockConverse = installFixtureBedrock(t);
    const capture = path.join(mindRoot, 'inbox/new/current.md');
    writeCapture(capture, 'Current');
    fs.writeFileSync(path.join(mindRoot, 'inbox/new', 'README.md'), '# Ignore\n');
    const result = await classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
        bedrockConverse,
    });
    assert.equal(result.mode, 'dry-run');
    assert.equal(result.processed, 1);
    assert.equal(result.classified, 1);
    assert.equal(result.results[0]?.file, path.join('inbox', 'new', 'current.md'));
    assert.equal(result.results.some((entry) => entry.file.endsWith('README.md')), false);
    assert.equal(fs.readFileSync(path.join(mindRoot, 'inbox/new/current.md'), 'utf8').includes('mind_steward_classified'), false);
});
test('classifier rejects unsafe capture directory and symlink escapes', async (t) => {
    const mindRoot = createMindFixture();
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-outside-'));
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
    fs.writeFileSync(path.join(outside, 'escape.md'), '# Escape\n');
    fs.rmSync(path.join(mindRoot, 'inbox/new'), { recursive: true, force: true });
    fs.symlinkSync(outside, path.join(mindRoot, 'inbox/new'));
    await assert.rejects(classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
    }), /unsafe_capture_path/);
    fs.rmSync(path.join(mindRoot, 'inbox/new'), { recursive: true, force: true });
    fs.mkdirSync(path.join(mindRoot, 'inbox/new'), { recursive: true });
    fs.symlinkSync(path.join(outside, 'escape.md'), path.join(mindRoot, 'inbox/new', 'escape.md'));
    await assert.rejects(classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
    }), /unsafe_capture_symlink|unsafe_capture_path/);
});
test('classifier fails closed if selector returns Codex and never executes Converse', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    writeCapture(path.join(mindRoot, 'inbox/new/current.md'), 'Current');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
        provider_id: 'codex-cli',
        model: 'gpt-5.4-mini',
        timeout_inference_sec: 5,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    let converseCalls = 0;
    const result = await classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
        bedrockConverse: async () => {
            converseCalls += 1;
            return '{}';
        },
    });
    assert.equal(result.ok, false);
    assert.equal(result.failed, 1);
    assert.equal(converseCalls, 0);
    assert.match(result.results[0]?.reason ?? '', /disallowed provider/);
});
test('classifier fails closed if selector returns an unapproved Bedrock model', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    writeCapture(path.join(mindRoot, 'inbox/new/current.md'), 'Current');
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({
        provider_id: 'claude-bedrock',
        model: 'us.anthropic.claude-opus-4-1',
        timeout_inference_sec: 5,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
    let converseCalls = 0;
    const result = await classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
        bedrockConverse: async () => {
            converseCalls += 1;
            return '{}';
        },
    });
    assert.equal(result.ok, false);
    assert.equal(result.failed, 1);
    assert.equal(converseCalls, 0);
    assert.match(result.results[0]?.reason ?? '', /disallowed model/);
});
test('Bedrock Converse keeps private Mind content out of argv and removes its private request', async () => {
    const privateCapture = 'PRIVATE_MIND_CAPTURE_DO_NOT_EXPOSE_IN_ARGV';
    let requestFile = '';
    let requestDir = '';
    const route = {
        provider_id: 'claude-bedrock',
        model: 'us.anthropic.claude-sonnet-4-6',
        timeout_inference_sec: 5,
        region: 'us-east-1',
    };
    const runExecFile = (file, args, options, callback) => {
        assert.equal(file, 'aws');
        assert.equal(args.includes('--messages'), false);
        assert.equal(args.includes('--model-id'), false);
        assert.equal(args.some((argument) => argument.includes(privateCapture)), false);
        assert.equal(options.timeout, 5000);
        assert.equal(options.maxBuffer, 2 * 1024 * 1024);
        const inputIndex = args.indexOf('--cli-input-json');
        assert.notEqual(inputIndex, -1);
        const requestUrl = args[inputIndex + 1];
        assert.ok(requestUrl?.startsWith('file://'));
        if (!requestUrl)
            throw new Error('missing private Bedrock request URL');
        requestFile = fileURLToPath(requestUrl);
        requestDir = path.dirname(requestFile);
        assert.equal(fs.statSync(requestFile).mode & 0o777, 0o600);
        const request = JSON.parse(fs.readFileSync(requestFile, 'utf8'));
        assert.equal(request.modelId, route.model);
        assert.equal(request.messages?.[0]?.content?.[0]?.text, privateCapture);
        assert.deepEqual(request.inferenceConfig, { maxTokens: 1200, temperature: 0.1 });
        callback(null, JSON.stringify({
            output: { message: { content: [{ text: 'private-safe-response' }] } },
        }), '');
    };
    const response = await converseWithBedrockAws(route, privateCapture, runExecFile);
    assert.equal(response, 'private-safe-response');
    assert.equal(fs.existsSync(requestFile), false);
    assert.equal(fs.existsSync(requestDir), false);
});
test('Bedrock Converse removes its private request after failure or timeout', async () => {
    const route = {
        provider_id: 'claude-bedrock',
        model: 'us.anthropic.claude-sonnet-4-6',
        timeout_inference_sec: 1,
        region: 'us-east-1',
    };
    for (const failureKind of ['failure', 'timeout']) {
        let requestFile = '';
        let requestDir = '';
        const runExecFile = (_file, args, _options, callback) => {
            const inputIndex = args.indexOf('--cli-input-json');
            const requestUrl = args[inputIndex + 1];
            assert.ok(requestUrl?.startsWith('file://'));
            if (!requestUrl)
                throw new Error('missing private Bedrock request URL');
            requestFile = fileURLToPath(requestUrl);
            requestDir = path.dirname(requestFile);
            const error = new Error(failureKind === 'timeout' ? 'process timed out' : 'process failed');
            if (failureKind === 'timeout') {
                Object.assign(error, { killed: true, signal: 'SIGTERM' });
            }
            callback(error, '', 'bounded AWS CLI failure');
        };
        await assert.rejects(converseWithBedrockAws(route, `private-${failureKind}`, runExecFile), /Bedrock Converse failed/);
        assert.equal(fs.existsSync(requestFile), false);
        assert.equal(fs.existsSync(requestDir), false);
    }
});
test('classifier disables apply until approval integration is proven', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    writeCapture(path.join(mindRoot, 'inbox/new/current.md'), 'Current');
    await assert.rejects(classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
        mode: 'apply',
    }), /apply_disabled_pending_approval_integration/);
    assert.equal(fs.readFileSync(path.join(mindRoot, 'inbox/new/current.md'), 'utf8').includes('mind_steward_classified'), false);
});
test('ambiguous or malformed classifier modes fail closed', () => {
    assert.equal(resolveMindCaptureExecutionMode({}), 'dry-run');
    assert.throws(() => resolveMindCaptureExecutionMode({ mode: 'apply', dryRun: true }), /conflict/);
    assert.throws(() => resolveMindCaptureExecutionMode({ mode: 'unsafe' }), /exactly/);
});
test('failed queue discovery is sorted, read-only, and limited to inbox/failed markdown', (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    writeCapture(path.join(mindRoot, 'inbox/failed/b.md'), 'B');
    writeCapture(path.join(mindRoot, 'inbox/failed/a.md'), 'A');
    fs.writeFileSync(path.join(mindRoot, 'inbox/failed/README.md'), '# Failed queue');
    fs.writeFileSync(path.join(mindRoot, 'inbox/failed/ignored.txt'), 'ignored');
    const before = fs.readFileSync(path.join(mindRoot, 'inbox/failed/a.md'), 'utf8');
    const items = discoverMindFailedCaptures(mindRoot);
    const after = fs.readFileSync(path.join(mindRoot, 'inbox/failed/a.md'), 'utf8');
    assert.deepEqual(items, [
        path.join('inbox', 'failed', 'a.md'),
        path.join('inbox', 'failed', 'b.md'),
    ]);
    assert.equal(after, before);
});
