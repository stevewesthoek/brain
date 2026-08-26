import { cn } from '@/lib/utils';

const positive = new Set(['fresh', 'available', 'ok', 'running', 'healthy', 'success', 'enabled', 'published', 'generated']);
const warning = new Set(['stale', 'partial', 'unknown', 'starting', 'planned', 'awaiting_approval', 'draft', 'generating']);
const negative = new Set(['error', 'failed', 'critical', 'unavailable', 'not_instrumented', 'stopped', 'blocked', 'disabled']);

export function statusClass(status: string | null | undefined): string {
  const normalized = String(status ?? 'unknown').toLowerCase();
  if (positive.has(normalized)) return 'success';
  if (negative.has(normalized)) return 'error';
  if (warning.has(normalized)) return 'warning';
  return '';
}

export function StatusBadge({ status, label }: { status?: string | null; label?: string }) {
  const value = status ?? 'unknown';
  return <span className={cn('badge', statusClass(value))}>{label ?? value.replaceAll('_', ' ')}</span>;
}
