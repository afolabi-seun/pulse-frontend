import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { BellRing, Trash2 } from 'lucide-react';
import { useMyAlertRules, useCreateAlertRule, useUpdateAlertRule, useDeleteAlertRule, useGoogleChatSpaces } from '../api/alertRules';
import { useTeamList } from '../api/teams';
import { useProjectList, useMyProjects } from '../api/projects';
import { useAuth } from '../hooks/useAuth';
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
import type { AlertMetric, AlertScopeType, AlertComparator, AlertRuleDto } from '../types/api';

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

const METRICS: { value: AlertMetric; label: string; scopeType: AlertScopeType; unit: string }[] = [
  { value: 'blockerCount',             label: 'Blocker count',                            scopeType: 'team',    unit: 'blockers' },
  { value: 'blockerCountChange',       label: 'Blocker count change (week-over-week)',     scopeType: 'team',    unit: '%' },
  { value: 'teamVelocity',             label: 'Team velocity (week)',                      scopeType: 'team',    unit: 'points' },
  { value: 'teamVelocityChange',       label: 'Team velocity change (week-over-week)',     scopeType: 'team',    unit: '%' },
  { value: 'checkInCompliance',        label: 'Check-in compliance',                       scopeType: 'team',    unit: '%' },
  { value: 'checkInComplianceChange',  label: 'Check-in compliance change (week-over-week)', scopeType: 'team',  unit: '%' },
  { value: 'qaRejectRate',             label: 'QA reject rate (30d)',                      scopeType: 'project', unit: '%' },
  { value: 'qaRejectRateChange',       label: 'QA reject rate change (week-over-week)',    scopeType: 'project', unit: '%' },
];
// BlockerCount/BlockerCountChange are the metrics valid for either scope — project-scoped
// variants, listed separately so the Metric dropdown can drive the Scope picker without a runtime branch.
const PROJECT_METRICS: { value: AlertMetric; label: string; scopeType: AlertScopeType; unit: string }[] = [
  { value: 'blockerCount', label: 'Blocker count', scopeType: 'project', unit: 'blockers' },
  { value: 'blockerCountChange', label: 'Blocker count change (week-over-week)', scopeType: 'project', unit: '%' },
  ...METRICS.filter((m) => m.scopeType === 'project'),
];

const METRIC_LABEL: Record<AlertMetric, string> = {
  blockerCount: 'Blocker count', teamVelocity: 'Team velocity', teamVelocityChange: 'Team velocity change',
  checkInCompliance: 'Check-in compliance', qaRejectRate: 'QA reject rate',
  blockerCountChange: 'Blocker count change', checkInComplianceChange: 'Check-in compliance change',
  qaRejectRateChange: 'QA reject rate change',
};

interface FormValues {
  name: string;
  metric: AlertMetric;
  scopeType: AlertScopeType;
  scopeId: string;
  comparator: AlertComparator;
  threshold: string;
  deliverInApp: boolean;
  deliverEmail: boolean;
  deliverWebhook: boolean;
  webhookUrl: string;
  slackChannel: string;
  googleChatSpaceId: string;
}

const CHANGE_METRICS: AlertMetric[] = ['teamVelocityChange', 'blockerCountChange', 'checkInComplianceChange', 'qaRejectRateChange'];

