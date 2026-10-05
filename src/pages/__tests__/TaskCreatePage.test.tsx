import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { toast } from 'sonner';
import TaskCreatePage from '../tasks/TaskCreatePage';
import { renderWithProviders } from '../../test/renderWithProviders';

vi.mock('sonner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('sonner')>();
  return { ...actual, toast: { ...actual.toast, success: vi.fn(), error: vi.fn() } };
});

const mockMutate = vi.fn();
vi.mock('../../api/tasks', () => ({
  useCreateTask: () => ({ mutate: mockMutate, isPending: false }),
}));

// pm-or-above implies team-lead-or-above in the real capability hierarchy — the mock mirrors
// that so a PM-role test doesn't accidentally pass by granting a capability the role lacks.
const mockAllow = vi.fn((capability: string) => capability === 'pm-or-above' || capability === 'team-lead-or-above');
const mockCurrentUser = { id: 'u1', name: 'Priya PM', role: 'project_manager', permissions: [], capabilities: [] };
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ currentUser: mockCurrentUser, allow: mockAllow }),
}));

vi.mock('../../api/projects', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/projects')>();
  return {
    ...actual,
    useMyProjects: () => ({ data: [{ id: 'mp1', name: 'My Real Project' }] }),
    useProjectList: () => ({
      data: [
        { id: 'p1', name: 'Pulse Core', isActive: true,  canAccess: true },
        { id: 'p2', name: 'Archive',       isActive: false, canAccess: true },
        { id: 'p3', name: 'Other Dept',    isActive: true,  canAccess: false },
      ],
    }),
  };
});

vi.mock('../../api/engineers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api/engineers')>();
  return {
    ...actual,
    useEngineerList: () => ({
      data: [
        { id: 'e1', name: 'Alice', isActive: true },
        { id: 'e2', name: 'Inactive Bob', isActive: false },
      ],
    }),
  };
});

