'use client';

import { useEffect, useRef, useState } from 'react';
import { Square, Volume2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { BrainCoreError, brainCoreRequest } from '@/lib/braincore-client';
import { jarvisUserResponseReadResponseSchema, type JarvisUserResponse } from '@/lib/braincore-schemas';
import { BrowserJarvisSpeechTransport, type JarvisSpeechSnapshot, createBrowserJarvisSpeechTransport } from '@/lib/jarvis-speech';
import { StatusBadge } from '@/components/status-badge';

const INITIAL_SPEECH_SNAPSHOT: JarvisSpeechSnapshot = { state: 'idle', outputId: null, responseId: null, receipt: null };

function speechLabel(snapshot: JarvisSpeechSnapshot): string {
  switch (snapshot.state) {
    case 'starting': return 'Starting speech…';
    case 'speaking': return 'Speaking…';
    case 'interrupted': return 'Speech interrupted';
    case 'completed': return 'Speech completed';
    case 'failed': return 'Speech failed';
    case 'unavailable': return 'Speech unavailable';
    default: return 'Ready to speak';
  }
}

function speechStatus(snapshot: JarvisSpeechSnapshot): string {
  return snapshot.state === 'idle' ? 'fresh' : snapshot.state;
}

export function JarvisResponsePlayback({ rootGoalId }: { rootGoalId: string | null }) {
  const transportRef = useRef<BrowserJarvisSpeechTransport | null>(null);
  const [snapshot, setSnapshot] = useState<JarvisSpeechSnapshot>(INITIAL_SPEECH_SNAPSHOT);
  const responseQuery = useQuery({
    queryKey: ['jarvis-user-response', rootGoalId],
    queryFn: () => brainCoreRequest(`/agent-mode/jarvis/responses/${encodeURIComponent(rootGoalId!)}`, jarvisUserResponseReadResponseSchema),
    enabled: Boolean(rootGoalId),
    retry: false,
    refetchInterval: 7_000,
  });

  useEffect(() => {
    const transport = createBrowserJarvisSpeechTransport();
    transportRef.current = transport;
    setSnapshot(transport.getSnapshot());
    const unsubscribe = transport.subscribe(setSnapshot);
    return () => {
      unsubscribe();
      transport.dispose();
      transportRef.current = null;
    };
  }, []);

  useEffect(() => {
    transportRef.current?.interrupt();
  }, [rootGoalId]);

  const response: JarvisUserResponse | undefined = responseQuery.data?.response;
  const active = snapshot.state === 'starting' || snapshot.state === 'speaking';
  const missingResponse = responseQuery.isError && responseQuery.error instanceof BrainCoreError && responseQuery.error.status === 404;

  return (
    <section className="card jarvis-response-card" aria-labelledby="jarvis-response-title">
      <div className="card-header">
        <div>
          <div className="card-title" id="jarvis-response-title">Canonical Jarvis response</div>
          <div className="card-description">Speech renders the immutable Brain-owned response locally in this browser. It never speaks worker output or arbitrary text.</div>
        </div>
        <Volume2 size={18} aria-hidden="true" />
      </div>
      {!rootGoalId ? <p className="meta">No durable root is currently visible.</p> : null}
      {rootGoalId && responseQuery.isLoading ? <p className="meta">Reading the canonical response from Brain Core…</p> : null}
      {rootGoalId && missingResponse ? <p className="meta">No canonical Jarvis response is available for the latest visible root.</p> : null}
      {rootGoalId && responseQuery.isError && !missingResponse ? <p className="status-error" role="alert">Canonical Jarvis response is unavailable.</p> : null}
      {response ? <>
        <blockquote className="jarvis-response-text">{response.text}</blockquote>
        <div className="row">
          <button type="button" className="button primary" disabled={active || snapshot.state === 'unavailable'} onClick={() => transportRef.current?.speak(response)}><Volume2 size={15} /> Speak</button>
          {active ? <button type="button" className="button secondary" onClick={() => transportRef.current?.interrupt()}><Square size={15} /> Stop speaking</button> : null}
          <StatusBadge status={speechStatus(snapshot)} label={speechLabel(snapshot)} />
        </div>
        <div className="meta">Response {response.responseId} · browser-local transport · no Brain lifecycle effect</div>
      </> : null}
      {snapshot.state === 'unavailable' ? <p className="status-error" role="status">Speech unavailable in this browser. The canonical text remains available.</p> : null}
      {snapshot.state === 'failed' ? <p className="status-error" role="status">Speech failed. The canonical text and Brain work remain unchanged.</p> : null}
    </section>
  );
}
