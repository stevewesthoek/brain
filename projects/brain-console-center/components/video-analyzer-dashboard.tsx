'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, RefreshCw, Sparkles } from 'lucide-react';
import { brainCoreRequest, postBrainCoreAction } from '@/lib/braincore-client';
import {
  videoAnalysisHistoryResponseSchema,
  videoAnalysisResponseSchema,
  type VideoAnalysisHistoryEntry,
} from '@/lib/braincore-schemas';
import { StatusBadge } from '@/components/status-badge';
import { timeAgo } from '@/lib/utils';

type VideoAnalysisSummary = {
  topic: string | null;
  speaker: string | null;
  keyClaims: string[];
  evidenceType: string | null;
  confidence: string | null;
  researchHooks: string[];
};

type VideoAnalyzerSelection = Omit<VideoAnalysisHistoryEntry, 'aiSummary'> & {
  aiSummary: VideoAnalysisSummary | null;
  source: 'live' | 'history';
};

function summarizeTranscript(text: string | null): string {
  if (!text) return 'No transcript returned.';
  const compact = text.replace(/\s+/g, ' ').trim();
  if (compact.length <= 180) return compact;
  return `${compact.slice(0, 177)}…`;
}

function formatLabel(value: string | null): string {
  if (!value) return 'unknown';
  return value;
}

function historyLabel(entry: VideoAnalysisHistoryEntry): string {
  return entry.title ?? entry.url;
}

function normalizeSummary(summary: any): VideoAnalysisSummary | null {
  if (!summary) return null;
  const record = summary as Record<string, unknown>;
  const rawClaims = Array.isArray(record.key_claims)
    ? record.key_claims
    : Array.isArray(record.keyClaims)
      ? record.keyClaims
      : [];
  const rawHooks = Array.isArray(record.research_hooks)
    ? record.research_hooks
    : Array.isArray(record.researchHooks)
      ? record.researchHooks
      : [];
  const evidenceType = typeof record.evidence_type === 'string'
    ? record.evidence_type
    : typeof record.evidenceType === 'string'
      ? record.evidenceType
      : null;
  return {
    topic: summary.topic?.trim() || null,
    speaker: summary.speaker?.trim() || null,
    keyClaims: rawClaims.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    evidenceType: evidenceType?.trim() || null,
    confidence: summary.confidence?.trim() || null,
    researchHooks: rawHooks.filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
  };
}

function normalizeHistoryEntry(entry: any): VideoAnalyzerSelection {
  return {
    ...entry,
    aiSummary: normalizeSummary(entry.aiSummary),
    source: 'history',
  };
}

function toSelection(
  url: string,
  focus: string,
  result: any,
  source: 'live' | 'history',
): VideoAnalyzerSelection {
  return {
    id: `live-${Date.now()}`,
    analyzedAt: new Date().toISOString(),
    url,
    focus: focus.trim().length > 0 ? focus.trim() : null,
    ok: result.ok,
    title: result.title?.trim() || null,
    channel: result.channel?.trim() || null,
    transcript: result.transcript?.trim() || null,
    humanSummary: result.human_summary?.trim() || null,
    aiSummary: normalizeSummary(result.ai_summary),
    mindPath: result.mind_path?.trim() || null,
    error: result.error?.trim() || null,
    step: result.step?.trim() || null,
    source,
  };
}

