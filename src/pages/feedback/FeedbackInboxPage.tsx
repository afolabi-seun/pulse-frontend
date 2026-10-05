import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { useFeedbackList, useFeedbackPatterns, useDeleteFeedback, useReplyToFeedback } from '../../api/feedback';
import { useAuth } from '../../hooks/useAuth';
import { useEngineerList } from '../../api/engineers';
import PageHeader from '../../components/layout/PageHeader';
import { MessageSquare, Reply, X } from 'lucide-react';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import FeedbackPatternsPanel from '../../components/feedback/FeedbackPatternsPanel';
import Button from '../../components/ui/Button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDate, weekLabel } from '../../lib/dates';
import type { FeedbackDto } from '../../types/api';

type Tab = 'entries' | 'patterns';

// The 'patterns' tab's internal value stays as-is (it's threaded through focusWeek/setTab logic
// elsewhere), but it's shown to the user as "Weekly trends" — "Patterns" reads as "recurring
// themes in what people said," which this tab doesn't do; it's a volume/participation rollup.
const TAB_LABELS: Record<Tab, string> = { entries: 'Entries', patterns: 'Weekly trends' };

const WEEKS_CAP = 8;

export default function FeedbackInboxPage() {
  const [tab, setTab] = useState<Tab>('entries');
  const [showAllWeeks, setShowAllWeeks] = useState(false);
  // Set by clicking a week in Patterns: the Entries tab then shows just that week.
  const [focusWeek, setFocusWeek] = useState<string | null>(null);
  const { currentUser, allow } = useAuth();

  const { data: entries,  isLoading: loadingEntries,  error: errorEntries,  refetch: refetchEntries  } = useFeedbackList();
  const { data: patterns, isLoading: loadingPatterns, error: errorPatterns, refetch: refetchPatterns } = useFeedbackPatterns();
  const deleteFeedback = useDeleteFeedback();
  const replyToFeedback = useReplyToFeedback();
  const { data: engineers } = useEngineerList();

  const engNameMap = new Map(engineers?.map((e) => [e.id, e.name]) ?? []);
  const isHead     = allow('any-head');
  // HR sees every department's feedback (org-wide, per ListFeedbackHandler), not just their own —
  // the empty-state copy below should say so rather than implying a department scope that doesn't
  // apply to them.
  const scopeLabel = isHead ? 'your department' : 'your organization';

  const groupedByWeek = useMemo(() => {
    const map = new Map<string, FeedbackDto[]>();
    for (const f of (entries ?? [])) {
      const group = map.get(f.weekOf) ?? [];
      group.push(f);
      map.set(f.weekOf, group);
    }
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);
  const visibleWeeks = focusWeek ? groupedByWeek.filter(([week]) => week === focusWeek) : groupedByWeek;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Feedback inbox" />

      {/* Tabs */}
      <div className="mb-5 flex border-b border-border">
        {(['entries', 'patterns'] as Tab[]).map((t) => (
          <button
            key={t}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            onClick={() => { setTab(t); if (t === 'patterns') setFocusWeek(null); }}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'entries' && (
        <>
          {loadingEntries && <TablePageSkeleton cols={4} hasAction={false} />}
          {errorEntries   && <ErrorState error={errorEntries} onRetry={refetchEntries} />}
          {focusWeek && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <span>Showing only <span className="font-medium text-foreground">{weekLabel(focusWeek)}</span></span>
              <button type="button" onClick={() => setFocusWeek(null)} className="ml-auto flex items-center gap-1 font-medium text-primary hover:underline">
                <X className="h-3 w-3" /> Show all weeks
              </button>
            </div>
          )}
          {!loadingEntries && !errorEntries && (
            visibleWeeks.length === 0
              ? <EmptyState icon={MessageSquare} title="No feedback yet" description={`Submitted feedback from ${scopeLabel} will appear here.`} />
              : (
                <div className="space-y-8">
                  {(showAllWeeks || focusWeek ? visibleWeeks : visibleWeeks.slice(0, WEEKS_CAP)).map(([week, weekEntries]) => (
                    <section key={week}>
                      <div className="mb-3 flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                          <MessageSquare className="h-4 w-4 text-primary" />
                        </div>
                        <h2 className="text-sm font-semibold text-foreground">{weekLabel(week)}</h2>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          {weekEntries.length}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {weekEntries.map((f) => (
                          <FeedbackCard
                            key={f.id}
                            entry={f}
                            engName={engNameMap.get(f.engineerId)}
                            isHead={isHead}
                            isOwn={currentUser?.id === f.engineerId}
                            onDelete={() => deleteFeedback.mutate(f.id, { onSuccess: () => toast.success('Feedback deleted.') })}
                            deleteLoading={deleteFeedback.isPending}
                            onReply={(text) => replyToFeedback.mutate({ id: f.id, text }, {
                              onSuccess: () => toast.success('Reply sent.'),
                              onError:   (e) => toast.error(e instanceof Error ? e.message : 'Failed to send reply.'),
                            })}
                            replyLoading={replyToFeedback.isPending}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                  {!showAllWeeks && !focusWeek && groupedByWeek.length > WEEKS_CAP && (
                    <button
                      type="button"
                      onClick={() => setShowAllWeeks(true)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Show more weeks ({groupedByWeek.length - WEEKS_CAP} older)
                    </button>
                  )}
                </div>
              )
          )}
        </>
      )}

      {tab === 'patterns' && (
        <>
          {loadingPatterns && <TablePageSkeleton cols={3} hasAction={false} />}
          {errorPatterns   && <ErrorState error={errorPatterns} onRetry={refetchPatterns} />}
          {!loadingPatterns && !errorPatterns && patterns && (
            <FeedbackPatternsPanel
              patterns={patterns}
              onOpenWeek={(week) => { setFocusWeek(week); setTab('entries'); }}
            />
          )}
        </>
      )}
    </div>
  );
}

function FeedbackCard({ entry, engName, isHead, isOwn, onDelete, deleteLoading, onReply, replyLoading }: {
  entry: FeedbackDto;
  engName: string | undefined;
  isHead: boolean;
  isOwn: boolean;
  onDelete: () => void;
  deleteLoading: boolean;
  onReply: (text: string) => void;
  replyLoading: boolean;
}) {
  const [isReplying, setIsReplying] = useState(false);
  const [draft, setDraft] = useState('');

  const initials = engName
    ? engName.split(' ').slice(0, 2).map((n: string) => n[0]).join('').toUpperCase()
    : '?';

  const startReply = () => { setDraft(entry.replyText ?? ''); setIsReplying(true); };

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-2.5">
        {isHead && engName && (
          <>
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {initials}
            </div>
            <span className="text-sm font-medium text-foreground">{engName}</span>
            <span className="text-xs text-muted-foreground">·</span>
          </>
        )}
        <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
        {isOwn && (
          <button
            onClick={onDelete}
            disabled={deleteLoading}
            className="ml-auto text-xs text-destructive hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>
      <div className="px-4 py-3">
        <p className="whitespace-pre-wrap text-sm text-foreground">{entry.text}</p>
      </div>

      {isHead && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          {entry.replyText && !isReplying && (
            <div className="mb-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="text-xs font-medium text-primary">
                Your reply{entry.repliedByName && entry.repliedByName !== engName ? ` (${entry.repliedByName})` : ''}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{entry.replyText}</p>
            </div>
          )}

          {isReplying ? (
            <div className="space-y-2">
              <Textarea
                rows={3}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Write a private reply — only the submitter will see this."
                className="text-sm"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!draft.trim()}
                  loading={replyLoading}
                  onClick={() => { onReply(draft.trim()); setIsReplying(false); }}
                >
                  {entry.replyText ? 'Update reply' : 'Send reply'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setIsReplying(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startReply}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              <Reply className="h-3.5 w-3.5" />
              {entry.replyText ? 'Edit reply' : 'Reply privately'}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
