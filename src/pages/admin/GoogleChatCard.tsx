import { useState } from 'react';
import { Copy, MessagesSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  integrationKeys,
  useCreateGoogleChatLinkCode,
  useGoogleChatConnection,
  useUnlinkGoogleChatSpace,
} from '../../api/integrations';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import Button from '../../components/ui/Button';
import type { GoogleChatLinkCodeDto } from '../../types/api';

/**
 * Google Chat on the Integrations page. Every organization shares the one Pulse Chat app, so instead of an
 * install there's linking: a head gets a one-time code here and sends "@Pulse link CODE" in a space Pulse has
 * been added to, which links that space to the organization.
 */
export default function GoogleChatCard() {
  const qc = useQueryClient();
  const { data, isLoading, error, refetch } = useGoogleChatConnection();
  const createCode = useCreateGoogleChatLinkCode();
  const unlink = useUnlinkGoogleChatSpace();
  const [linkCode, setLinkCode] = useState<GoogleChatLinkCodeDto | null>(null);

  function startLinking() {
    createCode.mutate(undefined, {
      onSuccess: setLinkCode,
      onError: () => toast.error('Could not create a link code.'),
    });
  }

  function finishLinking() {
    setLinkCode(null);
    void qc.invalidateQueries({ queryKey: integrationKeys.googleChat() });
  }

  function copyCommand(command: string) {
    navigator.clipboard?.writeText(command).then(
      () => toast.success('Copied.'),
      () => toast.error('Could not copy — select the text instead.'),
    );
  }

  if (error) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
            <MessagesSquare className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Google Chat</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {isLoading
                ? 'Checking…'
                : !data?.available
                  ? "Google Chat isn't set up on this Pulse server yet."
                  : 'Send alerts to your Google Chat spaces and answer follow-ups in the thread.'}
            </p>
          </div>
        </div>
        {!isLoading && data?.available && !linkCode && (
          <Button loading={createCode.isPending} onClick={startLinking}>
            Link a space
          </Button>
        )}
      </div>

      {linkCode && (
        <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
          <p>Add Pulse to the space if it isn't there yet, then send this message in the space:</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="rounded bg-background px-2 py-1 font-mono text-sm" data-testid="link-command">
              {linkCode.command}
            </code>
            <Button variant="ghost" size="icon" aria-label="Copy" onClick={() => copyCommand(linkCode.command)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            The code works once and expires in 15 minutes. Pulse replies in the space when it's linked.
          </p>
          <Button className="mt-3" variant="secondary" size="sm" onClick={finishLinking}>
            Done
          </Button>
        </div>
      )}

      {!!data?.spaces.length && (
        <ul className="mt-4 divide-y divide-border border-t border-border">
          {data.spaces.map((space) => (
            <li key={space.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="truncate">{space.displayName}</span>
              <Button
                variant="ghost"
                size="sm"
                loading={unlink.isPending && unlink.variables === space.id}
                onClick={() =>
                  unlink.mutate(space.id, {
                    onSuccess: () => toast.success(`Unlinked ${space.displayName}.`),
                    onError: () => toast.error('Could not unlink the space.'),
                  })
                }
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
