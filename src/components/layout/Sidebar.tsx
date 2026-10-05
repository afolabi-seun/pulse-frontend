import {
  Activity,
  AlertTriangle,
  AudioWaveform,
  BarChart2,
  Bell,
  BellDot,
  BookOpen,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  Crown,
  History,
  FileText,
  FolderOpen,
  Gauge,
  HeartPulse,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquarePlus,
  Moon,
  Mail,
  Radar,
  ScrollText,
  Search,
  Settings2,
  Sliders,
  Sun,
  Upload,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import TimerIndicator from '../time/TimerIndicator';
import type { Capability } from '../../lib/auth';

interface NavItem {
  to: string;
  label: string;
  icon: React.ElementType;
  description?: string;
  cap?: Capability | Capability[];
  hideForHeads?: boolean;
  /** Hides an otherwise-ungated item specifically for Executive — for pages that are
   * personal/self-service (check-ins, vitals) and make no sense for a role with no team, no
   * tasks, and no department to submit feedback to, rather than genuinely open to every role. */
  hideForExecutive?: boolean;
  /** Same idea as hideForExecutive, but independent of it — HR shares Executive's lack of a
   * personal work-tracking routine for most of these items, but unlike Executive, HR does have a
   * legitimate reason to open Vitals (the org-wide summary section), so the two roles can't be
   * gated by one shared flag. */
  hideForHr?: boolean;
  /** Accountant has no team, no check-ins, no vitals and no department to give feedback to, and its
   * own Performance page would only ever be empty — independent of the other two flags. */
  hideForAccountant?: boolean;
  end?: boolean;
}

const PERSONAL: NavItem[] = [
  { to: '/dashboard',    label: 'Dashboard',      icon: LayoutDashboard,   description: 'Your personal task summary, overwork signals, and recent activity' },
  { to: '/tasks',        label: 'Tasks',           icon: CheckSquare,       description: 'View and manage all tasks assigned to you or your team' },
  { to: '/check-in',         label: 'Check In',         icon: ClipboardCheck, description: 'Submit your daily standup: what you completed, what you planned, and any blockers', end: true, hideForExecutive: true, hideForHr: true, hideForAccountant: true },
  { to: '/check-in/history', label: 'Check-in History', icon: History,        description: 'View your past check-ins and standup entries', hideForExecutive: true, hideForHr: true, hideForAccountant: true },
  { to: '/my-time',          label: 'My Time',          icon: Clock,          description: 'Log hours against tasks or categories like meetings, admin, and leave', cap: 'time-entry-submitter', end: true },
  { to: '/vitals',           label: 'Vitals',           icon: Activity,       description: 'Your workload health score and recent overwork signals', hideForExecutive: true, hideForHr: true, hideForAccountant: true },
  { to: '/performance',      label: 'Performance',      icon: Gauge,          description: 'Velocity, on-time rate, QA quality, and check-in consistency over a rolling window', hideForAccountant: true },
  { to: '/feedback/new', label: 'Submit Feedback', icon: MessageSquarePlus, description: 'Submit anonymous weekly feedback to your department head', hideForHeads: true, hideForExecutive: true, hideForHr: true, hideForAccountant: true },
];

const WORK: NavItem[] = [
  { to: '/projects', label: 'Projects',       icon: FolderOpen,    description: 'Browse active and archived projects and view their task throughput', cap: ['pm-or-above', 'executive-read', 'hr-read', 'accountant-read'] },
  { to: '/wiki',     label: 'Wiki',           icon: BookOpen,      description: 'Project documentation and team knowledge base' },
  { to: '/sprints',  label: 'Sprints',        icon: Zap,           description: 'View sprint progress, burndown, and task board' },
  { to: '/standup',  label: 'Standup Digest', icon: ClipboardList, description: "Today's check-in summary and a list of who has not checked in yet", cap: ['team-lead-or-above', 'executive-read', 'hr-read', 'accountant-read'] },
  { to: '/vitals/digest', label: 'Vitals Digest', icon: HeartPulse, description: "Your team's weekly vitals — a department head's own department, org-wide for PMO/Head of Product/Executive/HR", cap: ['any-head', 'executive-read', 'hr-read'] },
];

const COMMS: NavItem[] = [
  { to: '/notifications',             label: 'Notifications',         icon: Bell,    description: 'In-app alerts for task updates, escalations, and system events', hideForExecutive: true, hideForHr: true },
  { to: '/notifications/preferences', label: 'Notification Settings', icon: BellDot, description: 'Configure which events trigger email or in-app notifications', hideForExecutive: true, hideForHr: true },
];

const MANAGEMENT: NavItem[] = [
  { to: '/engineers',          label: 'Engineers',      icon: Users,         description: 'View workload, capacity, and check-in history for your team', cap: ['team-lead-or-above', 'executive-read', 'hr-read', 'accountant-read'] },
  { to: '/time-summary',       label: 'Time Summary',   icon: Clock,         description: "This week's logged hours by engineer", cap: ['team-lead-or-above', 'executive-read', 'hr-read', 'accountant-read'] },
  { to: '/escalations',        label: 'Escalations',    icon: AlertTriangle, description: 'Tasks approaching or past their deadline that need immediate attention', cap: ['team-lead-or-above', 'executive-read', 'hr-read'] },
  { to: '/alerts',             label: 'My Alerts',      icon: Radar,         description: 'Get notified when a metric you watch — blockers, velocity, check-ins, QA rejects — crosses a threshold you set', cap: 'team-lead-or-above' },
  { to: '/automations',        label: 'My Automations', icon: Workflow,      description: 'Automatically reassign a task to your team lead once it has sat blocked past a threshold you set', cap: 'team-lead-or-above' },
  { to: '/import',             label: 'Import',         icon: Upload,        description: 'Bulk-import users, projects, or backlog items from a CSV file', cap: 'pm-or-above' },
  { to: '/reports',            label: 'Reports',        icon: BarChart2,     description: 'Consolidated team utilization, project health, sprint velocity, and check-in compliance', cap: ['team-lead-or-above', 'executive-read', 'hr-read', 'accountant-read'] },
  { to: '/reports/weekly',     label: 'Weekly Report',  icon: FileText,      description: 'Auto-generated workstream status, blockers, and KPIs alongside your editable weekly summary', cap: 'team-lead-or-above' },
  { to: '/reports/leadership', label: 'Leadership Report', icon: Crown,      description: 'Weekly workload, escalations, and blockers across the org', cap: ['any-head', 'executive-read', 'hr-read', 'accountant-read'] },
  { to: '/feedback',           label: 'Feedback Inbox', icon: Inbox,         description: 'Anonymous feedback submitted by your department, grouped by week', cap: ['any-head', 'hr-read'] },
];

const ADMIN: NavItem[] = [
  { to: '/admin/users',      label: 'Users',      icon: UsersRound, description: 'Create, deactivate, and manage user accounts and roles', cap: ['pm-or-above', 'executive-read', 'hr-read'] },
  { to: '/admin/teams',      label: 'Teams',      icon: Settings2,  description: 'Create and configure teams, assign team leads, and set departments', cap: 'pm-or-above' },
  { to: '/admin/thresholds', label: 'Thresholds', icon: Sliders,    description: 'Configure overwork detection thresholds and escalation timing rules', cap: 'any-head' },
  { to: '/admin/audit-log',      label: 'Audit Log',     icon: ScrollText, description: 'Full history of system events, user actions, and administrative changes', cap: 'head-only' },
  { to: '/admin/failed-emails',  label: 'Failed Emails', icon: Mail,       description: 'View and retry failed outbound email notifications', cap: 'head-only' },
];

interface SectionProps {
  label: string;
  items: NavItem[];
  allowFn: (cap: Capability) => boolean;
  isHead: boolean;
  isExecutive: boolean;
  isHr: boolean;
  isAccountant: boolean;
  onNavClick: () => void;
}

function NavSection({ label, items, allowFn, isHead, isExecutive, isHr, isAccountant, onNavClick }: SectionProps) {
  const visible = items.filter((i) => {
    if (i.cap) {
      const capOk = Array.isArray(i.cap) ? i.cap.some(allowFn) : allowFn(i.cap);
      if (!capOk) return false;
    }
    if (i.hideForHeads && isHead) return false;
    if (i.hideForExecutive && isExecutive) return false;
    if (i.hideForHr && isHr) return false;
    if (i.hideForAccountant && isAccountant) return false;
    return true;
  });
  if (visible.length === 0) return null;

  return (
    <div className="px-2">
      <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-muted-foreground/70">
        {label}
      </p>
      <ul role="list" className="space-y-0.5">
        {visible.map((item) => (
          <NavItemLink key={item.to} item={item} onClick={onNavClick} />
        ))}
      </ul>
    </div>
  );
}

const TOUR_ANCHORS: Partial<Record<string, string>> = {
  '/dashboard':     'tour-dashboard',
  '/tasks':         'tour-tasks',
  '/check-in':      'tour-checkin',
  '/projects':      'tour-projects',
  '/sprints':       'tour-sprints',
  '/escalations':   'tour-escalations',
  '/notifications': 'tour-notifications',
  '/wiki':          'tour-wiki',
};

function NavItemLink({ item, onClick }: { item: NavItem; onClick: () => void }) {
  const Icon = item.icon;
  const tourId = TOUR_ANCHORS[item.to];
  const location = useLocation();
  // Wiki pages live inside /projects/:id?wiki=... — highlight the wiki nav item there too
  const isWikiContext = item.to === '/wiki' && new URLSearchParams(location.search).has('wiki');
  return (
    <li>
      <TooltipProvider delayDuration={400}>
        <Tooltip>
          <TooltipTrigger asChild>
            <NavLink
              to={item.to}
              end={item.end}
              onClick={onClick}
              data-tour={tourId}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  (isActive || isWikiContext)
                    ? 'bg-white/15 text-white'
                    : 'text-sidebar-muted-foreground hover:bg-white/8 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          </TooltipTrigger>
          {item.description && (
            <TooltipContent side="right" sideOffset={8} className="max-w-[220px]">
              <p className="text-xs">{item.description}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
    </li>
  );
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

interface SidebarProps {
  open: boolean;
  onClose: () => void;
  onOpenPalette: () => void;
}

export default function Sidebar({ open, onClose, onOpenPalette }: SidebarProps) {
  const { currentUser, allow, logout } = useAuth();
  const isHead = allow('any-head');
  const isExecutive = allow('executive-read');
  const isHr = allow('hr-read');
  const isAccountant = allow('accountant-read');
  const { theme, toggleTheme } = useTheme();

  return (
    <aside
      className={cn(
        // Base: fixed drawer (mobile)
        'fixed inset-y-0 left-0 z-50 flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground',
        'transition-transform duration-200 ease-in-out',
        // Desktop: static, always visible, no animation needed
        'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
        // Mobile open/closed
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary shadow-md">
          <AudioWaveform className="h-4 w-4 text-white" />
        </div>
        <span className="flex-1 text-base font-bold tracking-tight">Pulse</span>
        {/* Close button — mobile only */}
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring lg:hidden"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 overflow-y-auto py-4" aria-label="Main navigation">
        <NavSection label="Personal"   items={PERSONAL}   allowFn={allow} isHead={isHead} isExecutive={isExecutive} isHr={isHr} isAccountant={isAccountant} onNavClick={onClose} />
        <NavSection label="Work"       items={WORK}       allowFn={allow} isHead={isHead} isExecutive={isExecutive} isHr={isHr} isAccountant={isAccountant} onNavClick={onClose} />
        <NavSection label="Comms"      items={COMMS}      allowFn={allow} isHead={isHead} isExecutive={isExecutive} isHr={isHr} isAccountant={isAccountant} onNavClick={onClose} />
        <NavSection label="Management" items={MANAGEMENT} allowFn={allow} isHead={isHead} isExecutive={isExecutive} isHr={isHr} isAccountant={isAccountant} onNavClick={onClose} />
        <NavSection label="Admin"      items={ADMIN}      allowFn={allow} isHead={isHead} isExecutive={isExecutive} isHr={isHr} isAccountant={isAccountant} onNavClick={onClose} />
      </nav>

      {/* User footer */}
      <div className="border-t border-sidebar-border p-3">
        <TimerIndicator />
        {/* Command palette trigger */}
        <button
          type="button"
          onClick={onOpenPalette}
          className="mb-2 flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-sidebar-border bg-sidebar-muted px-1 py-0.5 text-[9px] leading-none">⌘K</kbd>
        </button>
        <Separator className="mb-3 bg-sidebar-border" />
        <div className="flex items-center gap-2.5 rounded-md px-1 py-1">
          <Link to="/account" title="My account" className="shrink-0">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-[10px]">
                {currentUser ? initials(currentUser.name) : '??'}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="min-w-0 flex-1">
            <Link to="/account" className="block hover:underline">
              <p className="truncate text-xs font-medium text-sidebar-foreground">{currentUser?.name}</p>
            </Link>
            <p className="truncate text-[10px] text-sidebar-muted-foreground">{currentUser?.email}</p>
          </div>
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="shrink-0 rounded-md p-1.5 text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={logout}
            title="Sign out"
            className="shrink-0 rounded-md p-1.5 text-sidebar-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
