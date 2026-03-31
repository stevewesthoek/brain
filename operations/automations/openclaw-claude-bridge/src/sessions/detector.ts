// Patterns that indicate Claude Code (or a shell) is waiting for user input/confirmation

const SHELL_CONFIRMATION_PATTERNS: RegExp[] = [
  /\[y\/n\]/i,
  /\(y\/N\)/,
  /\(Y\/n\)/,
  /\[Y\/n\]/,
  /press enter to continue/i,
  /press enter/i,
  /are you sure/i,
  /do you want to/i,
  /do you wish to/i,
  /\bconfirm\?/i,
  /\bproceed\?/i,
  /\bcontinue\?/i,
  /\boverwrite\?/i,
  /\(yes\/no\)/i,
  /type ['"]yes['"] to confirm/i,
];

// Claude Code specific TUI confirmation patterns
const CLAUDE_CONFIRMATION_PATTERNS: RegExp[] = [
  /Allow this action\?/i,
  /Run this command\?/i,
  /Execute this\?/i,
  /Create this file\?/i,
  /Overwrite this file\?/i,
  /Apply these changes\?/i,
  /Trust this project\?/i,
  /\[1\]\s+Yes/i,
  /\[yes\]\s+\[no\]/i,
  /\(1\) Yes\s+\(2\) No/i,
];

/**
 * Returns the confirmation question text if the pane is waiting for confirmation,
 * or null if no confirmation is detected.
 */
export function detectConfirmation(paneContent: string): string | null {
  // Only inspect the last 20 lines — avoids false positives from scroll history
  const lines = paneContent.split('\n');
  const lastLines = lines.slice(-20).join('\n');

  for (const pattern of [...SHELL_CONFIRMATION_PATTERNS, ...CLAUDE_CONFIRMATION_PATTERNS]) {
    if (pattern.test(lastLines)) {
      // Return the last few non-empty lines as context
      const question = lines
        .slice(-8)
        .filter(l => l.trim())
        .join('\n');
      return question;
    }
  }
  return null;
}

/**
 * Returns true if the pane looks like Claude Code is ready for input.
 */
export function isClaudeReady(paneContent: string): boolean {
  const trimmed = paneContent.trimEnd();
  const lastLine = trimmed.split('\n').pop() || '';
  return /^\s*[>❯]\s*$/.test(lastLine) || lastLine.trimEnd().endsWith('>');
}
