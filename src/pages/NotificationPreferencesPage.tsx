import { Bell, AlertTriangle, Shield, Clock, BarChart3, CheckCircle2, MinusCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';
import { Card, CardContent } from '@/components/ui/card';

interface EventRow {
  label: string;
  description: string;
  inApp: boolean;
  email: boolean;
  notes?: string;
}

interface Category {
  icon: LucideIcon;
  title: string;
  events: EventRow[];
}

const CATEGORIES: Category[] = [
  {
    icon: Bell,
    title: 'Check-ins & surveys',
    events: [
      { label: 'Check-in reminder',   description: 'Daily reminders to submit your check-in',                 inApp: true,  email: true,  notes: 'Sent at 08:00 and 18:00 on weekdays' },
      { label: 'Weekly vitals survey', description: 'Prompt to complete your Friday morale check-in',         inApp: true,  email: true,  notes: 'Sent Fridays at 09:00' },
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Escalation alerts',
    events: [
      { label: 'T-3 early warning',   description: 'Task due in 3 or fewer days',                            inApp: true,  email: true,  notes: 'Suppressed on weekends unless overdue' },
      { label: 'T-1 off-ramp',        description: 'Task due tomorrow',                                       inApp: true,  email: true,  notes: 'Suppressed on weekends unless overdue' },
      { label: 'Overdue',             description: 'Task is past its due date',                               inApp: true,  email: true,  notes: 'PM and department heads are also notified' },
    ],
  },
  {
    icon: Shield,
    title: 'Security',
    events: [
      { label: 'Password reset',      description: 'Link to reset your account password',                     inApp: false, email: true  },
      { label: 'Account locked',      description: 'Account locked due to failed login attempts',             inApp: false, email: true  },
    ],
  },
  {
    icon: Clock,
    title: 'Tasks',
    events: [
      { label: 'Blocker flagged',     description: 'A blocker was raised on one of your tasks',              inApp: true,  email: false },
    ],
  },
  {
    icon: BarChart3,
    title: 'Leadership',
    events: [
      { label: 'Report ready',        description: 'Weekly leadership report is available for review',        inApp: true,  email: false, notes: 'Department heads only' },
    ],
  },
];

function ChannelBadge({ label, on }: { label: string; on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:ring-emerald-800">
      <CheckCircle2 className="h-3 w-3" />
      {label}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground ring-1 ring-border">
      <MinusCircle className="h-3 w-3" />
      {label}
    </span>
  );
}

function CategoryCard({ icon: Icon, title, events }: Category) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <CardContent className="space-y-5 p-5">
        {events.map((ev) => (
          <div key={ev.label}>
            <p className="text-sm font-medium text-foreground">{ev.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{ev.description}</p>
            {ev.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">{ev.notes}</p>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <ChannelBadge label="In-app" on={ev.inApp} />
              <ChannelBadge label="Email" on={ev.email} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function NotificationPreferencesPage() {
  return (
    <div>
      <PageHeader title="Notification preferences" />

      <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
        Notification channels are fixed in V1. Per-event configuration will be available in a future release.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORIES.map((cat) => (
          <CategoryCard key={cat.title} {...cat} />
        ))}
      </div>
    </div>
  );
}
