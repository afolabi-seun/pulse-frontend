import { render, screen, within } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EngineerUtilizationTable } from '../EngineerUtilizationTable';
import type { EngineerUtilizationEntry } from '../../../types/api';

const entry = (over: Partial<EngineerUtilizationEntry> = {}): EngineerUtilizationEntry => ({
  engineerId: 'e1', name: 'Frank Okafor', role: 'engineer',
  activeTasks: 4, totalPoints: 29, baselinePoints: 20, isOverworked: false,
  checkInsThisWeek: 3, blockers: 1, hoursLoggedThisWeek: 12, completedTasks: 2,
  tasksInQa: 0, pointsInQa: 0, subtasksCompleted: 5, cyclePoints: 17,
  ...over,
});

describe('EngineerUtilizationTable', () => {
  // The header help tooltips use a Radix popper, which needs ResizeObserver (absent in jsdom).
  beforeAll(() => {
    vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  });

  it('groups its columns under "Right now" and "This period"', () => {
    render(<EngineerUtilizationTable engineers={[entry()]} periodLabel="w/c 28 Sep 2026" />);
    expect(screen.getByText('Right now')).toBeInTheDocument();
    expect(screen.getByText('This period · w/c 28 Sep 2026')).toBeInTheDocument();
  });

  it('puts the live columns before the period columns', () => {
    render(<EngineerUtilizationTable engineers={[entry()]} />);
    const headers = screen.getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers.indexOf('Active tasks')).toBeLessThan(headers.indexOf('Completed'));
    expect(headers.indexOf('Blockers')).toBeLessThan(headers.indexOf('Subtasks done'));
  });

  it('renders the engineer row with load %, completed tasks, subtasks and hours', () => {
    render(<EngineerUtilizationTable engineers={[entry()]} />);
    const row = screen.getByText('Frank Okafor').closest('tr')!;
    expect(within(row).getByText('145%')).toBeInTheDocument();
    expect(within(row).getByText('5')).toBeInTheDocument();
    expect(within(row).getByText('12h')).toBeInTheDocument();
  });

  it('shows In QA as count and points, or a dash when none', () => {
    render(<EngineerUtilizationTable engineers={[
      entry({ engineerId: 'a', name: 'Has QA', tasksInQa: 2, pointsInQa: 10 }),
      entry({ engineerId: 'b', name: 'No QA' }),
    ]} />);
    expect(within(screen.getByText('Has QA').closest('tr')!).getByText('2 (10 pts)')).toBeInTheDocument();
    expect(within(screen.getByText('No QA').closest('tr')!).getByText('—')).toBeInTheDocument();
  });

  it('flags an overworked engineer', () => {
    render(<EngineerUtilizationTable engineers={[entry({ isOverworked: true })]} />);
    expect(screen.getByText('overworked')).toBeInTheDocument();
  });

  it('only shows the Role column when asked', () => {
    const { rerender } = render(<EngineerUtilizationTable engineers={[entry({ role: 'team_lead' })]} />);
    expect(screen.queryByText('team lead')).not.toBeInTheDocument();
    rerender(<EngineerUtilizationTable engineers={[entry({ role: 'team_lead' })]} showRole />);
    expect(screen.getByText('team lead')).toBeInTheDocument();
  });

  it('shows the empty label when there are no engineers', () => {
    render(<EngineerUtilizationTable engineers={[]} emptyLabel="Nobody here." />);
    expect(screen.getByText('Nobody here.')).toBeInTheDocument();
  });

  it('shows what is due this cycle beside the active points, and reds it when the engineer is flagged', () => {
    render(<EngineerUtilizationTable engineers={[
      entry({ engineerId: 'a', name: 'Flagged', totalPoints: 25, cyclePoints: 22, isOverworked: true }),
      entry({ engineerId: 'b', name: 'Fine', totalPoints: 25, cyclePoints: 9 }),
    ]} />);

    expect(screen.getByRole('columnheader', { name: /Due this cycle/ })).toBeInTheDocument();
    const flagged = within(screen.getByText('Flagged').closest('tr')!);
    expect(flagged.getByText('25')).toBeInTheDocument();
    expect(flagged.getByText('22')).toHaveClass('text-red-500');
    expect(flagged.getByText('overworked')).toBeInTheDocument();
    const fine = within(screen.getByText('Fine').closest('tr')!);
    expect(fine.getByText('9')).not.toHaveClass('text-red-500');
    expect(fine.queryByText('overworked')).not.toBeInTheDocument();
  });
});
