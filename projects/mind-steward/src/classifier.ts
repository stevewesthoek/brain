import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const TASK_TYPE = 'mind_capture_classification';
const DEFAULT_SELECTOR_URL = 'http://127.0.0.1:4890';
const APPROVED_BEDROCK_PROVIDER = 'claude-bedrock';
const APPROVED_BEDROCK_MODEL = 'us.anthropic.claude-sonnet-4-6';
const DEFAULT_BEDROCK_REGION = 'us-east-1';

export type MindCaptureParaType =
  | 'project'
  | 'area'
  | 'resource'
  | 'task'
  | 'decision'
  | 'research'
  | 'inbox';

export type MindCaptureClassification = {
  title: string;
  para_type: MindCaptureParaType;
  confidence: number;
  signal_quality: number;
  summary: string;
  key_points: string[];
  tags: string[];
};

export type MindCaptureClassificationResult = {
  file: string;
  status: 'classified' | 'skipped' | 'failed';
  reason?: string;
  classification?: MindCaptureClassification;
};

export type MindCaptureExecutionMode = 'dry-run' | 'apply';

export type MindCaptureClassificationRun = {
  ok: boolean;
  mindRoot: string;
  selectorUrl: string;
  mode: MindCaptureExecutionMode;
  writesToMind: false;
  executableActions: false;
  processed: number;
  classified: number;
  skipped: number;
  failed: number;
  results: MindCaptureClassificationResult[];
};

type SelectorResponse = {
  provider_id?: string;
  model?: string;
  base_url?: string;
  timeout_inference_sec?: number;
  error?: string;
  deferred?: boolean;
};

export type MindBedrockRoute = {
  provider_id: typeof APPROVED_BEDROCK_PROVIDER;
  model: typeof APPROVED_BEDROCK_MODEL;
  timeout_inference_sec: number;
  region: string;
};

type BedrockConverseResponse = {
  output?: {
    message?: {
      content?: Array<{
        text?: string;
      }>;
    };
  };
};

export type MindBedrockExecFile = (
  file: string,
  args: string[],
  options: {
    encoding: 'utf8';
    timeout: number;
    maxBuffer: number;
    windowsHide: boolean;
  },
  callback: (error: Error | null, stdout: string, stderr: string) => void,
) => void;

type ParsedMarkdown = {
  frontmatter: Record<string, string>;
  body: string;
  hasFrontmatter: boolean;
};

export async function classifyMindCaptureInbox(input: {
  mindRoot: string;
  selectorUrl?: string;
  limit?: number;
  mode?: MindCaptureExecutionMode;
  dryRun?: boolean;
  bedrockConverse?: (route: MindBedrockRoute, prompt: string) => Promise<string>;
}): Promise<MindCaptureClassificationRun> {
  const mode = resolveMindCaptureExecutionMode(input);
  if (mode === 'apply') {
    throw new Error('apply_disabled_pending_approval_integration');
  }
  const mindRoot = path.resolve(input.mindRoot);
  const selectorUrl = input.selectorUrl ?? process.env.AI_SELECTOR_URL ?? DEFAULT_SELECTOR_URL;
  const inboxDir = path.join(mindRoot, 'inbox/new');
  const files = listCaptureFiles(inboxDir).slice(0, input.limit ?? Number.POSITIVE_INFINITY);
  const results: MindCaptureClassificationResult[] = [];

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

      const route = await selectMindBedrockModel(selectorUrl, estimateTokens(content));
      const classification = await classifyWithBedrock(
        route,
        content,
        parsed,
        input.bedrockConverse ?? converseWithBedrockAws,
      );
      classified += 1;
      results.push({ file: relativePath, status: 'classified', classification });
    } catch (error) {
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

export function resolveMindCaptureExecutionMode(input: {
  mode?: string;
  dryRun?: boolean;
}): MindCaptureExecutionMode {
  const mode = input.mode ?? 'dry-run';
  if (mode !== 'dry-run' && mode !== 'apply') {
    throw new Error("mode must be exactly 'dry-run' or 'apply'");
  }
  if (mode === 'apply' && input.dryRun === true) {
    throw new Error('conflicting execution mode arguments');
  }
  return mode;
}

export function discoverMindFailedCaptures(mindRoot: string, limit?: number): string[] {
  const failedDir = path.join(path.resolve(mindRoot), 'inbox/failed');
  if (!fs.existsSync(failedDir)) return [];
  return fs.readdirSync(failedDir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort()
    .map((name) => path.join('inbox', 'failed', name))
    .slice(0, limit ?? Number.POSITIVE_INFINITY);
}

function listCaptureFiles(inboxDir: string): string[] {
  if (!fs.existsSync(inboxDir)) return [];
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

async function selectMindBedrockModel(selectorUrl: string, inputTokenCount: number): Promise<MindBedrockRoute> {
  const response = await fetch(`${selectorUrl.replace(/\/$/, '')}/select`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_type: TASK_TYPE,
      input_token_count: inputTokenCount,
      urgent: true,
      task_metadata: {
        sensitive: true,
        private: true,
        allowed_providers: [APPROVED_BEDROCK_PROVIDER],
        allowed_models: [APPROVED_BEDROCK_MODEL],
        preferred_providers: [APPROVED_BEDROCK_PROVIDER],
        preferred_models: [APPROVED_BEDROCK_MODEL],
        fallback_policy: 'none',
      },
    }),
  });

  const body = await response.json() as SelectorResponse;
  if (!response.ok) {
    throw new Error(`selector failed: ${response.status} ${body.error ?? JSON.stringify(body)}`);
  }
  if (body.deferred) {
    throw new Error('selector deferred private Mind classification');
  }
  if (body.provider_id !== APPROVED_BEDROCK_PROVIDER) {
    throw new Error(`selector returned disallowed provider for private Mind classification: ${body.provider_id ?? 'missing'}`);
  }
  if (body.model !== APPROVED_BEDROCK_MODEL) {
    throw new Error(`selector returned disallowed model for private Mind classification: ${body.model ?? 'missing'}`);
  }

  return {
    provider_id: APPROVED_BEDROCK_PROVIDER,
    model: APPROVED_BEDROCK_MODEL,
    timeout_inference_sec: body.timeout_inference_sec ?? 180,
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? DEFAULT_BEDROCK_REGION,
  };
}

