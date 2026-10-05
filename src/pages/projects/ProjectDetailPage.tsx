import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { toast } from 'sonner';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import WikiContent from '../../components/wiki/WikiContent';
import {
  Activity, BarChart2, BookOpen, Calendar, Check, CheckSquare, ChevronLeft, Download, Eye, EyeOff, FileJson, FolderOpen,
  Layers, Lock, Pencil, Plus, Search, Timer, Trash2, UserMinus, UserPlus, Users,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useProject, useUpdateProject, usePauseProject, useResumeProject, useProjectThroughput, useProjectActivity, useFollowedProjects, useFollowProject, useUnfollowProject, useProjectMembers, useAddProjectMember, useRemoveProjectMember, useAddProjectTeam } from '../../api/projects';
import { useTeamList } from '../../api/teams';
import { useWikiPages, useWikiPage, useCreateWikiPage, useUpdateWikiPage, useDeleteWikiPage, useWikiRevisions, useWikiRevision, downloadWikiPagePdf } from '../../api/wiki';
import { useTaskList, useInfiniteTaskList, useAllTasks, useBulkCreateTasks } from '../../api/tasks';
import { useEngineerList } from '../../api/engineers';
import { useEpicsByProject, useCreateEpic, useDeleteEpic } from '../../api/epics';
import { useSprintList } from '../../api/sprints';
import { useCursorPagination } from '../../hooks/useCursorPagination';
import { Pagination } from '../../components/ui/Pagination';
import type { BulkCreateTaskItem } from '../../api/tasks';
import type { EpicDto, EpicStatus, TaskStatus, WikiPageSummaryDto } from '../../types/api';

import { applyServerErrors } from '../../lib/formErrors';
import TaskPreviewDrawer from '../../components/tasks/TaskPreviewDrawer';
import TaskBoard from '../../components/tasks/TaskBoard';
import PageHeader from '../../components/layout/PageHeader';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { DetailPageSkeleton, Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import ErrorState from '../../components/ui/ErrorState';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { RichTextContent } from '@/components/ui/rich-text-content';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Switch } from '@/components/ui/switch';
import { cn, stripHtml } from '@/lib/utils';
import { formatDate, formatDateTime, daysLate } from '../../lib/dates';
import { formatPtsDays } from '../../lib/points';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip);

const TASK_PAGE_SIZE = 20;
/** Epics listed at first on the Epics tab; "Show more" reveals the rest. */
const EPICS_SHOWN = 20;
const WIKI_PAGE_SIZE = 10;

const STATUS_VARIANT: Record<TaskStatus, 'green' | 'red' | 'gray' | 'yellow'> = {
  backlog: 'gray', active: 'green', blocked: 'red', inQa: 'gray', done: 'gray', paused: 'yellow',
};

const EPIC_STATUS_STYLES: Record<string, string> = {
  NotStarted: 'bg-muted text-muted-foreground',
  InProgress:  'bg-primary/10 text-primary',
  Done:        'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
};

const EPIC_STATUS_LABEL: Record<string, string> = {
  NotStarted: 'Not started', InProgress: 'In progress', Done: 'Done',
};

const CHART_OPTIONS = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, title: { display: false } },
  scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } },
};

