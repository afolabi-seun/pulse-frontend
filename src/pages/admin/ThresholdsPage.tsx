import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Activity, AlertTriangle, AlertCircle, Plus, Trash2, BarChart2, Flag, CheckSquare, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import HelpTooltip from '../../components/ui/HelpTooltip';
import { useThresholds, useUpdateThresholds, useDepartmentThresholds, useUpsertDepartmentThreshold, useDeleteDepartmentThreshold } from '../../api/thresholds';
import { useTeamList } from '../../api/teams';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import PageHeader from '../../components/layout/PageHeader';
import Button from '../../components/ui/Button';
import { FormPageSkeleton, Skeleton } from '@/components/ui/skeleton';
import ErrorState from '../../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ThresholdsDto, PointScaleEntryDto, PriorityScaleEntryDto, DepartmentThresholdDto } from '../../types/api';

type NumericThresholdKey = Exclude<keyof ThresholdsDto, 'pointScale' | 'priorityScale'>;
type FieldMeta = { key: NumericThresholdKey; label: string; description: string; step: string };

const OVERWORK_FIELDS: FieldMeta[] = [
  { key: 'loadVsBaselineRatio',   label: 'Load vs baseline ratio',   description: 'Active task points ÷ baseline points. Trips above this value. Default: 1.3.',                              step: '0.05' },
  { key: 'maxConcurrentTasks',    label: 'Max concurrent tasks',     description: 'Trips when the engineer has more active tasks than this. Default: 3.',                                       step: '1'    },
  { key: 'staleCycleMultiplier',  label: 'Stale cycle multiplier',   description: "Trips when an in-progress task exceeds this multiple of the engineer's baseline cycle days. Default: 1.5.", step: '0.1'  },
  { key: 'signalsRequiredToFlag', label: 'Signals required to flag', description: 'How many of the 3 signals must trip before flagging overwork. Default: 2.',                                 step: '1'    },
];

const T3_FIELDS: FieldMeta[] = [
  { key: 'escalationT3Days',       label: 'Days floor',          description: 'Absolute days-remaining floor for the T-3 warning. Default: 3.',                                                           step: '0.5'  },
  { key: 'escalationT3ElapsedPct', label: 'Elapsed % floor',     description: 'Proportional elapsed-time floor (0–1). T-3 fires at the later of this fraction elapsed or the days floor. Default: 0.60.', step: '0.05' },
  { key: 'escalationT3MinHours',   label: 'Min remaining hours', description: "Suppress the T-3 alert if fewer than this many hours remain. Default: 2.",                                                 step: '0.5'  },
];

const T1_FIELDS: FieldMeta[] = [
  { key: 'escalationT1Days',       label: 'Days floor',          description: 'Absolute days-remaining floor for the T-1 off-ramp prompt. Default: 1.',                                                    step: '0.5'  },
  { key: 'escalationT1ElapsedPct', label: 'Elapsed % floor',     description: 'Proportional elapsed-time floor (0–1). T-1 fires at the later of this fraction elapsed or the days floor. Default: 0.85.', step: '0.05' },
  { key: 'escalationT1MinHours',   label: 'Min remaining hours', description: "Suppress the T-1 alert if fewer than this many hours remain. Default: 1.",                                                  step: '0.5'  },
];

const QA_FIELDS: FieldMeta[] = [
  { key: 'qaLeadTimeDays', label: 'QA lead time (business days)', description: 'When a task is sent to QA, its review task gets this many business days from today as its due date — independent of the original task\'s due date. Default: 2.', step: '1' },
];

