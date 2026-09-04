import type { z } from 'zod';
import { freshnessSchema } from '@/lib/braincore-schemas';

type Freshness = z.infer<typeof freshnessSchema>;

export function formatOperationalAge(updatedAt: string | null | undefined, now = Date.now()): string {
  if (!updatedAt) return 'Unknown age';
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp)) return 'Unknown age';
  const seconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (seconds < 10) return 'Updated just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
export function FreshnessLabel({ freshness, updatedAt, detail }: { freshness: Freshness; updatedAt?: string | null; detail?: string }) {
  const age = formatOperationalAge(updatedAt);
  const label = freshness === 'fresh' ? age : freshness === 'stale' ? `Stale, ${age}` : freshness === 'unknown' ? 'Unknown freshness' : freshness === 'unavailable' ? 'Unavailable' : 'Not instrumented';
  return <span role="status" aria-label={detail ? `${label}: ${detail}` : label} suppressHydrationWarning>{label}</span>;
}
