export interface LocalSearchRoute {
  id: string;
  type: 'ROUTE';
  title: string;
  subtitle: string;
  source: 'console-navigation';
  href: string;
  freshness: 'CURRENT';
  deepLink?: never;
  state?: string;
}

export const LOCAL_SEARCH_ROUTES: LocalSearchRoute[] = [
  { id: 'route:command-center', type: 'ROUTE', title: 'Command Center', subtitle: 'Brain Console overview', source: 'console-navigation', href: '/command-center', freshness: 'CURRENT' },
  { id: 'route:brain', type: 'ROUTE', title: 'Brain', subtitle: 'Tasks, evidence, continuity, and capability routing', source: 'console-navigation', href: '/brain', freshness: 'CURRENT' },
  { id: 'route:brain-active-work', type: 'ROUTE', title: 'Active Work', subtitle: 'Current task and continuation state', source: 'console-navigation', href: '/brain/active-work', freshness: 'CURRENT' },
  { id: 'route:brain-tasks-evidence', type: 'ROUTE', title: 'Tasks & Evidence', subtitle: 'Task graph and bounded packet references', source: 'console-navigation', href: '/brain/tasks-evidence', freshness: 'CURRENT' },
  { id: 'route:computer', type: 'ROUTE', title: 'Computer', subtitle: 'Host, processes, and local applications', source: 'console-navigation', href: '/computer', freshness: 'CURRENT' },
  { id: 'route:operations', type: 'ROUTE', title: 'Operations', subtitle: 'Services, scheduler, infrastructure, and monitoring', source: 'console-navigation', href: '/operations', freshness: 'CURRENT' },
  { id: 'route:scheduler', type: 'ROUTE', title: 'Scheduler', subtitle: 'Nightly job status and latest run', source: 'console-navigation', href: '/scheduler', freshness: 'CURRENT' },
  { id: 'route:local-apps', type: 'ROUTE', title: 'Local Apps', subtitle: 'Brain Console, Core, Obsidian, and local services', source: 'console-navigation', href: '/local-apps', freshness: 'CURRENT' },
  { id: 'route:settings', type: 'ROUTE', title: 'Settings', subtitle: 'Console preferences', source: 'console-navigation', href: '/settings', freshness: 'CURRENT' },
];

export function matchLocalRoutes(query: string): LocalSearchRoute[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return LOCAL_SEARCH_ROUTES.slice(0, 5);
  return LOCAL_SEARCH_ROUTES.filter((route) => `${route.title} ${route.subtitle} ${route.href}`.toLocaleLowerCase().includes(needle)).slice(0, 12);
}