async function classifyWithBedrock(
  route: MindBedrockRoute,
  content: string,
  parsed: ParsedMarkdown,
  converse: (route: MindBedrockRoute, prompt: string) => Promise<string>,
): Promise<MindCaptureClassification> {
  const message = await converse(route, buildClassificationPrompt(content, parsed));
  if (!message.trim()) {
    throw new Error('Bedrock returned no message content');
  }
  return normalizeClassification(parseJsonObject(message));
}

const execBedrockAws: MindBedrockExecFile = (file, args, options, callback) => {
  execFile(file, args, options, callback);
};

export async function converseWithBedrockAws(
  route: MindBedrockRoute,
  prompt: string,
  runExecFile: MindBedrockExecFile = execBedrockAws,
): Promise<string> {
  const requestDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mind-steward-bedrock-'));
  const requestFile = path.join(requestDir, 'converse-request.json');

  try {
    fs.writeFileSync(requestFile, `${JSON.stringify({
      modelId: route.model,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 1200, temperature: 0.1 },
    })}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.chmodSync(requestFile, 0o600);

    const args = [
      'bedrock-runtime',
      'converse',
      '--region', route.region,
      '--cli-input-json', pathToFileURL(requestFile).href,
      '--output', 'json',
    ];

    const stdout = await new Promise<string>((resolve, reject) => {
      runExecFile(
        'aws',
        args,
        {
          encoding: 'utf8',
          timeout: route.timeout_inference_sec * 1000,
          maxBuffer: 2 * 1024 * 1024,
          windowsHide: true,
        },
        (error, out, stderr) => {
          if (error) {
            const detail = String(stderr || out || error.message).trim().slice(0, 2000);
            reject(new Error(`Bedrock Converse failed: ${detail || error.message}`));
            return;
          }
          resolve(out);
        },
      );
    });

    let body: BedrockConverseResponse;
    try {
      body = JSON.parse(stdout) as BedrockConverseResponse;
    } catch {
      throw new Error('Bedrock Converse returned invalid JSON');
    }
    const text = body.output?.message?.content?.find((item) => typeof item.text === 'string')?.text;
    if (!text) {
      throw new Error('Bedrock Converse returned no text content');
    }
    return text;
  } finally {
    try {
      fs.rmSync(requestFile, { force: true });
    } finally {
      fs.rmSync(requestDir, { recursive: true, force: true });
    }
  }
}

function buildClassificationPrompt(content: string, parsed: ParsedMarkdown): string {
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

function parseMarkdown(content: string): ParsedMarkdown {
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

function parseSimpleYaml(raw: string): Record<string, string> {
  const data: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match?.[1]) continue;
    data[match[1]] = stripYamlString(match[2] ?? '');
  }
  return data;
}

function stripYamlString(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function renderClassifiedMarkdown(
  originalContent: string,
  parsed: ParsedMarkdown,
  classification: MindCaptureClassification,
  route: { provider_id: string; model: string },
): string {
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

function renderYaml(frontmatter: Record<string, string>): string {
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

function formatYamlValue(value: string): string {
  if (value === 'true' || value === 'false' || /^-?\d+(\.\d+)?$/.test(value) || value.startsWith('[')) {
    return value;
  }
  return JSON.stringify(value);
}

function upsertClassificationSection(body: string, classification: MindCaptureClassification): string {
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

function parseJsonObject(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`local model did not return JSON: ${trimmed.slice(0, 200)}`);
  }
  return JSON.parse(trimmed.slice(start, end + 1));
}

function normalizeClassification(value: unknown): MindCaptureClassification {
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

function normalizeParaType(value: string): MindCaptureParaType {
  const normalized = value.toLowerCase().trim();
  if (
    normalized === 'project'
    || normalized === 'area'
    || normalized === 'resource'
    || normalized === 'task'
    || normalized === 'decision'
    || normalized === 'research'
    || normalized === 'inbox'
  ) {
    return normalized;
  }
  return 'inbox';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanSingleLine(String(item))).filter(Boolean);
}

function clampNumber(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanSingleLine(value: string): string {
  return cleanText(value).replace(/[\r\n]/g, ' ');
}

function slugTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function firstHeading(body: string): string | undefined {
  return body.split('\n').find((line) => line.startsWith('# '))?.replace(/^#\s+/, '').trim();
}

function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
