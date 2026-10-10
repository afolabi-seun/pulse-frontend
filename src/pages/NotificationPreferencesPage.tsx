import type { ChangeEvent, ElementType } from 'react';
import { Bell, Lock, Mail, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useNotificationPreferences, usePersonalChatSettings, useUpdateNotificationPreference } from '../api/notifications';
import PageHeader from '../components/layout/PageHeader';
import ErrorState from '../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import PersonalChatCard from './PersonalChatCard';
import { cn } from '@/lib/utils';
import type { ChatChannel, NotificationPreferenceDto } from '../types/api';

const CHAT_NAMES: Record<Exclude<ChatChannel, 'none'>, string> = { slack: 'Slack', google_chat: 'Google Chat' };

function groupByCategory(prefs: NotificationPreferenceDto[]) {
  const groups = new Map<string, NotificationPreferenceDto[]>();
  for (const pref of prefs) groups.set(pref.category, [...(groups.get(pref.category) ?? []), pref]);
  return [...groups.entries()];
}

const CHIP = 'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors';

/**
 * One delivery channel for one kind of notification: a chip that is filled when the channel is on, and — unless the
 * channel can't be changed — a checkbox to switch it.
 */
function ChannelChip({ icon: Icon, label, checked, disabled, ariaLabel, onChange }: {
  icon: ElementType;
  label: string;
  checked: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className={cn(
      CHIP,
      checked ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
      disabled ? 'cursor-not-allowed opacity-70' : checked ? 'cursor-pointer hover:bg-primary/90' : 'cursor-pointer hover:text-foreground',
      'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
    )}>
      <input type="checkbox" className="sr-only" checked={checked} disabled={disabled} aria-label={ariaLabel} onChange={onChange} />
      <Icon className="h-3 w-3" aria-hidden="true" />
      {label}
    </label>
  );
}

export default function NotificationPreferencesPage() {
  const { data: prefs, isLoading, error, refetch } = useNotificationPreferences();
  const update = useUpdateNotificationPreference();
  const { data: chat } = usePersonalChatSettings();
  const chatName = chat && chat.channel !== 'none' ? CHAT_NAMES[chat.channel] : null;
  // How many kinds reach the person somewhere other than the inbox, which every kind always reaches.
  const beyondInbox = prefs?.filter((p) => p.email || (chatName !== null && p.chat)).length ?? 0;

  function change(pref: NotificationPreferenceDto, setting: { email?: boolean; chat?: boolean }) {
    update.mutate(
      { kind: pref.kind, ...setting },
      { onError: () => toast.error(`Could not update "${pref.label}".`) },
    );
  }

  return (
    <div>
      <PageHeader
        title="Notification preferences"
        description="Choose which notifications are also emailed or messaged to you. Every notification always appears in your Pulse inbox."
      />

      <PersonalChatCard />

      {error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !prefs ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground" data-testid="preferences-summary">
            <span className="font-semibold text-foreground">{beyondInbox} of {prefs.length}</span>{' '}
            {chatName ? `notifications also reach you by email or ${chatName}.` : 'notifications are also emailed to you.'}
          </p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {groupByCategory(prefs).map(([category, items]) => (
              <Card key={category}>
                <CardContent className="p-5">
                  <h2 className="mb-3 text-sm font-semibold">{category}</h2>
                  <ul className="divide-y divide-border">
                    {items.map((pref) => (
                      <li key={pref.kind} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{pref.label}</p>
                          <p className="text-xs text-muted-foreground">{pref.description}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {/* The inbox isn't a choice — it's shown so the row reads as the full list of where this goes. */}
                          <span className={cn(CHIP, 'bg-primary/10 text-primary')} title="Always in your Pulse inbox">
                            <Bell className="h-3 w-3" aria-hidden="true" />
                            Inbox
                          </span>
                          <ChannelChip
                            icon={pref.emailLocked ? Lock : Mail}
                            label={pref.emailLocked ? 'Always emailed' : 'Email'}
                            checked={pref.email}
                            disabled={pref.emailLocked}
                            ariaLabel={`Email me: ${pref.label}`}
                            onChange={(e) => change(pref, { email: e.target.checked })}
                          />
                          {chatName && (
                            <ChannelChip
                              icon={MessageSquare}
                              label={chatName}
                              checked={pref.chat}
                              ariaLabel={`Message me: ${pref.label}`}
                              onChange={(e) => change(pref, { chat: e.target.checked })}
                            />
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
