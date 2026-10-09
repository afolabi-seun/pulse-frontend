// ── Shared ───────────────────────────────────────────────────────────────────

export type Role =
  | 'engineer'
  | 'team_lead'
  | 'designer'
  | 'product_manager'
  | 'project_manager'
  | 'head_of_rd'
  | 'head_of_product'
  | 'head_of_design'
  | 'head_of_pmo'
  | 'head_of_functional'
  | 'head_of_core_banking'
  | 'head_of_infra_devops'
  | 'executive'
  | 'hr'
  | 'accountant';

// ── Meta ─────────────────────────────────────────────────────────────────────

export interface EnumMetaDto {
  value: string;
  label: string;
}

export interface RoleMetaDto {
  value: Role;
  label: string;
  rank: number;
  isDeptHead: boolean;
  group: string;
  assignableRoles: Role[] | null;
  canCreateProjects: boolean;
  canDeleteProjects: boolean;
}

export interface PointScaleEntryDto {
  value: number;
  label: string;
  timeGuide: string;
}

export interface PriorityScaleEntryDto {
  value: number;
  label: string;
  criteria: string;
}

/** The signed-in user's own organization (GET /organization). */
export interface CurrentOrganizationDto {
  id: string;
  name: string;
  slug: string;
}

/** GET /integrations/slack — the caller's organization's Slack connection. */
export interface SlackConnectionDto {
  /** Slack is set up on this Pulse server (OAuth app + encryption key configured). */
  available: boolean;
  connected: boolean;
  teamName: string | null;
  connectedAt: string | null;
}

/** A Google Chat space linked to the caller's organization. */
export interface GoogleChatSpaceDto {
  id: string;
  spaceId: string;
  displayName: string;
}

/** GET /integrations/google-chat — whether Chat is set up, and the organization's linked spaces. */
export interface GoogleChatConnectionDto {
  available: boolean;
  spaces: GoogleChatSpaceDto[];
}

/** POST /integrations/google-chat/link-codes — a one-time code to type in a space. */
export interface GoogleChatLinkCodeDto {
  code: string;
  expiresAt: string;
  /** What to send in the space, e.g. "@Pulse link ABCD-2345". */
  command: string;
}

/** One notification kind and whether it's emailed to the caller (GET /notifications/preferences). */
export interface NotificationPreferenceDto {
  kind: string;
  category: string;
  label: string;
  description: string;
  email: boolean;
  /** A security notice: always emailed. */
  emailLocked: boolean;
}

export interface AppMetaDto {
  roles: RoleMetaDto[];
  taskStatuses: EnumMetaDto[];
  taskTypes: EnumMetaDto[];
  sprintStatuses: EnumMetaDto[];
  pointScale: PointScaleEntryDto[];
  priorityScale: PriorityScaleEntryDto[];
}

export interface ApiResponse<T> {
  status: 'success' | 'error';
  data: T | null;
  error: {
    code: string;
    message: string;
    errors?: Record<string, string[]>;
  } | null;
  meta: { requestId?: string; timestamp?: string } | null;
}

export interface PagedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: string[];
  /** Resolved capability keys (backend CapabilityRegistry) — what the UI should gate role-level
   * rendering on. See docs/rbac-consolidation.md. */
  capabilities: string[];
}

export interface AuthDto {
  accessToken: string;
  /** Empty for the web app: the refresh token is an httpOnly cookie and never appears in a response body. */
  refreshToken: string;
  user: AuthUserDto;
}

// ── Engineers ─────────────────────────────────────────────────────────────────

export interface EngineerDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  baselinePoints: number;
  baselineCycleDays: number;
  isActive: boolean;
  team: string | null;
  teamId: string | null;
  isQa: boolean;
  discipline: Discipline | null;
  activeTasks: number;
  totalPoints: number;
  /** The overwork signal's verdict (set where load is assessed, i.e. the Engineers page). */
  isOverworked: boolean;
  /** The part of totalPoints due within the engineer's baseline cycle, plus overdue/undated — what the verdict is based on. */
  cyclePoints?: number;
}

