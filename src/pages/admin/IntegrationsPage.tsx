import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useConnectSlack, useDisconnectSlack, useSlackConnection } from '../../api/integrations';
import PageHeader from '../../components/layout/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import GoogleChatCard from './GoogleChatCard';
import { formatDateTime } from '../../lib/dates';

/** Why an "Add to Slack" install came back unsuccessful — the `reason` the API's OAuth callback redirects with. */
const SLACK_ERRORS: Record<string, string> = {
  cancelled: 'The Slack install was cancelled.',
  workspace_taken: 'That Slack workspace is already connected to another organization.',
  invalid_state: 'That install link expired. Start again with "Connect Slack".',
  exchange_failed: "Slack didn't complete the install. Please try again.",
  not_configured: "Slack isn't set up on this Pulse server.",
};

export default function IntegrationsPage() {
  const [params, setParams] = useSearchParams();
  const { data: slack, isLoading, error, refetch } = useSlackConnection();
  const connect = useConnectSlack();
  const disconnect = useDisconnectSlack();

  // The API's OAuth callback lands here with ?slack=connected or ?slack=error&reason=… — report it once,
  // then drop the parameters so a refresh doesn't repeat it.
  useEffect(() => {
    const outcome = params.get('slack');
    if (!outcome) return;
    const reason = params.get('reason') ?? '';
    // Deferred a tick so it doesn't race the toaster mounting on a direct landing from Slack.
    setTimeout(() => {
      if (outcome === 'connected') toast.success('Slack connected.');
      else toast.error(SLACK_ERRORS[reason] ?? 'Slack could not be connected.');
    }, 0);
    setParams({}, { replace: true });
  }, [params, setParams]);

  function handleDisconnect() {
    disconnect.mutate(undefined, {
      onSuccess: () => toast.success('Slack disconnected.'),
      onError: () => toast.error('Could not disconnect Slack.'),
    });
  }

  return (
    <div>
      <PageHeader title="Integrations" description="Connect the chat tools your organization uses for alerts." />

      {error ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold">Slack</h2>
                {slack?.connected && <Badge variant="green" label="Connected" />}
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {isLoading
                  ? 'Checking…'
                  : !slack?.available
                    ? "Slack isn't set up on this Pulse server yet."
                    : slack.connected
                      ? `Alerts and follow-up replies go to ${slack.teamName}${slack.connectedAt ? ` · connected ${formatDateTime(slack.connectedAt)}` : ''}.`
                      : "Send alerts to your organization's own Slack workspace and answer follow-ups in the thread."}
              </p>
            </div>
          </div>

          {!isLoading && slack?.available && (
            slack.connected ? (
              <Button variant="secondary" loading={disconnect.isPending} onClick={handleDisconnect}>
                Disconnect
              </Button>
            ) : (
              <Button loading={connect.isPending} onClick={() => connect.mutate(undefined, {
                onError: () => toast.error('Could not start the Slack install.'),
              })}>
                Connect Slack
              </Button>
            )
          )}
        </Card>
      )}

      <div className="mt-4">
        <GoogleChatCard />
      </div>
    </div>
  );
}
