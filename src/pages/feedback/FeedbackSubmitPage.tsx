import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { MessageSquare, ShieldCheck } from 'lucide-react';
import { useSubmitFeedback } from '../../api/feedback';
import { applyServerErrors } from '../../lib/formErrors';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';

interface FormValues { text: string; }

export default function FeedbackSubmitPage() {
  const { mutate, isPending } = useSubmitFeedback();
  const { register, handleSubmit, setError, reset, formState: { errors } } = useForm<FormValues>();

  const onSubmit = handleSubmit((values) => {
    mutate(values, {
      onSuccess: () => { toast.success('Feedback submitted.'); reset(); },
      onError:   (e) => applyServerErrors(e, setError),
    });
  });

  return (
    <div className="max-w-lg">
      <PageHeader title="Submit feedback" />

      <Card className="mb-4 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
            <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">Privacy notice</p>
        </div>
        <div className="px-5 py-4 text-sm text-muted-foreground">
          Your feedback is readable only by department heads and HR. This restriction is technically enforced at the API level — no one else can access the raw text, including project managers.
        </div>
      </Card>

      <Card className="overflow-hidden">
        <form onSubmit={onSubmit}>
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <MessageSquare className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Your feedback</p>
            <span className="ml-auto text-xs text-destructive">required</span>
          </div>
          <div className="px-5 py-5">
            <Textarea
              rows={6}
              {...register('text', { required: 'Feedback text is required' })}
              placeholder="Share anything on your mind — team dynamics, process, workload, concerns…"
            />
            {errors.text && <p className="mt-1.5 text-xs text-destructive">{errors.text.message}</p>}
          </div>
          <div className="border-t border-border bg-muted/30 px-4 py-3">
            <Button type="submit" loading={isPending}>Submit feedback</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