function ThresholdCard({
  icon: Icon, iconBg, iconCls, title, description, fields, register, values, readOnly,
}: {
  icon: LucideIcon;
  iconBg: string;
  iconCls: string;
  title: string;
  description: string;
  fields: FieldMeta[];
  register: ReturnType<typeof useForm<ThresholdsDto>>['register'];
  values?: ThresholdsDto;
  readOnly: boolean;
}) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-start gap-2.5 border-b border-border px-4 py-3">
        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconCls}`} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <CardContent className="space-y-5 p-5">
        {fields.map(({ key, label, description: desc }) => (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label>{label}</Label>
              <HelpTooltip title={label} body={desc} side="right" />
            </div>
            {readOnly ? (
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {values?.[key] ?? '—'}
              </p>
            ) : (
              <Input type="number" step={fields.find((f) => f.key === key)?.step} min={0} {...register(key)} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PointScaleCard({
  entries,
  onChange,
  readOnly,
}: {
  entries: PointScaleEntryDto[];
  onChange: (entries: PointScaleEntryDto[]) => void;
  readOnly: boolean;
}) {
  const update = (idx: number, field: keyof PointScaleEntryDto, val: string | number) => {
    const next = entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e));
    onChange(next);
  };

  const addRow = () =>
    onChange([...entries, { value: 0, label: '', timeGuide: '' }]);

  const removeRow = (idx: number) =>
    onChange(entries.filter((_, i) => i !== idx));

  return (
    <Card className="flex flex-col overflow-hidden col-span-full">
      <div className="flex items-start gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
          <BarChart2 className="h-4 w-4 text-violet-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Story point scale</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {readOnly
              ? 'The point scale used across Planning Poker and task estimates.'
              : 'Configure the values, labels, and time guides shown in Planning Poker. At least one entry required.'}
          </p>
        </div>
      </div>
      <CardContent className="p-4">
        {readOnly ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className="pb-2 pr-4 font-medium w-16">Points</th>
                <th className="pb-2 pr-4 font-medium">Label</th>
                <th className="pb-2 font-medium">Time guide</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.value} className="border-t border-border">
                  <td className="py-2 pr-4 font-semibold tabular-nums">{e.value}</td>
                  <td className="py-2 pr-4 text-foreground">{e.label}</td>
                  <td className="py-2 text-muted-foreground">{e.timeGuide}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[64px_1fr_1fr_32px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Points</span>
              <span>Label</span>
              <span>Time guide</span>
              <span />
            </div>
            {entries.map((e, idx) => (
              <div key={idx} className="grid grid-cols-[64px_1fr_1fr_32px] gap-2 items-center">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={e.value === 0 ? '' : e.value}
                  onChange={(ev) => update(idx, 'value', Number(ev.target.value))}
                  className="text-sm tabular-nums"
                />
                <Input
                  type="text"
                  value={e.label}
                  onChange={(ev) => update(idx, 'label', ev.target.value)}
                  placeholder="e.g. Small"
                  className="text-sm"
                />
                <Input
                  type="text"
                  value={e.timeGuide}
                  onChange={(ev) => update(idx, 'timeGuide', ev.target.value)}
                  placeholder="e.g. ~1 day"
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  disabled={entries.length <= 1}
                  className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                  title="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add value
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PriorityScaleCard({
  entries,
  onChange,
  readOnly,
}: {
  entries: PriorityScaleEntryDto[];
  onChange: (entries: PriorityScaleEntryDto[]) => void;
  readOnly: boolean;
}) {
  const update = (idx: number, field: keyof PriorityScaleEntryDto, val: string | number) => {
    const next = entries.map((e, i) => (i === idx ? { ...e, [field]: val } : e));
    onChange(next);
  };

  const addRow = () =>
    onChange([...entries, { value: 0, label: '', criteria: '' }]);

  const removeRow = (idx: number) =>
    onChange(entries.filter((_, i) => i !== idx));

  return (
    <Card className="flex flex-col overflow-hidden col-span-full">
      <div className="flex items-start gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-rose-50 dark:bg-rose-950/40">
          <Flag className="h-4 w-4 text-rose-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Priority scale</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {readOnly
              ? 'What each priority level means — shown as a tooltip wherever priority is set or displayed.'
              : 'Configure the label and criteria shown for each priority level (1–5). At least one entry required.'}
          </p>
        </div>
      </div>
      <CardContent className="p-4">
        {readOnly ? (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-muted-foreground text-xs">
                <th className="pb-2 pr-4 font-medium w-16">Level</th>
                <th className="pb-2 pr-4 font-medium">Label</th>
                <th className="pb-2 font-medium">Criteria</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.value} className="border-t border-border">
                  <td className="py-2 pr-4 font-semibold tabular-nums">P{e.value}</td>
                  <td className="py-2 pr-4 text-foreground">{e.label}</td>
                  <td className="py-2 text-muted-foreground">{e.criteria}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-[64px_1fr_2fr_32px] gap-2 text-xs font-medium text-muted-foreground">
              <span>Level</span>
              <span>Label</span>
              <span>Criteria</span>
              <span />
            </div>
            {entries.map((e, idx) => (
              <div key={idx} className="grid grid-cols-[64px_1fr_2fr_32px] gap-2 items-center">
                <Input
                  type="number"
                  min={1}
                  max={5}
                  step={1}
                  value={e.value === 0 ? '' : e.value}
                  onChange={(ev) => update(idx, 'value', Number(ev.target.value))}
                  className="text-sm tabular-nums"
                />
                <Input
                  type="text"
                  value={e.label}
                  onChange={(ev) => update(idx, 'label', ev.target.value)}
                  placeholder="e.g. Critical"
                  className="text-sm"
                />
                <Input
                  type="text"
                  value={e.criteria}
                  onChange={(ev) => update(idx, 'criteria', ev.target.value)}
                  placeholder="e.g. Blocking another team, a customer, or production"
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  disabled={entries.length <= 1}
                  className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                  title="Remove row"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline mt-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add value
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type DeptFields = Pick<DepartmentThresholdDto, 'loadVsBaselineRatio' | 'maxConcurrentTasks' | 'staleCycleMultiplier' | 'signalsRequiredToFlag'>;

function DepartmentThresholdRow({
  override, readOnly, onSave, onRemove, saving, removing,
}: {
  override: DepartmentThresholdDto;
  readOnly: boolean;
  onSave: (values: DeptFields) => void;
  onRemove: () => void;
  saving: boolean;
  removing: boolean;
}) {
  const [values, setValues] = useState<DeptFields>({
    loadVsBaselineRatio: override.loadVsBaselineRatio,
    maxConcurrentTasks: override.maxConcurrentTasks,
    staleCycleMultiplier: override.staleCycleMultiplier,
    signalsRequiredToFlag: override.signalsRequiredToFlag,
  });

  const field = (key: keyof DeptFields, step: string) =>
    readOnly ? (
      <span className="tabular-nums">{values[key] ?? <span className="text-muted-foreground">inherits</span>}</span>
    ) : (
      <Input
        type="number" step={step} min={0} placeholder="inherits"
        value={values[key] ?? ''}
        onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value === '' ? null : Number(e.target.value) }))}
        className="h-8 w-24 text-sm tabular-nums"
      />
    );

  return (
    <tr className="border-t border-border">
      <td className="py-2 pr-4 font-medium text-foreground">{override.department}</td>
      <td className="py-2 pr-4">{field('loadVsBaselineRatio', '0.05')}</td>
      <td className="py-2 pr-4">{field('maxConcurrentTasks', '1')}</td>
      <td className="py-2 pr-4">{field('staleCycleMultiplier', '0.1')}</td>
      <td className="py-2 pr-4">{field('signalsRequiredToFlag', '1')}</td>
      {!readOnly && (
        <td className="py-2">
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => onSave(values)} loading={saving}>Save</Button>
            <button
              type="button" onClick={onRemove} disabled={removing}
              className="flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
              title="Remove override — reverts to the global default"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

function DepartmentThresholdsCard({ readOnly }: { readOnly: boolean }) {
  const { data: overrides, isLoading } = useDepartmentThresholds();
  const { data: teams } = useTeamList();
  const upsert = useUpsertDepartmentThreshold();
  const remove = useDeleteDepartmentThreshold();
  const [newDept, setNewDept] = useState('');

  const knownDepartments = Array.from(
    new Set((teams ?? []).map((t) => t.department).filter((d): d is string => !!d)),
  ).sort();
  const overriddenDepts = new Set((overrides ?? []).map((o) => o.department));
  const addableDepartments = knownDepartments.filter((d) => !overriddenDepts.has(d));

  const addOverride = () => {
    if (!newDept) return;
    upsert.mutate(
      { department: newDept },
      { onSuccess: () => { toast.success(`Override added for ${newDept}.`); setNewDept(''); } },
    );
  };

  return (
    <Card className="flex flex-col overflow-hidden col-span-full">
      <div className="flex items-start gap-2.5 border-b border-border px-4 py-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-950/40">
          <Building2 className="h-4 w-4 text-blue-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Department overrides</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Overwork detection only — escalation timing and the point scale stay org-wide. A blank field inherits the global default above.
          </p>
        </div>
      </div>
      <CardContent className="p-4">
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (overrides?.length ?? 0) === 0 ? (
          <p className="py-2 text-center text-xs text-muted-foreground">No department overrides — every department uses the global default.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground text-xs">
                  <th className="pb-2 pr-4 font-medium">Department</th>
                  <th className="pb-2 pr-4 font-medium">Load ratio</th>
                  <th className="pb-2 pr-4 font-medium">Max concurrent</th>
                  <th className="pb-2 pr-4 font-medium">Stale multiplier</th>
                  <th className="pb-2 pr-4 font-medium">Signals to flag</th>
                  {!readOnly && <th className="pb-2 font-medium" />}
                </tr>
              </thead>
              <tbody>
                {overrides!.map((o) => (
                  <DepartmentThresholdRow
                    key={o.department}
                    override={o}
                    readOnly={readOnly}
                    saving={upsert.isPending}
                    removing={remove.isPending}
                    onSave={(values) => upsert.mutate(
                      { department: o.department, ...values },
                      { onSuccess: () => toast.success(`${o.department} override saved.`) },
                    )}
                    onRemove={() => remove.mutate(o.department, {
                      onSuccess: () => toast.success(`${o.department} override removed.`),
                    })}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!readOnly && addableDepartments.length > 0 && (
          <div className="mt-3 flex items-center gap-2">
            <select
              value={newDept}
              onChange={(e) => setNewDept(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Add department override…</option>
              {addableDepartments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <Button size="sm" variant="secondary" onClick={addOverride} disabled={!newDept} loading={upsert.isPending}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ThresholdsPage() {
  const { isHeadOfPmo: canEdit } = useCurrentRole();

  const { data: thresholds, isLoading, error, refetch } = useThresholds();
  const { mutate, isPending } = useUpdateThresholds();

  const { register, handleSubmit, reset, watch } = useForm<ThresholdsDto>();
  const [scaleEntries, setScaleEntries] = useState<PointScaleEntryDto[]>([]);
  const [priorityEntries, setPriorityEntries] = useState<PriorityScaleEntryDto[]>([]);

  useEffect(() => {
    if (thresholds) {
      reset(thresholds);
      setScaleEntries(thresholds.pointScale ?? []);
      setPriorityEntries(thresholds.priorityScale ?? []);
    }
  }, [thresholds, reset]);

  const t3Days = Number(watch('escalationT3Days') ?? thresholds?.escalationT3Days ?? 3);
  const t3Pct  = Number(watch('escalationT3ElapsedPct') ?? thresholds?.escalationT3ElapsedPct ?? 0.6);
  const t1Days = Number(watch('escalationT1Days') ?? thresholds?.escalationT1Days ?? 1);
  const t1Pct  = Number(watch('escalationT1ElapsedPct') ?? thresholds?.escalationT1ElapsedPct ?? 0.85);

  const t3Crossover = t3Pct < 1 ? t3Days / (1 - t3Pct) : null;
  const t1Crossover = t1Pct < 1 ? t1Days / (1 - t1Pct) : null;

  const onSubmit = handleSubmit((values) => {
    mutate(
      {
        loadVsBaselineRatio:    Number(values.loadVsBaselineRatio),
        maxConcurrentTasks:     Number(values.maxConcurrentTasks),
        staleCycleMultiplier:   Number(values.staleCycleMultiplier),
        signalsRequiredToFlag:  Number(values.signalsRequiredToFlag),
        escalationT3Days:       Number(values.escalationT3Days),
        escalationT3ElapsedPct: Number(values.escalationT3ElapsedPct),
        escalationT1Days:       Number(values.escalationT1Days),
        escalationT1ElapsedPct: Number(values.escalationT1ElapsedPct),
        escalationT3MinHours:   Number(values.escalationT3MinHours),
        escalationT1MinHours:   Number(values.escalationT1MinHours),
        qaLeadTimeDays:         Number(values.qaLeadTimeDays),
        pointScale:             scaleEntries,
        priorityScale:          priorityEntries,
      },
      { onSuccess: () => toast.success('Thresholds updated.') },
    );
  });

  if (isLoading) return <FormPageSkeleton fields={6} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const cardProps = { register, values: thresholds, readOnly: !canEdit };

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Threshold configuration"
        description={
          canEdit
            ? 'Overwork detection parameters. Changes take effect immediately.'
            : 'Overwork detection parameters. Contact the Head of PMO to make changes.'
        }
      />

      {!canEdit && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
          View only — only the Head of PMO can edit these values.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <ThresholdCard
            icon={Activity}
            iconBg="bg-primary/10"
            iconCls="text-primary"
            title="Overwork detection"
            description="Three independent signals. An engineer is flagged when the required number trip simultaneously."
            fields={OVERWORK_FIELDS}
            {...cardProps}
          />
          <ThresholdCard
            icon={AlertTriangle}
            iconBg="bg-amber-50 dark:bg-amber-950/40"
            iconCls="text-amber-500"
            title="T-3 early warning"
            description="Fires at the later of the absolute days-remaining floor and the proportional elapsed-time floor."
            fields={T3_FIELDS}
            {...cardProps}
          />
          <ThresholdCard
            icon={AlertCircle}
            iconBg="bg-red-50 dark:bg-red-950/40"
            iconCls="text-red-500"
            title="T-1 off-ramp"
            description="Fires at the later of the absolute days-remaining floor and the proportional elapsed-time floor."
            fields={T1_FIELDS}
            {...cardProps}
          />
          <ThresholdCard
            icon={CheckSquare}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconCls="text-emerald-500"
            title="QA hand-off"
            description="How long a QA review task has before it's due."
            fields={QA_FIELDS}
            {...cardProps}
          />
          <PointScaleCard
            entries={scaleEntries}
            onChange={setScaleEntries}
            readOnly={!canEdit}
          />
          <PriorityScaleCard
            entries={priorityEntries}
            onChange={setPriorityEntries}
            readOnly={!canEdit}
          />
          <DepartmentThresholdsCard readOnly={!canEdit} />
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
          <p className="mb-1 font-semibold">Live crossover</p>
          {t3Crossover !== null ? (
            <p>T-3: tasks shorter than <strong>{t3Crossover.toFixed(1)} days</strong> scale proportionally; longer tasks always get a fixed {t3Days}-day warning.</p>
          ) : (
            <p>T-3: elapsed % = 100% — threshold never reached proportionally.</p>
          )}
          {t1Crossover !== null ? (
            <p className="mt-1">T-1: tasks shorter than <strong>{t1Crossover.toFixed(1)} days</strong> scale proportionally; longer tasks always get a fixed {t1Days}-day off-ramp.</p>
          ) : (
            <p className="mt-1">T-1: elapsed % = 100% — threshold never reached proportionally.</p>
          )}
        </div>

        {canEdit && (
          <Button type="submit" loading={isPending}>Save thresholds</Button>
        )}
      </form>
    </div>
  );
}
