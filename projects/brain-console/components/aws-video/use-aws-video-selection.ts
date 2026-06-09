'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const SELECTED_JOB_KEY = 'aws-video-selected-job-id';
const TIMEOUT_MONITOR_KEY = 'aws-video-timeout-monitor';

export interface AwsVideoSelection {
  selectedJobId: string | null;
  setSelectedJobId: (id: string | null) => void;
  resolvedJobId: string | null;
  isSelectionReady: boolean;
}

interface TimeoutMonitorSnapshot {
  pendingActionByJobId: Record<string, string>;
  createDraftTimedOut: boolean;
  currentCreateActionId: string | null;
  preTimeoutJobIds: string[];
  selectedJobId: string | null;
}

function readStorageSafe(key: string): string | null {
  try {
    return sessionStorage.getItem(key) || null;
  } catch {
    return null;
  }
}

function writeStorageSafe(key: string, value: string | null): void {
  try {
    if (value) {
      sessionStorage.setItem(key, value);
    } else {
      sessionStorage.removeItem(key);
    }
  } catch { /* quota or private-mode */ }
}

function readTimeoutMonitorSnapshot(): TimeoutMonitorSnapshot | null {
  try {
    const raw = sessionStorage.getItem(TIMEOUT_MONITOR_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimeoutMonitorSnapshot;
  } catch {
    return null;
  }
}

const DIAGNOSTIC_JOB_PATTERNS = [
  'test-clientactionid-dedup',
  'test-concurrent-in-flight-dedu',
  'test clientactionid dedup',
  'test concurrent in-flight dedup',
];

function isDiagnosticJob(job: { jobId: string; title?: string }): boolean {
  const id = job.jobId.toLowerCase();
  const title = ('title' in job && typeof (job as any).title === 'string') ? (job as any).title.toLowerCase() : '';
  return DIAGNOSTIC_JOB_PATTERNS.some(p => id.includes(p) || title.includes(p));
}

/**
 * Hydration-safe selected-job hook for the AWS Video dashboard.
 *
 * Contract:
 * - Server render and first client render both see selectedJobId = null, isSelectionReady = false.
 * - After mount (useEffect), sessionStorage is read and selection is restored.
 * - isSelectionReady flips to true after the first mount effect completes.
 * - jobList may provide an initial default ONLY after hydration AND if no persisted selection exists.
 * - /jobs/recent changes never clear or replace an existing selectedJobId.
 * - Explicit calls to setSelectedJobId persist immediately.
 * - Diagnostic/test jobs are never auto-selected as the default.
 */
export function useAwsVideoSelection(jobList: { jobId: string }[]): AwsVideoSelection {
  const [selectedJobId, setSelectedJobIdRaw] = useState<string | null>(null);
  const [isSelectionReady, setIsSelectionReady] = useState(false);
  const hasRestoredRef = useRef(false);

  const setSelectedJobId = useCallback((id: string | null) => {
    setSelectedJobIdRaw(id);
    writeStorageSafe(SELECTED_JOB_KEY, id);
  }, []);

  // Restore persisted selection after mount — never during render
  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;

    const persisted = readStorageSafe(SELECTED_JOB_KEY);
    if (persisted) {
      setSelectedJobIdRaw(persisted);
    } else {
      const monitor = readTimeoutMonitorSnapshot();
      if (monitor) {
        const hasActive = monitor.createDraftTimedOut || Object.keys(monitor.pendingActionByJobId).length > 0;
        if (hasActive && monitor.selectedJobId) {
          setSelectedJobIdRaw(monitor.selectedJobId);
        }
      }
    }
    setIsSelectionReady(true);
  }, []);

  // After hydration: if no persisted selection was found, pick first non-diagnostic job
  useEffect(() => {
    if (!isSelectionReady) return;
    if (selectedJobId) return;
    const firstNormal = jobList.find(j => !isDiagnosticJob(j));
    if (firstNormal) {
      setSelectedJobId(firstNormal.jobId);
    }
  }, [isSelectionReady, selectedJobId, jobList, setSelectedJobId]);

  // resolvedJobId: stable identity for queries.
  // Before hydration: null (no queries fire, UI shows loading).
  // After hydration: selectedJobId or first non-diagnostic job fallback.
  const firstNormalJob = jobList.find(j => !isDiagnosticJob(j));
  const resolvedJobId = isSelectionReady
    ? selectedJobId ?? firstNormalJob?.jobId ?? null
    : null;

  return { selectedJobId, setSelectedJobId, resolvedJobId, isSelectionReady };
}
