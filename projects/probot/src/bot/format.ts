export function formatList(items: string[]): string {
  return items.filter(Boolean).join("\n\n");
}

export function truncate(text: string, max = 3900): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}