export interface EngineerStatsDto {
  activeCount: number;
  overworkedCount: number;
  avgUtilisation: number;
  tasksInFlight: number;
}

export interface EngineerListPageDto {
  items: EngineerDto[];
  nextCursor: string | null;
  hasMore: boolean;
  stats: EngineerStatsDto;
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export interface TeamDto {
  id: string;
  name: string;
  teamLeadId: string | null;
  teamLeadName: string | null;
  isActive: boolean;
  department: string | null;
  /** Null when the caller can't see this team's roster (a department head viewing another department). */
  memberCount: number | null;
}

export interface BaselineHistoryEntryDto {
  fromPoints: number;
  fromCycleDays: number;
  toPoints: number;
  toCycleDays: number;
  changedBy: string;
  changedAt: string;
}

export interface OverworkSignalDto {
  tripped: boolean;
  reason: string;
}

export interface OverworkSignalsDto {
  loadVsBaseline: OverworkSignalDto;
  concurrent: OverworkSignalDto;
  staleInProgress: OverworkSignalDto;
  isOverworked: boolean;
  hasActiveOverride: boolean;
  /** The numbers behind the load signal. */
  workload?: WorkloadDto | null;
}

export interface WorkloadDto {
  /** All active points, however far off they are due. */
  activePoints: number;
  /** The part due within the baseline cycle (plus overdue/undated) — what the load signal tests. */
  cyclePoints: number;
  cycleDays: number;
  /** The load signal trips above this many cycle points. */
  thresholdPoints: number;
}

export interface OverworkOverrideDto {
  id: string;
  engineerId: string;
  grantedById: string;
  reason: string;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export type ProjectStatus = 'active' | 'paused' | 'archived';

export interface ProjectDto {
  id: string;
  name: string;
  /** Short, unique, uppercase key used as the prefix for every task's display key in this project
   * (e.g. "NOTIF" for task keys like NOTIF-011). */
  code: string;
  description: string | null;
  isActive: boolean;
  status: ProjectStatus;
  createdAt: string;
  ownerTeamId: string | null;
  canAccess: boolean;
}

export interface ThroughputWeekDto {
  weekOf: string;
  pointsDelivered: number;
}

export interface ProjectActivityDto {
  id: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  actorName: string;
  summary: string;
  changedAt: string;
}

export interface MyProjectDto {
  id: string;
  name: string;
  description: string | null;
  activeTaskCount: number;
  blockedTaskCount: number;
}

export interface ProjectMemberDto {
  engineerId: string;
  name: string;
  email: string;
  role: Role;
  addedAt: string;
}

export interface FollowedProjectDto {
  projectId: string;
  projectName: string;
  isFollowing: boolean;
  activeTaskCount: number;
  blockedTaskCount: number;
  doneThisSprintCount: number;
  lastBlockerTitle: string | null;
  activeSprintId: string | null;
  activeSprintName: string | null;
  activeSprintEndDate: string | null;
  followedSince: string;
}

// ── Tasks ─────────────────────────────────────────────────────────────────────

export type TaskStatus = 'backlog' | 'active' | 'blocked' | 'inQa' | 'done' | 'paused';
export type TaskType = 'feature' | 'bug' | 'test' | 'review' | 'chore';
export type Discipline = 'frontend' | 'backend' | 'design' | 'fullStack' | 'product' | 'pmo' | 'functional' | 'database' | 'infraDevSecOps' | 'support' | 'other';

export type BugSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface PointsChangeDto {
  from: number | null;
  to: number | null;
  reason: string;
  changedAt: string;
  changedById: string;
  changedByName: string | null;
}

export interface DueDateChangeDto {
  from: string | null;
  to: string | null;
  reason: string;
  changedAt: string;
  changedById: string;
  changedByName: string | null;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  acceptanceCriteria: string | null;
  severity: BugSeverity | null;
  /** 1 (lowest) to 5 (highest). Applies to every task type. Null means unprioritized. */
  priority: number | null;
  points: number;
  /** Sequential, per-project display number — combined with the owning project's code to form
   * taskKey (e.g. "NOTIF-011"). Never shown on its own. */
  taskNumber: number;
  /** Free-text pointer to this task's ID in an external system (Jira, a legacy tracker, …). */
  externalReference: string | null;
  status: TaskStatus;
  taskType: TaskType;
  projectId: string;
  epicId: string | null;
  assigneeId: string | null;
  sprintId: string | null;
  dueDate: string | null;
  actualEndDate: string | null;
  /** When this task most recently entered QA — the deadline is considered met from this point
   * on, even though the task isn't formally closed until QA passes it. Null if it's never been
   * sent to QA, or was rejected and is awaiting resubmission. */
  sentToQaAt: string | null;
  activatedAt: string;
  blockerReason: string | null;
  requiresQa: boolean;
  discipline: Discipline | null;
  requiresFrontendHandoff: boolean;
  currentStage: 'backend' | 'frontend' | null;
  /** The most recent engineer to hold the Backend stage of this task — kept even after the task
   * is handed off to Frontend, so a completed backend half stays attributable to whoever did it. */
  backendAssigneeId: string | null;
  backendAssigneeName: string | null;
  parentTaskId: string | null;
  qaTaskId: string | null;
  /** In QA, but the QA task no longer exists, so nothing can accept the task (task detail only). */
  qaTaskMissing?: boolean;
  reactivationReason: string | null;
  pauseNote: string | null;
  createdAt: string;
  projectName: string | null;
  assigneeName: string | null;
  createdById: string | null;
  creatorName: string | null;
  canRejectQa: boolean;
  reactivatedByEngineerId: string | null;
  reactivatedByName: string | null;
  /** A QA rejection proposed but not yet confirmed or withdrawn — the task stays in QA and
   * nothing about its status changes until one of those happens. On a QA sub-task, this is
   * borrowed from the parent task it reviews (see GetTaskQuery), since that's where the real
   * state lives. Null when nothing is pending. */
  pendingRejectionReason: string | null;
  pendingRejectionActorId: string | null;
  pendingRejectionActorName: string | null;
  pendingRejectionResponse: string | null;
  pendingRejectionRespondedByEngineerId: string | null;
  pendingRejectionRespondedByName: string | null;
  requiresPrApproval: boolean;
  prLink: string | null;
  /** Non-null while a PR approval request is awaiting a decision. */
  pendingPrApprovalRequestedAt: string | null;
  pendingPrApprovalRequestedByName: string | null;
  /** Set only once the request has been explicitly reassigned to someone other than the
   * default department head(s). */
  pendingPrApprovalDelegatedToName: string | null;
  /** Who can currently act on the pending request — the delegate if reassigned, else the
   * assignee's department head(s). Null when nothing is pending. */
  pendingPrApprovalApproverNames: string[] | null;
  /** Server-computed — whether the current viewer can approve/reject/reassign the pending
   * request. Never re-derive this client-side. */
  canApprovePrApproval: boolean;
  prApprovedAt: string | null;
  /** Latest person-made move of an existing due date, with the stated reason. Detail only. */
  dueDateChange?: DueDateChangeDto | null;
  /** The latest change of an existing estimate that came with a reason (task detail only). */
  pointsChange?: PointsChangeDto | null;
  loanedFromEngineerId: string | null;
  /** Checklist subtask counts — absent (not 0) when the task has no subtasks. */
  subtasksDone?: number | null;
  subtasksTotal?: number | null;
  /** When the current assignee was assigned. Null if the task has never been assigned. */
  assignedAt: string | null;
  /** Null when the caller didn't resolve the owning project's code (see TaskDto.cs). */
  projectCode?: string | null;
  /** Display key — ProjectCode-TaskNumber (e.g. "NOTIF-011") — null when projectCode is absent. */
  taskKey: string | null;
  /** A private to-do in its owner's personal-tasks project: no estimate, hand-offs, blockers or feedback. */
  isPersonal?: boolean;
}

export interface PreviewAssignResult {
  before: OverworkSignalsDto;
  after: OverworkSignalsDto;
  wouldFlagOverwork: boolean;
}

export interface BulkReassignResult {
  tasksReassigned: number;
  signalsAfter: OverworkSignalsDto;
  triggeredOverworkWarning: boolean;
}

export interface BulkCreateTasksResult {
  created: number;
  failed: Array<{ index: number; error: string }>;
}

// ── CheckIns ──────────────────────────────────────────────────────────────────

export interface CheckInDto {
  id: string;
  engineerId: string;
  date: string;
  completed: string;
  plannedNext: string;
  blockers: string | null;
  submittedAt: string;
  projectId: string | null;
}

// ── Time entries ──────────────────────────────────────────────────────────────

export type TimeEntryCategory = 'task' | 'meeting' | 'admin' | 'leave' | 'other';

export interface ActivityEntryDto { date: string; hours: number; note: string | null; }

export interface ActivityTaskDto {
  taskId: string;
  key: string | null;
  title: string;
  projectName: string | null;
  /** camelCase task status ("active", "inQa", …); null when the task isn't visible to the viewer. */
  status: string | null;
  dueDate: string | null;
  hours: number;
  entries: ActivityEntryDto[];
}

export interface CategoryHoursDto { category: string; hours: number; }

/** What an engineer is assigned to next to what they logged time on, for a period (Time Summary drill-down). */
export interface EngineerTimeActivityDto {
  assigned: ActivityTaskDto[];
  loggedOnly: ActivityTaskDto[];
  otherTime: CategoryHoursDto[];
  assignedWithoutTime: number;
}

export interface TimeEntryDto {
  id: string;
  engineerId: string;
  date: string;
  category: TimeEntryCategory;
  taskId: string | null;
  subtaskId: string | null;
  projectId: string | null;
  hours: number;
  note: string | null;
  loggedAt: string;
  /** The task's own title, resolved independently of the viewer's current task list — present
   * even once the task is no longer assigned to the viewer (done, backlog, reassigned away).
   * Null on most single-entry command responses; present on ListTimeEntriesQuery results. */
  taskTitle: string | null;
  /** Display key ("NOTIF-011") and project name — resolved on list results so someone reviewing another
   * person's timesheet can see which task and project an entry belongs to. */
  taskKey?: string | null;
  projectName?: string | null;
}

export interface ActiveTimerDto {
  id: string;
  category: TimeEntryCategory;
  taskId: string | null;
  taskTitle: string | null;
  startedAt: string;
  subtaskId: string | null;
  subtaskTitle: string | null;
}

export interface DailyHoursDto {
  date: string;
  hours: number;
}

export interface EngineerHoursDto {
  engineerId: string;
  name: string;
  totalHours: number;
  dailyHours: DailyHoursDto[];
}

export interface ProjectHoursDto {
  projectId: string | null;
  projectName: string;
  totalHours: number;
  /** "general" = time with no project (meetings, admin, leave, other); "personal" = everyone's personal tasks folded
   * into one line. The two null-id lines are told apart by this. Absent on older responses ("project"). */
  kind?: 'project' | 'general' | 'personal';
}

export interface ProjectActivityPersonDto { engineerId: string; name: string; hours: number; }

/** `taskId` is null for a category row (meetings, admin, leave, other). */
export interface ProjectActivityItemDto {
  date: string;
  taskId: string | null;
  label: string;
  key: string | null;
  status: string | null;
  hours: number;
  people: ProjectActivityPersonDto[];
}

export interface ProjectActivityByPersonDto { engineerId: string; name: string; tasks: number; hours: number; }

/** Who logged the hours behind one "Hours by project" line, and on what. */
export interface ProjectTimeActivityDto {
  kind: 'project' | 'general' | 'personal';
  name: string;
  totalHours: number;
  items: ProjectActivityItemDto[];
  people: ProjectActivityByPersonDto[];
}

export interface TimeEntrySummaryDto {
  weekOf: string;
  to: string;
  engineers: EngineerHoursDto[];
  projects: ProjectHoursDto[];
  teamTotalHours: number;
}

export interface TaskTimeSummaryDto {
  taskId: string;
  totalHoursLogged: number;
  expectedHours: number | null;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export interface NotificationDto {
  id: string;
  userId: string;
  kind: string;
  payload: string | null;
  channel: string;
  isRead: boolean;
  readAt: string | null;
  sentAt: string;
}

// ── Escalations ───────────────────────────────────────────────────────────────

export type EscalationLevel = 'TMinus3' | 'TMinus1' | 'Overdue';

export interface EscalationDto {
  taskId: string;
  taskTitle: string;
  assigneeId: string | null;
  dueDate: string | null;
  level: EscalationLevel;
  daysUntilDue: number;
  projectName: string | null;
  taskKey: string | null;
}

// ── Feedback ──────────────────────────────────────────────────────────────────

export interface FeedbackDto {
  id: string;
  engineerId: string;
  text: string;
  weekOf: string;
  createdAt: string;
  taskId: string | null;
  replyText: string | null;
  repliedByName: string | null;
  repliedAt: string | null;
}

export interface FeedbackPatternDto {
  weekOf: string;
  totalResponses: number;
  distinctSources: number;
}

export interface FeedbackPatternsDto {
  /** Weeks with enough different people to show, newest first. */
  weeks: FeedbackPatternDto[];
  /** Weeks with feedback but too few people to show. */
  hiddenWeeks: number;
  /** People in scope who could have given feedback — the base for a participation rate. */
  eligiblePeople: number;
  /** "Organisation", or the department the reader is limited to. */
  scope: string;
}

// ── Vitals ────────────────────────────────────────────────────────────────────

export interface VitalsResponseDto {
  id: string;
  engineerId: string;
  score: number;
  comment: string | null;
  weekOf: string;
  createdAt: string;
  /** Populated only by the team/org list (GET /vitals) — null on the caller's own history. */
  engineerName?: string | null;
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface EscalationReportEntry {
  taskId: string;
  title: string;
  assigneeId: string | null;
  dueDate: string | null;
  level: EscalationLevel;
  assigneeName: string | null;
  projectName: string | null;
  taskKey: string | null;
}

export interface BlockerReportEntry {
  taskId: string;
  title: string;
  assigneeId: string | null;
  reason: string;
  assigneeName: string | null;
  projectName: string | null;
  taskKey: string | null;
  daysBlocked: number;
}

export interface LeadershipReportDto {
  weekOf: string;
  totalDeliveredPoints: number;
  previousWeekPoints: number;
  engineers: EngineerUtilizationEntry[];
  escalations: EscalationReportEntry[];
  blockers: BlockerReportEntry[];
  /** True for a department head — totalDeliveredPoints/previousWeekPoints stay org-wide aggregate
   * velocity even then, unlike engineers/escalations/blockers, which are scoped to their department. */
  isCallerDepartmentScoped: boolean;
}

// ── Audit Log ─────────────────────────────────────────────────────────────────

export interface AuditLogEntryDto {
  id: number;
  action: string;
  actorId: string;
  ipAddress: string | null;
  detail: string | null;
  ts: string;
}

export interface AuditLogPageDto {
  items: AuditLogEntryDto[];
  nextCursor: number | null;
  hasMore: boolean;
}

// ── Users (admin) ────────────────────────────────────────────────────────────

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  baselinePoints: number;
  baselineCycleDays: number;
  team: string | null;
  teamId: string | null;
  isQa: boolean;
  discipline: Discipline | null;
  createdAt: string;
}

// ── Sprints ───────────────────────────────────────────────────────────────────

export type SprintStatus = 'Planning' | 'Active' | 'Completed';

export interface SprintDto {
  id: string;
  teamId: string;
  projectId: string | null;
  projectName: string | null;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  capacityPoints: number | null;
  showAndTellDate: string | null;
  showAndTellNotes: string | null;
  createdAt: string;
  teamName: string | null;
}

export interface TaskDependencyDto {
  id: string;
  blockingTaskId: string;
  dependentTaskId: string;
}

export interface LinkedTaskDto {
  id: string;
  title: string;
  status: TaskStatus;
  taskKey: string | null;
}

export interface TaskLinksDto {
  blockedBy: LinkedTaskDto[];
  blocks: LinkedTaskDto[];
}

export interface SubtaskDto {
  id: string;
  taskId: string;
  title: string;
  isDone: boolean;
  createdBy: string;
  completedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
}

export interface StandupEntryDto {
  engineerId: string;
  engineerName: string;
  role: string;
  teamName: string | null;
  completed: string;
  plannedNext: string;
  blockers: string | null;
  projectId: string | null;
  projectName: string | null;
}

export interface MissingEngineerDto {
  id: string;
  name: string;
}

export interface StandupSummaryDto {
  date: string;
  teamId: string | null;
  entries: StandupEntryDto[];
  missingEngineers: MissingEngineerDto[];
}

export interface SprintVelocityDto {
  plannedPoints: number;
  deliveredPoints: number;
  totalTasks: number;
  doneTasks: number;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

export interface ThresholdsDto {
  loadVsBaselineRatio: number;
  maxConcurrentTasks: number;
  staleCycleMultiplier: number;
  signalsRequiredToFlag: number;
  escalationT3Days: number;
  escalationT3ElapsedPct: number;
  escalationT1Days: number;
  escalationT1ElapsedPct: number;
  escalationT3MinHours: number;
  escalationT1MinHours: number;
  qaLeadTimeDays: number;
  pointScale: PointScaleEntryDto[];
  priorityScale: PriorityScaleEntryDto[];
}

export interface DepartmentThresholdDto {
  department: string;
  loadVsBaselineRatio: number | null;
  maxConcurrentTasks: number | null;
  staleCycleMultiplier: number | null;
  signalsRequiredToFlag: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

export type EpicStatus = 'NotStarted' | 'InProgress' | 'Done';

export interface EpicDto {
  id: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  status: EpicStatus;
  projectId: string;
  sprintId?: string;
  order: number;
  createdAt: string;
  totalTasks: number;
  completedTasks: number;
}

export interface VoterVoteDto {
  voterId: string;
  voterName: string;
  points: number | null;
}

export interface EstimationDto {
  taskId: string;
  isRevealed: boolean;
  votes: VoterVoteDto[];
  pendingApprovalPoints: number | null;
  submittedByName: string | null;
  pendingApproverNames: string[] | null;
  canApprove: boolean;
  isEscalated: boolean;
}

export interface RetroDto {
  id: string;
  sprintId: string;
  wentWell: string;
  needsImprovement: string;
  actionItems: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface BurndownPointDto {
  date: string;
  remaining: number;
  ideal: number;
}

export interface TaskHitDto {
  id: string;
  title: string;
  points: number;
  status: TaskStatus;
  taskKey: string | null;
}

export interface EngineerHitDto {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface SearchResultDto {
  tasks: TaskHitDto[];
  engineers: EngineerHitDto[];
}

export interface CommentDto {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
}

export interface ImportRowFailure {
  row: number;
  error: string;
}

export interface ImportResult {
  created: number;
  failures: ImportRowFailure[];
}

export interface WikiPageSummaryDto {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string | null;
  /** Readable only by the project's members (and Executive/HR/Accountant) rather than every signed-in user. */
  restrictedToMembers?: boolean;
}

export interface WikiPageDto {
  id: string;
  projectId: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string | null;
  restrictedToMembers?: boolean;
}

export interface WikiPageRevisionDto {
  id: string;
  title: string;
  createdAt: string;
}

export interface WikiPageRevisionContentDto {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface WikiIndexEntryDto {
  pageId: string;
  pageTitle: string;
  projectId: string;
  projectName: string;
  createdAt: string;
  updatedAt: string | null;
  restrictedToMembers?: boolean;
}

// ── PMO Reports ───────────────────────────────────────────────────────────────

export interface EngineerUtilizationEntry {
  engineerId: string;
  name: string;
  role: string;
  activeTasks: number;
  totalPoints: number;
  baselinePoints: number;
  isOverworked: boolean;
  checkInsThisWeek: number;
  blockers: number;
  hoursLoggedThisWeek: number;
  completedTasks: number;
  /** Separate from activeTasks/totalPoints (which stay Active+Blocked-only, the correct scope for
   * overwork detection) — a task awaiting QA review still reflects real work done this period. */
  tasksInQa: number;
  pointsInQa: number;
  /** Count of subtasks checked off this period, attributed to whoever checked them off. Subtasks
   * carry no points of their own, so this is a visibility signal, not a points contribution. */
  subtasksCompleted: number;
  /** The part of totalPoints due this cycle (plus overdue/undated) — what isOverworked is decided on. */
  cyclePoints?: number;
}

export interface TeamUtilizationDto {
  teamId: string;
  teamName: string;
  engineers: EngineerUtilizationEntry[];
  overworkedCount: number;
  /** Null when nobody on the team has a baseline set — never a real 0. */
  avgLoadPct: number | null;
}

/** One task named in a health reason. `days` = working days late (overdue), days until due (due_soon) or
 * working days blocked (blocked / blocked_long). */
export interface HealthTaskRef {
  taskId: string;
  key: string | null;
  title: string;
  assigneeName: string | null;
  days: number;
}

export interface HealthReasonDto {
  kind: 'overdue' | 'blocked_long' | 'blocked' | 'due_soon';
  count: number;
  text: string;
  examples: HealthTaskRef[];
  /** What to do about it, in a few words. */
  action?: string;
}

export interface ProjectHealthDto {
  projectId: string;
  name: string;
  activeTasks: number;
  blockedTasks: number;
  doneThisSprint: number;
  totalTasks: number;
  completionPct: number;
  escalationCount: number;
  activeSprintName: string | null;
  health: 'Healthy' | 'AtRisk' | 'Critical';
  hoursLoggedThisWeek: number;
  highPriorityOpenTasks: number;
  /** Why `health` is what it is, and what would clear it — absent on older responses. */
  reasons?: HealthReasonDto[] | null;
  nextSteps?: string[] | null;
  overdueTasks?: number;
  dueSoonTasks?: number;
  /** Weekly team report: the counts cover only this team's tasks on a project another team owns. */
  teamSliceOnly?: boolean;
}

export interface SprintVelocityEntry {
  sprintName: string;
  plannedPoints: number | null;
  deliveredPoints: number;
}

export interface TeamSprintVelocityDto {
  teamId: string;
  teamName: string;
  sprints: SprintVelocityEntry[];
}

export interface WeekComplianceDto {
  weekOf: string;
  engineerCount: number;
  checkedInCount: number;
  compliancePct: number;
}

export interface TeamComplianceDto {
  teamId: string;
  teamName: string;
  weeks: WeekComplianceDto[];
}

export interface BlockerAgingDto {
  taskId: string;
  title: string;
  assigneeName: string | null;
  projectName: string | null;
  reason: string | null;
  daysBlocked: number;
  taskKey: string | null;
}

export interface PmoReportDto {
  weekOf: string;
  /** The actual window "Points delivered" and every Hours column reflect — equals weekOf's own
   * Monday-Sunday week unless an explicit from/to range was requested. */
  deliveredFrom: string;
  deliveredTo: string;
  totalDeliveredPoints: number;
  previousWeekPoints: number;
  teams: TeamUtilizationDto[];
  projects: ProjectHealthDto[];
  sprintVelocity: TeamSprintVelocityDto[];
  checkInCompliance: TeamComplianceDto[];
  blockerAging: BlockerAgingDto[];
  /** Org-wide average days from a task's creation to completion, over the same deliveredFrom/
   * deliveredTo window as totalDeliveredPoints. Null when nothing completed in that window. */
  avgCycleTimeDays: number | null;
  /** Org-wide average hours from a PR approval request to its approval, among approvals that
   * landed in the same deliveredFrom/deliveredTo window. Null when nothing was approved in it. */
  avgPrApprovalHours: number | null;
}

export interface WeeklyEscalationPoint {
  weekOf: string;
  count: number;
}

export interface OrgTrendDto {
  deliveryTrend: ThroughputWeekDto[];
  escalationTrend: WeeklyEscalationPoint[];
}

// ── Weekly Report ─────────────────────────────────────────────────────────────

export interface WorkstreamCheckInDto {
  projectId: string;
  expectedEngineers: number;
  checkedInEngineers: number;
  coveragePct: number;
}

export interface WeeklyReportDto {
  teamId: string;
  teamName: string;
  weekOf: string;
  totalDeliveredPoints: number;
  previousWeekPoints: number;
  utilization: TeamUtilizationDto;
  workstreams: ProjectHealthDto[];
  blockers: BlockerAgingDto[];
  compliance: TeamComplianceDto;
  checkInCoverage: WorkstreamCheckInDto[];
  executiveSummary: string;
  keyAccomplishments: string;
  plannedNextWeek: string;
  resourcingNotes: string;
  suggestedExecutiveSummary: string;
  suggestedKeyAccomplishments: string;
  suggestedPlannedNextWeek: string;
  suggestedResourcingNotes: string;
  submittedById: string | null;
  submittedByName: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
  isNew: boolean;
}

export interface SaveWeeklyReportDraftRequest {
  teamId: string;
  weekOf: string;
  executiveSummary: string;
  keyAccomplishments: string;
  plannedNextWeek: string;
  resourcingNotes: string;
}

// ── Failed Emails ─────────────────────────────────────────────────────────────

export interface FailedEmailDto {
  id: string;
  to: string;
  subject: string;
  attemptCount: number;
  lastAttemptAt: string;
  lastError: string | null;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
}

export interface FailedEmailPageDto {
  items: FailedEmailDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface RetryAllResult {
  succeeded: number;
  failed: number;
}

// ── Performance ───────────────────────────────────────────────────────────────

export interface PerformanceMetricsDto {
  engineerId: string;
  engineerName: string;
  from: string;
  to: string;
  deliveredPoints: number;
  baselinePoints: number;
  baselineCycleDays: number;
  /** What the baseline implies for this window: baselinePoints x window days / baselineCycleDays. */
  expectedPoints: number;
  velocityRatio: number;
  tasksCompleted: number;
  tasksWithDueDate: number;
  tasksCompletedOnTime: number;
  onTimeRate: number | null;
  avgCycleTimeDays: number | null;
  tasksSentToQa: number;
  tasksQaRejected: number;
  qaRejectRate: number | null;
  escalatedTaskCount: number;
  checkInCount: number;
  expectedCheckInDays: number;
  checkInConsistency: number;
}

export interface ProjectPerformanceDto {
  projectId: string;
  projectName: string;
  from: string;
  to: string;
  engineerCount: number;
  deliveredPoints: number;
  tasksCompleted: number;
  tasksWithDueDate: number;
  tasksCompletedOnTime: number;
  onTimeRate: number | null;
  avgCycleTimeDays: number | null;
  tasksSentToQa: number;
  tasksQaRejected: number;
  qaRejectRate: number | null;
  escalatedTaskCount: number;
}

// ── Alert Rules ──────────────────────────────────────────────────────────────

export type AlertMetric =
  | 'blockerCount' | 'teamVelocity' | 'checkInCompliance' | 'qaRejectRate'
  | 'teamVelocityChange' | 'blockerCountChange' | 'checkInComplianceChange' | 'qaRejectRateChange';
export type AlertScopeType = 'team' | 'project';
export type AlertComparator = 'greaterThan' | 'lessThan';

export interface AlertRuleDto {
  id: string;
  name: string;
  metric: AlertMetric;
  scopeType: AlertScopeType;
  scopeId: string;
  scopeName: string | null;
  comparator: AlertComparator;
  threshold: number;
  deliverInApp: boolean;
  deliverEmail: boolean;
  deliverWebhook: boolean;
  webhookUrl: string | null;
  slackChannel: string | null;
  googleChatSpaceId: string | null;
  isActive: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

// ── Automation Rules ─────────────────────────────────────────────────────────

export interface AutomationRuleDto {
  id: string;
  name: string;
  teamId: string;
  teamName: string | null;
  thresholdDays: number;
  isActive: boolean;
  createdAt: string;
}