type Tab = 'epics' | 'tasks' | 'throughput' | 'activity' | 'wiki';
interface EditForm { name: string; description: string; ownerTeamId: string; code: string; }
interface EpicForm { title: string; description: string; }
interface WikiForm { title: string; content: string; restrictedToMembers: boolean; }

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { allow } = useAuth();
  const isPm        = allow('pm-or-above');
  const isProductPm = allow('product-manager-or-above');
  // Follow/Unfollow is team lead and above — same capability the Dashboard's Followed
  // projects section uses.
  const canFollowProjects = allow('project-follow');
  const isPmo       = allow('pmo-only'); // archiving is [PmoOnly], not all of PmOrAbove

  const wikiParam = searchParams.get('wiki');
  const [tab, setTab]           = useState<Tab>(wikiParam ? 'wiki' : 'epics');
  const [editing, setEditing]   = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [showEpicForm, setShowEpicForm] = useState(false);
  const [epicStatusFilter, setEpicStatusFilter] = useState<EpicStatus | 'all'>('all');
  const [epicSprintFilter, setEpicSprintFilter] = useState<'all' | 'backlog' | string>('all');
  const [epicLimit, setEpicLimit] = useState(EPICS_SHOWN);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(wikiParam ?? null);
  const [wikiMode, setWikiMode] = useState<'view' | 'create' | 'edit'>('view');
  // A wiki-internal link (WikiContent's `a` override) navigates via router `navigate()` rather
  // than the in-app row-click handlers below, so the `?wiki=` param can change without this
  // component remounting — re-sync selectedPageId/tab whenever that happens.
  useEffect(() => {
    if (wikiParam && wikiParam !== selectedPageId) {
      setTab('wiki');
      setWikiMode('view');
      setSelectedPageId(wikiParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wikiParam]);
  const [wikiEditorTab, setWikiEditorTab] = useState<'write' | 'preview'>('write');
  const [showHistory, setShowHistory] = useState(false);
  const [downloadingWikiPdf, setDownloadingWikiPdf] = useState(false);
  const [downloadingListPageId, setDownloadingListPageId] = useState<string | null>(null);
  const [viewingRevisionId, setViewingRevisionId] = useState<string | null>(null);
  const [wikiPageIndex, setWikiPageIndex] = useState(0);
  const [previewTaskId, setPreviewTaskId] = useState<string | null>(null);
  const [showBacklogOnly, setShowBacklogOnly] = useState(false);
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'board'>('list');
  const { confirm, dialog } = useConfirm();

  const { data: project, isLoading, error, refetch } = useProject(id!);
  const { data: throughput, isLoading: throughputLoading } = useProjectThroughput(id!);
  const { cursor: activityCursor, hasPrev: activityHasPrev, pageNumber: activityPage, goNext: activityGoNext, goPrev: activityGoPrev } =
    useCursorPagination({ urlKey: 'activityCursor' });
  const { data: activity, isLoading: activityLoading } = useProjectActivity(id!, activityCursor);
  const { cursor: taskCursor, hasPrev: taskHasPrev, pageNumber: taskPage, goNext: taskGoNext, goPrev: taskGoPrev, reset: taskCursorReset } =
    useCursorPagination({ urlKey: 'taskCursor' });
  const { data: tasks, isLoading: tasksLoading } = useTaskList({
    projectId: id, status: showBacklogOnly ? 'backlog' : undefined, cursor: taskCursor, limit: TASK_PAGE_SIZE,
  });
  const { data: epics, isLoading: epicsLoading } = useEpicsByProject(id!);
  const { data: engineers } = useEngineerList();
  // Scoped to this project — an unscoped fetch would pull in every other project's sprints too,
  // corrupting both the "current sprint" widget below and the epic/board sprint filters.
  const { data: sprints } = useSprintList(undefined, id);
  const [boardSprintId, setBoardSprintId] = useState<'all' | 'backlog' | string>('all');
  const [boardSprintInitialized, setBoardSprintInitialized] = useState(false);
  // The board loads 100 tasks at a time and says so when there are more, rather than quietly leaving the rest off.
  const {
    items: boardTaskItems, isLoading: boardTasksLoading,
    hasNextPage: boardHasMore, isFetchingNextPage: boardLoadingMore, fetchNextPage: loadMoreBoardTasks,
  } = useInfiniteTaskList(
    {
      projectId: id,
      sprintId: boardSprintId !== 'all' && boardSprintId !== 'backlog' ? boardSprintId : undefined,
      noSprint: boardSprintId === 'backlog' ? true : undefined,
      limit: 100,
    },
    taskViewMode === 'board',
  );
  const activeSprint = (sprints ?? []).find((s) => s.status === 'Active');
  // Defaults the board to the active sprint once sprints load, without clobbering a manual pick.
  useEffect(() => {
    if (!boardSprintInitialized && activeSprint) {
      setBoardSprintId(activeSprint.id);
      setBoardSprintInitialized(true);
    }
  }, [activeSprint, boardSprintInitialized]);
  // All of the sprint's tasks, so its progress isn't worked out from a list cut off at 100.
  const { items: sprintTasks } = useAllTasks({ sprintId: activeSprint?.id, limit: 100 }, !!activeSprint);
  const { data: followedProjects } = useFollowedProjects(canFollowProjects);
  const followProject   = useFollowProject();
  const unfollowProject = useUnfollowProject();
  const isFollowing     = followedProjects?.some((p) => p.projectId === id) ?? false;
  const updateProject  = useUpdateProject(id!);
  const pauseProject   = usePauseProject(id!);
  const resumeProject  = useResumeProject(id!);
  const bulkCreate     = useBulkCreateTasks();
  const createEpic     = useCreateEpic(id!);
  const deleteEpic     = useDeleteEpic(id!);

  const { data: wikiPages, isLoading: wikiLoading } = useWikiPages(id!);
  const { data: wikiPage } = useWikiPage(id!, selectedPageId);
  // A wiki-internal link can carry a heading anchor (WikiContent appends "#slug" to the target
  // URL) — the target page's content renders async once wikiPage data arrives, so poll briefly
  // for the heading (rehype-slug gives it a matching id) rather than assuming it's already there.
  useEffect(() => {
    if (!location.hash || tab !== 'wiki' || wikiMode !== 'view') return;
    const targetId = location.hash.slice(1);
    let cancelled = false;
    let attempts = 0;
    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(targetId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else if (attempts < 20) {
        attempts += 1;
        setTimeout(tryScroll, 100);
      }
    };
    tryScroll();
    return () => { cancelled = true; };
  }, [location.hash, wikiPage?.content, tab, wikiMode]);
  const { data: wikiRevisions } = useWikiRevisions(id!, selectedPageId);
  const { data: viewingRevision } = useWikiRevision(id!, selectedPageId, viewingRevisionId);
  const createWikiPage = useCreateWikiPage(id!);
  const updateWikiPage = useUpdateWikiPage(id!);
  const deleteWikiPage = useDeleteWikiPage(id!);
  const wikiForm = useForm<WikiForm>();

  const { data: members } = useProjectMembers(id!);
  const addMember         = useAddProjectMember(id!);
  const removeMember      = useRemoveProjectMember(id!);
  const addTeam           = useAddProjectTeam(id!);
  const { data: teams }   = useTeamList();
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setPickerOpen(false);
    }
    if (pickerOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [pickerOpen]);

  const { register, control, handleSubmit, setError, reset, formState: { errors } } = useForm<EditForm>();
  const epicForm = useForm<EpicForm>({ defaultValues: { description: '' } });

  const onEdit = handleSubmit((values) => {
    updateProject.mutate(
      {
        name: values.name, description: values.description || undefined,
        ownerTeamId: values.ownerTeamId || undefined,
        clearOwnerTeam: !values.ownerTeamId,
        code: values.code || undefined,
      },
      {
        onSuccess: () => { toast.success('Project updated.'); setEditing(false); },
        onError:   (e) => applyServerErrors(e, setError),
      },
    );
  });

  const onArchive = async () => {
    if (!await confirm({ title: `Archive "${project?.name}"?`, description: 'This cannot be undone.', confirmLabel: 'Archive' })) return;
    updateProject.mutate(
      { archive: true },
      {
        onSuccess: () => { toast.success('Project archived.'); navigate('/projects'); },
        onError:   () => toast.error('Failed to archive project.'),
      },
    );
  };

  const onPause = async () => {
    if (!await confirm({
      title: `Pause "${project?.name}"?`,
      description: 'Every active or blocked task in this project will be paused and stop counting toward workload or escalations until the project is resumed.',
      confirmLabel: 'Pause project',
    })) return;
    pauseProject.mutate(undefined, {
      onSuccess: () => toast.success('Project paused.'),
      onError:   () => toast.error('Failed to pause project.'),
    });
  };

  const onResume = async () => {
    if (!await confirm({
      title: `Resume "${project?.name}"?`,
      description: 'Tasks this hold paused will reactivate, with due dates shifted forward by however long the project was paused.',
      confirmLabel: 'Resume project',
    })) return;
    resumeProject.mutate(undefined, {
      onSuccess: () => toast.success('Project resumed.'),
      onError:   () => toast.error('Failed to resume project.'),
    });
  };

  const onImport = () => {
    setImportError(null);
    let parsed: BulkCreateTaskItem[];
    try {
      parsed = JSON.parse(importJson);
      if (!Array.isArray(parsed)) throw new Error('Expected a JSON array.');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON.');
      return;
    }
    bulkCreate.mutate(
      { projectId: id!, tasks: parsed },
      {
        onSuccess: (result) => {
          toast.success(result.created === 1 ? '1 task imported.' : `${result.created} tasks imported.`);
          if (result.failed.length > 0) {
            toast.warning(`${result.failed.length} task(s) skipped.`);
            setImportError(result.failed.map((f) => `Row ${f.index + 1}: ${f.error}`).join('\n'));
          } else { setShowImport(false); setImportJson(''); }
        },
        onError: () => setImportError('Import failed. Please try again.'),
      },
    );
  };

  const onCreateEpic = epicForm.handleSubmit((values) => {
    createEpic.mutate(
      { title: values.title, description: values.description || undefined },
      {
        onSuccess: () => { toast.success('Epic created.'); epicForm.reset(); setShowEpicForm(false); },
        onError:   () => toast.error('Failed to create epic.'),
      },
    );
  });

  const onDeleteEpic = async (epic: EpicDto) => {
    if (!await confirm({ title: `Delete "${epic.title}"?`, description: 'Tasks in this epic will lose their epic association.', confirmLabel: 'Delete' })) return;
    deleteEpic.mutate(epic.id, { onSuccess: () => toast.success('Epic deleted.') });
  };

  const onCreateWikiPage = wikiForm.handleSubmit((values) => {
    createWikiPage.mutate(values, {
      onSuccess: (page) => {
        toast.success('Page created.');
        wikiForm.reset();
        setWikiMode('view');
        setSelectedPageId(page.id);
      },
      onError: () => toast.error('Failed to create page.'),
    });
  });

  const onUpdateWikiPage = wikiForm.handleSubmit((values) => {
    if (!selectedPageId) return;
    updateWikiPage.mutate({ pageId: selectedPageId, ...values }, {
      onSuccess: () => { toast.success('Page saved.'); setWikiMode('view'); },
      onError: () => toast.error('Failed to save page.'),
    });
  });

  const onDeleteWikiPage = async (page: WikiPageSummaryDto) => {
    if (!await confirm({ title: `Delete "${page.title}"?`, description: 'This cannot be undone.', confirmLabel: 'Delete' })) return;
    deleteWikiPage.mutate(page.id, {
      onSuccess: () => {
        toast.success('Page deleted.');
        if (selectedPageId === page.id) setSelectedPageId(null);
        setWikiPageIndex(0);
      },
    });
  };

  if (isLoading) return <DetailPageSkeleton maxW="4xl" />;
  if (error || !project) return <ErrorState error={error} onRetry={refetch} />;

  const taskItems = tasks?.items ?? [];

  const sprintDone   = sprintTasks.filter((t) => t.status === 'done').length;
  const sprintPct    = sprintTasks.length > 0 ? Math.round((sprintDone / sprintTasks.length) * 100) : 0;
  const sprintDaysLeft = activeSprint
    ? Math.ceil((new Date(activeSprint.endDate).getTime() - Date.now()) / 86_400_000)
    : 0;

  const filteredEpics = (epics ?? []).filter((e) => {
    if (epicStatusFilter !== 'all' && e.status !== epicStatusFilter) return false;
    if (epicSprintFilter === 'backlog' && e.sprintId) return false;
    if (epicSprintFilter !== 'all' && epicSprintFilter !== 'backlog' && e.sprintId !== epicSprintFilter) return false;
    return true;
  });
  const chartLabels = (throughput ?? []).map((w) => {
    const d = new Date(w.weekOf);
    return `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
  });
  const chartData = {
    labels: chartLabels,
    datasets: [{ data: (throughput ?? []).map((w) => w.pointsDelivered), backgroundColor: 'rgb(99, 102, 241)', borderRadius: 4 }],
  };

  return (
    <div className="max-w-3xl">
      {dialog}
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-4 w-4" /> All projects
      </Link>

      <PageHeader
        breadcrumbs={[{ label: 'Projects', href: '/projects' }]}
        title={project.name}
        actions={
          canFollowProjects || (isPm && (project.isActive || project.status === 'paused')) ? (
            <div className="flex gap-2">
              {canFollowProjects && (
                <Button
                  size="sm"
                  variant={isFollowing ? 'primary' : 'secondary'}
                  loading={followProject.isPending || unfollowProject.isPending}
                  onClick={() => {
                    if (isFollowing) {
                      unfollowProject.mutate(id!, {
                        onSuccess: () => toast.success('Unfollowed project.'),
                        onError:   () => toast.error('Failed to unfollow.'),
                      });
                    } else {
                      followProject.mutate(id!, {
                        onSuccess: () => toast.success('Now following project.'),
                        onError:   () => toast.error('Failed to follow.'),
                      });
                    }
                  }}
                >
                  {isFollowing
                    ? <><EyeOff className="mr-1.5 h-3.5 w-3.5" />Unfollow</>
                    : <><Eye    className="mr-1.5 h-3.5 w-3.5" />Follow</>}
                </Button>
              )}
              {isPm && project.isActive && (
                <>
                  <Button size="sm" variant="ghost"
                    onClick={() => { setEditing((v) => !v); reset({ name: project.name, description: project.description ?? '', ownerTeamId: project.ownerTeamId ?? '', code: project.code }); }}>
                    {editing ? 'Cancel' : 'Edit'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={onPause} loading={pauseProject.isPending}>Pause</Button>
                  {isPmo && (
                    <Button size="sm" variant="ghost" onClick={onArchive} loading={updateProject.isPending}>Archive</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { setShowImport((v) => !v); setImportError(null); }}>
                    {showImport ? 'Cancel' : 'Import tasks'}
                  </Button>
                </>
              )}
              {isPm && project.status === 'paused' && (
                <Button size="sm" onClick={onResume} loading={resumeProject.isPending}>Resume</Button>
              )}
              {project.isActive && (
                <Button size="sm" onClick={() => navigate(`/tasks/new?projectId=${id}`)}>New task</Button>
              )}
            </div>
          ) : undefined
        }
      />

      {/* Meta */}
      {!editing && (
        <Card className={cn('mb-6 overflow-hidden border-l-4', {
          'border-l-primary':   project.status === 'active',
          'border-l-yellow-400': project.status === 'paused',
          'border-l-gray-300':  project.status === 'archived',
        })}>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                label={project.status}
                variant={project.status === 'active' ? 'green' : project.status === 'paused' ? 'yellow' : 'gray'}
              />
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                Created {formatDate(project.createdAt)}
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                {project.code}
              </span>
            </div>
            {project.description && <RichTextContent html={project.description} className="text-muted-foreground" />}
          </CardContent>
        </Card>
      )}

      {editing && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <FolderOpen className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Edit project</p>
          </div>
          <form onSubmit={onEdit}>
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
                <Label>Owner team</Label>
                <Controller
                  name="ownerTeamId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="— unassigned —"
                      emptyLabel="No matching teams"
                      options={[{ value: '', label: '— unassigned —' }, ...(teams ?? []).filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))]}
                    />
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  A project with no owner team won't appear in that team's Weekly Report.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Code</Label>
                <Input {...register('code')} />
                <p className="text-xs text-muted-foreground">
                  Prefix for this project's task IDs (e.g. "NOTIF" for task keys like NOTIF-011). Changing it only
                  affects new tasks — existing task keys keep their old prefix.
                </p>
                {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
              </div>
            </div>
            <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
              <Button size="sm" type="submit" loading={updateProject.isPending}>Save</Button>
              <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {showImport && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
              <FileJson className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-foreground">Import tasks from JSON</p>
          </div>
          <CardContent className="p-4">
            <p className="mb-3 text-xs text-muted-foreground">
              Paste a JSON array. Each item must have <code className="rounded bg-muted px-1">title</code>. <code className="rounded bg-muted px-1">dueDate</code> (YYYY-MM-DD) is optional — but required once you set <code className="rounded bg-muted px-1">points</code> or <code className="rounded bg-muted px-1">assigneeId</code>. Omit points to import ungroomed and estimate later.
            </p>
            <Textarea rows={8} className="mb-3 font-mono text-xs" placeholder="Paste JSON here…"
              value={importJson} onChange={(e) => setImportJson(e.target.value)} />
            {importError && (
              <pre className="mb-3 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive whitespace-pre-wrap">{importError}</pre>
            )}
            <Button size="sm" onClick={onImport} loading={bulkCreate.isPending}>Import</Button>
          </CardContent>
        </Card>
      )}

      {/* Current sprint */}
      {activeSprint && sprintTasks.length > 0 && (
        <Card className="mb-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                <Timer className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Current sprint</p>
                <p className="text-sm font-semibold text-foreground">{activeSprint.name}</p>
              </div>
            </div>
            <Link
              to={`/sprints/${activeSprint.id}`}
              className="text-xs font-medium text-primary hover:underline"
            >
              View sprint
            </Link>
          </div>
          <CardContent className="p-4">
            <div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(activeSprint.startDate)} → {formatDate(activeSprint.endDate)}
              </span>
              <span className={cn(
                'inline-flex items-center gap-1 font-medium',
                sprintDaysLeft < 0 ? 'text-destructive' : sprintDaysLeft <= 2 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
              )}>
                {sprintDaysLeft < 0
                  ? `${Math.abs(sprintDaysLeft)}d overdue`
                  : sprintDaysLeft === 0 ? 'Ends today'
                  : `${sprintDaysLeft}d remaining`}
              </span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{sprintDone} / {sprintTasks.length} tasks done</span>
                <span>{sprintPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn('h-full rounded-full transition-all', sprintPct === 100 ? 'bg-emerald-500' : 'bg-primary')}
                  style={{ width: `${sprintPct}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Members */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Project members</p>
              <p className="text-sm font-semibold text-foreground">
                {(members?.length ?? 0) === 0 ? 'No members yet' : `${members!.length} member${members!.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {isPm && project.isActive && (
            <div className="flex items-center gap-2">
              {(teams?.filter((t) => t.isActive).length ?? 0) > 0 && (
                // Always passed value="" — this is a one-shot action picker (pick a team, its
                // members get added, the box resets to blank), not a persistent selection, so it
                // never reflects the team just picked back as "selected".
                <SearchableSelect
                  className="w-44 [&_input]:h-7 [&_input]:text-xs [&_input]:border-border [&_input]:bg-muted/50 [&_input]:font-medium hover:[&_input]:bg-muted"
                  value=""
                  disabled={addTeam.isPending}
                  onChange={(teamId) => {
                    if (!teamId) return;
                    const team = teams!.find((t) => t.id === teamId);
                    addTeam.mutate(teamId, {
                      onSuccess: () => toast.success(`Added ${team?.name ?? 'team'} members.`),
                      onError: () => toast.error('Failed to add team members.'),
                    });
                  }}
                  placeholder="Add team…"
                  emptyLabel="No matching teams"
                  options={teams!.filter((t) => t.isActive).map((t) => ({ value: t.id, label: t.name }))}
                />
              )}
              <div className="relative" ref={pickerRef}>
                <button
                  onClick={() => { setPickerOpen((v) => !v); setPickerSearch(''); }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add members
                </button>

              {pickerOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-lg border border-border bg-background shadow-lg">
                  {/* Search */}
                  <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                    <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search engineers…"
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>

                  {/* Engineer list */}
                  <div className="max-h-60 overflow-y-auto py-1">
                    {(() => {
                      const q = pickerSearch.toLowerCase();
                      const list = (engineers ?? [])
                        .filter((e) => e.isActive && (!q || e.name.toLowerCase().includes(q) || e.role.toLowerCase().includes(q)))
                        .sort((a, b) => a.name.localeCompare(b.name));

                      if (list.length === 0)
                        return <p className="px-3 py-4 text-center text-xs text-muted-foreground">No engineers found.</p>;

                      return list.map((e) => {
                        const isMember = members?.some((m) => m.engineerId === e.id) ?? false;
                        return (
                          <button
                            key={e.id}
                            className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                            onClick={() => {
                              if (isMember) {
                                removeMember.mutate(e.id, { onSuccess: () => toast.success(`${e.name} removed.`) });
                              } else {
                                addMember.mutate(e.id, { onSuccess: () => toast.success(`${e.name} added.`), onError: () => toast.error('Failed to add member.') });
                              }
                            }}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                              {e.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-foreground">{e.name}</p>
                              <p className="text-xs text-muted-foreground capitalize">{e.role.replace(/_/g, ' ')}</p>
                            </div>
                            {isMember && <Check className="h-4 w-4 shrink-0 text-primary" />}
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          {(members?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No members yet{isPm && project.isActive ? ' — use Add members to assign engineers.' : '.'}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members!.map((m) => (
                <div key={m.engineerId} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 pl-2.5 pr-1.5 py-1 text-xs">
                  <span className="font-medium text-foreground">{m.name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground capitalize">{m.role.replace(/_/g, ' ')}</span>
                  {isPm && project.isActive && (
                    <button
                      onClick={() => removeMember.mutate(m.engineerId, { onSuccess: () => toast.success(`${m.name} removed.`) })}
                      className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      title={`Remove ${m.name}`}
                    >
                      <UserMinus className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs — overflow-x-auto rather than wrapping: on a narrow viewport the five tabs don't
          fit in one row, and without this the row just clips (Wiki becomes untappable) since
          nothing here forces the page itself to scroll horizontally. shrink-0 keeps each label
          at its natural width instead of getting squeezed as the row scrolls. */}
      <div className="mb-5 flex overflow-x-auto border-b border-border">
        {(['epics', 'tasks', 'throughput', 'activity', 'wiki'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              'shrink-0 px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
              tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* Epics tab */}
      {tab === 'epics' && (
        <div className="space-y-4">
          {isProductPm && project.isActive && (
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setShowEpicForm((v) => !v)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {showEpicForm ? 'Cancel' : 'New epic'}
              </Button>
            </div>
          )}

          {showEpicForm && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
                  <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <p className="text-sm font-semibold text-foreground">New epic</p>
              </div>
              <form onSubmit={onCreateEpic}>
                <div className="space-y-3 px-5 py-4">
                  <div className="space-y-1.5">
                    <Label>Title <span className="text-destructive">*</span></Label>
                    <Input {...epicForm.register('title', { required: 'Title is required' })} placeholder="e.g. User Authentication" />
                    {epicForm.formState.errors.title && (
                      <p className="text-xs text-destructive">{epicForm.formState.errors.title.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description</Label>
                    <Controller
                      name="description"
                      control={epicForm.control}
                      render={({ field }) => <RichTextEditor value={field.value} onChange={field.onChange} />}
                    />
                  </div>
                </div>
                <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
                  <Button size="sm" type="submit" loading={createEpic.isPending}>Create epic</Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => setShowEpicForm(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          )}

          {!epicsLoading && (epics?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-border overflow-hidden text-xs">
                {(['all', 'NotStarted', 'InProgress', 'Done'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setEpicStatusFilter(s)}
                    className={cn(
                      'px-3 py-1.5 font-medium transition-colors border-r border-border last:border-r-0',
                      epicStatusFilter === s
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    {s === 'all' ? 'All' : s === 'NotStarted' ? 'Not started' : s === 'InProgress' ? 'In progress' : 'Done'}
                  </button>
                ))}
              </div>
              <select
                value={epicSprintFilter}
                onChange={(e) => setEpicSprintFilter(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="all">All sprints</option>
                <option value="backlog">Backlog only</option>
                {(sprints ?? []).map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {(epicStatusFilter !== 'all' || epicSprintFilter !== 'all') && (
                <button
                  onClick={() => { setEpicStatusFilter('all'); setEpicSprintFilter('all'); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}

          {epicsLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (epics?.length ?? 0) === 0 ? (
            <Card>
              <EmptyState icon={Layers} title="No epics yet"
                description="Epics group related tasks together. Create one to start building the backlog."
                action={isProductPm && project.isActive
                  ? <Button size="sm" onClick={() => setShowEpicForm(true)}>Create first epic</Button>
                  : undefined}
              />
            </Card>
          ) : filteredEpics.length === 0 ? (
            <Card>
              <EmptyState icon={Layers} title="No epics match"
                description="Try adjusting the status or sprint filter."
                action={
                  <button onClick={() => { setEpicStatusFilter('all'); setEpicSprintFilter('all'); }}
                    className="text-sm text-primary hover:underline">
                    Clear filters
                  </button>
                }
              />
            </Card>
          ) : (
            <Card className="divide-y divide-border overflow-hidden p-0">
              {filteredEpics.slice(0, epicLimit).map((epic) => (
                <div
                  key={epic.id}
                  className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                  onClick={() => navigate(`/epics/${epic.id}`)}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-violet-50 dark:bg-violet-950/40">
                    <Layers className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{epic.title}</p>
                    {epic.totalTasks > 0 ? (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full transition-all', epic.completedTasks === epic.totalTasks ? 'bg-emerald-500' : 'bg-primary')}
                            style={{ width: `${Math.round((epic.completedTasks / epic.totalTasks) * 100)}%` }}
                          />
                        </div>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {epic.completedTasks}/{epic.totalTasks}
                        </span>
                      </div>
                    ) : epic.description ? (
                      <p className="truncate text-xs text-muted-foreground">{stripHtml(epic.description)}</p>
                    ) : null}
                  </div>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-medium', EPIC_STATUS_STYLES[epic.status])}>
                    {EPIC_STATUS_LABEL[epic.status]}
                  </span>
                  {epic.sprintId && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      In sprint
                    </span>
                  )}
                  {isProductPm && project.isActive && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); onDeleteEpic(epic); }}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
              {filteredEpics.length > epicLimit && (
                <button
                  type="button"
                  onClick={() => setEpicLimit((n) => n + EPICS_SHOWN)}
                  className="block w-full px-5 py-2.5 text-left text-xs font-medium text-primary hover:bg-muted/40"
                >
                  Show {Math.min(EPICS_SHOWN, filteredEpics.length - epicLimit)} more ({filteredEpics.length - epicLimit} not shown)
                </button>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Tasks tab */}
      {tab === 'tasks' && (
        <section>
          {tasksLoading && taskViewMode === 'list' ? (
            <Skeleton className="h-32 w-full" />
          ) : taskItems.length === 0 && !showBacklogOnly && taskPage === 1 && taskViewMode === 'list' ? (
            <Card>
              <EmptyState icon={CheckSquare} title="No tasks yet"
                description="Tasks assigned to this project will appear here."
                action={project.isActive
                  ? <Button size="sm" onClick={() => navigate(`/tasks/new?projectId=${id}`)}>Add first task</Button>
                  : undefined}
              />
            </Card>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between gap-2">
                {taskViewMode === 'list' ? (
                  <button
                    type="button"
                    onClick={() => { setShowBacklogOnly((v) => !v); taskCursorReset(); }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      showBacklogOnly
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70',
                    )}
                  >
                    Backlog only
                  </button>
                ) : (
                  <select
                    value={boardSprintId}
                    onChange={(e) => setBoardSprintId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="all">All sprints</option>
                    <option value="backlog">No sprint</option>
                    {(sprints ?? []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}{s.status === 'Active' ? ' (active)' : ''}</option>
                    ))}
                  </select>
                )}
                <div className="flex rounded-md border border-border overflow-hidden text-xs">
                  {(['list', 'board'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setTaskViewMode(m)}
                      className={cn(
                        'px-3 py-1 font-medium capitalize transition-colors border-r border-border last:border-r-0',
                        taskViewMode === m ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
                      )}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              {taskViewMode === 'list' ? (
                <>
                  <Card className="divide-y divide-border overflow-hidden p-0">
                  {taskItems.length === 0 && (
                    <p className="px-5 py-6 text-center text-sm text-muted-foreground">No backlog tasks.</p>
                  )}
                  {taskItems.map((task) => {
                    const days = daysLate(task);
                    // task.assigneeName (not engineerMap) — engineerMap comes from GET /engineers,
                    // which is role-scoped and 403s outright for a plain Engineer/Designer, so it
                    // silently showed "Unknown" for exactly the viewers most likely to be looking
                    // at their own project. The task's own denormalized name is always reliable.
                    const assigneeName = task.assigneeName;
                    const assigneeInitials = assigneeName
                      ? assigneeName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
                      : null;
                    return (
                      <div key={task.id}
                        className="flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                        onClick={() => navigate(`/tasks/${task.id}`)}>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {task.taskKey && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{task.taskKey}</span>}
                            {task.title}
                          </p>
                          {assigneeName && (
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
                                {assigneeInitials}
                              </div>
                              <p className="text-xs text-muted-foreground">{assigneeName}</p>
                            </div>
                          )}
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {task.points} pts
                          {(() => { const d = formatPtsDays(task.points, engineers?.find(e => e.id === task.assigneeId)); return d ? ` · ${d}` : ''; })()}
                        </span>
                        <span className={cn('shrink-0 text-xs', days === null ? 'text-muted-foreground' : days < 0 ? 'font-medium text-destructive' : days <= 3 ? 'text-yellow-600' : 'text-muted-foreground')}>
                          {days === null ? 'Unscheduled' : days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'due today' : `${days}d left`}
                        </span>
                        <Badge label={task.status} variant={STATUS_VARIANT[task.status]} />
                      </div>
                    );
                  })}
                  </Card>
                  <Pagination
                    hasPrev={taskHasPrev}
                    hasMore={tasks?.hasMore ?? false}
                    page={taskPage}
                    onPrev={taskGoPrev}
                    onNext={() => { if (tasks?.nextCursor) taskGoNext(tasks.nextCursor); }}
                  />
                </>
              ) : boardTasksLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <>
                  <TaskBoard tasks={boardTaskItems} engineers={engineers} onOpenTask={setPreviewTaskId} />
                  {boardHasMore && (
                    <div className="mt-3 flex items-center gap-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                      <span>Showing {boardTaskItems.length} tasks — there are more. Pick a sprint above to narrow the board, or load the rest.</span>
                      <Button size="sm" variant="ghost" className="ml-auto" loading={boardLoadingMore} onClick={() => void loadMoreBoardTasks()}>
                        Load more
                      </Button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      )}

      {/* Wiki tab */}
      {tab === 'wiki' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            {selectedPageId && wikiMode === 'view' && (
              <button
                onClick={() => { setSelectedPageId(null); setShowHistory(false); setViewingRevisionId(null); }}
                className="mr-1 text-xs text-muted-foreground hover:text-foreground"
              >
                ← All pages
              </button>
            )}
            <span className="flex-1" />
            {wikiMode === 'view' && selectedPageId && wikiPage && !viewingRevisionId && (
              <Button
                size="sm"
                variant="ghost"
                loading={downloadingWikiPdf}
                onClick={async () => {
                  setDownloadingWikiPdf(true);
                  try {
                    await downloadWikiPagePdf(id!, wikiPage.id, wikiPage.title);
                  } catch {
                    toast.error('Failed to download PDF.');
                  } finally {
                    setDownloadingWikiPdf(false);
                  }
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download PDF
              </Button>
            )}
            {isPm && project.isActive && wikiMode === 'view' && !selectedPageId && (
              <Button size="sm" onClick={() => { setWikiMode('create'); wikiForm.reset({ title: '', content: '', restrictedToMembers: false }); setWikiEditorTab('write'); }}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New page
              </Button>
            )}
            {isPm && project.isActive && wikiMode === 'view' && selectedPageId && wikiPage && (
              <Button size="sm" variant="ghost" onClick={() => {
                wikiForm.reset({ title: wikiPage.title, content: wikiPage.content, restrictedToMembers: !!wikiPage.restrictedToMembers });
                setWikiEditorTab('write');
                setWikiMode('edit');
              }}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
              </Button>
            )}
          </div>

          {/* Editor (create / edit) */}
          {(wikiMode === 'create' || wikiMode === 'edit') && (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <BookOpen className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {wikiMode === 'create' ? 'New page' : 'Edit page'}
                </p>
              </div>
              <form onSubmit={wikiMode === 'create' ? onCreateWikiPage : onUpdateWikiPage}>
                <div className="space-y-3 px-5 py-4">
                  <div className="space-y-1.5">
                    <Label>Title <span className="text-destructive">*</span></Label>
                    <Input {...wikiForm.register('title', { required: 'Title is required' })} placeholder="e.g. Architecture Overview" />
                    {wikiForm.formState.errors.title && (
                      <p className="text-xs text-destructive">{wikiForm.formState.errors.title.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Content</Label>
                      <div className="flex rounded-md border border-border overflow-hidden text-xs">
                        {(['write', 'preview'] as const).map((t) => (
                          <button key={t} type="button" onClick={() => setWikiEditorTab(t)}
                            className={cn(
                              'px-3 py-1 font-medium capitalize transition-colors border-r border-border last:border-r-0',
                              wikiEditorTab === t ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted',
                            )}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    {wikiEditorTab === 'write' ? (
                      <Textarea
                        rows={16}
                        className="font-mono text-xs"
                        placeholder="Markdown supported — # Heading, **bold**, `code`, - list…"
                        {...wikiForm.register('content')}
                      />
                    ) : (
                      <div className="min-h-[16rem] rounded-md border border-input bg-background px-3 py-2">
                        <div className="wiki-prose">
                          <WikiContent
                            content={wikiForm.watch('content') || '*Nothing to preview yet.*'}
                            projectId={id!}
                            currentProjectPages={wikiPages}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-foreground"><Lock className="h-3.5 w-3.5" /> Project members only</span>
                      <Switch {...wikiForm.register('restrictedToMembers')} />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Wiki pages are readable by everyone in the organisation. Turn this on to limit this page, and its history, to this project's members.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-border bg-muted/30 px-4 py-2.5">
                  <Button size="sm" type="submit" loading={createWikiPage.isPending || updateWikiPage.isPending}>
                    {wikiMode === 'create' ? 'Create page' : 'Save changes'}
                  </Button>
                  <Button size="sm" variant="ghost" type="button" onClick={() => { setWikiMode('view'); wikiForm.reset(); }}>
                    Cancel
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Page view */}
          {wikiMode === 'view' && selectedPageId && (
            wikiPage ? (
              <div className="space-y-4">
                <Card className="overflow-hidden">
                  <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <p className="text-sm font-semibold text-foreground flex-1">
                      {viewingRevisionId && viewingRevision ? viewingRevision.title : wikiPage.title}
                    </p>
                    {viewingRevisionId ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        Viewing old revision
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">
                        {wikiPage.updatedAt
                          ? `Updated ${new Date(wikiPage.updatedAt).toLocaleDateString()}`
                          : `Created ${new Date(wikiPage.createdAt).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                  {viewingRevisionId && (
                    <div className="flex items-center gap-2 border-b border-border bg-amber-50 px-5 py-2 dark:bg-amber-950/30">
                      <span className="text-xs text-amber-700 dark:text-amber-400">
                        Viewing a past revision from {viewingRevision ? new Date(viewingRevision.createdAt).toLocaleString() : '…'}
                      </span>
                      <button
                        onClick={() => setViewingRevisionId(null)}
                        className="ml-auto text-xs font-medium text-primary hover:underline"
                      >
                        Back to current
                      </button>
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="wiki-prose">
                      <WikiContent
                        content={viewingRevisionId && viewingRevision ? viewingRevision.content : wikiPage.content}
                        projectId={id!}
                        currentProjectPages={wikiPages}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* History panel */}
                {(wikiRevisions?.length ?? 0) > 0 && (
                  <div>
                    <button
                      onClick={() => setShowHistory((v) => !v)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showHistory ? '▲ Hide history' : `▼ History (${wikiRevisions!.length} revision${wikiRevisions!.length === 1 ? '' : 's'})`}
                    </button>
                    {showHistory && (
                      <Card className="mt-2 divide-y divide-border overflow-hidden p-0">
                        {wikiRevisions!.map((rev) => (
                          <div
                            key={rev.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40',
                              viewingRevisionId === rev.id && 'bg-amber-50 dark:bg-amber-950/20',
                            )}
                            onClick={() => setViewingRevisionId(viewingRevisionId === rev.id ? null : rev.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">{rev.title}</p>
                              <p className="text-[10px] text-muted-foreground">
                                Saved {new Date(rev.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <span className="text-xs text-primary">
                              {viewingRevisionId === rev.id ? 'Viewing' : 'View'}
                            </span>
                          </div>
                        ))}
                      </Card>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Card><EmptyState icon={BookOpen} title="Loading page…" description="" /></Card>
            )
          )}

          {/* Page list */}
          {wikiMode === 'view' && !selectedPageId && (
            wikiLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (wikiPages?.length ?? 0) === 0 ? (
              <Card>
                <EmptyState
                  icon={BookOpen}
                  title="No wiki pages yet"
                  description="Document architecture decisions, onboarding guides, and project notes here."
                  action={isPm && project.isActive
                    ? <Button size="sm" onClick={() => { setWikiMode('create'); wikiForm.reset({ title: '', content: '', restrictedToMembers: false }); setWikiEditorTab('write'); }}>Create first page</Button>
                    : undefined}
                />
              </Card>
            ) : (
              <>
              <Card className="divide-y divide-border overflow-hidden p-0">
                {(wikiPages ?? []).slice(wikiPageIndex * WIKI_PAGE_SIZE, (wikiPageIndex + 1) * WIKI_PAGE_SIZE).map((page) => (
                  <div
                    key={page.id}
                    className="flex cursor-pointer items-center gap-3 px-5 py-3 hover:bg-muted/40 transition-colors"
                    onClick={() => { setSelectedPageId(page.id); setShowHistory(false); setViewingRevisionId(null); }}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        {page.title}
                        {page.restrictedToMembers && <Lock className="h-3 w-3 text-muted-foreground" aria-label="Project members only" />}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {page.updatedAt
                          ? `Updated ${new Date(page.updatedAt).toLocaleDateString()}`
                          : `Created ${new Date(page.createdAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      title="Download PDF"
                      disabled={downloadingListPageId === page.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDownloadingListPageId(page.id);
                        try {
                          await downloadWikiPagePdf(id!, page.id, page.title);
                        } catch {
                          toast.error('Failed to download PDF.');
                        } finally {
                          setDownloadingListPageId(null);
                        }
                      }}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {isPm && project.isActive && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onDeleteWikiPage(page); }}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </Card>
              {(wikiPages?.length ?? 0) > WIKI_PAGE_SIZE && (
                <Pagination
                  page={wikiPageIndex + 1}
                  hasPrev={wikiPageIndex > 0}
                  hasMore={(wikiPageIndex + 1) * WIKI_PAGE_SIZE < (wikiPages?.length ?? 0)}
                  onPrev={() => setWikiPageIndex((i) => i - 1)}
                  onNext={() => setWikiPageIndex((i) => i + 1)}
                />
              )}
              </>
            )
          )}
        </div>
      )}

      {/* Throughput tab */}
      {tab === 'throughput' && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <BarChart2 className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Delivered points — last 6 weeks</p>
          </div>
          <CardContent className="p-4">
            {throughputLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : (throughput?.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No throughput data yet.</p>
            ) : (
              <div className="h-44"><Bar data={chartData} options={CHART_OPTIONS} /></div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Activity tab */}
      {tab === 'activity' && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
              <Activity className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground">Recent activity</p>
          </div>
          <CardContent className="p-0">
            {activityLoading ? (
              <div className="space-y-3 p-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (activity?.items.length ?? 0) === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activity!.items.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                    <div className="min-w-0">
                      <p className="text-foreground">
                        <span className="font-medium">{a.actorName}</span> {a.summary}
                      </p>
                      <button
                        type="button"
                        onClick={() => setPreviewTaskId(a.taskId)}
                        className="text-xs text-muted-foreground hover:text-primary"
                      >
                        {a.taskTitle}
                      </button>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      {formatDateTime(a.changedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
          {!activityLoading && (activity?.items.length ?? 0) > 0 && (
            <div className="border-t border-border p-3">
              <Pagination
                hasPrev={activityHasPrev}
                hasMore={activity?.hasMore ?? false}
                onPrev={activityGoPrev}
                onNext={() => activity?.nextCursor && activityGoNext(activity.nextCursor)}
                page={activityPage}
              />
            </div>
          )}
        </Card>
      )}

      <TaskPreviewDrawer taskId={previewTaskId} onClose={() => setPreviewTaskId(null)} />
    </div>
  );
}
