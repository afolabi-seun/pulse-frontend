import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { useCurrentRole } from '../../hooks/useCurrentRole';
import { useTeamList, useCreateTeam, useUpdateTeam } from '../../api/teams';
import { useEngineerList } from '../../api/engineers';
import { applyServerErrors } from '../../lib/formErrors';

import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { UsersRound } from 'lucide-react';
import { CardListSkeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Sheet, SheetContent, SheetHeader, SheetBody, SheetTitle } from '@/components/ui/sheet';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import type { EngineerDto, TeamDto } from '../../types/api';

interface CreateForm { name: string; teamLeadId: string; department: string; }
interface EditForm   { name: string; teamLeadId: string; department: string; }

function MembersDrawer({ team, members, onClose }: {
  team: TeamDto;
  members: EngineerDto[];
  onClose: () => void;
}) {
  const active   = members.filter((e) => e.isActive);
  const inactive = members.filter((e) => !e.isActive);

  return (
    <Sheet open onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{team.name}</SheetTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {active.length} active member{active.length !== 1 ? 's' : ''}
            {inactive.length > 0 && `, ${inactive.length} inactive`}
          </p>
        </SheetHeader>

        <SheetBody className="p-0">
          <div className="divide-y divide-border">
            {members.length === 0 ? (
              <EmptyState size="sm" icon={UsersRound} title="No members assigned to this team." description="Assign people to it from Admin > Users." />
            ) : (
              <>
                {active.map((eng) => <MemberRow key={eng.id} engineer={eng} />)}
                {inactive.length > 0 && (
                  <>
                    <div className="px-5 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Inactive</p>
                    </div>
                    {inactive.map((eng) => <MemberRow key={eng.id} engineer={eng} />)}
                  </>
                )}
              </>
            )}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}

function MemberRow({ engineer }: { engineer: EngineerDto }) {
  const initials = engineer.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase();
  return (
    <div className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to={`/engineers/${engineer.id}`}
          className="block truncate text-sm font-medium text-foreground hover:text-primary"
        >
          {engineer.name}
        </Link>
        <p className="truncate text-xs text-muted-foreground capitalize">{engineer.role.replace(/_/g, ' ')}</p>
      </div>
      <Badge label={engineer.isActive ? 'active' : 'inactive'} variant={engineer.isActive ? 'green' : 'gray'} />
    </div>
  );
}

function TeamCard({ team, canManage, allEngineers }: { team: TeamDto; canManage: boolean; allEngineers: EngineerDto[] }) {
  const [editing, setEditing]         = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const updateTeam = useUpdateTeam(team.id);
  const { confirm, dialog } = useConfirm();

  const { register, control, handleSubmit, setError, reset, formState: { errors } } = useForm<EditForm>({
    defaultValues: { name: team.name, teamLeadId: team.teamLeadId ?? '', department: team.department ?? '' },
  });

  const members = allEngineers.filter((e) => e.teamId === team.id);

  const onSubmit = handleSubmit((values) => {
    const body: Record<string, unknown> = { name: values.name };
    if (values.teamLeadId) body.teamLeadId = values.teamLeadId;
    else                   body.clearTeamLead = true;
    if (values.department) body.department = values.department;
    else                   body.clearDepartment = true;
    updateTeam.mutate(body, {
      onSuccess: () => { toast.success('Team updated.'); setEditing(false); },
      onError:   (e) => applyServerErrors(e, setError),
    });
  });

  const handleDeactivate = async () => {
    if (!await confirm({ title: `Deactivate "${team.name}"?`, description: 'Members will keep their existing assignments.', confirmLabel: 'Deactivate' })) return;
    updateTeam.mutate({ deactivate: true }, { onSuccess: () => toast.success('Team deactivated.') });
  };

  if (editing) {
    return (
      <Card className="overflow-hidden p-0">
        {dialog}
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
            <UsersRound className="h-4 w-4 text-primary" />
          </div>
          <p className="text-sm font-semibold text-foreground">Edit {team.name}</p>
        </div>
        <form onSubmit={onSubmit}>
          <div className="space-y-4 px-5 py-5">
            <div className="space-y-1.5">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input {...register('name', { required: 'Name is required' })} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Department</Label>
              <Input {...register('department')} placeholder="e.g. R&D, Products, Design" />
            </div>
            <div className="space-y-1.5">
              <Label>Team Lead</Label>
              <Controller
                name="teamLeadId"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value}
                    onChange={field.onChange}
                    placeholder="Search engineers…"
                    emptyLabel="No matching engineers"
                    options={[
                      { value: '', label: 'None' },
                      ...allEngineers.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.name })),
                    ]}
                  />
                )}
              />
            </div>
          </div>
          <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
            <Button size="sm" type="submit" loading={updateTeam.isPending}>Save</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setEditing(false); reset(); }}>Cancel</Button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <>
      {dialog}
      {showMembers && (
        <MembersDrawer team={team} members={members} onClose={() => setShowMembers(false)} />
      )}
      <Card className="flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md">
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <UsersRound className="h-5 w-5 text-primary" />
            </div>
            {!team.isActive && <Badge label="inactive" variant="gray" />}
          </div>

          <span className="font-semibold text-foreground">{team.name}</span>
          {team.department && (
            <p className="mt-2">
              <Badge label={team.department} variant="blue" />
            </p>
          )}
          <p className="mt-auto pt-4 text-sm text-muted-foreground">
            {team.memberCount === null
              ? 'Lead hidden — another department'
              : team.teamLeadName ? `Lead: ${team.teamLeadName}` : 'No team lead assigned'}
          </p>
        </div>

        <div className="flex items-center border-t border-border px-4 py-2.5">
          {team.memberCount === null ? (
            <span className="px-2 py-1 text-xs text-muted-foreground" title="Only visible for your own department">
              — members
            </span>
          ) : (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              onClick={() => setShowMembers(true)}
            >
              {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
            </button>
          )}
          {canManage && (
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                onClick={() => setEditing(true)}
              >
                Edit
              </button>
              {team.isActive && (
                <button
                  type="button"
                  className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                  onClick={handleDeactivate}
                  disabled={updateTeam.isPending}
                >
                  Deactivate
                </button>
              )}
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

export default function TeamsPage() {
  const { isPmo } = useCurrentRole();
  const [showCreate, setShowCreate] = useState(false);

  const { data: teams,     isLoading, error, refetch } = useTeamList();
  const { data: engineers }                            = useEngineerList();
  const createTeam = useCreateTeam();

  const { register, control, handleSubmit, setError, reset, watch, formState: { errors } } = useForm<CreateForm>();
  const watchedName = watch('name', '');
  const eng = engineers ?? [];

  const onSubmit = handleSubmit((values) => {
    createTeam.mutate(
      {
        name:       values.name,
        teamLeadId: values.teamLeadId || undefined,
        department: values.department || undefined,
      },
      {
        onSuccess: () => { toast.success('Team created.'); reset(); setShowCreate(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  if (isLoading) return <CardListSkeleton count={4} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const active   = teams?.filter((t) => t.isActive)  ?? [];
  const inactive = teams?.filter((t) => !t.isActive) ?? [];

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Teams"
        actions={
          isPmo ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>New team</Button>
          ) : undefined
        }
      />

      {showCreate && (
        <Card className="mb-5 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <UsersRound className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">New team</p>
          </div>
          <form onSubmit={onSubmit}>
            <div className="space-y-4 px-5 py-5">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input {...register('name', { required: 'Name is required' })} placeholder="e.g. OMS" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Department</Label>
                <Input
                  {...register('department')}
                  placeholder={watchedName ? `Defaults to "${watchedName}"` : 'e.g. R&D, Products, Design'}
                />
                <p className="text-xs text-muted-foreground">Leave blank to use the team name.</p>
              </div>
              <div className="space-y-1.5">
                <Label>Team Lead</Label>
                <Controller
                  name="teamLeadId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search engineers…"
                      emptyLabel="No matching engineers"
                      options={[
                        { value: '', label: 'None' },
                        ...eng.filter((e) => e.isActive).map((e) => ({ value: e.id, label: e.name })),
                      ]}
                    />
                  )}
                />
              </div>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={createTeam.isPending}>Create</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {teams?.length === 0 && (
        <EmptyState icon={UsersRound} title="No teams yet" description="Create a team to start assigning engineers and sprints." />
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((t) => (
            <TeamCard key={t.id} team={t} canManage={isPmo} allEngineers={eng} />
          ))}
        </div>
      )}

      {inactive.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <UsersRound className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground">Inactive</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inactive.map((t) => (
              <TeamCard key={t.id} team={t} canManage={isPmo} allEngineers={eng} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
