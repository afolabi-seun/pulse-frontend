import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { X, AlertTriangle, BarChart2, Lock, ShieldCheck, UserCircle, Search, Check } from 'lucide-react';
import { useUserList, useCreateUser, useUpdateUser, useDeleteUser, useResendInvite, useCheckEmailsExist, type CreateUserRequest, type EmailExistsDto } from '../../api/users';
import { useTeamList } from '../../api/teams';
import { useEngineer } from '../../api/engineers';
import { useMeta } from '../../api/meta';
import { useAuth } from '../../hooks/useAuth';
import { FilterBar, FILTER_SELECT } from '../../components/ui/FilterBar';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { useUrlFilters } from '../../hooks/useUrlFilters';
import { Pagination } from '../../components/ui/Pagination';
import { applyServerErrors } from '../../lib/formErrors';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { TablePageSkeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from '../../lib/dates';
import type { Role, RoleMetaDto, UserDto } from '../../types/api';

const SELECT_CLS = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';
const DRAWER_SELECT = 'h-8 w-full rounded-md border border-input bg-background px-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50';

const DISCIPLINES = [
  { value: 'frontend',  label: 'Frontend' },
  { value: 'backend',   label: 'Backend' },
  { value: 'design',    label: 'Design' },
  { value: 'fullStack', label: 'Full Stack' },
  { value: 'product',   label: 'Product' },
  { value: 'pmo',       label: 'PMO' },
  { value: 'functional', label: 'Functional' },
  { value: 'database', label: 'Database' },
  { value: 'infraDevSecOps', label: 'Infra/DevSecOps' },
  { value: 'support',   label: 'Support' },
  { value: 'other',     label: 'Other' },
];

function userInitials(name: string) {
  return name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
}

function roleLabel(role: string, roles: RoleMetaDto[] | undefined): string {
  return roles?.find((r) => r.value === role)?.label ?? role.replace(/_/g, ' ');
}

// ── User detail drawer ────────────────────────────────────────────────────────

function UserDetailDrawer({ user, onClose }: { user: UserDto; onClose: () => void }) {
  const { currentUser } = useAuth();
  const updateUser   = useUpdateUser(user.id);
  const resendInvite = useResendInvite();
  const deleteUser   = useDeleteUser();
  const { data: teams } = useTeamList();
  const { data: meta  } = useMeta();
  const { confirm, dialog } = useConfirm();

  const callerRole    = currentUser?.role as Role | undefined;
  const isPmo         = callerRole === 'head_of_pmo' || callerRole === 'project_manager';
  const isExecutive   = callerRole === 'executive';
  const isHr          = callerRole === 'hr';
  const callerMeta    = meta?.roles.find((r) => r.value === callerRole);
  // Dept head sees their own assignable roles + their own head role in the dropdown
  const drawerRoleOptions = isPmo
    ? (meta?.roles ?? [])
    : callerMeta?.assignableRoles
      ? (meta?.roles ?? []).filter((r) => r.value === callerRole || callerMeta.assignableRoles!.includes(r.value as Role))
      : (meta?.roles ?? []);
  // Executive/HR are read-only here — see the same detail as everyone else but can't mutate a user.
  const canEditRole = !isExecutive && !isHr && (isPmo || !!callerMeta?.assignableRoles);

  const isLocked = !!user.lockedUntil && new Date(user.lockedUntil) > new Date();

  const handleRoleChange = (newRole: string) => {
    if (!newRole || newRole === user.role) return;
    updateUser.mutate({ role: newRole as Role }, {
      onSuccess: () => toast.success('Role updated.'),
      onError:   () => toast.error('Failed to update role.'),
    });
  };

  const handleTeamChange = (newTeamId: string) => {
    if (newTeamId === (user.teamId ?? '')) return;
    updateUser.mutate({ teamId: newTeamId || undefined }, {
      onSuccess: () => toast.success('Team updated.'),
      onError:   () => toast.error('Failed to update team.'),
    });
  };

  const handleUnlock = () => {
    updateUser.mutate({ unlockAccount: true }, { onSuccess: () => toast.success('Account unlocked.') });
  };

  const handleIsQaChange = (checked: boolean) => {
    if (checked && !user.discipline) {
      toast.error('Set a discipline first — QA reviews get routed by it.');
      return;
    }
    updateUser.mutate({ isQa: checked }, {
      onSuccess: () => toast.success('QA status updated.'),
      onError:   () => toast.error('Failed to update QA status.'),
    });
  };

  const handleDisciplineChange = (newDiscipline: string) => {
    updateUser.mutate({ discipline: newDiscipline || undefined }, {
      onSuccess: () => toast.success('Discipline updated.'),
      onError:   () => toast.error('Failed to update discipline.'),
    });
  };

  const handleToggleActive = async () => {
    if (user.isActive) {
      if (!await confirm({ title: `Deactivate ${user.name}?`, description: 'Their data will be preserved.', confirmLabel: 'Deactivate' })) return;
      deleteUser.mutate(user.id, { onSuccess: () => { toast.success('User deactivated.'); onClose(); } });
    } else {
      updateUser.mutate({ isActive: true }, { onSuccess: () => toast.success('User reactivated.') });
    }
  };

  return createPortal(
    <>
      {dialog}
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Panel — rendered in portal so fixed positioning is always relative to viewport */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-background shadow-xl">

        {/* Header */}
        <div className="flex items-start gap-4 border-b border-border px-5 py-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
            {userInitials(user.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <Badge label={user.isActive ? 'active' : 'inactive'} variant={user.isActive ? 'green' : 'gray'} />
              {isLocked && <Badge label="locked" variant="red" />}
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Role & access */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
                <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Role &amp; access</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-xs text-muted-foreground">Role</span>
                {canEditRole ? (
                  <select
                    defaultValue={user.role}
                    disabled={updateUser.isPending}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className={DRAWER_SELECT}
                  >
                    {drawerRoleOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm capitalize text-foreground">{roleLabel(user.role, meta?.roles)}</span>
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-xs text-muted-foreground">Team</span>
                {(isExecutive || isHr) ? (
                  <span className="text-sm text-foreground">{user.team ?? 'No team'}</span>
                ) : (
                  <SearchableSelect
                    className="w-full [&_input]:h-8 [&_input]:text-sm"
                    value={user.teamId ?? ''}
                    disabled={updateUser.isPending}
                    onChange={handleTeamChange}
                    placeholder="No team"
                    emptyLabel="No matching teams"
                    options={[{ value: '', label: 'No team' }, ...(teams ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))]}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="shrink-0 text-xs text-muted-foreground">Discipline</span>
                {(isExecutive || isHr) ? (
                  <span className="text-sm capitalize text-foreground">{user.discipline ?? 'Not specified'}</span>
                ) : (
                  <SearchableSelect
                    value={user.discipline ?? ''}
                    onChange={handleDisciplineChange}
                    disabled={updateUser.isPending}
                    placeholder="Search disciplines…"
                    emptyLabel="No matching disciplines"
                    options={[{ value: '', label: 'Not specified' }, ...DISCIPLINES]}
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">QA engineer</p>
                  <p className="text-[11px] text-muted-foreground/70">Routes QA tasks to this engineer</p>
                </div>
                <Switch
                  defaultChecked={user.isQa}
                  disabled={updateUser.isPending || isExecutive || isHr}
                  aria-label="QA engineer"
                  onChange={(e) => {
                    if (e.target.checked && !user.discipline) {
                      e.target.checked = false;
                      toast.error('Set a discipline first — QA reviews get routed by it.');
                      return;
                    }
                    handleIsQaChange(e.target.checked);
                  }}
                />
              </div>
              {(() => {
                const roleMeta = meta?.roles.find((r) => r.value === user.role);
                return roleMeta?.isDeptHead && user.role !== 'head_of_pmo' && !user.team ? (
                  <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      No team assigned — this dept head's task view won't be department-scoped
                    </p>
                  </div>
                ) : null;
              })()}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Joined</span>
                <span className="text-sm text-foreground">{formatDate(user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Workload */}
          <div className="border-b border-border px-4 py-3">
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
                <BarChart2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Workload defaults</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Baseline points</span>
                <span className="text-sm text-foreground">{user.baselinePoints}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Baseline cycle days</span>
                <span className="text-sm text-foreground">{user.baselineCycleDays}</span>
              </div>
            </div>
          </div>

          {/* Security */}
          <div className="px-4 py-3">
            <div className="mb-3 flex items-center gap-2.5">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-md', isLocked ? 'bg-red-50 dark:bg-red-950/40' : 'bg-muted')}>
                <Lock className={cn('h-4 w-4', isLocked ? 'text-red-500' : 'text-muted-foreground')} />
              </div>
              <p className="text-sm font-semibold text-foreground">Security</p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Failed login attempts</span>
                <span className={cn('text-sm', user.failedLoginAttempts > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground')}>
                  {user.failedLoginAttempts}
                </span>
              </div>
              {user.lockedUntil && (
                <div className="flex items-start justify-between gap-4">
                  <span className="text-xs text-muted-foreground">Locked until</span>
                  <span className={cn('text-right text-sm', isLocked ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground line-through')}>
                    {formatDateTime(user.lockedUntil)}
                  </span>
                </div>
              )}
              {user.failedLoginAttempts > 0 && !isLocked && (
                <div className="flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-2 dark:bg-amber-950/30">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">Previous failed login attempts on record</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions — Executive/HR are read-only, no mutating controls */}
        {!isExecutive && !isHr && (
          <div className="flex flex-wrap gap-2 border-t border-border bg-muted/30 px-4 py-3">
            {isLocked && (
              <Button size="sm" variant="secondary" onClick={handleUnlock} loading={updateUser.isPending}>
                Unlock account
              </Button>
            )}
            {user.isActive && (
              <Button
                size="sm" variant="ghost" loading={resendInvite.isPending}
                onClick={() => resendInvite.mutate(user.id, {
                  onSuccess: () => toast.success(`Invite resent to ${user.email}.`),
                  onError:   () => toast.error('Failed to resend invite.'),
                })}
              >
                Resend invite
              </Button>
            )}
            <Button
              size="sm"
              variant={user.isActive ? 'ghost' : 'secondary'}
              className={user.isActive ? 'text-destructive hover:text-destructive' : ''}
              onClick={handleToggleActive}
              loading={deleteUser.isPending || updateUser.isPending}
            >
              {user.isActive ? 'Deactivate' : 'Reactivate'}
            </Button>
          </div>
        )}
      </div>
    </>,
    document.body,
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [showCheckEmails, setShowCheckEmails] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [emailResults, setEmailResults] = useState<EmailExistsDto[] | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [filters, setFilter, , clearUrlFilters] = useUrlFilters({ role: '', team: '', isActive: '', isQa: '' }, ['cursor', 'cursorPage']);
  const { role, team, isActive, isQa } = filters;

  const { currentUser } = useAuth();
  const { data: meta  } = useMeta();
  const callerRole = currentUser?.role as Role | undefined;
  const isPmo = callerRole === 'head_of_pmo' || callerRole === 'project_manager';
  const isExecutive = callerRole === 'executive';
  const isHr = callerRole === 'hr';

  const callerMeta = meta?.roles.find((r) => r.value === callerRole);

  // Role options for the list filter and edit drawer
  const filterRoleOptions = isPmo
    ? (meta?.roles ?? [])
    : callerMeta?.assignableRoles
      ? (meta?.roles ?? []).filter((r) => r.value === callerRole || callerMeta.assignableRoles!.includes(r.value as Role))
      : (meta?.roles ?? []);
  const showRoleFilter = filterRoleOptions.length > 1;

  // Roles a dept head can assign when creating a new user (excludes their own head role)
  const createRoleOptions = isPmo
    ? null
    : (meta?.roles ?? []).filter((r) => callerMeta?.assignableRoles?.includes(r.value as Role));

  const { cursor, hasPrev, pageNumber, goNext, goPrev } = useCursorPagination();
  const { data: teams } = useTeamList();

  const hasFilters = !!(role || team || isActive || isQa);
  const clearFilters = () => clearUrlFilters();

  const { data, isLoading, error, refetch } = useUserList({
    cursor:   cursor || undefined,
    role:     role     || undefined,
    team:     team     || undefined,
    isActive: isActive ? isActive === 'active' : undefined,
    isQa:     isQa ? isQa === 'yes' : undefined,
  });
  const users = data?.items;
  // Re-derived from the live list on every render (rather than a snapshot captured on row-click)
  // so a mutation's refetch — e.g. changing Discipline — is reflected in the open drawer immediately.
  const selectedUser = users?.find((u) => u.id === selectedUserId) ?? null;
  const createUser = useCreateUser();
  const checkEmails = useCheckEmailsExist();

  const { register, control, handleSubmit, setError, reset: resetForm, setValue, watch, formState: { errors } } = useForm<CreateUserRequest>();
  const isQaChecked = watch('isQa');
  const createRoleSelected = watch('role');
  const isExecutiveRole = createRoleSelected === 'executive';
  const isHrRole = createRoleSelected === 'hr';
  const isAccountantRole = createRoleSelected === 'accountant';

  const onCheckEmails = () => {
    const emails = emailsText.split(/[\n,]/).map((e) => e.trim()).filter(Boolean);
    if (emails.length === 0) return;
    checkEmails.mutate(emails, {
      onSuccess: (data) => setEmailResults(data),
      onError:   () => toast.error('Failed to check emails.'),
    });
  };

  const { data: callerEngineer } = useEngineer(currentUser?.id ?? '');
  useEffect(() => {
    if (callerRole !== 'head_of_pmo' && callerEngineer?.teamId) {
      setValue('teamId', callerEngineer.teamId);
    }
  }, [callerRole, callerEngineer?.teamId, setValue]);

  const onSubmit = handleSubmit((values) => {
    createUser.mutate(
      { ...values, baselinePoints: Number(values.baselinePoints), baselineCycleDays: Number(values.baselineCycleDays) },
      {
        onSuccess: () => { toast.success('User created — activation email sent.'); resetForm(); setShowCreate(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  if (isLoading) return <TablePageSkeleton cols={5} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  return (
    <div>
      {selectedUser && (
        <UserDetailDrawer
          user={selectedUser}
          onClose={() => setSelectedUserId(null)}
        />
      )}

      <PageHeader
        title="User management"
        actions={
          !isExecutive && !isHr && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => setShowCheckEmails((v) => !v)}>Check emails</Button>
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>New user</Button>
          </div>
          )
        }
      />

      <FilterBar hasFilters={hasFilters} onClear={clearFilters}>
        {showRoleFilter && (
          <>
            <FilterBar.Item label="Role">
              <select value={role} onChange={(e) => setFilter('role', e.target.value)} className={FILTER_SELECT}>
                <option value="">All roles</option>
                {filterRoleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </FilterBar.Item>
            <FilterBar.Divider />
          </>
        )}
        {isPmo && (
          <>
            <FilterBar.Item label="Team">
              <SearchableSelect
                className="w-40 [&_input]:h-8 [&_input]:text-xs"
                value={team}
                onChange={(v) => setFilter('team', v)}
                placeholder="All teams"
                emptyLabel="No matching teams"
                options={[{ value: '', label: 'All teams' }, ...(teams ?? []).map((t) => ({ value: t.name, label: t.name }))]}
              />
            </FilterBar.Item>
            <FilterBar.Divider />
          </>
        )}
        <FilterBar.Item label="Status">
          <select value={isActive} onChange={(e) => setFilter('isActive', e.target.value)} className={FILTER_SELECT}>
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </FilterBar.Item>
        <FilterBar.Divider />
        <FilterBar.Item label="QA">
          <select value={isQa} onChange={(e) => setFilter('isQa', e.target.value)} className={FILTER_SELECT}>
            <option value="">All</option>
            <option value="yes">QA engineers only</option>
          </select>
        </FilterBar.Item>
      </FilterBar>

      {showCreate && (
        <Card className="mb-5 overflow-hidden">
          <form onSubmit={onSubmit}>
            {/* Identity */}
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <UserCircle className="h-4 w-4 text-primary" />
              </div>
              <p className="text-sm font-semibold text-foreground">Identity</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <Label>Full name <span className="text-destructive">*</span></Label>
                <Input {...register('name', { required: 'Name is required' })} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Email <span className="text-destructive">*</span></Label>
                <Input type="email" {...register('email', { required: 'Email is required' })} />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
            </div>

            {/* Role & access */}
            <div className="flex items-center gap-2.5 border-y border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
                <ShieldCheck className="h-4 w-4 text-violet-600 dark:text-violet-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Role & access</p>
            </div>
            <div className="px-5 py-5">
              <div className="space-y-1.5">
                <Label>Role <span className="text-destructive">*</span></Label>
                <select {...register('role', { required: 'Role is required' })} className={SELECT_CLS}>
                  <option value="">Select role</option>
                  {createRoleOptions
                    ? createRoleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
                    : (() => {
                        const groups = (meta?.roles ?? []).reduce<Record<string, RoleMetaDto[]>>((acc, r) => {
                          (acc[r.group] ??= []).push(r);
                          return acc;
                        }, {});
                        return Object.entries(groups).map(([group, roles]) => (
                          <optgroup key={group} label={group}>
                            {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </optgroup>
                        ));
                      })()
                  }
                </select>
                {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
              </div>
            </div>

            {/* Workload defaults */}
            <div className="flex items-center gap-2.5 border-y border-border px-4 py-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/40">
                <BarChart2 className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold text-foreground">Workload defaults</p>
            </div>
            <div className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Baseline points</Label>
                  <Input type="number" min={1} defaultValue={20} {...register('baselinePoints')} />
                </div>
                <div className="space-y-1.5">
                  <Label>Baseline cycle days</Label>
                  <Input type="number" min={1} defaultValue={5} {...register('baselineCycleDays')} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Team{!(isExecutiveRole || isHrRole || isAccountantRole) && <span className="text-destructive"> *</span>}</Label>
                <select
                  {...register('teamId', { required: (isExecutiveRole || isHrRole || isAccountantRole) ? false : 'Team is required.' })}
                  className={SELECT_CLS}
                  disabled={isExecutiveRole || isHrRole || isAccountantRole}
                >
                  <option value="">{(isExecutiveRole || isHrRole || isAccountantRole) ? 'Not applicable — this role has no team' : 'Select a team…'}</option>
                  {teams?.filter((t) => t.isActive).map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                {errors.teamId && <p className="text-xs text-destructive">{errors.teamId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Discipline{isQaChecked && <span className="text-destructive"> *</span>}</Label>
                <Controller
                  name="discipline"
                  control={control}
                  rules={{ validate: (v) => !isQaChecked || !!v || 'A discipline is required for a QA engineer.' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      placeholder="Search disciplines…"
                      emptyLabel="No matching disciplines"
                      options={[{ value: '', label: 'Not specified' }, ...DISCIPLINES]}
                    />
                  )}
                />
                {errors.discipline && <p className="text-xs text-destructive">{errors.discipline.message}</p>}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">QA engineer</span>
                <Switch {...register('isQa')} />
              </div>
              {isQaChecked && (
                <p className="text-xs text-muted-foreground">
                  QA reviews get routed by discipline — set one above so this engineer actually receives matching reviews.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                A temporary password will be generated and an activation email sent to the user.
              </p>
            </div>

            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={createUser.isPending}>Create</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {showCheckEmails && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Check emails</p>
          </div>
          <div className="space-y-3 px-4 py-3">
            <div className="space-y-1.5">
              <Label>Emails (one per line, or comma-separated)</Label>
              <Textarea
                rows={4}
                placeholder={'clayton@example.com\naniebiet@example.com'}
                value={emailsText}
                onChange={(e) => { setEmailsText(e.target.value); setEmailResults(null); }}
              />
            </div>
            {emailResults && (
              <div className="space-y-1.5 rounded-md border border-border">
                {emailResults.map((r) => (
                  <div key={r.email} className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-b-0">
                    <span className="text-foreground">{r.email}</span>
                    {r.exists
                      ? <Badge label="already exists" variant="yellow" />
                      : <span className="flex items-center gap-1 text-xs text-muted-foreground"><Check className="h-3.5 w-3.5" />available</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            <Button size="sm" onClick={onCheckEmails} loading={checkEmails.isPending}>Check</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowCheckEmails(false); setEmailsText(''); setEmailResults(null); }}>Close</Button>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        <div className="divide-y divide-border">
          {users?.map((u) => {
            const deptHeadNoTeam = (() => {
              const rm = meta?.roles.find((r) => r.value === u.role);
              return rm?.isDeptHead && u.role !== 'head_of_pmo' && !u.team;
            })();
            const isLocked = !!u.lockedUntil && new Date(u.lockedUntil) > new Date();
            return (
              <div
                key={u.id}
                className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-muted/30"
                onClick={() => setSelectedUserId(u.id)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {userInitials(u.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-foreground">{u.name}</p>
                    <Badge label={u.isActive ? 'active' : 'inactive'} variant={u.isActive ? 'green' : 'gray'} />
                    {isLocked && <Badge label="locked" variant="red" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="capitalize">{roleLabel(u.role, meta?.roles)}</span>
                    <span className="inline-flex items-center gap-1">
                      {u.team ?? 'No team'}
                      {deptHeadNoTeam && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />}
                    </span>
                    {u.isQa && (
                      <span className="inline-flex items-center gap-1">
                        QA · {u.discipline
                          ? (DISCIPLINES.find((d) => d.value === u.discipline)?.label ?? u.discipline)
                          : <span className="text-amber-600 dark:text-amber-500">no discipline</span>}
                        {!u.discipline && <AlertTriangle className="h-3 w-3 shrink-0 text-amber-500" />}
                      </span>
                    )}
                    {!isLocked && u.failedLoginAttempts > 0 && (
                      <span className="text-yellow-600 dark:text-yellow-500">{u.failedLoginAttempts} failed logins</span>
                    )}
                    <span>Joined {formatDate(u.createdAt)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Pagination
        hasPrev={hasPrev}
        hasMore={data?.hasMore ?? false}
        onPrev={goPrev}
        onNext={() => data?.nextCursor && goNext(data.nextCursor)}
        page={pageNumber}
      />
    </div>
  );
}
