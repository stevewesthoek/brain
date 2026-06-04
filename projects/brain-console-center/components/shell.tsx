'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, AppWindow, BrainCircuit, Gauge, Settings, Video } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { brainCoreRequest, BRAIN_CORE_URL } from '@/lib/braincore-client';
import { brainCoreStatusSchema } from '@/lib/braincore-schemas';
import { cn, timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';

const nav = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/ai-models', label: 'AI Models', icon: BrainCircuit },
  { href: '/local-apps', label: 'Local Apps', icon: AppWindow },
  { href: '/aws-video', label: 'AWS Video', icon: Video },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const status = useQuery({
    queryKey: ['brain-core-status'],
    queryFn: () => brainCoreRequest('/status', brainCoreStatusSchema),
    refetchInterval: 5_000,
  });

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-title">Brain Console Center</div>
            <div className="brand-subtitle">Leading local operations dashboard</div>
          </div>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {nav.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={cn('nav-link', active && 'active')}>
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="row">
            <Activity size={18} />
            <span className="meta">Brain Core: {BRAIN_CORE_URL}</span>
          </div>
          <div className="row">
            {status.isError ? <StatusBadge status="error" label="offline" /> : <StatusBadge status={status.isSuccess ? 'fresh' : 'stale'} label={status.isSuccess ? 'online' : 'checking'} />}
            <span className="meta">updated {status.dataUpdatedAt ? timeAgo(new Date(status.dataUpdatedAt).toISOString()) : 'never'}</span>
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
