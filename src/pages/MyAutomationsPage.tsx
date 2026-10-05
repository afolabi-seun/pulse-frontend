import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { ArrowRightLeft, Trash2 } from 'lucide-react';
import { useMyAutomationRules, useCreateAutomationRule, useUpdateAutomationRule, useDeleteAutomationRule } from '../api/automationRules';
import { useTeamList } from '../api/teams';
import { applyServerErrors } from '../lib/formErrors';
import { formatDateTime } from '../lib/dates';
import { cn } from '@/lib/utils';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../components/ui/ErrorState';
import type { AutomationRuleDto } from '../types/api';

interface FormValues {
  name: string;
  teamId: string;
  thresholdDays: string;
}

const DEFAULT_VALUES: FormValues = { name: '', teamId: '', thresholdDays: '5' };

export default function MyAutomationsPage() {
  const { data: rules, isLoading, error, refetch } = useMyAutomationRules();
  const { data: teams } = useTeamList();

  const createRule = useCreateAutomationRule();
  const deleteRule = useDeleteAutomationRule();

  const [showCreate, setShowCreate] = useState(false);

  const { register, control, handleSubmit, reset, setError, formState: { errors } } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = handleSubmit((values) => {
    createRule.mutate(
      { name: values.name, teamId: values.teamId, thresholdDays: Number(values.thresholdDays) },
      {
        onSuccess: () => { toast.success('Automation created.'); reset(DEFAULT_VALUES); setShowCreate(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  if (isLoading) return <TablePageSkeleton />;
  if (error)      return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My Automations"
        description="Automatically reassign a task to your team lead once it's sat blocked for too long."
        actions={<Button size="sm" onClick={() => setShowCreate((v) => !v)}>New automation</Button>}
      />

      {showCreate && (
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">New automation</p>
        </div>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...register('name', { required: 'Name is required' })} placeholder="e.g. Reassign stuck tasks after a week" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Team <span className="text-destructive">*</span></Label>
                <Controller
                  name="teamId"
                  control={control}
                  rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Search teams…"
                      emptyLabel="No matches"
                      options={(teams ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))}
                    />
                  )}
                />
                {errors.teamId && <p className="text-xs text-destructive">{errors.teamId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Reassign after (days blocked) <span className="text-destructive">*</span></Label>
                <Input type="number" min={1} step={1} {...register('thresholdDays', { required: 'Required' })} placeholder="e.g. 5" />
                {errors.thresholdDays && <p className="text-xs text-destructive">{errors.thresholdDays.message}</p>}
              </div>
            </div>

            <p className="-mt-2 text-xs text-muted-foreground">
              Only reassigns tasks whose current assignee is on this team, and only ones not already
              assigned to the team lead. Every reassignment is logged and notified to both the lead
              and the previous assignee.
            </p>

            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          </div>
          <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            <Button size="sm" type="submit" loading={createRule.isPending}>Create automation</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setShowCreate(false); reset(DEFAULT_VALUES); }}>Cancel</Button>
          </div>
        </form>
      </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <ArrowRightLeft className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Your automations</h2>
          {(rules?.length ?? 0) > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{rules!.length}</span>
          )}
        </div>
        {(rules?.length ?? 0) === 0 ? (
          <EmptyState
            icon={ArrowRightLeft}
            title="No automations yet"
            description="Create one to auto-reassign blocked tasks off a stuck engineer."
            action={<Button size="sm" onClick={() => setShowCreate(true)}>New automation</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rules!.map((rule) => (
              <AutomationRuleRow key={rule.id} rule={rule} onDelete={() => deleteRule.mutate(rule.id, { onSuccess: () => toast.success('Automation deleted.') })} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AutomationRuleRow({ rule, onDelete }: { rule: AutomationRuleDto; onDelete: () => void }) {
  const updateRule = useUpdateAutomationRule(rule.id);

  return (
    <li className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40', !rule.isActive && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge label={rule.teamName ?? 'Unknown team'} variant="gray" />
          <span className="text-xs text-muted-foreground">
            reassigns to the team lead after {rule.thresholdDays}+ days blocked
          </span>
          <span className="text-xs text-muted-foreground">· created {formatDateTime(rule.createdAt)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Switch
          checked={rule.isActive}
          aria-label={`${rule.isActive ? 'Deactivate' : 'Activate'} ${rule.name}`}
          onChange={(e) => updateRule.mutate({
            name: rule.name, thresholdDays: rule.thresholdDays, isActive: e.target.checked,
          })}
        />
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={`Delete ${rule.name}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
