import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { MessageCircle, SmilePlus } from 'lucide-react';
import { useSubmitVitals, useVitalsList, useDeleteVitals, scoreBadgeClass } from '../api/vitals';
import { applyServerErrors } from '../lib/formErrors';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { weekLabel, todayIso, getWeekStart } from '../lib/dates';

const SCORE_LABELS: Record<number, string> = {
  1: 'Struggling', 2: 'Below par', 3: 'OK', 4: 'Good', 5: 'Great',
};

interface FormValues { score: number; comment: string; }

const HISTORY_PAGE = 5;

export default function VitalsPage() {
  const { mutate, isPending } = useSubmitVitals();
  const { data: history, isLoading } = useVitalsList();
  const deleteVitals = useDeleteVitals();
  const [selected, setSelected] = useState<number>(0);
  const [showAll, setShowAll] = useState(false);

  const { register, handleSubmit, setValue, setError, reset, formState: { errors } } = useForm<FormValues>();

  const weekStart  = getWeekStart(todayIso());
  const alreadyThisWeek = history?.find((p) => p.weekOf === weekStart);

  const onSubmit = handleSubmit((values) => {
    mutate(
      { score: Number(values.score), comment: values.comment || undefined },
      {
        onSuccess: () => { toast.success('Vitals submitted.'); reset(); setSelected(0); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  if (isLoading) return <CardListSkeleton count={3} hasAction={false} />;

  return (
    <div className="max-w-lg space-y-4">
      <PageHeader title="Weekly vitals" description="How are you feeling this week?" />

      {alreadyThisWeek ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col items-center border-b border-border px-6 py-6 text-center">
            <div className={cn(
              'mb-3 flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold',
              scoreBadgeClass(alreadyThisWeek.score),
            )}>
              {alreadyThisWeek.score}
            </div>
            <p className="font-semibold text-foreground">{SCORE_LABELS[alreadyThisWeek.score]}</p>
            <p className="mt-1 text-sm text-muted-foreground">Vitals submitted this week</p>
          </div>
          {alreadyThisWeek.comment && (
            <div className="px-6 py-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Comment</p>
              <p className="text-sm text-foreground">{alreadyThisWeek.comment}</p>
            </div>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <form onSubmit={onSubmit}>
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <SmilePlus className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">How are you feeling this week?</p>
              <span className="ml-auto text-xs text-destructive">required</span>
            </div>
            <div className="px-5 py-5">
              <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n} type="button"
                    onClick={() => { setSelected(n); setValue('score', n); }}
                    className={cn(
                      'flex flex-col items-center rounded-lg border py-3 text-sm font-medium transition-colors',
                      selected === n
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                    )}
                  >
                    <span className="text-lg font-bold">{n}</span>
                    <span className="mt-0.5 text-[10px]">{SCORE_LABELS[n]}</span>
                  </button>
                ))}
              </div>
              <input type="hidden" {...register('score', { required: 'Please select a score', min: 1, max: 5 })} />
              {errors.score && <p className="mt-2 text-xs text-destructive">{errors.score.message}</p>}
            </div>

            <div className="flex items-center gap-2.5 border-y border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Comment</p>
              <span className="ml-auto text-xs text-muted-foreground">optional</span>
            </div>
            <div className="px-5 py-5">
              <Textarea rows={3} {...register('comment')} placeholder="Anything you'd like to add?" />
            </div>

            <div className="border-t border-border bg-muted/30 px-4 py-3">
              <Button type="submit" loading={isPending}>Submit vitals</Button>
            </div>
          </form>
        </Card>
      )}

      {history && history.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold text-foreground">Past responses</h2>
          <Card className="divide-y divide-border overflow-hidden p-0">
            {(showAll ? history : history.slice(0, HISTORY_PAGE)).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                <div className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                  scoreBadgeClass(p.score),
                )}>
                  {p.score}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{SCORE_LABELS[p.score]}</p>
                  {p.comment && <p className="truncate text-xs text-muted-foreground">{p.comment}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{weekLabel(p.weekOf)}</span>
                <button
                  onClick={() => deleteVitals.mutate(p.id, { onSuccess: () => toast.success('Vitals deleted.') })}
                  disabled={deleteVitals.isPending}
                  className="shrink-0 text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ))}
            {history.length > HISTORY_PAGE && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="w-full px-4 py-2.5 text-center text-xs font-medium text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors"
              >
                {showAll ? 'Show less' : `Show ${history.length - HISTORY_PAGE} more`}
              </button>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
