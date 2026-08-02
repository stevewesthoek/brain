import fs from 'node:fs';
import path from 'node:path';
const TASK_TYPE = 'mind_capture_classification';
const DEFAULT_SELECTOR_URL = 'http://127.0.0.1:4890';
export async function classifyMindCaptureInbox(input) {
    const mode = resolveMindCaptureExecutionMode(input);
    if (mode === 'apply') {
        throw new Error('apply_disabled_pending_approval_integration');
    }
    const mindRoot = path.resolve(input.mindRoot);
    const selectorUrl = input.selectorUrl ?? process.env.AI_SELECTOR_URL ?? DEFAULT_SELECTOR_URL;
    const inboxDir = path.join(mindRoot, 'inbox/new');
    const files = listCaptureFiles(inboxDir).slice(0, input.limit ?? Number.POSITIVE_INFINITY);
    const results = [];
    let classified = 0;
    let skipped = 0;
    let failed = 0;
    for (const file of files) {
        const relativePath = path.relative(mindRoot, file);
        try {
            const content = fs.readFileSync(file, 'utf8');
            const parsed = parseMarkdown(content);
            if (parsed.frontmatter.mind_steward_classified === 'true') {
                skipped += 1;
                results.push({ file: relativePath, status: 'skipped', reason: 'already classified' });
                continue;
            }
            const route = await selectLocalModel(selectorUrl, estimateTokens(content));
            const classification = await classifyWithLocalModel(route, content, parsed);
            classified += 1;
            results.push({ file: relativePath, status: 'classified', classification });
        }
        catch (error) {
            failed += 1;
            results.push({
                file: relativePath,
                status: 'failed',
                reason: error instanceof Error ? error.message : String(error),
            });
        }
    }
    return {
        ok: failed === 0,
        mindRoot,
        selectorUrl,
        mode,
        writesToMind: false,
        executableActions: false,
        processed: files.length,
        classified,
        skipped,
        failed,
        results,
    };
}
export function resolveMindCaptureExecutionMode(input) {
    const mode = input.mode ?? 'dry-run';
    if (mode !== 'dry-run' && mode !== 'apply') {
        throw new Error("mode must be exactly 'dry-run' or 'apply'");
    }
    if (mode === 'apply' && input.dryRun === true) {
        throw new Error('conflicting execution mode arguments');
    }
    return mode;
}
export function discoverMindFailedCaptures(mindRoot, limit) {
    const failedDir = path.join(path.resolve(mindRoot), 'inbox/failed');
    if (!fs.existsSync(failedDir))
        return [];
    return fs.readdirSync(failedDir)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort()
        .map((name) => path.join('inbox', 'failed', name))
        .slice(0, limit ?? Number.POSITIVE_INFINITY);
}
function listCaptureFiles(inboxDir) {
    if (!fs.existsSync(inboxDir))
        return [];
    const directoryStat = fs.lstatSync(inboxDir);
    if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) {
        throw new Error(`unsafe_capture_path: ${inboxDir}`);
    }
    return fs
        .readdirSync(inboxDir)
        .filter((name) => name.endsWith('.md') && name !== 'README.md')
        .sort()
        .map((name) => {
        const file = path.join(inboxDir, name);
        const fileStat = fs.lstatSync(file);
        if (!fileStat.isFile() || fileStat.isSymbolicLink()) {
            throw new Error(`unsafe_capture_symlink: ${file}`);
        }
        return file;
    });
}
async function selectLocalModel(selectorUrl, inputTokenCount) {
    const response = await fetch(`${selectorUrl.replace(/\/$/, '')}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            task_type: TASK_TYPE,
            input_token_count: inputTokenCount,
            urgent: true,
            local_only: true,
        }),
    });
    const body = await response.json();
    if (!response.ok) {
        throw new Error(`selector failed: ${response.status} ${body.error ?? JSON.stringify(body)}`);
    }
    if (body.deferred) {
        throw new Error('selector deferred local classification');
    }
    if (!body.provider_id || !body.model || !body.base_url) {
        throw new Error(`selector did not return a local OpenAI-compatible route: ${JSON.stringify(body)}`);
    }
    return {
        provider_id: body.provider_id,
        model: body.model,
        base_url: body.base_url,
        timeout_inference_sec: body.timeout_inference_sec ?? 180,
    };
}
async function classifyWithLocalModel(route, content, parsed) {
    const response = await fetch(`${route.base_url.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(route.timeout_inference_sec * 1000),
        body: JSON.stringify({
            model: route.model,
            temperature: 0.1,
            messages: [
                {
                    role: 'user',
                    content: buildClassificationPrompt(content, parsed),
                },
            ],
        }),
    });
    const body = await response.json();
    if (!response.ok) {
        throw new Error(`local model failed: ${response.status} ${JSON.stringify(body.error ?? body)}`);
    }
    const message = body.choices?.[0]?.message?.content;
    if (!message) {
        throw new Error('local model returned no message content');
    }
    return normalizeClassification(parseJsonObject(message));
}
function buildClassificationPrompt(content, parsed) {
    const title = parsed.frontmatter.title || firstHeading(parsed.body) || 'Untitled capture';
    return `Classify this Mind capture. Return only one JSON object. Do not use markdown.

Required JSON schema:
{
  "title": "short useful title",
  "para_type": "project|area|resource|task|decision|research|inbox",
  "confidence": 0.0,
  "signal_quality": 0.0,
  "summary": "two sentence summary",
  "key_points": ["point 1", "point 2", "point 3"],
  "tags": ["tag-one", "tag-two"]
}

Routing rules:
- project: outcome with multiple steps
- task: one concrete action
- decision: committed choice or policy
- area: ongoing responsibility
- research: source-heavy or exploratory investigation
- resource: reusable reference
- inbox: unclear, low-signal, or needs human review

Existing title: ${title}

Capture:
${content.slice(0, 30000)}`;
}
function parseMarkdown(content) {
    if (!content.startsWith('---\n')) {
        return { frontmatter: {}, body: content, hasFrontmatter: false };
    }
    const closeIndex = content.indexOf('\n---', 4);
    if (closeIndex === -1) {
        return { frontmatter: {}, body: content, hasFrontmatter: false };
    }
    const rawFrontmatter = content.slice(4, closeIndex);
    const body = content.slice(closeIndex + 4).replace(/^\n/, '');
    return {
        frontmatter: parseSimpleYaml(rawFrontmatter),
        body,
        hasFrontmatter: true,
    };
}
function parseSimpleYaml(raw) {
    const data = {};
    for (const line of raw.split('\n')) {
        const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (!match?.[1])
            continue;
        data[match[1]] = stripYamlString(match[2] ?? '');
    }
    return data;
}
function stripYamlString(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"'))
        || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}
