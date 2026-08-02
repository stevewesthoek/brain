import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyMindCaptureInbox, discoverMindFailedCaptures, resolveMindCaptureExecutionMode, } from '../classifier.js';
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
function installFixtureModel(t) {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input) => {
        const url = String(input);
        if (url.endsWith('/select')) {
            return new Response(JSON.stringify({
                provider_id: 'fixture-local',
                model: 'fixture-model',
                base_url: 'http://127.0.0.1:11434',
                timeout_inference_sec: 5,
            }), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        return new Response(JSON.stringify({
            choices: [{
                    message: {
                        content: JSON.stringify({
                            title: 'Current',
                            para_type: 'inbox',
                            confidence: 0.8,
                            signal_quality: 0.7,
                            summary: 'Fixture summary.',
                            key_points: ['fixture'],
                            tags: ['fixture'],
                        }),
                    },
                }],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    t.after(() => {
        globalThis.fetch = originalFetch;
    });
}
test('classifier discovers only inbox/new and ignores retired capture/inbox', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    writeCapture(path.join(mindRoot, 'inbox/new/current.md'), 'Current');
    writeCapture(path.join(mindRoot, 'capture/inbox/retired.md'), 'Retired');
    installFixtureModel(t);
    const result = await classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
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
    installFixtureModel(t);
    const capture = path.join(mindRoot, 'inbox/new/current.md');
    writeCapture(capture, 'Current');
    fs.writeFileSync(path.join(mindRoot, 'inbox/new', 'README.md'), '# Ignore\n');
    const result = await classifyMindCaptureInbox({
        mindRoot,
        selectorUrl: 'http://selector.invalid',
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
test('classifier disables apply until approval integration is proven', async (t) => {
    const mindRoot = createMindFixture();
    t.after(() => fs.rmSync(mindRoot, { recursive: true, force: true }));
    installFixtureModel(t);
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
