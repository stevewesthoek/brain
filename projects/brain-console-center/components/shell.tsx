'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, AppWindow, BrainCircuit, CalendarClock, Gauge, Globe, ListVideo, PlayCircle, Server, Settings, UploadCloud, Video } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { brainCoreRequest, BRAIN_CORE_URL } from '@/lib/braincore-client';
import { brainCoreStatusSchema } from '@/lib/braincore-schemas';
import { cn, timeAgo } from '@/lib/utils';
import { StatusBadge } from '@/components/status-badge';
import { ThemeToggle } from '@/components/theme-toggle';

const nav = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/ai-models', label: 'AI Models', icon: BrainCircuit },
  { href: '/local-apps', label: 'Local Apps', icon: AppWindow },
  { href: '/dokploy', label: 'Dokploy', icon: Server },
  { href: '/tunnels', label: 'Tunnels', icon: Globe },
  { href: '/scheduler', label: 'Scheduler', icon: CalendarClock },
  {
    href: '/aws-video',
    label: 'AWS Video',
    icon: Video,
    children: [
      { href: '/aws-video', label: 'Pipeline', icon: PlayCircle },
      { href: '/aws-video#jobs', label: 'Jobs', icon: ListVideo },
      { href: '/aws-video#publish', label: 'Publish', icon: UploadCloud },
    ],
  },
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
          <div className="brand-mark" aria-hidden="true" />
          <div>
            <div className="brand-title">Brain Console Center</div>
            <div className="brand-subtitle">Local operations command surface</div>
          </div>
        </div>
        <nav className="nav" aria-label="Primary navigation">
          {nav.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <div key={item.href} className="nav-group">
                <Link href={item.href} className={cn('nav-link', active && 'active')}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
                {'children' in item && item.children ? (
                  <div className="nav-children">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon;
                      return (
                        <Link key={child.href} href={child.href} className="nav-child-link">
                          <ChildIcon size={14} />
                          <span>{child.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="row">
            <Activity size={18} />
            <span className="meta">Brain Core</span>
            <code className="topbar-endpoint">{BRAIN_CORE_URL}</code>
          </div>
          <div className="row">
            {status.isError ? <StatusBadge status="error" label="offline" /> : <StatusBadge status={status.isSuccess ? 'fresh' : 'stale'} label={status.isSuccess ? 'online' : 'checking'} />}
            <span className="meta">updated {status.dataUpdatedAt ? timeAgo(new Date(status.dataUpdatedAt).toISOString()) : 'never'}</span>
            <ThemeToggle />
          </div>
        </header>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