export function VideoAnalyzerDashboard() {
  const queryClient = useQueryClient();
  const [url, setUrl] = useState('');
  const [focus, setFocus] = useState('');
  const [selectedAnalysis, setSelectedAnalysis] = useState<VideoAnalyzerSelection | null>(null);
  const [copied, setCopied] = useState(false);

  const history = useQuery({
    queryKey: ['research-video-analysis-history'],
    queryFn: () => brainCoreRequest('/research/video-analyze/history?limit=12', videoAnalysisHistoryResponseSchema, { timeoutMs: 12_000 }),
    refetchInterval: 20_000,
  });

  const historyEntries = useMemo(() => (history.data?.entries ?? []).map(normalizeHistoryEntry), [history.data?.entries]);
  const historySelection = historyEntries[0] ?? null;
  const currentSelection = selectedAnalysis ?? historySelection;
  const transcript = currentSelection?.transcript ?? '';

  const analyze = useMutation({
    mutationFn: async (input: { url: string; focus: string }) => {
      return postBrainCoreAction(
        '/research/video-analyze',
        videoAnalysisResponseSchema,
        {
          url: input.url,
          ...(input.focus ? { focus: input.focus } : {}),
        },
        1_800_000,
      );
    },
    onSuccess: (result, variables) => {
      setSelectedAnalysis(toSelection(variables.url, variables.focus, result, 'live'));
      void queryClient.invalidateQueries({ queryKey: ['research-video-analysis-history'] });
    },
  });

  useEffect(() => {
    if (!selectedAnalysis && historyEntries.length > 0) {
      setSelectedAnalysis({
        ...historyEntries[0],
        source: 'history',
      });
    }
  }, [historyEntries, selectedAnalysis]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 1_500);
    return () => clearTimeout(timer);
  }, [copied]);

  const overallStatus = history.data?.status ?? (history.isError ? 'invalid' : 'empty');
  const overallTone = overallStatus === 'ok' ? 'fresh' : overallStatus === 'empty' ? 'warning' : 'error';
  const overallLabel = overallStatus === 'ok' ? 'Connected' : overallStatus === 'empty' ? 'No history yet' : 'History invalid';

  async function copyTranscript(): Promise<void> {
    if (!transcript) return;
    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="stack">
      <section className="page-heading">
        <div>
          <div className="eyebrow">Research</div>
          <h1>Video Analyzer</h1>
          <p>Brain Core runs the YouTube analyzer, returns the transcript and summaries, and keeps a recent history of past analyses for quick recall and copyable output.</p>
        </div>
        <div className="compact-actions">
          <StatusBadge status={overallTone} label={overallLabel} />
          <span className="meta">Refreshes every 20 seconds</span>
          <button className="button compact secondary" onClick={() => void history.refetch()}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </section>

      {history.isError ? (
        <div className="compact-error">
          <strong>Video analysis history failed to load.</strong> Brain Core could not read `/research/video-analyze/history`.
        </div>
      ) : null}

      {analyze.isError ? (
        <div className="compact-error">
          <strong>Video analysis failed.</strong> {analyze.error instanceof Error ? analyze.error.message : 'Brain Core could not complete the analyzer request.'}
        </div>
      ) : null}

      <section className="grid two">
        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Analyze a YouTube URL</div>
              <div className="card-description">Paste a YouTube link and optionally add a focus prompt for the analyzer.</div>
            </div>
            <StatusBadge status={analyze.isPending ? 'stale' : 'fresh'} label={analyze.isPending ? 'Processing' : 'Ready'} />
          </div>
          <div className="stack" style={{ marginTop: 14 }}>
            <label className="stack" style={{ gap: 8 }}>
              <span className="meta">YouTube URL</span>
              <input
                className="input"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=…"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <label className="stack" style={{ gap: 8 }}>
              <span className="meta">Focus (optional)</span>
              <textarea
                className="textarea compact-textarea"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="Ask the analyzer to focus on a theme, claim, or section."
              />
            </label>
            <button
              className="button secondary"
              disabled={url.trim().length === 0 || analyze.isPending}
              onClick={() => {
                void analyze.mutateAsync({ url: url.trim(), focus: focus.trim() });
              }}
            >
              <Sparkles size={14} /> {analyze.isPending ? 'Processing…' : 'Process URL'}
            </button>
            <p className="meta">Brain Core keeps the transcript, summary, and research hooks. The browser only sends the URL and reads the API response.</p>
          </div>
        </article>

        <article className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent transcriptions</div>
              <div className="card-description">Click an entry to reopen a previous transcript and summary.</div>
            </div>
            <StatusBadge
              status={history.isError ? 'error' : history.data?.status === 'ok' ? 'fresh' : history.data?.status === 'invalid' ? 'error' : 'warning'}
              label={`${historyEntries.length} recent`}
            />
          </div>
          <div className="job-list" style={{ marginTop: 14 }}>
            {historyEntries.map((entry) => {
              const active = entry.id === currentSelection?.id && currentSelection?.source !== 'live';
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`job-list-item ${active ? 'active' : ''}`}
                  onClick={() => setSelectedAnalysis({ ...entry, source: 'history' })}
                >
                  <div className="card-title">{historyLabel(entry)}</div>
                  <div className="meta">{entry.channel ?? 'Unknown channel'}</div>
                  <div className="job-progress">
                    <span>{timeAgo(entry.analyzedAt)}</span>
                    <StatusBadge status={entry.ok ? 'fresh' : 'error'} label={entry.ok ? 'Transcribed' : 'Error'} />
                  </div>
                  <div className="meta truncate">{summarizeTranscript(entry.transcript)}</div>
                </button>
              );
            })}
            {historyEntries.length === 0 ? (
              <div className="compact-error" style={{ marginTop: 0 }}>
                <strong>No transcript history yet.</strong> Run an analysis and Brain Core will store the recent output here.
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <article className="card">
        <div className="card-header">
          <div>
            <div className="card-title">{currentSelection?.title ?? 'Transcript output'}</div>
            <div className="card-description">
              {currentSelection ? (
                <>
                  {formatLabel(currentSelection.channel)} · {timeAgo(currentSelection.analyzedAt)}
                  {currentSelection.focus ? ` · focus: ${currentSelection.focus}` : ''}
                </>
              ) : (
                'Run an analysis or select a history entry to view the transcript.'
              )}
            </div>
          </div>
          <div className="compact-actions">
            {currentSelection ? <StatusBadge status={currentSelection.ok ? 'fresh' : 'error'} label={currentSelection.source === 'live' ? 'Live result' : 'History result'} /> : null}
            <button className="button compact secondary" disabled={!transcript} onClick={() => { void copyTranscript(); }}>
              <Copy size={14} /> {copied ? 'Copied' : 'Copy transcript'}
            </button>
          </div>
        </div>

        <div className="grid two" style={{ marginTop: 14 }}>
          <div className="stack">
            <div className="grid cards" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <article className="card" style={{ boxShadow: 'none' }}>
                <div className="card-title">Transcript</div>
                <div className="metric">{currentSelection?.transcript ? `${currentSelection.transcript.split(/\s+/).length}` : 0}</div>
                <div className="meta">Words in the returned transcription</div>
              </article>
              <article className="card" style={{ boxShadow: 'none' }}>
                <div className="card-title">Summary</div>
                <div className="metric">{currentSelection?.humanSummary ? 'Ready' : 'Missing'}</div>
                <div className="meta">Human summary from Brain Core</div>
              </article>
            </div>

            <div>
              <div className="card-title">Transcript block</div>
              <pre className="compact-pre" style={{ maxHeight: '58vh', marginTop: 10 }}>
                {transcript || 'No transcript selected yet. Run an analysis or choose a history entry.'}
              </pre>
            </div>
          </div>

          <div className="stack">
            <article className="card" style={{ boxShadow: 'none' }}>
              <div className="card-title">Analysis details</div>
              {currentSelection ? (
                <ul className="compact-list" style={{ marginTop: 10 }}>
                  <li>URL: <code>{currentSelection.url}</code></li>
                  <li>Channel: {currentSelection.channel ?? 'unknown'}</li>
                  <li>Mind path: {currentSelection.mindPath ?? 'not provided'}</li>
                  <li>Step: {currentSelection.step ?? 'not provided'}</li>
                  <li>Analyzed: {timeAgo(currentSelection.analyzedAt)}</li>
                </ul>
              ) : (
                <p className="meta" style={{ marginTop: 10 }}>No analysis selected yet.</p>
              )}
            </article>

            <article className="card" style={{ boxShadow: 'none' }}>
              <div className="card-title">Human summary</div>
              <p className="meta" style={{ marginTop: 10, whiteSpace: 'pre-wrap' }}>{currentSelection?.humanSummary ?? 'No human summary returned.'}</p>
            </article>

            <article className="card" style={{ boxShadow: 'none' }}>
              <div className="card-title">AI summary</div>
              {currentSelection?.aiSummary ? (
                <ul className="compact-list" style={{ marginTop: 10 }}>
                  <li>Topic: {currentSelection.aiSummary.topic ?? 'unknown'}</li>
                  <li>Speaker: {currentSelection.aiSummary.speaker ?? 'unknown'}</li>
                  <li>Evidence type: {currentSelection.aiSummary.evidenceType ?? 'unknown'}</li>
                  <li>Confidence: {currentSelection.aiSummary.confidence ?? 'unknown'}</li>
                  <li>Key claims: {currentSelection.aiSummary.keyClaims.length > 0 ? currentSelection.aiSummary.keyClaims.join(' · ') : 'none'}</li>
                  <li>Research hooks: {currentSelection.aiSummary.researchHooks.length > 0 ? currentSelection.aiSummary.researchHooks.join(' · ') : 'none'}</li>
                </ul>
              ) : (
                <p className="meta" style={{ marginTop: 10 }}>No AI summary returned.</p>
              )}
            </article>
          </div>
        </div>
      </article>
    </div>
  );
}
