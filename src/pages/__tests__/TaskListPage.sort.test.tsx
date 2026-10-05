import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SortableHeader } from '../tasks/TaskListPage';

describe('SortableHeader', () => {
  it('calls onSort with its own column when clicked', () => {
    const onSort = vi.fn();
    render(<SortableHeader label="Due" column="dueDate" sortBy="" sortDirection="asc" onSort={onSort} />);

    fireEvent.click(screen.getByRole('button', { name: /due/i }));

    expect(onSort).toHaveBeenCalledWith('dueDate');
  });

  it('is not visually active when a different column is sorted', () => {
    render(<SortableHeader label="Due" column="dueDate" sortBy="points" sortDirection="asc" onSort={vi.fn()} />);

    expect(screen.getByRole('button', { name: /due/i })).toHaveClass('text-muted-foreground');
  });

  it('is visually active when its own column is the current sort', () => {
    render(<SortableHeader label="Pts" column="points" sortBy="points" sortDirection="desc" onSort={vi.fn()} />);

    expect(screen.getByRole('button', { name: /pts/i })).toHaveClass('text-foreground');
  });
});
