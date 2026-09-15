'use client';

import { useRef, useState } from 'react';
import { Mic, Send, Square, Trash2 } from 'lucide-react';
import { transcribeJarvisAudio, submitJarvisIntake } from '@/lib/operator-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { readOperatorSession } from '@/lib/operator-client';

function wavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  const samples = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  const write = (offset: number, value: string): void => { for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index)); };
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, samples * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const sample of chunk) { const value = Math.max(-1, Math.min(1, sample)); view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true); offset += 2; }
  return new Blob([buffer], { type: 'audio/wav' });
}

export function JarvisPushToTalk() {
  const session = useQuery({ queryKey: ['operator-session'], queryFn: readOperatorSession, retry: 0 });
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [requestId, setRequestId] = useState<string>();
  const [error, setError] = useState<string>();
  const streamRef = useRef<MediaStream | undefined>(undefined);
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const sourceRef = useRef<MediaStreamAudioSourceNode | undefined>(undefined);
  const processorRef = useRef<ScriptProcessorNode | undefined>(undefined);
  const chunksRef = useRef<Float32Array[]>([]);
  const sampleRateRef = useRef(44_100);
  const queryClient = useQueryClient();
  const submit = useMutation({ mutationFn: (input: { requestId: string; text: string; csrfToken: string }) => submitJarvisIntake({ ...input, source: 'voice' }), onSuccess: () => { setTranscript(''); setRequestId(undefined); void queryClient.invalidateQueries({ queryKey: ['agent-mode-console'] }); } });

  const start = async (): Promise<void> => {
    setError(undefined);
    if (!session.data?.authenticated || !navigator.mediaDevices?.getUserMedia) { setError('Sign in to the local operator session and allow microphone access.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
      const context = new AudioContext();
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      chunksRef.current = []; sampleRateRef.current = context.sampleRate;
      processor.onaudioprocess = (event) => { chunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0))); };
      source.connect(processor); processor.connect(context.destination);
      streamRef.current = stream; contextRef.current = context; sourceRef.current = source; processorRef.current = processor; setRecording(true);
    } catch { setError('Microphone access was unavailable. No intake was created.'); }
  };

  const stop = async (): Promise<void> => {
    processorRef.current?.disconnect(); sourceRef.current?.disconnect(); streamRef.current?.getTracks().forEach((track) => track.stop());
    await contextRef.current?.close();
    processorRef.current = undefined; sourceRef.current = undefined; streamRef.current = undefined; contextRef.current = undefined; setRecording(false);
    const blob = wavBlob(chunksRef.current, sampleRateRef.current);
    const nextRequestId = crypto.randomUUID(); setRequestId(nextRequestId); setBusy(true); setError(undefined);
    try { const result = await transcribeJarvisAudio({ requestId: nextRequestId, audio: blob, csrfToken: session.data?.authenticated ? session.data.csrfToken : '' }); setTranscript(result.transcript); } catch { setError('Local speech transcription was unavailable. No intake was created.'); } finally { setBusy(false); }
  };

  return <section className="card jarvis-intake-card"><div className="card-header"><div><div className="card-title">Jarvis intake</div><div className="card-description">Read-only console plus explicit, authenticated push-to-talk. Transcript review is required before submission.</div></div><Mic size={18} /></div><div className="row"><button type="button" className="button primary" disabled={busy || !session.data?.authenticated} onClick={() => void (recording ? stop() : start())}>{recording ? <><Square size={15} /> Stop recording</> : <><Mic size={15} /> Push to talk</>}</button>{busy ? <span className="meta">Transcribing locally…</span> : null}</div>{transcript ? <div className="stack compact-detail-stack"><label className="field-label" htmlFor="jarvis-transcript">Review transcript</label><textarea id="jarvis-transcript" value={transcript} maxLength={2_000} onChange={(event) => setTranscript(event.target.value)} /><div className="row"><button type="button" className="button primary" disabled={submit.isPending || transcript.trim().length === 0 || !requestId || !session.data?.authenticated} onClick={() => { if (requestId && session.data?.authenticated) submit.mutate({ requestId, text: transcript, csrfToken: session.data.csrfToken }); }}><Send size={15} /> Submit to Jarvis</button><button type="button" className="button secondary" disabled={submit.isPending} onClick={() => { setTranscript(''); setRequestId(undefined); }}><Trash2 size={15} /> Discard</button></div></div> : null}{submit.isSuccess ? <p className="meta">Intake accepted durably; the new root goal is now visible in the Agent Mode projection.</p> : null}{error ? <p className="meta status-error">{error}</p> : null}</section>;
}
