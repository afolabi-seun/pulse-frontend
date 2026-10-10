import { toast } from 'sonner';
import { usePersonalChatSettings, useUpdatePersonalChatChannel } from '../api/notifications';
import { Card, CardContent } from '@/components/ui/card';
import type { ChatChannel, PersonalChatSettingsDto } from '../types/api';

interface Option {
  value: ChatChannel;
  label: string;
  /** Why it can't be chosen yet, if it can't. */
  unavailable?: string;
}

function options(settings: PersonalChatSettingsDto): Option[] {
  return [
    { value: 'none', label: 'None' },
    {
      value: 'slack',
      label: 'Slack',
      unavailable: settings.slackAvailable ? undefined : "Your organization hasn't connected Slack yet.",
    },
    {
      value: 'google_chat',
      label: 'Google Chat',
      unavailable: !settings.googleChatAvailable
        ? "Google Chat isn't set up on this Pulse server."
        : settings.googleChatLinked
          ? undefined
          : 'Open a direct message with Pulse in Google Chat first, then come back.',
    },
  ];
}

/**
 * Lets a person also receive their notifications as personal direct messages in Slack or Google Chat.
 * Opt-in: "None" until they choose. An option that can't reach them yet is disabled, with the reason.
 */
export default function PersonalChatCard() {
  const { data: settings } = usePersonalChatSettings();
  const update = useUpdatePersonalChatChannel();

  if (!settings) return null;

  function choose(channel: ChatChannel) {
    update.mutate(channel, {
      onSuccess: () => toast.success(channel === 'none' ? 'Personal chat messages turned off.' : 'Personal chat messages turned on.'),
      onError: (err) => toast.error((err as { message?: string })?.message ?? 'Could not update your chat channel.'),
    });
  }

  return (
    <Card className="mb-4">
      <CardContent className="p-5">
        <h2 className="text-sm font-semibold">Personal chat</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Also send my notifications to me as direct messages. You can switch individual notifications off below.
        </p>
        <fieldset className="mt-3 space-y-2" disabled={update.isPending}>
          <legend className="sr-only">Send my notifications to</legend>
          {options(settings).map((option) => (
            <label key={option.value} className="flex items-start gap-2 text-sm">
              <input
                type="radio"
                name="chat-channel"
                className="mt-0.5"
                checked={settings.channel === option.value}
                disabled={!!option.unavailable}
                onChange={() => choose(option.value)}
              />
              <span>
                <span className={option.unavailable ? 'text-muted-foreground' : undefined}>{option.label}</span>
                {option.unavailable && <span className="block text-xs text-muted-foreground">{option.unavailable}</span>}
              </span>
            </label>
          ))}
        </fieldset>
      </CardContent>
    </Card>
  );
}