function renderClassifiedMarkdown(originalContent, parsed, classification, route) {
    const source = parsed.frontmatter.source || 'save-to-mind';
    const created = parsed.frontmatter.created || new Date().toISOString();
    const frontmatter = {
        ...parsed.frontmatter,
        type: 'capture',
        source,
        para_type: classification.para_type,
        confidence: classification.confidence.toFixed(2),
        signal_quality: classification.signal_quality.toFixed(2),
        title: classification.title,
        tags: JSON.stringify(classification.tags),
        created,
        mind_steward_classified: 'true',
        mind_steward_classified_at: new Date().toISOString(),
        mind_steward_provider: route.provider_id,
        mind_steward_model: route.model,
    };
    const body = parsed.hasFrontmatter ? parsed.body : originalContent;
    return `---\n${renderYaml(frontmatter)}---\n\n${upsertClassificationSection(body, classification)}`;
}
function renderYaml(frontmatter) {
    const preferredOrder = [
        'type',
        'source',
        'para_type',
        'confidence',
        'signal_quality',
        'title',
        'tags',
        'created',
        'mind_steward_classified',
        'mind_steward_classified_at',
        'mind_steward_provider',
        'mind_steward_model',
    ];
    const keys = [
        ...preferredOrder.filter((key) => key in frontmatter),
        ...Object.keys(frontmatter).filter((key) => !preferredOrder.includes(key)).sort(),
    ];
    return keys.map((key) => `${key}: ${formatYamlValue(frontmatter[key] ?? '')}`).join('\n') + '\n';
}
function formatYamlValue(value) {
    if (value === 'true' || value === 'false' || /^-?\d+(\.\d+)?$/.test(value) || value.startsWith('[')) {
        return value;
    }
    return JSON.stringify(value);
}
function upsertClassificationSection(body, classification) {
    const marker = '<!-- mind-steward-classification -->';
    const section = [
        marker,
        '## Mind Steward Classification',
        '',
        `Summary: ${classification.summary}`,
        '',
        ...classification.key_points.map((point) => `- ${point}`),
        '',
    ].join('\n');
    const markerIndex = body.indexOf(marker);
    if (markerIndex !== -1) {
        return `${body.slice(0, markerIndex).trimEnd()}\n\n${section}`;
    }
    return `${body.trimEnd()}\n\n${section}`;
}
function parseJsonObject(raw) {
    const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
        throw new Error(`local model did not return JSON: ${trimmed.slice(0, 200)}`);
    }
    return JSON.parse(trimmed.slice(start, end + 1));
}
function normalizeClassification(value) {
    if (!isRecord(value)) {
        throw new Error('classification is not an object');
    }
    const paraType = normalizeParaType(String(value.para_type ?? 'inbox'));
    return {
        title: cleanSingleLine(String(value.title ?? 'Untitled capture')).slice(0, 120),
        para_type: paraType,
        confidence: clampNumber(value.confidence, 0, 1),
        signal_quality: clampNumber(value.signal_quality, 0, 1),
        summary: cleanText(String(value.summary ?? '')).slice(0, 600),
        key_points: normalizeStringArray(value.key_points).slice(0, 6),
        tags: normalizeStringArray(value.tags).map(slugTag).filter(Boolean).slice(0, 8),
    };
}
function normalizeParaType(value) {
    const normalized = value.toLowerCase().trim();
    if (normalized === 'project'
        || normalized === 'area'
        || normalized === 'resource'
        || normalized === 'task'
        || normalized === 'decision'
        || normalized === 'research'
        || normalized === 'inbox') {
        return normalized;
    }
    return 'inbox';
}
function normalizeStringArray(value) {
    if (!Array.isArray(value))
        return [];
    return value.map((item) => cleanSingleLine(String(item))).filter(Boolean);
}
function clampNumber(value, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number))
        return min;
    return Math.min(max, Math.max(min, number));
}
function cleanText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function cleanSingleLine(value) {
    return cleanText(value).replace(/[\r\n]/g, ' ');
}
function slugTag(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function firstHeading(body) {
    return body.split('\n').find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim();
}
function estimateTokens(content) {
    return Math.ceil(content.length / 4);
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
