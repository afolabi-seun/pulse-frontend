import { toast } from 'sonner';
import { useNotificationPreferences, useUpdateNotificationPreference } from '../api/notifications';
import PageHeader from '../components/layout/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import type { NotificationPreferenceDto } from '../types/api';

function groupByCategory(prefs: NotificationPreferenceDto[]) {
  const groups = new Map<string, NotificationPreferenceDto[]>();
  for (const pref of prefs) groups.set(pref.category, [...(groups.get(pref.category) ?? []), pref]);
  return [...groups.entries()];
}

export default function NotificationPreferencesPage() {
  const { data: prefs, isLoading, error, refetch } = useNotificationPreferences();
  const update = useUpdateNotificationPreference();

  function setEmail(pref: NotificationPreferenceDto, email: boolean) {
    update.mutate(
      { kind: pref.kind, email },
      { onError: () => toast.error(`Could not update "${pref.label}".`) },
    );
  }

  return (
    <div>
      <PageHeader
        title="Notification preferences"
        description="Choose which notifications are also emailed to you. Every notification always appears in your Pulse inbox."
      />

      {error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !prefs ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {groupByCategory(prefs).map(([category, items]) => (
            <Card key={category}>
              <CardContent className="p-5">
                <h2 className="mb-3 text-sm font-semibold">{category}</h2>
                <ul className="divide-y divide-border">
                  {items.map((pref) => (
                    <li key={pref.kind} className="flex items-center justify-between gap-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{pref.label}</p>
                        <p className="text-xs text-muted-foreground">{pref.description}</p>
                      </div>
                      <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                        {pref.emailLocked ? 'Always emailed' : 'Email'}
                        <Switch
                          checked={pref.email}
                          disabled={pref.emailLocked}
                          aria-label={`Email me: ${pref.label}`}
                          onChange={(e) => setEmail(pref, e.target.checked)}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
