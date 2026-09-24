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

function wrap(value: string, width: number): string[] {
  const words = value.trim().split(/\s+/u).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    let remaining = Array.from(word);
    if (line && Array.from(line).length + 1 > width) {
      lines.push(line);
      line = '';
    }
    while (remaining.length > width) {
      if (line) {
        lines.push(line);
        line = '';
      }
      lines.push(remaining.slice(0, width).join(''));
      remaining = remaining.slice(width);
    }
    if (remaining.length === 0) continue;
    const text = remaining.join('');
    const lineLength = Array.from(line).length;
    if (!line) line = text;
    else if (lineLength + 1 + remaining.length <= width) line += ` ${text}`;
    else {
      lines.push(line);
      line = text;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function wrapInline(value: string, width: number, color: boolean): string[] {
  type Tone = 'bold' | 'code' | null;
  type Part = { text: string; tone: Tone };
  const spans: Array<{ text: string; tone: Tone }> = [];
  const pattern = /\*\*([^*\n]+)\*\*|`([^`\n]+)`/gu;
  let offset = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) spans.push({ text: value.slice(offset, index), tone: null });
    spans.push({ text: match[1] ?? match[2] ?? '', tone: match[1] !== undefined ? 'bold' : 'code' });
    offset = index + match[0].length;
  }
  if (offset < value.length) spans.push({ text: value.slice(offset), tone: null });

  const rows: Part[][] = [];
  let row: Part[] = [];
  let rowWidth = 0;
  const append = (text: string, tone: Tone): void => {
    if (!text) return;
    const previous = row.at(-1);
    if (previous?.tone === tone) previous.text += text;
    else row.push({ text, tone });
    rowWidth += Array.from(text).length;
  };
  const finishRow = (): void => {
    if (row.length > 0) rows.push(row);
    row = [];
    rowWidth = 0;
  };

  for (const span of spans) {
    let previousEnd = 0;
    for (const match of span.text.matchAll(/\S+/gu)) {
      const index = match.index ?? 0;
      const word = match[0];
      const wordChars = Array.from(word);
      const hasSpace = index > previousEnd;
      previousEnd = index + word.length;
      if (hasSpace && rowWidth > 0 && rowWidth + 1 + wordChars.length > width) finishRow();
      else if (hasSpace && rowWidth > 0) append(' ', null);

      if (wordChars.length > width && rowWidth > 0) finishRow();
      while (wordChars.length > width) {
        append(wordChars.splice(0, width).join(''), span.tone);
        finishRow();
      }
      if (wordChars.length > 0) {
        if (rowWidth + wordChars.length > width && rowWidth > 0) finishRow();
        append(wordChars.join(''), span.tone);
      }
    }
  }
  finishRow();
  return rows.map((parts) => parts.map(({ text, tone }) => {
    if (!color || !tone) return text;
    return tone === 'bold' ? `\u001b[1m${text}\u001b[22m` : `\u001b[36m${text}\u001b[39m`;
  }).join(''));
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
      lines.push(...wrap(line, Math.max(1, width - 2)).map((value) => `  ${value}`));
      continue;
    }
    if (/^\s*---+\s*$/u.test(line) || /^\s*\*\*\*+\s*$/u.test(line)) {
      lines.push('─'.repeat(Math.min(width, 48)));
      continue;
    }
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line);
    if (heading) {
      const wrapped = wrapInline(heading[2] ?? '', width, color);
      lines.push(...(color ? wrapped.map((value) => `\u001b[1m${value}\u001b[22m`) : wrapped));
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.+)$/u.exec(line);
    if (bullet) {
      const wrapped = wrapInline(bullet[1] ?? '', Math.max(1, width - 2), color);
      lines.push(...wrapped.map((value, index) => `${index === 0 ? '• ' : '  '}${value}`));
      continue;
    }
    const numbered = /^\s*(\d+)[.)]\s+(.+)$/u.exec(line);
    if (numbered) {
      const prefix = `${numbered[1] ?? ''}. `;
      const wrapped = wrapInline(numbered[2] ?? '', Math.max(1, width - prefix.length), color);
      lines.push(...wrapped.map((value, index) => `${index === 0 ? prefix : ' '.repeat(prefix.length)}${value}`));
      continue;
    }
    lines.push(...(line.trim().length === 0 ? [''] : wrapInline(line, width, color)));
  }
  while (lines.at(-1) === '') lines.pop();
  return lines.slice(0, maxLines);
}