export default function MyAlertsPage() {
  const { allow } = useAuth();
  const isPmOrAbove = allow('pm-or-above');
  const { data: rules, isLoading, error, refetch } = useMyAlertRules();
  const { data: teams } = useTeamList();
  const { data: allProjects } = useProjectList(isPmOrAbove);
  const { data: myProjects } = useMyProjects(!isPmOrAbove);
  const projects = isPmOrAbove ? allProjects : myProjects;
  const { data: googleChatSpaces } = useGoogleChatSpaces();

  const createRule = useCreateAlertRule();
  const deleteRule = useDeleteAlertRule();

  const [showCreate, setShowCreate] = useState(false);

  const DEFAULT_VALUES = { scopeType: 'team' as const, comparator: 'greaterThan' as const, deliverInApp: true, deliverEmail: false, deliverWebhook: false, webhookUrl: '', slackChannel: '', googleChatSpaceId: '' };
  const { register, control, handleSubmit, watch, reset, setError, formState: { errors } } = useForm<FormValues>({
    defaultValues: DEFAULT_VALUES,
  });

  const scopeType = watch('scopeType');
  const deliverWebhook = watch('deliverWebhook');
  const metric = watch('metric');
  const metricOptions = scopeType === 'team' ? METRICS : PROJECT_METRICS;

  const onSubmit = handleSubmit((values) => {
    createRule.mutate(
      {
        name: values.name,
        metric: values.metric,
        scopeType: values.scopeType,
        scopeId: values.scopeId,
        comparator: values.comparator,
        threshold: Number(values.threshold),
        deliverInApp: values.deliverInApp,
        deliverEmail: values.deliverEmail,
        deliverWebhook: values.deliverWebhook,
        webhookUrl: values.deliverWebhook ? values.webhookUrl : undefined,
        slackChannel: values.deliverWebhook ? values.slackChannel || undefined : undefined,
        googleChatSpaceId: values.deliverWebhook ? values.googleChatSpaceId || undefined : undefined,
      },
      {
        onSuccess: () => { toast.success('Alert rule created.'); reset(DEFAULT_VALUES); setShowCreate(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  if (isLoading) return <TablePageSkeleton />;
  if (error)      return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="My Alerts"
        description="Get notified when a metric you watch crosses a threshold you set."
        actions={<Button size="sm" onClick={() => setShowCreate((v) => !v)}>New alert</Button>}
      />

      {showCreate && (
      <Card className="mb-5 overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <BellRing className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">New alert rule</p>
        </div>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...register('name', { required: 'Name is required' })} placeholder="e.g. Too many blockers on Finsys CBS" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Watch</Label>
                <select {...register('scopeType')} className={SELECT_CLS}>
                  <option value="team">A team</option>
                  <option value="project">A project</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>{scopeType === 'team' ? 'Team' : 'Project'} <span className="text-destructive">*</span></Label>
                <Controller
                  name="scopeId"
                  control={control}
                  rules={{ required: 'Required' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder={scopeType === 'team' ? 'Search teams…' : 'Search projects…'}
                      emptyLabel="No matches"
                      options={
                        scopeType === 'team'
                          ? (teams ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))
                          : (projects ?? []).map((p) => ({ value: p.id, label: p.name }))
                      }
                    />
                  )}
                />
                {errors.scopeId && <p className="text-xs text-destructive">{errors.scopeId.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Metric</Label>
                <select {...register('metric')} className={SELECT_CLS}>
                  {metricOptions.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Condition</Label>
                <select {...register('comparator')} className={SELECT_CLS}>
                  <option value="greaterThan">Goes above</option>
                  <option value="lessThan">Drops below</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Threshold <span className="text-destructive">*</span></Label>
                <Input type="number" step="any" {...register('threshold', { required: 'Required' })} placeholder="e.g. 5" />
                {errors.threshold && <p className="text-xs text-destructive">{errors.threshold.message}</p>}
              </div>
            </div>
            {CHANGE_METRICS.includes(metric) && (
              <p className="-mt-2 text-xs text-muted-foreground">
                A signed percentage vs. ~7 days ago. E.g. "Drops below" with threshold <span className="font-mono">-40</span> catches a 40%+ drop.
              </p>
            )}

            <div className="space-y-1.5">
              <Label>Notify me by</Label>
              <div className="flex items-center gap-5 pt-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...register('deliverInApp')} />
                  <span className="text-sm text-foreground">In-app</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...register('deliverEmail')} />
                  <span className="text-sm text-foreground">Email</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...register('deliverWebhook')} />
                  <span className="text-sm text-foreground">Slack / Webhook</span>
                </label>
              </div>
              {deliverWebhook && (
                <div className="pt-2">
                  <Input
                    {...register('webhookUrl', { required: deliverWebhook ? 'A webhook URL is required' : false })}
                    placeholder="https://hooks.slack.com/services/…"
                  />
                  {errors.webhookUrl && <p className="mt-1 text-xs text-destructive">{errors.webhookUrl.message}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    A Slack incoming webhook URL, or any other webhook endpoint. Slack is detected automatically from the URL for full formatting; anything else receives a plain JSON payload.
                  </p>
                  <div className="mt-3">
                    <Input {...register('slackChannel')} placeholder="#team-alerts (optional)" />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Set a Slack channel to let alerts post as a thread you can ask follow-up questions in —
                      requires a Slack bot to be configured for this workspace. Leave blank to keep this a one-way webhook.
                    </p>
                  </div>
                  <div className="mt-3">
                    <Controller
                      name="googleChatSpaceId"
                      control={control}
                      render={({ field }) => (
                        <SearchableSelect
                          value={field.value ?? ''}
                          onChange={field.onChange}
                          placeholder="Google Chat space (optional)…"
                          emptyLabel={(googleChatSpaces?.length ?? 0) === 0 ? 'No Google Chat spaces yet — add the app to one first' : 'No matches'}
                          options={(googleChatSpaces ?? []).map((s) => ({ value: s.spaceId, label: s.displayName }))}
                        />
                      )}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Same idea as the Slack channel above, for Google Chat — only spaces the Pulse
                      app has already been added to appear here. Leave unset to keep this a one-way webhook.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          </div>
          <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            <Button size="sm" type="submit" loading={createRule.isPending}>Create alert</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setShowCreate(false); reset(DEFAULT_VALUES); }}>Cancel</Button>
          </div>
        </form>
      </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <BellRing className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-semibold text-foreground">Your alerts</h2>
          {(rules?.length ?? 0) > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{rules!.length}</span>
          )}
        </div>
        {(rules?.length ?? 0) === 0 ? (
          <EmptyState
            icon={BellRing}
            title="No alert rules yet"
            description="Create one to get notified when a metric crosses a threshold."
            action={<Button size="sm" onClick={() => setShowCreate(true)}>New alert</Button>}
          />
        ) : (
          <ul className="divide-y divide-border">
            {rules!.map((rule) => (
              <AlertRuleRow key={rule.id} rule={rule} onDelete={() => deleteRule.mutate(rule.id, { onSuccess: () => toast.success('Alert rule deleted.') })} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function AlertRuleRow({ rule, onDelete }: { rule: AlertRuleDto; onDelete: () => void }) {
  const updateRule = useUpdateAlertRule(rule.id);
  const metricDef = [...METRICS, ...PROJECT_METRICS].find((m) => m.value === rule.metric);
  const comparatorLabel = rule.comparator === 'greaterThan' ? 'goes above' : 'drops below';
  const channels = [
    rule.deliverInApp && 'In-app',
    rule.deliverEmail && 'Email',
    rule.deliverWebhook && 'Slack/Webhook',
  ].filter((c): c is string => !!c);

  return (
    <li className={cn('flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/40', !rule.isActive && 'opacity-60')}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{rule.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Badge label={rule.scopeName ?? 'Unknown'} variant="gray" />
          <span className="text-xs text-muted-foreground">
            {METRIC_LABEL[rule.metric]} {comparatorLabel} {rule.threshold}{metricDef?.unit === '%' ? '%' : ` ${metricDef?.unit ?? ''}`}
          </span>
          {channels.map((c) => <Badge key={c} label={c} variant="blue" />)}
          {rule.lastTriggeredAt && (
            <span className="text-xs text-muted-foreground">· fired {formatDateTime(rule.lastTriggeredAt)}</span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Switch
          checked={rule.isActive}
          aria-label={`${rule.isActive ? 'Deactivate' : 'Activate'} ${rule.name}`}
          onChange={(e) => updateRule.mutate({
            name: rule.name, comparator: rule.comparator, threshold: rule.threshold,
            deliverInApp: rule.deliverInApp, deliverEmail: rule.deliverEmail, isActive: e.target.checked,
            // Always pass the rule's current webhook config through — the update command
            // defaults deliverWebhook/webhookUrl/slackChannel/googleChatSpaceId to false/null
            // when omitted, so leaving these out here would silently clear a configured webhook
            // on every Active toggle.
            deliverWebhook: rule.deliverWebhook, webhookUrl: rule.webhookUrl ?? undefined,
            slackChannel: rule.slackChannel ?? undefined, googleChatSpaceId: rule.googleChatSpaceId ?? undefined,
          })}
        />
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive transition-colors" aria-label={`Delete ${rule.name}`}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  );
}
