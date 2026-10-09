import { lazy } from 'react';
import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import type { Role } from './types/api';
import type { Capability } from './lib/auth';
import Spinner from './components/ui/Spinner';
import { RouteErrorBoundary } from './components/ErrorPage';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';

// Lazy — everything below lives behind auth (inside AppShell), so none of it needs to be in the
// first bundle a visitor downloads just to reach the login screen. AppShell wraps its <Outlet />
// in a single Suspense boundary, so the sidebar/header render instantly on every navigation and
// only the content area shows a loading state while a route's chunk is fetched.
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const TaskListPage = lazy(() => import('./pages/tasks/TaskListPage'));
const TaskDetailPage = lazy(() => import('./pages/tasks/TaskDetailPage'));
const TaskCreatePage = lazy(() => import('./pages/tasks/TaskCreatePage'));
const CheckInPage = lazy(() => import('./pages/CheckInPage'));
const CheckInHistoryPage = lazy(() => import('./pages/CheckInHistoryPage'));
const CheckInStatusPage = lazy(() => import('./pages/CheckInStatusPage'));
const MyTimePage = lazy(() => import('./pages/MyTimePage'));
const MyTimeHistoryPage = lazy(() => import('./pages/MyTimeHistoryPage'));
const TimeSummaryPage = lazy(() => import('./pages/TimeSummaryPage'));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const FeedbackSubmitPage = lazy(() => import('./pages/feedback/FeedbackSubmitPage'));
const VitalsPage = lazy(() => import('./pages/VitalsPage'));
const VitalsDigestPage = lazy(() => import('./pages/vitals/VitalsDigestPage'));
const EngineersPage = lazy(() => import('./pages/engineers/EngineersPage'));
const EngineerDetailPage = lazy(() => import('./pages/engineers/EngineerDetailPage'));
const EscalationsPage = lazy(() => import('./pages/EscalationsPage'));
const MyAlertsPage = lazy(() => import('./pages/MyAlertsPage'));
const MyAutomationsPage = lazy(() => import('./pages/MyAutomationsPage'));
const LeadershipReportPage = lazy(() => import('./pages/reports/LeadershipReportPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const WeeklyReportPage = lazy(() => import('./pages/reports/WeeklyReportPage'));
const FeedbackInboxPage = lazy(() => import('./pages/feedback/FeedbackInboxPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const AuditLogPage = lazy(() => import('./pages/admin/AuditLogPage'));
const FailedEmailsPage = lazy(() => import('./pages/admin/FailedEmailsPage'));
const TaskArchivePage = lazy(() => import('./pages/admin/TaskArchivePage'));
const ThresholdsPage = lazy(() => import('./pages/admin/ThresholdsPage'));
const IntegrationsPage = lazy(() => import('./pages/admin/IntegrationsPage'));
const TeamsPage = lazy(() => import('./pages/admin/TeamsPage'));
const NotificationPreferencesPage = lazy(() => import('./pages/NotificationPreferencesPage'));
const ProjectDetailPage = lazy(() => import('./pages/projects/ProjectDetailPage'));
const SprintsPage = lazy(() => import('./pages/sprints/SprintsPage'));
const SprintDetailPage = lazy(() => import('./pages/sprints/SprintDetailPage'));
const ImportPage = lazy(() => import('./pages/ImportPage'));
const EpicDetailPage = lazy(() => import('./pages/epics/EpicDetailPage'));
const StandupSummaryPage = lazy(() => import('./pages/standup/StandupSummaryPage'));
const AccountPage = lazy(() => import('./pages/AccountPage'));
const WikiIndexPage = lazy(() => import('./pages/wiki/WikiIndexPage'));
const WikiPageViewPage = lazy(() => import('./pages/wiki/WikiPageViewPage'));
const PerformancePage = lazy(() => import('./pages/PerformancePage'));

function PrivateRoute({ exactRole, cap }: { exactRole?: Role; cap?: Capability | Capability[] }) {
  const { currentUser, isLoading, allow } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }
  if (!currentUser) return <Navigate to="/login" replace />;
  const capAllowed = !cap || (Array.isArray(cap) ? cap.some(allow) : allow(cap));
  if (!capAllowed) return <Navigate to="/dashboard" replace />;
  if (exactRole && currentUser.role !== exactRole) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/setup', element: <SetupPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/forgot-password', element: <ForgotPasswordPage />, errorElement: <RouteErrorBoundary /> },
  { path: '/reset-password', element: <ResetPasswordPage />, errorElement: <RouteErrorBoundary /> },
  {
    element: <PrivateRoute />,
    errorElement: <RouteErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'tasks', element: <TaskListPage /> },
          { path: 'tasks/new', element: <TaskCreatePage /> },
          { path: 'tasks/:id', element: <TaskDetailPage /> },
          { path: 'check-in', element: <CheckInPage /> },
          { path: 'check-in/history', element: <CheckInHistoryPage /> },
          { path: 'my-time', element: <MyTimePage /> },
          { path: 'my-time/history', element: <MyTimeHistoryPage /> },
          { path: 'projects/:id', element: <ProjectDetailPage /> },
          { path: 'wiki', element: <WikiIndexPage /> },
          { path: 'wiki/:projectId/:pageId', element: <WikiPageViewPage /> },
          { path: 'epics/:id', element: <EpicDetailPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
          { path: 'notifications/preferences', element: <NotificationPreferencesPage /> },
          { path: 'feedback/new', element: <FeedbackSubmitPage /> },
          { path: 'vitals', element: <VitalsPage /> },
          { path: 'performance', element: <PerformancePage /> },
          { path: 'account', element: <AccountPage /> },
          { path: 'sprints', element: <SprintsPage /> },
          { path: 'sprints/:id', element: <SprintDetailPage /> },
          {
            // Read-only alternate for Executive — Engineers/Time Summary are view-only here too.
            element: <PrivateRoute cap={['team-lead-or-above', 'executive-read', 'hr-read']} />,
            children: [
              { path: 'engineers', element: <EngineersPage /> },
              { path: 'engineers/:id', element: <EngineerDetailPage /> },
            ],
          },
          {
            // Time Summary is in the Accountant's menu and GET /time-entries/summary (+ the drill-down
            // endpoints) admit AccountantRead — the route has to as well, or the menu item bounces.
            element: <PrivateRoute cap={['team-lead-or-above', 'executive-read', 'hr-read', 'accountant-read']} />,
            children: [
              { path: 'time-summary', element: <TimeSummaryPage /> },
            ],
          },
          {
            // Read-only alternate for Executive — mirrors the dashboard's Organization widget.
            element: <PrivateRoute cap={['team-lead-or-above', 'executive-read', 'hr-read', 'accountant-read']} />,
            children: [
              { path: 'standup', element: <StandupSummaryPage /> },
              { path: 'reports', element: <ReportsPage /> },
            ],
          },
          {
            // Read-only alternate for Executive — browsing the project list is view-only, unlike
            // the write-oriented pm-or-above routes below it.
            element: <PrivateRoute cap={['pm-or-above', 'executive-read', 'hr-read', 'accountant-read']} />,
            children: [
              { path: 'projects', element: <ProjectsPage /> },
            ],
          },
          {
            element: <PrivateRoute cap="pm-or-above" />,
            children: [
              { path: 'check-in/status', element: <CheckInStatusPage /> },
              { path: 'import', element: <ImportPage /> },
              { path: 'admin/teams', element: <TeamsPage /> },
            ],
          },
          {
            // Read-only alternate for Executive — page itself hides mutating controls for that role.
            element: <PrivateRoute cap={['pm-or-above', 'executive-read', 'hr-read']} />,
            children: [
              { path: 'admin/users', element: <UsersPage /> },
            ],
          },
          {
            element: <PrivateRoute cap={['team-lead-or-above', 'executive-read', 'hr-read']} />,
            children: [
              { path: 'escalations', element: <EscalationsPage /> },
            ],
          },
          {
            element: <PrivateRoute cap="team-lead-or-above" />,
            children: [
              { path: 'reports/weekly', element: <WeeklyReportPage /> },
              { path: 'alerts', element: <MyAlertsPage /> },
              { path: 'automations', element: <MyAutomationsPage /> },
            ],
          },
          {
            // Read-only alternate for Executive/HR — org-wide, matching their other reporting queries.
            element: <PrivateRoute cap={['any-head', 'executive-read', 'hr-read', 'accountant-read']} />,
            children: [
              { path: 'reports/leadership', element: <LeadershipReportPage /> },
            ],
          },
          {
            // Matches GET /vitals's own capability gate exactly (AnyHead + ExecutiveRead + HrRead).
            element: <PrivateRoute cap={['any-head', 'executive-read', 'hr-read']} />,
            children: [
              { path: 'vitals/digest', element: <VitalsDigestPage /> },
            ],
          },
          {
            // Feedback Inbox: HR is org-wide read (GET /feedback admits HrRead, and the sidebar item shows for it).
            element: <PrivateRoute cap={['any-head', 'hr-read']} />,
            children: [
              { path: 'feedback', element: <FeedbackInboxPage /> },
            ],
          },
          {
            element: <PrivateRoute cap="any-head" />,
            children: [
              { path: 'admin/thresholds', element: <ThresholdsPage /> },
              { path: 'admin/integrations', element: <IntegrationsPage /> },
            ],
          },
          {
            element: <PrivateRoute cap="head-only" />,
            children: [
              { path: 'admin/audit-log', element: <AuditLogPage /> },
            ],
          },
          {
            element: <PrivateRoute cap="head-only" />,
            children: [
              { path: 'admin/failed-emails', element: <FailedEmailsPage /> },
            ],
          },
          {
            element: <PrivateRoute cap="pmo-only" />,
            children: [
              { path: 'admin/task-archive', element: <TaskArchivePage /> },
            ],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]);
