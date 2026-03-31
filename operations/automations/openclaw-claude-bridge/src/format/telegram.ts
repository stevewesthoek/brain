import { config } from '../config';

// Plain text only — no HTML, no parse_mode dependency.
// OpenClaw can send this as-is without any special configuration.

export function esc(text: string): string {
  return text; // Plain text — no escaping needed
}

export function truncate(text: string): string {
  const max = config.session.outputTruncateChars;
  if (text.length <= max) return text;
  return text.slice(0, max) + '\n…[truncated]';
}

function cleanResponse(output: string): string {
  return truncate(output.trim() || '(no response)');
}

// Minimal "thinking" indicator — just a job ID suffix so user can reference it
export function formatPromptAccepted(_sessionId: string, jobId: string, _repo: string | null): string {
  return `⏳ thinking… [${jobId.slice(0, 8)}]`;
}

// The main response — just Claude's answer, no metadata
export function formatResult(
  _sessionId: string,
  output: string,
  timedOut: boolean,
  _repo?: string | null
): string {
  const body = cleanResponse(output);
  return timedOut ? `${body}\n\n⏱ (partial — timed out)` : body;
}

// Confirmation prompt — clear text with instructions
export function formatConfirmationRequest(
  _sessionId: string,
  question: string,
  _jobId: string
): string {
  return `🔔 Claude needs confirmation:\n\n${question.trim()}\n\nTap Approve or Deny below.`;
}

export function formatError(_action: string, error: string): string {
  return `❌ Error: ${error}`;
}

export function formatSessionList(sessions: string[]): string {
  if (sessions.length === 0) return 'No active sessions.';
  return sessions.map(s => `• ${s}`).join('\n');
}

export function formatRepoStatus(repo: string, branch: string, status: string, lastCommit: string): string {
  const name = repo.split('/').pop() || repo;
  return [`📁 ${name}  [${branch}]`, lastCommit, '', status === '(clean)' ? 'Working tree clean' : status].join('\n');
}

// Button metadata for OpenClaw → Telegram inline keyboards
export function confirmationButtons(
  jobId: string
): Array<Array<{ text: string; callback_data: string }>> {
  return [[
    { text: '✅ Approve', callback_data: `confirm_approve_${jobId}` },
    { text: '❌ Deny',    callback_data: `confirm_deny_${jobId}` },
  ]];
}

export function skillMenuButtons(
  skills: Array<{ name: string; command: string }>
): Array<Array<{ text: string; callback_data: string }>> {
  const rows: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < skills.length; i += 2) {
    const row = [{ text: `/${skills[i].name}`, callback_data: `skill_${skills[i].name}` }];
    if (skills[i + 1]) row.push({ text: `/${skills[i + 1].name}`, callback_data: `skill_${skills[i + 1].name}` });
    rows.push(row);
  }
  return rows;
}
