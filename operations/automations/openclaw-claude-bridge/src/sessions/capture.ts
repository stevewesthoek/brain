import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { config } from '../config';
import { detectConfirmation } from './detector';

const exec = promisify(execCb);

// ── Terminal cleaning ─────────────────────────────────────────────────────────

function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\[[0-9;]*[mGKHFJABCDEFsuhl]/g, '')
    .replace(/\x1B\[[?][0-9]*[hl]/g, '')
    .replace(/\x1B\([AB]/g, '')
    .replace(/\x1B=/g, '')
    .replace(/\r/g, '');
}

function stripClaudeChrome(text: string): string {
  return text
    // Box-drawing separator lines
    .replace(/^[\u2500-\u257F\u2580-\u259F─━═╌╍┄┅┈┉▀▄█]{3,}.*$/gm, '')
    // Claude Code UI header lines
    .replace(/^Accessing workspace:.*$/gm, '')
    .replace(/^Quick safety check:.*$/gm, '')
    .replace(/^Claude Code.ll be able to.*$/gm, '')
    .replace(/^Claude Code will be able to.*$/gm, '')
    .replace(/^❯?\s*\d+\.\s+(Yes|No)[,.].*$/gm, '')
    .replace(/^Enter to confirm.*$/gm, '')
    .replace(/^Esc to cancel.*$/gm, '')
    .replace(/^Working in:.*$/gm, '')
    .replace(/^claude-code.*$/gim, '')
    // Trailing > prompt indicator
    .replace(/\n?\s*[>❯]\s*$/m, '')
    // Collapse 3+ blank lines to 2
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Extract only the response — content after the prompt echo, before the next > cursor
function extractResponse(delta: string, prompt: string): string {
  const cleaned = stripClaudeChrome(delta);

  // Try to find where the prompt was echoed and take what comes after
  const promptIdx = cleaned.indexOf(prompt.slice(0, 40));
  if (promptIdx !== -1) {
    const after = cleaned.slice(promptIdx + prompt.length).trim();
    if (after.length > 10) return after;
  }

  return cleaned;
}

// ── tmux wrappers ─────────────────────────────────────────────────────────────

export async function sendKeys(sessionId: string, text: string): Promise<void> {
  await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} ${JSON.stringify(text)} Enter`);
}

export async function capturePane(sessionId: string): Promise<string> {
  try {
    const { stdout } = await exec(
      `tmux capture-pane -t ${JSON.stringify(sessionId)} -p 2>/dev/null`
    );
    return stripAnsi(stdout);
  } catch {
    return '';
  }
}

// ── Polling ───────────────────────────────────────────────────────────────────

export interface PollResult {
  output: string;
  stable: boolean;
  timedOut: boolean;
  confirmationDetected: boolean;
  confirmationText?: string;
}

export async function pollForOutput(
  sessionId: string,
  baselineSnapshot: string,
  sentPrompt?: string
): Promise<PollResult> {
  const {
    pollIntervalMs,
    pollMaxAttempts,
    stabilityRequiredPolls,
    outputTruncateChars,
  } = config.session;

  let lastSnapshot = baselineSnapshot;
  let stableCount = 0;

  for (let attempt = 0; attempt < pollMaxAttempts; attempt++) {
    await new Promise(r => setTimeout(r, pollIntervalMs));

    const snapshot = await capturePane(sessionId);

    // Auto-accept Claude Code's trust prompt — never surface this to the user
    if (/Yes, I trust this folder/i.test(snapshot) || /trust this folder/i.test(snapshot)) {
      await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} "1" ""`);
      await new Promise(r => setTimeout(r, 300));
      await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} "" Enter`);
      await new Promise(r => setTimeout(r, 2500));
      lastSnapshot = await capturePane(sessionId);
      continue;
    }

    // Confirmation check (real Claude action prompts — surface these with buttons)
    const confirmation = detectConfirmation(snapshot);
    if (confirmation) {
      const delta = extractDelta(baselineSnapshot, snapshot, outputTruncateChars);
      const response = sentPrompt ? extractResponse(delta, sentPrompt) : stripClaudeChrome(delta);
      return {
        output: response,
        stable: false,
        timedOut: false,
        confirmationDetected: true,
        confirmationText: confirmation,
      };
    }

    // Stability check
    if (snapshot === lastSnapshot) {
      stableCount++;
      if (stableCount >= stabilityRequiredPolls) {
        const delta = extractDelta(baselineSnapshot, snapshot, outputTruncateChars);
        const response = sentPrompt ? extractResponse(delta, sentPrompt) : stripClaudeChrome(delta);
        return { output: response, stable: true, timedOut: false, confirmationDetected: false };
      }
    } else {
      stableCount = 0;
      lastSnapshot = snapshot;
    }
  }

  const delta = extractDelta(baselineSnapshot, lastSnapshot, outputTruncateChars);
  const response = sentPrompt ? extractResponse(delta, sentPrompt) : stripClaudeChrome(delta);
  return { output: response, stable: false, timedOut: true, confirmationDetected: false };
}

function extractDelta(baseline: string, current: string, maxChars: number): string {
  const baseLines = baseline.split('\n');
  const curLines = current.split('\n');

  let commonLen = 0;
  const minLen = Math.min(baseLines.length, curLines.length);
  while (commonLen < minLen && baseLines[commonLen] === curLines[commonLen]) {
    commonLen++;
  }

  const newLines = curLines.slice(commonLen);
  const delta = newLines.join('\n').trim();

  if (!delta) return current.trim().slice(-maxChars);
  if (delta.length > maxChars) return '…[truncated]\n' + delta.slice(-maxChars);
  return delta;
}
