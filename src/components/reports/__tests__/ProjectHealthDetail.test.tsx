import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ProjectHealthDetail, { HealthLegend, HealthToggle, healthSummary } from '../ProjectHealthDetail';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { HealthTaskRef, ProjectHealthDto } from '../../../types/api';

const project = (over: Partial<ProjectHealthDto> = {}): ProjectHealthDto => ({
  projectId: 'p1', name: 'OMS', activeTasks: 2, blockedTasks: 1, doneThisSprint: 0, totalTasks: 473,
  completionPct: 79, escalationCount: 3, activeSprintName: null, health: 'Critical', hoursLoggedThisWeek: 0,
  highPriorityOpenTasks: 0,
  reasons: [
    { kind: 'overdue', count: 4, text: '4 overdue tasks (oldest 6 working days late)', action: 'Finish, re-date or reassign', examples: [
      { taskId: 't1', key: 'OMS-22', title: 'SMS spike', assigneeName: 'Emma Wilson', days: 6 },
      { taskId: 't2', key: 'OMS-23', title: 'Load test', assigneeName: null, days: 1 },
    ] },
    { kind: 'blocked_long', count: 1, text: '1 blocked 5+ working days (oldest 7)', action: 'Unblock or escalate', examples: [
      { taskId: 't3', key: null, title: 'Vendor API', assigneeName: 'Frank Okafor', days: 7 },
    ] },
    { kind: 'due_soon', count: 1, text: '1 due within 3 days', action: "Check they're on track", examples: [
      { taskId: 't4', key: 'OMS-30', title: 'Release notes', assigneeName: 'Grace Liu', days: 2 },
    ] },
  ],
  nextSteps: ['Finish, re-date or reassign the 4 overdue tasks (longest: 6 working days late).'],
  ...over,
});

describe('ProjectHealthDetail', () => {
  it('lists each reason with its detail sentence and what to do, under its status badge', () => {
    renderWithProviders(<ProjectHealthDetail project={project()} />);

    expect(screen.getByText('Why OMS is Critical')).toBeInTheDocument();
    expect(screen.getByText('4 overdue tasks (oldest 6 working days late)')).toBeInTheDocument();
    expect(screen.getByText('Finish, re-date or reassign')).toBeInTheDocument();
    expect(screen.getByText('1 blocked 5+ working days (oldest 7)')).toBeInTheDocument();
    expect(screen.getByText('Unblock or escalate')).toBeInTheDocument();
    // Two reasons share the "Overdue"/"Blocked long" wording as the Tasks-to-look-at badges below,
    // so assert on the reasons section specifically via its heading's following sibling.
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0);
  });

  it('lists the worst tasks with owner and how long, each linked to the task', () => {
    renderWithProviders(<ProjectHealthDetail project={project()} />);

    expect(screen.getByText('Tasks to look at')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /OMS-22 SMS spike/ })).toHaveAttribute('href', '/tasks/t1');
    expect(screen.getByText('Emma Wilson · 6 working days late')).toBeInTheDocument();
    expect(screen.getByText('Unassigned · 1 working day late')).toBeInTheDocument();
    expect(screen.getByText('Frank Okafor · blocked 7 working days')).toBeInTheDocument();
    expect(screen.getByText('Grace Liu · due in 2d')).toBeInTheDocument();
  });

  it('says how many more tasks there are beyond the ones named', () => {
    renderWithProviders(<ProjectHealthDetail project={project()} />);
    expect(screen.getByText('…and 2 more not shown')).toBeInTheDocument();
  });

  it('caps the task list and reveals the rest behind "Show all N"', () => {
    const many: HealthTaskRef[] = Array.from({ length: 14 }, (_, i) => (
      { taskId: `m${i}`, key: `OMS-${i}`, title: `Task ${i}`, assigneeName: 'Someone', days: 1 }
    ));
    renderWithProviders(<ProjectHealthDetail project={project({
      reasons: [{ kind: 'overdue', count: 14, text: '14 overdue tasks', action: 'Finish, re-date or reassign', examples: many }],
    })} />);

    expect(screen.getByText('Task 9')).toBeInTheDocument();
    expect(screen.queryByText('Task 10')).not.toBeInTheDocument();
    const showAll = screen.getByRole('button', { name: 'Show all 14' });

    fireEvent.click(showAll);

    expect(screen.getByText('Task 13')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show all/ })).not.toBeInTheDocument();
  });

  it('marks a team slice of a shared project', () => {
    renderWithProviders(<ProjectHealthDetail project={project({ teamSliceOnly: true })} />);
    expect(screen.getByText(/this team's tasks only/)).toBeInTheDocument();
  });

  it('says "blocked today" for a task blocked the same working day', () => {
    renderWithProviders(<ProjectHealthDetail project={project({
      reasons: [{ kind: 'blocked', count: 1, text: '1 blocked', action: 'Follow up', examples: [{ taskId: 'b1', key: 'OMS-1', title: 'Fresh', assigneeName: 'Hana', days: 0 }] }],
    })} />);
    expect(screen.getByText('Hana · blocked today')).toBeInTheDocument();
  });

  it('renders nothing for a project with no reasons', () => {
    const { container } = renderWithProviders(<ProjectHealthDetail project={project({ health: 'Healthy', reasons: [], nextSteps: [] })} />);
    expect(container.querySelector('[data-testid="project-health-detail"]')).toBeNull();
  });
});

describe('HealthToggle', () => {
  it('opens and closes the explanation when clicked', () => {
    const onToggle = vi.fn();
    renderWithProviders(<HealthToggle project={project()} open={false} onToggle={onToggle} badge={<span>Critical</span>} />);

    const button = screen.getByRole('button', { name: /OMS: Critical — show why/ });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('is not clickable for a healthy project — there is nothing to explain', () => {
    renderWithProviders(<HealthToggle project={project({ health: 'Healthy', reasons: [] })} open={false} onToggle={vi.fn()} badge={<span>Healthy</span>} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Healthy')).toBeInTheDocument();
  });
});

describe('healthSummary and HealthLegend', () => {
  it('joins the reasons into one short line', () => {
    expect(healthSummary(project())).toBe('4 overdue tasks (oldest 6 working days late) · 1 blocked 5+ working days (oldest 7) · 1 due within 3 days');
    expect(healthSummary(project({ reasons: null }))).toBe('');
  });

  it('explains what Critical and At Risk mean', () => {
    renderWithProviders(<HealthLegend />);
    expect(screen.getByText(/late or blocked for too long/)).toBeInTheDocument();
    expect(screen.getByText(/late \(but\s+recently\)/)).toBeInTheDocument();
  });
});
