export type TerminalMarkdownOptions = {
  width?: number;
  maxLines?: number;
  color?: boolean;
};

function stripControl(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
}

function fit(value: string, width: number): string {
  const visible = value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '');
  if (visible.length <= width) return value;
  if (width <= 1) return value.slice(0, width);
  // Do not cut an ANSI escape sequence in half. A long formatted line loses
  // styling at the boundary, but remains safe and width-bounded in scrollback.
  return `${visible.slice(0, width - 1)}…`;
}

function inline(value: string, color: boolean): string {
  return stripControl(value)
    .replace(/\*\*([^*\n]+)\*\*/gu, color ? '\u001b[1m$1\u001b[22m' : '$1')
    .replace(/`([^`\n]+)`/gu, color ? '\u001b[36m$1\u001b[39m' : '$1');
}

/** Small terminal-native Markdown renderer for bounded Jarvis result text. */
export function renderTerminalMarkdown(value: string, options: TerminalMarkdownOptions = {}): string[] {
  const width = Math.max(20, Math.min(Math.floor(options.width ?? 120), 180));
  const maxLines = Math.max(1, Math.min(Math.floor(options.maxLines ?? 128), 256));
  const color = options.color ?? false;
  const lines: string[] = [];
  let inFence = false;
  for (const raw of stripControl(value).split(/\r?\n/u)) {
    if (lines.length >= maxLines) break;
    const line = raw.trimEnd();
    if (/^\s*```/u.test(line)) {
      inFence = !inFence;
      lines.push('');
      continue;
    }
    if (inFence) {
      lines.push(fit(`  ${line}`, width));
      continue;
    }
    if (/^\s*---+\s*$/u.test(line) || /^\s*\*\*\*+\s*$/u.test(line)) {
      lines.push('─'.repeat(Math.min(width, 48)));
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      lines.push(color ? `\u001b[1m${fit(heading[2] ?? '', width)}\u001b[22m` : fit(heading[2] ?? '', width));
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.+)$/u.exec(line);
    if (bullet) {
      lines.push(fit(`• ${inline(bullet[1] ?? '', color)}`, width));
      continue;
    }
    const numbered = /^\s*(\d+)[.)]\s+(.+)$/u.exec(line);
    if (numbered) {
      lines.push(fit(`${numbered[1] ?? ''}. ${inline(numbered[2] ?? '', color)}`, width));
      continue;
    }
    lines.push(line.trim().length === 0 ? '' : fit(inline(line, color), width));
  }
  while (lines.at(-1) === '') lines.pop();
  return lines.slice(0, maxLines);
}
