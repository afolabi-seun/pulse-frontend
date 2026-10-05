import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import { BarChart2, FolderOpen, FolderArchive, Lock, Search } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { useCurrentRole } from '../hooks/useCurrentRole';
import { useProjectList, useCreateProject, useUpdateProject, useProjectThroughput, useDeleteProject } from '../api/projects';
import { useTeamList } from '../api/teams';
import { applyServerErrors } from '../lib/formErrors';
import PageHeader from '../components/layout/PageHeader';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { CardListSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../components/ui/ErrorState';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '../components/ui/Pagination';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { cn, stripHtml } from '@/lib/utils';
import { formatDate } from '../lib/dates';
import type { ProjectDto } from '../types/api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: false } },
  scales: {
    x: { grid: { display: false } },
    y: { beginAtZero: true, ticks: { precision: 0 } },
  },
};

interface CreateForm { name: string; description: string; ownerTeamId: string; code: string; }

function ThroughputChart({ projectId }: { projectId: string }) {
  const { data, isLoading } = useProjectThroughput(projectId);
  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (!data || data.length === 0) return <p className="py-3 text-center text-xs text-muted-foreground">No throughput data yet.</p>;

  const labels = data.map((w) => {
    const d = new Date(w.weekOf);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  });
  const chartData = {
    labels,
    datasets: [{ data: data.map((w) => w.pointsDelivered), backgroundColor: 'rgb(99, 102, 241)', borderRadius: 4 }],
  };
  return <div className="h-32"><Bar data={chartData} options={CHART_OPTIONS} /></div>;
}

