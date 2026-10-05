import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AudioWaveform, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Footer from './Footer';
import CommandPalette from '../CommandPalette';
import DemoBanner from '../DemoBanner';
import GuidedTour from '../GuidedTour';
import Spinner from '../ui/Spinner';
import { useSignalR } from '../../hooks/useSignalR';

const EXACT_TITLES: Record<string, string> = {
  '/dashboard':                  'Dashboard',
  '/tasks':                      'Tasks',
  '/tasks/new':                  'New Task',
  '/check-in':                   'Check In',
  '/check-in/history':           'Check-in History',
  '/check-in/status':            'Check-in Status',
  '/projects':                   'Projects',
  '/sprints':                    'Sprints',
  '/wiki':                       'Wiki',
  '/notifications':              'Notifications',
  '/notifications/preferences':  'Notification Preferences',
  '/engineers':                  'Engineers',
  '/escalations':                'Escalations',
  '/vitals':                     'Vitals',
  '/feedback':                   'Feedback Inbox',
  '/feedback/new':               'Submit Feedback',
  '/reports/leadership':         'Leadership Report',
  '/admin/users':                'Users',
  '/admin/teams':                'Teams',
  '/admin/thresholds':           'Thresholds',
  '/admin/audit-log':            'Audit Log',
  '/admin/failed-emails':        'Failed Emails',
};

function resolveTitle(pathname: string): string {
  if (EXACT_TITLES[pathname]) return EXACT_TITLES[pathname];
  if (pathname.startsWith('/tasks/'))     return 'Task';
  if (pathname.startsWith('/projects/'))  return 'Project';
  if (pathname.startsWith('/sprints/'))   return 'Sprint';
  if (pathname.startsWith('/engineers/')) return 'Engineer';
  return '';
}

export default function AppShell() {
  useSignalR();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const page = resolveTitle(location.pathname);
    document.title = page ? `${page} — Pulse` : 'Pulse';
  }, [location.pathname]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onOpenPalette={() => { setSidebarOpen(false); setPaletteOpen(true); }}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DemoBanner />
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary">
              <AudioWaveform className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-bold tracking-tight">Pulse</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6" id="main-content">
          <div key={location.pathname} className="page-transition min-h-full">
            <Suspense fallback={<div className="flex h-64 items-center justify-center"><Spinner size="lg" /></div>}>
              <Outlet />
            </Suspense>
          </div>
          <Footer className="mt-10 border-t border-border" />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <GuidedTour />
    </div>
  );
}
