import { screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import FeedbackPatternsPanel from '../FeedbackPatternsPanel';
import { renderWithProviders } from '../../../test/renderWithProviders';
import type { FeedbackPatternsDto } from '../../../types/api';

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
});

const patterns = (over: Partial<FeedbackPatternsDto> = {}): FeedbackPatternsDto => ({
  weeks: [
    { weekOf: '2026-09-14', totalResponses: 5, distinctSources: 5 },
    { weekOf: '2026-09-07', totalResponses: 8, distinctSources: 4 },
  ],
  hiddenWeeks: 0, eligiblePeople: 10, scope: 'Organisation', ...over,
});

describe('FeedbackPatternsPanel', () => {
  it('shows how much of the team took part, leading with the percentage', () => {
    renderWithProviders(<FeedbackPatternsPanel patterns={patterns()} onOpenWeek={() => {}} />);

    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('(5 of 10)')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('(4 of 10)')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Took part' })).toBeInTheDocument();
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
    expect(screen.getByText(/whole organisation/i)).toBeInTheDocument();
  });

  it('explains up front that this is volume/participation, not what people said', () => {
    renderWithProviders(<FeedbackPatternsPanel patterns={patterns()} onOpenWeek={() => {}} />);

    expect(screen.getByText(/not what anyone said/i)).toBeInTheDocument();
    expect(screen.getByText(/Entries/)).toBeInTheDocument();
  });

  it('says how many weeks were left out and why, and names the department for a head', () => {
    renderWithProviders(
      <FeedbackPatternsPanel patterns={patterns({ hiddenWeeks: 2, scope: 'Core Banking' })} onOpenWeek={() => {}} />,
    );

    expect(screen.getByText(/2 other weeks have feedback but fewer than 3 people/i)).toBeInTheDocument();
    expect(screen.getByText('Core Banking.')).toBeInTheDocument();
  });

  it('opens a week\'s entries when its row is clicked', () => {
    const onOpenWeek = vi.fn();
    renderWithProviders(<FeedbackPatternsPanel patterns={patterns()} onOpenWeek={onOpenWeek} />);

    fireEvent.click(screen.getByText('50%'));
    expect(onOpenWeek).toHaveBeenCalledWith('2026-09-14');
  });

  it('explains an empty result instead of showing an empty table', () => {
    renderWithProviders(
      <FeedbackPatternsPanel patterns={patterns({ weeks: [], hiddenWeeks: 3 })} onOpenWeek={() => {}} />,
    );

    expect(screen.getByText('No weeks to show yet')).toBeInTheDocument();
    expect(screen.getByText(/3 other weeks have feedback/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('falls back to a plain People count when nobody is eligible for a participation rate', () => {
    renderWithProviders(<FeedbackPatternsPanel patterns={patterns({ eligiblePeople: 0 })} onOpenWeek={() => {}} />);

    expect(screen.queryByText('Took part')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'People' })).toBeInTheDocument();
  });
});
