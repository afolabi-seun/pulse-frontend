import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart2,
  Bell,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  MessageSquarePlus,
  Plus,
  ScrollText,
  Settings2,
  Sliders,
  Users,
  UsersRound,
  Zap,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useSearch } from '../api/search';
import { cn } from '@/lib/utils';
import type { Capability } from '../lib/auth';

interface CommandItem {
  id: string;
  label: string;
  group: string;
  icon: React.ElementType;
  to: string;
  cap?: Capability | Capability[];
  hideForHeads?: boolean;
  keywords?: string;
}

const ITEMS: CommandItem[] = [
  /* Navigate */
  { id: 'dashboard',      label: 'Dashboard',              group: 'Navigate', icon: LayoutDashboard, to: '/dashboard' },
  { id: 'tasks',          label: 'My Tasks',               group: 'Navigate', icon: CheckSquare,     to: '/tasks' },
  { id: 'projects',       label: 'Projects',               group: 'Navigate', icon: FolderOpen,      to: '/projects',  cap: 'pm-or-above' },
  { id: 'sprints',        label: 'Sprints',                group: 'Navigate', icon: Zap,             to: '/sprints',   cap: 'team-lead-or-above' },
  { id: 'engineers',      label: 'Engineers',              group: 'Navigate', icon: Users,           to: '/engineers', cap: 'pm-or-above' },
  { id: 'escalations',    label: 'Escalations',            group: 'Navigate', icon: AlertTriangle,   to: '/escalations', cap: 'pm-or-above' },
  { id: 'notifications',  label: 'Notifications',          group: 'Navigate', icon: Bell,            to: '/notifications' },
  { id: 'report',         label: 'Leadership Report',      group: 'Navigate', icon: BarChart2,       to: '/reports/leadership', cap: ['any-head', 'executive-read', 'hr-read', 'accountant-read'] },
  { id: 'feedback-inbox', label: 'Feedback Inbox',         group: 'Navigate', icon: Inbox,           to: '/feedback', cap: 'any-head' },
  /* Admin */
  { id: 'admin-users',    label: 'Users',                  group: 'Admin',    icon: UsersRound,      to: '/admin/users',      cap: 'pm-or-above' },
  { id: 'admin-teams',    label: 'Teams',                  group: 'Admin',    icon: Settings2,       to: '/admin/teams',      cap: 'pm-or-above' },
  { id: 'admin-thresh',   label: 'Thresholds',             group: 'Admin',    icon: Sliders,         to: '/admin/thresholds', cap: 'any-head' },
  { id: 'admin-audit',    label: 'Audit Log',              group: 'Admin',    icon: ScrollText,      to: '/admin/audit-log',  cap: 'head-only' },
  /* Quick actions */
  { id: 'check-in',       label: 'Submit Check-In',        group: 'Actions',  icon: ClipboardCheck,    to: '/check-in',      hideForHeads: true, keywords: 'daily standup' },
  { id: 'vitals',         label: 'Weekly Vitals',          group: 'Actions',  icon: Activity,          to: '/vitals',        keywords: 'mood survey morale pulse' },
  { id: 'new-feedback',   label: 'Submit Feedback',        group: 'Actions',  icon: MessageSquarePlus, to: '/feedback/new',  hideForHeads: true },
  { id: 'new-task',       label: 'New Task',               group: 'Actions',  icon: Plus,            to: '/tasks/new',  keywords: 'create add' },
  { id: 'checkin-status', label: 'Check-In Status',        group: 'Actions',  icon: ClipboardList,   to: '/check-in/status', cap: 'pm-or-above' },
  { id: 'checkin-history',label: 'Check-In History',       group: 'Actions',  icon: ClipboardList,   to: '/check-in/history', keywords: 'past previous' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const navigate = useNavigate();
  const { allow } = useAuth();
  const isHead = allow('any-head');
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: searchResults } = useSearch(query);

  const q = query.toLowerCase();
  const filtered = ITEMS.filter((item) => {
    if (item.cap) {
      const capOk = Array.isArray(item.cap) ? item.cap.some(allow) : allow(item.cap);
      if (!capOk) return false;
    }
    if (item.hideForHeads && isHead) return false;
    if (!q) return true;
    return (
      item.label.toLowerCase().includes(q) ||
      item.group.toLowerCase().includes(q) ||
      (item.keywords ?? '').includes(q)
    );
  });

  // Group the filtered items
  const groups = Array.from(new Set(filtered.map((i) => i.group)));

  const flatFiltered = filtered;

  useEffect(() => {
    if (open) {
      setQuery('');
      setFocused(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setFocused(0); }, [query]);

  const select = (item: CommandItem) => {
    navigate(item.to);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocused((i) => Math.min(i + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocused((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatFiltered[focused]) {
      select(flatFiltered[focused]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] sm:pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative w-full max-w-lg mx-4 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages and actions…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {/* Dynamic search results */}
          {query.trim().length >= 2 && ((searchResults?.tasks.length ?? 0) > 0 || (searchResults?.engineers.length ?? 0) > 0) && (
            <div className="mb-1">
              {(searchResults?.tasks.length ?? 0) > 0 && (
                <>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Tasks</p>
                  {searchResults!.tasks.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => { navigate(`/tasks/${hit.id}`); onClose(); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {hit.taskKey && <span className="shrink-0 font-mono text-xs text-muted-foreground">{hit.taskKey}</span>}
                      <span className="flex-1 font-medium truncate">{hit.title}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{hit.points} pts</span>
                    </button>
                  ))}
                </>
              )}
              {(searchResults?.engineers.length ?? 0) > 0 && (
                <>
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Engineers</p>
                  {searchResults!.engineers.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => { navigate(`/engineers/${hit.id}`); onClose(); }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-muted transition-colors"
                    >
                      <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 font-medium">{hit.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{hit.email}</span>
                    </button>
                  ))}
                </>
              )}
              {flatFiltered.length > 0 && <div className="my-1 border-t border-border" />}
            </div>
          )}

          {/* Navigation / action items */}
          {flatFiltered.length === 0 && query.trim().length < 2 ? null :
           flatFiltered.length === 0 && (searchResults?.tasks.length ?? 0) === 0 && (searchResults?.engineers.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No results for "{query}"</p>
          ) : (
            groups.map((group) => {
              const groupItems = filtered.filter((i) => i.group === group);
              return (
                <div key={group} className="mb-1">
                  <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {group}
                  </p>
                  {groupItems.map((item) => {
                    const globalIndex = flatFiltered.indexOf(item);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => select(item)}
                        onMouseEnter={() => setFocused(globalIndex)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors',
                          focused === globalIndex
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="flex-1 font-medium">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-border px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5">↑↓</kbd> navigate</span>
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5">↵</kbd> open</span>
            <span><kbd className="rounded border border-border bg-muted px-1 py-0.5">Esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