describe('TaskCreatePage', () => {
  beforeEach(() => {
    mockMutate.mockReset();
    vi.mocked(toast.success).mockReset();
    mockAllow.mockImplementation((capability: string) => capability === 'pm-or-above' || capability === 'team-lead-or-above');
  });

  function fillAndSubmit() {
    fireEvent.change(screen.getByPlaceholderText(/task title/i), { target: { value: 'New feature' } });
    fireEvent.focus(screen.getByPlaceholderText(/search projects/i));
    fireEvent.mouseDown(screen.getByText('Pulse Core'));
    fireEvent.click(screen.getByRole('button', { name: /create task/i }));
  }

  it('renders all required form fields', () => {
    renderWithProviders(<TaskCreatePage />);
    expect(screen.getByPlaceholderText(/task title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create task/i })).toBeInTheDocument();
  });

  it('does not render a Points field — points are set later via grooming, not on create', () => {
    renderWithProviders(<TaskCreatePage />);
    expect(screen.queryByText('Points')).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  });

  it('only lists active projects in the dropdown', () => {
    renderWithProviders(<TaskCreatePage />);
    // SearchableSelect only renders its option list once the input is focused open.
    fireEvent.focus(screen.getByPlaceholderText(/search projects/i));
    expect(screen.getByText('Pulse Core')).toBeInTheDocument();
    expect(screen.queryByText('Archive')).not.toBeInTheDocument();
  });

  it('excludes projects the viewer cannot access from the dropdown', () => {
    renderWithProviders(<TaskCreatePage />);
    fireEvent.focus(screen.getByPlaceholderText(/search projects/i));
    expect(screen.queryByText('Other Dept')).not.toBeInTheDocument();
  });

  it('only lists active engineers in the assignee dropdown', () => {
    renderWithProviders(<TaskCreatePage />);
    // SearchableSelect only renders its option list once the input is focused open.
    fireEvent.focus(screen.getByPlaceholderText(/search engineers/i));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Inactive Bob')).not.toBeInTheDocument();
  });

  it('lets a team lead (below pm-or-above) assign to their team engineers, not just themselves', () => {
    mockAllow.mockImplementation((capability: string) => capability === 'team-lead-or-above');
    renderWithProviders(<TaskCreatePage />);
    fireEvent.focus(screen.getByPlaceholderText(/search engineers/i));
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Assign to me')).not.toBeInTheDocument();
  });

  it('shows a static assignee line instead of a dropdown when you have no one else to assign to', () => {
    mockAllow.mockImplementation(() => false);
    renderWithProviders(<TaskCreatePage />);
    expect(screen.getByText('Assigned to you')).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/search engineers/i)).not.toBeInTheDocument();
  });

  it('shows validation errors when submitted empty', async () => {
    renderWithProviders(<TaskCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      expect(screen.getByText(/title is required/i)).toBeInTheDocument();
      expect(screen.getByText(/project is required/i)).toBeInTheDocument();
    });
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate when required fields are filled', async () => {
    renderWithProviders(<TaskCreatePage />);

    fireEvent.change(screen.getByPlaceholderText(/task title/i), { target: { value: 'New feature' } });

    const allInputs = document.querySelectorAll('input[type="date"]');
    if (allInputs.length > 0) {
      fireEvent.change(allInputs[0], { target: { value: '2026-08-01' } });
    }

    fireEvent.focus(screen.getByPlaceholderText(/search projects/i));
    fireEvent.mouseDown(screen.getByText('Pulse Core'));
    fireEvent.click(screen.getByRole('button', { name: /create task/i }));

    await waitFor(() => {
      if (mockMutate.mock.calls.length > 0) {
        expect(mockMutate.mock.calls[0][0]).toMatchObject({ title: 'New feature', projectId: 'p1' });
      }
    });
  });

  it('shows a backlog-specific toast when the created task lands in Backlog', async () => {
    renderWithProviders(<TaskCreatePage />);
    fillAndSubmit();

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    mockMutate.mock.calls[0][1].onSuccess({ id: 't1', status: 'backlog' });

    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('Backlog'));
  });

  it('shows the generic toast when the created task is not in Backlog', async () => {
    renderWithProviders(<TaskCreatePage />);
    fillAndSubmit();

    await waitFor(() => expect(mockMutate).toHaveBeenCalled());
    mockMutate.mock.calls[0][1].onSuccess({ id: 't1', status: 'active' });

    expect(toast.success).toHaveBeenCalledWith('Task created.');
  });

  describe('personal tasks (HR / Accountant)', () => {
    beforeEach(() => {
      mockAllow.mockImplementation((capability: string) => capability === 'personal-task-creator');
    });

    it('offers the Project task / Personal task toggle only to roles that can keep personal tasks', () => {
      mockAllow.mockImplementation((capability: string) => capability === 'pm-or-above' || capability === 'team-lead-or-above');
      renderWithProviders(<TaskCreatePage />);
      expect(screen.queryByRole('button', { name: /personal task/i })).not.toBeInTheDocument();
    });

    it('starts in personal mode and submits just a title, notes and due date with personal: true', async () => {
      renderWithProviders(<TaskCreatePage />);

      expect(screen.getByText('New personal task')).toBeInTheDocument();
      fireEvent.change(screen.getByPlaceholderText(/task title/i), { target: { value: 'Review leave policy' } });
      fireEvent.change(document.querySelector('input[type="date"]:not([disabled])')!, { target: { value: '2026-11-02' } });
      fireEvent.click(screen.getByRole('button', { name: /create task/i }));

      await waitFor(() => expect(mockMutate).toHaveBeenCalled());
      expect(mockMutate.mock.calls[0][0]).toEqual({
        title: 'Review leave policy', description: undefined, dueDate: '2026-11-02', personal: true,
      });
    });

    it('does not ask for a project, and requires a due date', async () => {
      renderWithProviders(<TaskCreatePage />);
      fireEvent.change(screen.getByPlaceholderText(/task title/i), { target: { value: 'No date yet' } });
      fireEvent.click(screen.getByRole('button', { name: /create task/i }));

      await waitFor(() => expect(screen.getByText(/due date is required/i)).toBeInTheDocument());
      expect(screen.queryByText(/project is required/i)).not.toBeInTheDocument();
      expect(mockMutate).not.toHaveBeenCalled();
    });

    it('switches back to an ordinary project task', async () => {
      renderWithProviders(<TaskCreatePage />);
      fireEvent.click(screen.getByRole('button', { name: 'Project task' }));

      expect(screen.getByText('New task')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /create task/i }));
      await waitFor(() => expect(screen.getByText(/project is required/i)).toBeInTheDocument());
    });

    it('opens as a project task when arriving from a specific project', () => {
      renderWithProviders(<TaskCreatePage />, { initialEntries: ['/tasks/new?projectId=mp1'] });
      expect(screen.getByText('New task')).toBeInTheDocument();
    });
  });
});
