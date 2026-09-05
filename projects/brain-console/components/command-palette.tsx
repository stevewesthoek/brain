'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Command, ExternalLink, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { BRAIN_CORE_URL, brainCoreRequest } from '@/lib/braincore-client';
import { unifiedSearchSchema } from '@/lib/braincore-schemas';
import { LOCAL_SEARCH_ROUTES, matchLocalRoutes, type LocalSearchRoute } from '@/lib/search-routes';

type RemoteResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  source: string;
  freshness: 'CURRENT' | 'STALE' | 'DEGRADED' | 'UNAVAILABLE';
  href: string | null;
  deepLink?: string;
  state?: string;
};
type PaletteResult = LocalSearchRoute | RemoteResult;

const RECENTS_KEY = 'brain-console.recent-destinations.v1';
const GROUP_LABELS: Record<string, string> = {
  ROUTE: 'Navigation', TASK: 'Tasks', EVIDENCE: 'Evidence', CONTEXT: 'Context', CONTINUATION: 'Continuations',
  REPORT: 'Reports & Specs', SERVICE: 'Operations', SCHEDULER_JOB: 'Scheduler', CONSUMER: 'Capabilities', OBSIDIAN_NOTE: 'Obsidian',
};

function readRecents(): LocalSearchRoute[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENTS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LocalSearchRoute => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.href === 'string').slice(0, 6);
  } catch { return []; }
}

function remember(item: PaletteResult): void {
  if (!item.href) return;
  try {
    const current = readRecents().filter((entry) => entry.id !== item.id);
    window.localStorage.setItem(RECENTS_KEY, JSON.stringify([{ ...item, type: 'ROUTE', source: 'console-navigation', freshness: 'CURRENT' }, ...current].slice(0, 6)));
  } catch { /* local recents are optional */ }
}

export function CommandPalette({ onOpenChange }: { onOpenChange?: (open: boolean) => void }) {
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const requestSequence = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<RemoteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [recents, setRecents] = useState<LocalSearchRoute[]>([]);

  const setOpenState = useCallback((value: boolean) => {
    setOpen(value);
    onOpenChange?.(value);
    if (value) {
      setRecents(readRecents());
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setQuery('');
      setRemote([]);
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, [onOpenChange]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpenState(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, setOpenState]);

  useEffect(() => {
    if (!open || !query.trim()) {
      setRemote([]);
      setLoading(false);
      setRemoteError(false);
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setRemoteError(false);
    const timer = window.setTimeout(() => {
      void brainCoreRequest(`/search?q=${encodeURIComponent(query.trim())}`, unifiedSearchSchema, { timeoutMs: 2500 })
        .then((payload) => {
          if (sequence !== requestSequence.current) return;
          setRemote(payload.results as RemoteResult[]);
          setLoading(false);
        })
        .catch(() => {
          if (sequence !== requestSequence.current) return;
          setRemote([]);
          setRemoteError(true);
          setLoading(false);
        });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  const local = useMemo(() => matchLocalRoutes(query), [query]);
  const results = useMemo<PaletteResult[]>(() => {
    const seen = new Set<string>();
    const combined: PaletteResult[] = [];
    const push = (item: PaletteResult) => { if (!seen.has(item.id)) { seen.add(item.id); combined.push(item); } };
    if (!query.trim()) recents.forEach(push);
    local.forEach(push);
    remote.forEach(push);
    return combined.slice(0, 32);
  }, [local, query, recents, remote]);

  useEffect(() => setActiveIndex((current) => Math.min(current, Math.max(0, results.length - 1))), [results.length]);

  const activate = useCallback((item: PaletteResult | undefined) => {
    if (!item) return;
    remember(item);
    if (item.deepLink) {
      window.location.href = item.deepLink;
      return;
    }
    if (item.href) {
      setOpenState(false);
      router.push(item.href);
    }
  }, [router, setOpenState]);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); setOpenState(false); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((current) => Math.min(current + 1, results.length - 1)); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((current) => Math.max(current - 1, 0)); return; }
    if (event.key === 'Enter') { event.preventDefault(); activate(results[activeIndex]); }
    if (event.key === 'Tab') {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]');
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  };

  const grouped = results.reduce<Record<string, PaletteResult[]>>((groups, item) => {
    (groups[item.type] ||= []).push(item);
    return groups;
  }, {});

  return (
    <>
      <button ref={triggerRef} type="button" className="shell-search-trigger" onClick={() => setOpenState(true)} aria-label="Open Brain Console search" aria-haspopup="dialog">
        <Search size={15} /><span>Search</span><kbd><Command size={11} />K</kbd>
      </button>
      {open ? (
        <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenState(false); }}>
          <div ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-palette-title" onKeyDown={onKeyDown}>
            <div className="command-palette-heading"><span id="command-palette-title">Search Brain Console</span><button type="button" className="icon-button" onClick={() => setOpenState(false)} aria-label="Close search"><X size={16} /></button></div>
            <div className="command-palette-input"><Search size={17} aria-hidden="true" /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search routes, tasks, operations, notes…" aria-label="Search routes, tasks, operations, and notes" aria-controls="command-palette-results" autoComplete="off" /><span className="palette-status">{loading ? 'Searching…' : query.trim() && remoteError ? 'Core unavailable' : '⌘K'}</span></div>
            <div id="command-palette-results" className="command-palette-results" role="listbox" aria-label="Search results">
              {Object.entries(grouped).map(([type, items]) => <div className="palette-group" key={type}><div className="palette-group-title">{GROUP_LABELS[type] || type}</div>{items.map((item) => { const index = results.indexOf(item); return <button type="button" role="option" aria-selected={index === activeIndex} className={`palette-result ${index === activeIndex ? 'active' : ''}`} key={item.id} onMouseEnter={() => setActiveIndex(index)} onClick={() => activate(item)}><span className="palette-result-main"><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="palette-result-meta">{item.freshness !== 'CURRENT' ? item.freshness : ''}{item.deepLink ? <ExternalLink size={13} aria-label="Open in Obsidian" /> : item.state || ''}</span></button>; })}</div>)}
              {!results.length && !query.trim() ? <div className="palette-empty">Type to search, or choose a recent destination.</div> : null}
              {!results.length && query.trim() && !loading ? <div className="palette-empty">No matching Brain Console results.</div> : null}
            </div>
            <div className="command-palette-footer"><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>↵</kbd> open</span><span><kbd>esc</kbd> close</span><span className="palette-source">{BRAIN_CORE_URL}</span></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
