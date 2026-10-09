import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileUp, FolderOpen, CheckSquare, AlertCircle, CheckCircle2, LayoutList, UserPlus } from 'lucide-react';
import HelpTooltip from '../components/ui/HelpTooltip';
import PageHeader from '../components/layout/PageHeader';
import Button from '../components/ui/Button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ImportResult } from '../types/api';
import { useAuth } from '../hooks/useAuth';
import { useCurrentRole } from '../hooks/useCurrentRole';
import {
  useImportProjects,
  useImportTasks,
  useImportBacklog,
  useImportUsers,
  downloadProjectsTemplate,
  downloadTasksTemplate,
  downloadBacklogTemplate,
  downloadUsersTemplate,
} from '../api/import';

interface ImportSectionProps {
  title: string;
  description: string;
  icon: React.ElementType;
  iconBg: string;
  iconCls: string;
  columns: string[];
  columnHints?: Record<string, string>;
  isPending: boolean;
  result: ImportResult | undefined;
  onDownloadTemplate: () => void;
  onUpload: (file: File) => void;
}

function ImportSection({
  title,
  description,
  icon: Icon,
  iconBg,
  iconCls,
  columns,
  columnHints,
  isPending,
  result,
  onDownloadTemplate,
  onUpload,
}: ImportSectionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv')) {
      toast.error('Please select a .csv file.');
      return;
    }
    setFileName(file.name);
    setPendingFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleImport() {
    if (!pendingFile) return;
    onUpload(pendingFile);
  }

  const hasFailures = result && result.failures.length > 0;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
        <div className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-md', iconBg)}>
          <Icon className={cn('h-4 w-4', iconCls)} />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <button
          type="button"
          onClick={onDownloadTemplate}
          className="ml-auto flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
          Template
        </button>
      </div>

      {/* Columns reference */}
      <div className="border-b border-border bg-muted/30 px-4 py-2.5">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Expected columns</p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map((col) => {
            const hint = columnHints?.[col.replace(' *', '')];
            return (
              <span key={col} className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground">
                {col}
                {hint && <HelpTooltip title={col.replace(' *', '')} body={hint} side="top" />}
              </span>
            );
          })}
        </div>
      </div>

      {/* Drop zone */}
      <CardContent className="p-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed py-6 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          <FileUp className={cn('h-8 w-8', fileName ? 'text-primary' : 'text-muted-foreground/50')} />
          {fileName ? (
            <p className="text-sm font-medium text-foreground">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-foreground">Drop your CSV here</p>
              <p className="text-xs text-muted-foreground">or click to browse</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      </CardContent>

      {/* Result */}
      {result && (
        <div className={cn('border-t px-5 py-4', hasFailures ? 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30')}>
          <div className="flex items-center gap-2 mb-2">
            {hasFailures
              ? <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
              : <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            <p className={cn('text-sm font-medium', hasFailures ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400')}>
              {result.created} row{result.created !== 1 ? 's' : ''} imported successfully
              {hasFailures && ` · ${result.failures.length} skipped`}
            </p>
          </div>
          {hasFailures && (
            <div className="space-y-1">
              {result.failures.map((f) => (
                <p key={f.row} className="text-xs text-amber-700 dark:text-amber-400">
                  <span className="font-medium">Row {f.row}:</span> {f.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border bg-muted/30 px-4 py-3">
        <Button
          onClick={handleImport}
          disabled={!pendingFile}
          loading={isPending}
          size="sm"
        >
          Import {title.toLowerCase()}
        </Button>
      </div>
    </Card>
  );
}

type TabId = 'backlog' | 'projects' | 'tasks' | 'users';

export default function ImportPage() {
  const { allow } = useAuth();
  const isHead  = allow('any-head');
  const { isPmo } = useCurrentRole();

  const [activeTab, setActiveTab] = useState<TabId>('backlog');

  const importProjects = useImportProjects();
  const importTasks = useImportTasks();
  const importBacklog = useImportBacklog();
  const importUsers = useImportUsers();

  const [projectsResult, setProjectsResult] = useState<ImportResult | undefined>();
  const [tasksResult, setTasksResult] = useState<ImportResult | undefined>();
  const [backlogResult, setBacklogResult] = useState<ImportResult | undefined>();
  const [usersResult, setUsersResult] = useState<ImportResult | undefined>();

  function handleImportProjects(file: File) {
    importProjects.mutate(file, {
      onSuccess: (result) => {
        setProjectsResult(result);
        if (result.created > 0) toast.success(`Imported ${result.created} project(s).`);
        else toast.warning('No projects were imported.');
      },
      onError: () => toast.error('Failed to import projects. Check the file format.'),
    });
  }

  function handleImportTasks(file: File) {
    importTasks.mutate(file, {
      onSuccess: (result) => {
        setTasksResult(result);
        if (result.created > 0) toast.success(`Imported ${result.created} task(s).`);
        else toast.warning('No tasks were imported.');
      },
      onError: () => toast.error('Failed to import tasks. Check the file format.'),
    });
  }

  function handleImportBacklog(file: File) {
    importBacklog.mutate(file, {
      onSuccess: (result) => {
        setBacklogResult(result);
        if (result.created > 0) toast.success(`Imported ${result.created} backlog item(s).`);
        else toast.warning('No backlog items were imported.');
      },
      onError: () => toast.error('Failed to import backlog. Check the file format.'),
    });
  }

  function handleImportUsers(file: File) {
    importUsers.mutate(file, {
      onSuccess: (result) => {
        setUsersResult(result);
        if (result.created > 0) toast.success(`Invited ${result.created} user(s). Activation emails sent.`);
        else toast.warning('No users were imported.');
      },
      onError: () => toast.error('Failed to import users. Check the file format.'),
    });
  }

  const tabs: { id: TabId; label: string }[] = [
    ...(isHead  ? [{ id: 'users'    as TabId, label: 'Users'    }] : []),
    ...(isPmo   ? [{ id: 'backlog'  as TabId, label: 'Backlog'  }] : []),
    ...(isPmo   ? [{ id: 'projects' as TabId, label: 'Projects' }] : []),
    { id: 'tasks', label: 'Tasks' },
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Import"
        description="Bulk-import existing data from CSV."
      />

      {/* Tab bar */}
      <div className="mb-6 flex border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="mb-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
        Download a template, fill it in, and upload. Use <strong>Backlog</strong> to import your initial product backlog — projects and epics are auto-created.
        Use <strong>Projects</strong> and <strong>Tasks</strong> for ongoing imports that link tasks to existing projects and engineers.
      </p>

      {/* Active tab content */}
      {activeTab === 'users' && isHead && (
        <ImportSection
          title="Users"
          description="Bulk-invite team members. Each user receives an activation email."
          icon={UserPlus}
          iconBg="bg-emerald-50 dark:bg-emerald-950/40"
          iconCls="text-emerald-600 dark:text-emerald-400"
          columns={['name *', 'email *', 'role *', 'team *', 'baseline_points', 'baseline_cycle_days']}
          columnHints={{
            role: 'One of: engineer, team_lead, product_manager, project_manager, head_of_rd, head_of_product, head_of_design, head_of_pmo, head_of_functional, head_of_core_banking, head_of_infra_devops, executive',
            team: 'Must match an existing team name exactly. Required for every role except Executive, which has no team by design — leave blank for those rows.',
            baseline_points: 'Points this engineer can typically deliver per sprint. Used for overwork detection. Default: 20.',
            baseline_cycle_days: 'How many days this engineer typically takes to complete a task. Default: 14.',
          }}
          isPending={importUsers.isPending}
          result={usersResult}
          onDownloadTemplate={downloadUsersTemplate}
          onUpload={handleImportUsers}
        />
      )}

      {activeTab === 'backlog' && isPmo && (
        <ImportSection
          title="Backlog"
          description="Import your initial product backlog. Projects and epics are auto-created."
          icon={LayoutList}
          iconBg="bg-indigo-50 dark:bg-indigo-950/40"
          iconCls="text-indigo-600 dark:text-indigo-400"
          columns={['project_name *', 'epic_name *', 'title *', 'epic_ref', 'feature', 'story_ref', 'description', 'acceptance_criteria', 'priority', 'type', 'story_points', 'phase', 'notes', 'owner_team']}
          columnHints={{
            epic_ref: 'A short code to group stories under the same epic (e.g. EP-1). All rows with the same epic_ref share one epic.',
            story_points: 'Effort estimate in story points (Fibonacci: 1, 2, 3, 5, 8, 13…). Leave blank to set later.',
            type: 'One of: Feature, Bug, Test, Review, Chore. Defaults to Feature.',
            acceptance_criteria: 'What "done" looks like for this story. Plain text.',
            owner_team: 'Must match an existing team name exactly. Scopes unassigned backlog tasks to this department. Only the first value per project is used.',
          }}
          isPending={importBacklog.isPending}
          result={backlogResult}
          onDownloadTemplate={downloadBacklogTemplate}
          onUpload={handleImportBacklog}
        />
      )}

      {activeTab === 'projects' && isPmo && (
        <ImportSection
          title="Projects"
          description="Create multiple projects in one go."
          icon={FolderOpen}
          iconBg="bg-primary/10"
          iconCls="text-primary"
          columns={['name *', 'description', 'owner_team']}
          columnHints={{
            owner_team: 'Must match an existing team name exactly. Sets the project’s owning team, which controls department-head visibility. Leave blank for an unowned project.',
          }}
          isPending={importProjects.isPending}
          result={projectsResult}
          onDownloadTemplate={downloadProjectsTemplate}
          onUpload={handleImportProjects}
        />
      )}

      {activeTab === 'tasks' && (
        <ImportSection
          title="Tasks"
          description="Import tasks and link them to existing projects. Anyone set as an assignee is automatically added as a member of that project."
          icon={CheckSquare}
          iconBg="bg-violet-50 dark:bg-violet-950/40"
          iconCls="text-violet-600 dark:text-violet-400"
          columns={['project_name *', 'title *', 'description', 'acceptance_criteria', 'points *', 'due_date *', 'priority', 'type', 'assignee_email', 'epic_name', 'external_reference']}
          columnHints={{
            project_name: 'Must match an existing project name exactly (case-insensitive).',
            acceptance_criteria: 'What "done" looks like for this task. Plain text.',
            points: 'Story points — a whole number, e.g. 3 or 5. Leave blank to import ungroomed and estimate later.',
            due_date: 'Format: YYYY-MM-DD (2026-10-16) or DD/MM/YYYY (16/10/2026) — the day always comes first. Can be left blank — but required once points, priority, or assignee_email is set for that row.',
            priority: 'A whole number from 1 (lowest) to 5 (highest). Leave blank to leave unset.',
            type: 'One of: Feature, Bug, Test, Review, Chore. Defaults to Feature.',
            assignee_email: 'Must match an existing user email. Leave blank to leave unassigned.',
            epic_name: 'Must match an existing epic in that project exactly. Leave blank to leave unassigned.',
            external_reference: 'Optional — a pre-existing ID for this task in another system (e.g. a Jira key).',
          }}
          isPending={importTasks.isPending}
          result={tasksResult}
          onDownloadTemplate={downloadTasksTemplate}
          onUpload={handleImportTasks}
        />
      )}
    </div>
  );
}
