import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Inbox } from 'lucide-react';
import { EmptyState } from '../empty-state';

describe('EmptyState', () => {
  it('shows its title, description and action', () => {
    render(<EmptyState icon={Inbox} title="Nothing here" description="Add one to get started." action={<button>Add</button>} />);

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Add one to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('takes less room at the small size, for an empty panel inside a page', () => {
    const { container, rerender } = render(<EmptyState icon={Inbox} title="Nothing here" />);
    expect(container.firstChild).toHaveClass('py-16');

    rerender(<EmptyState icon={Inbox} title="Nothing here" size="sm" />);
    expect(container.firstChild).toHaveClass('py-8');
    expect(container.firstChild).not.toHaveClass('py-16');
  });
});