function ProjectCard({ project, canEdit, canDelete, onDelete }: {
  project: ProjectDto; canEdit: boolean; canDelete: boolean;
  onDelete: (id: string, name: string) => void;
}) {
  const [showChart, setShowChart] = useState(false);
  const updateProject = useUpdateProject(project.id);
  const { confirm, dialog } = useConfirm();

  const handleArchive = async () => {
    if (!await confirm({ title: `Archive "${project.name}"?`, description: 'This project will be hidden from active views.', confirmLabel: 'Archive' })) return;
    updateProject.mutate({ archive: true }, { onSuccess: () => toast.success('Project archived.') });
  };

  if (!project.canAccess) {
    return (
      <Card
        className="flex flex-col overflow-hidden p-0 opacity-60"
        title="You don't have access to this project"
      >
        <div className="flex flex-1 flex-col p-5">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted">
              <Lock className="h-5 w-5 text-muted-foreground" />
            </div>
            <Badge label="no access" variant="gray" />
          </div>

          <span className="font-semibold text-muted-foreground">{project.name}</span>
          {project.description && (
            <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{stripHtml(project.description)}</p>
          )}

          <p className="mt-auto pt-4 text-xs text-muted-foreground">Created {formatDate(project.createdAt)}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col overflow-hidden p-0 transition-shadow hover:shadow-md">
      {dialog}
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-4 flex items-start justify-between">
          <div className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            project.status === 'active' ? 'bg-primary/10' : 'bg-muted',
          )}>
            {project.status === 'active'
              ? <FolderOpen className="h-5 w-5 text-primary" />
              : <FolderArchive className="h-5 w-5 text-muted-foreground" />
            }
          </div>
          {project.status === 'paused' && <Badge label="paused" variant="yellow" />}
          {project.status === 'archived' && <Badge label="archived" variant="gray" />}
        </div>

        <Link
          to={`/projects/${project.id}`}
          className="font-semibold text-foreground hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {project.name}
        </Link>
        {project.description && (
          <p className="mt-1.5 text-sm text-muted-foreground line-clamp-2">{stripHtml(project.description)}</p>
        )}

        <p className="mt-auto pt-4 text-xs text-muted-foreground">Created {formatDate(project.createdAt)}</p>

        {showChart && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivered points — last 6 weeks</p>
            <ThroughputChart projectId={project.id} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-t border-border px-4 py-2.5">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
          onClick={() => setShowChart((v) => !v)}
        >
          <BarChart2 className="h-3.5 w-3.5" />
          {showChart ? 'Hide' : 'Throughput'}
        </button>

        <div className="ml-auto flex items-center gap-1">
          {canEdit && project.status === 'active' && (
            <Button variant="ghost" size="sm" onClick={handleArchive} loading={updateProject.isPending}>
              Archive
            </Button>
          )}
          {canDelete && (
            <button
              type="button"
              className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              onClick={() => onDelete(project.id, project.name)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

type ProjectStatusTab = 'active' | 'paused' | 'archived';
const PROJECTS_PAGE_SIZE = 12;

export default function ProjectsPage() {
  const { isPmo, canCreateProject, canDeleteProject } = useCurrentRole();
  const [showCreate, setShowCreate] = useState(false);
  const [statusTab, setStatusTab] = useState<ProjectStatusTab | null>(null);
  const [search, setSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const { confirm, dialog } = useConfirm();

  const { data: projects, isLoading, error, refetch } = useProjectList();
  const { data: teams } = useTeamList();
  const createProject = useCreateProject();
  const deleteProject = useDeleteProject();

  const { register, control, handleSubmit, setError, reset, formState: { errors } } = useForm<CreateForm>({
    defaultValues: { description: '' },
  });

  const onSubmit = handleSubmit((values) => {
    createProject.mutate(
      { name: values.name, description: values.description || undefined, ownerTeamId: values.ownerTeamId, code: values.code || undefined },
      {
        onSuccess: () => { toast.success('Project created.'); reset(); setShowCreate(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  const handleDelete = async (id: string, name: string) => {
    if (!await confirm({
      title: `Delete "${name}"?`,
      description: 'This project will be permanently deleted. This is only possible if it has no tasks.',
      confirmLabel: 'Delete',
    })) return;
    deleteProject.mutate(id, {
      onSuccess: () => toast.success('Project deleted.'),
      onError:   (e: unknown) => toast.error(e instanceof Error ? e.message : 'Cannot delete — project has tasks.'),
    });
  };

  if (isLoading) return <CardListSkeleton count={6} />;
  if (error)     return <ErrorState error={error} onRetry={refetch} />;

  const q = search.trim().toLowerCase();
  const count = (status: ProjectStatusTab) => projects?.filter((p) => p.status === status).length ?? 0;
  // Active first; if there is nothing active, open on whichever status has projects so the page isn't empty.
  const tab: ProjectStatusTab = statusTab ?? (['active', 'paused', 'archived'] as const).find((st) => count(st) > 0) ?? 'active';
  // A search looks across every status — the badge on a card says which — rather than only the open tab.
  const matching = (projects ?? []).filter((p) =>
    q ? (p.name.toLowerCase().includes(q) || stripHtml(p.description ?? '').toLowerCase().includes(q)) : p.status === tab);
  // Archiving or deleting the last project on a page must not strand the reader on an empty one.
  const safePage = Math.min(pageIndex, Math.max(0, Math.ceil(matching.length / PROJECTS_PAGE_SIZE) - 1));
  const pageProjects = matching.slice(safePage * PROJECTS_PAGE_SIZE, (safePage + 1) * PROJECTS_PAGE_SIZE);
  const tabs: { key: ProjectStatusTab; label: string }[] = [
    { key: 'active', label: 'Active' }, { key: 'paused', label: 'Paused' }, { key: 'archived', label: 'Archived' },
  ];

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Projects"
        actions={
          canCreateProject ? (
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>New project</Button>
          ) : undefined
        }
      />

      {showCreate && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">New project</p>
          </div>
          <form onSubmit={onSubmit}>
            <div className="space-y-3 px-5 py-4">
              <div className="space-y-1.5">
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input {...register('name', { required: 'Name is required' })} />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Controller
                  name="description"
                  control={control}
                  render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Owner team <span className="text-destructive">*</span></Label>
                <Controller
                  name="ownerTeamId"
                  control={control}
                  rules={{ required: 'Owner team is required' }}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Select a team…"
                      emptyLabel="No matching teams"
                      options={(teams ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))}
                    />
                  )}
                />
                {errors.ownerTeamId && <p className="text-xs text-destructive">{errors.ownerTeamId.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input placeholder="Auto-generated from the name if left blank" {...register('code')} />
                <p className="text-xs text-muted-foreground">
                  Short, unique prefix for this project's task IDs (e.g. "NOTIF" for task keys like NOTIF-011).
                </p>
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={createProject.isPending}>Create</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => { setShowCreate(false); reset(); }}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {(projects?.length ?? 0) > 0 && (
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 pl-9"
              placeholder="Search projects…"
              aria-label="Search projects"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPageIndex(0); }}
            />
          </div>
          {!q && (
            <div role="tablist" aria-label="Project status" className="flex gap-1 border-b border-border">
              {tabs.filter((t) => t.key === 'active' || count(t.key) > 0).map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  type="button"
                  aria-selected={tab === t.key}
                  onClick={() => { setStatusTab(t.key); setPageIndex(0); }}
                  className={cn(
                    '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t.label}
                  <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{count(t.key)}</span>
                </button>
              ))}
            </div>
          )}
          {q && (
            <p className="text-xs text-muted-foreground">
              {matching.length} project{matching.length === 1 ? '' : 's'} match across all statuses.
            </p>
          )}
        </div>
      )}

      {projects?.length === 0 && (
        <EmptyState icon={FolderOpen} title="No projects yet" description="Create a project to start tracking tasks and throughput." />
      )}

      {(projects?.length ?? 0) > 0 && matching.length === 0 && (
        <EmptyState
          icon={Search}
          title={q ? 'No projects match' : `No ${tab} projects`}
          description={q ? 'Try a different search term.' : 'Nothing here right now.'}
        />
      )}

      {matching.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {pageProjects.map((p) => (
            <ProjectCard
              key={p.id} project={p}
              canEdit={isPmo} canDelete={canDeleteProject}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {matching.length > PROJECTS_PAGE_SIZE && (
        <Pagination
          page={safePage + 1}
          hasPrev={safePage > 0}
          hasMore={(safePage + 1) * PROJECTS_PAGE_SIZE < matching.length}
          onPrev={() => setPageIndex(safePage - 1)}
          onNext={() => setPageIndex(safePage + 1)}
        />
      )}

      {dialog}
    </div>
  );
}
