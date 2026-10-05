import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { WorkloadFigures, dueThisCycleHelp } from '../WorkloadFigures';

describe('WorkloadFigures', () => {
  it('shows everything active, the part due this cycle, and the baseline', () => {
    render(<WorkloadFigures activePoints={25} cyclePoints={13} baselinePoints={15} cycleDays={7} />);

    expect(screen.getByText('25 active')).toBeInTheDocument();
    expect(screen.getByText('13 due this cycle')).toBeInTheDocument();
    expect(screen.getByText('/ 15 pts')).toBeInTheDocument();
  });

  it('marks the cycle figure when the engineer is overworked, and not otherwise', () => {
    const { rerender } = render(<WorkloadFigures activePoints={25} cyclePoints={22} baselinePoints={15} overworked />);
    expect(screen.getByText('22 due this cycle')).toHaveClass('text-red-500');

    rerender(<WorkloadFigures activePoints={25} cyclePoints={9} baselinePoints={15} />);
    expect(screen.getByText('9 due this cycle')).not.toHaveClass('text-red-500');
  });

  it('explains what "due this cycle" means on hover', () => {
    const { container } = render(<WorkloadFigures activePoints={25} cyclePoints={13} baselinePoints={15} cycleDays={7} />);

    expect(container.firstElementChild).toHaveAttribute('title', dueThisCycleHelp(7));
    expect(dueThisCycleHelp(7)).toMatch(/7-day baseline cycle/);
    expect(dueThisCycleHelp(7)).toMatch(/overdue or with no due date/);
  });

  it('falls back to a plain x / baseline when the cycle figure is not available', () => {
    render(<WorkloadFigures activePoints={25} baselinePoints={15} />);

    expect(screen.getByText('25 / 15 pts')).toBeInTheDocument();
    expect(screen.queryByText(/due this cycle/)).not.toBeInTheDocument();
  });
});
