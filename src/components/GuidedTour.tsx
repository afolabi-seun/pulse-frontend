import { useState, useEffect, useCallback } from 'react';
import { Joyride, type EventData, STATUS, type Step } from 'react-joyride';

const STORAGE_KEY = 'pulse_hasSeenTour';

const STEPS: Step[] = [
  {
    target: '[data-tour="tour-dashboard"]',
    title: 'Your dashboard',
    content: 'A live overview of your active tasks, upcoming due dates, and overwork signals — your daily starting point.',
    placement: 'right',
    skipBeacon: true,
  },
  {
    target: '[data-tour="tour-tasks"]',
    title: 'Tasks',
    content: 'All your work lives here. Filter by project, sprint, or status. Click any task to see full details, flag a blocker, or send it to QA.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-checkin"]',
    title: 'Daily check-in',
    content: 'A 60-second async stand-up. What you completed, what\'s next, and any blockers. Replaces the daily meeting and feeds the standup digest for your team lead.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-projects"]',
    title: 'Projects',
    content: 'Browse all active projects, see task counts, and follow projects to get notified of changes. Each project has its own epics and task board.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-sprints"]',
    title: 'Sprints',
    content: 'Plan and track sprints. Drag tasks between Active, Blocked, and Done columns. Use Planning Poker to agree on story points as a team.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-escalations"]',
    title: 'Escalations',
    content: 'Tasks that are at risk of missing their due date automatically appear here (T-3: 3 days out, T-1: 1 day out, Overdue). You\'ll also get email and in-app alerts.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-notifications"]',
    title: 'Notifications',
    content: 'Escalation alerts, QA outcomes, task assignments, and blocker flags all land here. Critical ones also arrive by email.',
    placement: 'right',
  },
  {
    target: '[data-tour="tour-wiki"]',
    title: 'Wiki',
    content: 'A shared knowledge base for your team. Write and edit pages in Markdown, browse revision history, and search across all projects from the global wiki index.',
    placement: 'right',
  },
  {
    target: '#main-content',
    title: "You're all set",
    content: 'That\'s the core of Pulse. Use ⌘K to search for anything, or click the ? icons throughout the app for context-specific help.',
    placement: 'center',
  },
];

export default function GuidedTour() {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // A storage-restricted session (private browsing, blocked storage) throws on read — treat
    // that as "not seen" rather than letting it crash the effect and never show the tour.
    let hasSeenTour = false;
    try {
      hasSeenTour = !!localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore — fall through as unseen
    }
    if (!hasSeenTour) {
      // Small delay so the sidebar nav links are rendered before Joyride queries them.
      const t = setTimeout(() => setRun(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleEvent = useCallback((data: EventData) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      // setRun(false) must run even if persisting the dismissal fails, or the tour would be
      // stuck open in a storage-restricted session with no way to close it.
      try {
        localStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // ignore — dismissal still takes effect for this session, just won't persist
      }
      setRun(false);
    }
  }, []);

  if (!run) return null;

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      scrollToFirstStep
      onEvent={handleEvent}
      options={{
        primaryColor: 'hsl(var(--primary))',
        zIndex: 10000,
        showProgress: true,
        buttons: ['back', 'close', 'primary', 'skip'],
      }}
      styles={{
        tooltip: {
          borderRadius: '0.5rem',
          padding: '1.25rem',
          maxWidth: '320px',
        },
        tooltipTitle: {
          fontSize: '0.875rem',
          fontWeight: '600',
          marginBottom: '0.5rem',
        },
        tooltipContent: {
          fontSize: '0.8125rem',
          lineHeight: '1.5',
          padding: '0',
        },
        buttonPrimary: {
          borderRadius: '0.375rem',
          fontSize: '0.8125rem',
          padding: '0.5rem 1rem',
        },
        buttonBack: {
          borderRadius: '0.375rem',
          fontSize: '0.8125rem',
          padding: '0.5rem 1rem',
          marginRight: '0.5rem',
        },
        buttonSkip: {
          fontSize: '0.75rem',
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      locale={{
        back: 'Back',
        close: 'Close',
        last: 'Done',
        next: 'Next',
        skip: 'Skip tour',
      }}
    />
  );
}
