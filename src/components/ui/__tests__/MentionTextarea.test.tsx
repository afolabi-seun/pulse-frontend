import { useState } from 'react';
import { screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import MentionTextarea from '../MentionTextarea';
import { renderWithProviders } from '../../../test/renderWithProviders';

// The backend (GetTaskMentionCandidatesQuery) always includes a task's creator in this list
// regardless of their project access or active status — a client-side filter re-applied here
// would silently break that guarantee, which is exactly the bug this suite locks in.
const candidates = [
  { id: 'e1', name: 'Anuoluwapo Mogbojuri' },
  { id: 'e2', name: 'Oluwaseun Afolabi' },
  { id: 'e3', name: 'Oluwakemi Rokosu' },
];

function Wrapper() {
  const [value, setValue] = useState('');
  return <MentionTextarea value={value} onChange={setValue} engineers={candidates} />;
}

describe('MentionTextarea', () => {
  it('suggests every matching candidate the caller passed in, with no extra filtering', () => {
    renderWithProviders(<Wrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@olu' } });

    expect(screen.getByText('Oluwaseun Afolabi')).toBeInTheDocument();
    expect(screen.getByText('Oluwakemi Rokosu')).toBeInTheDocument();
  });

  it('inserts the name when a suggestion is clicked, not just when it is chosen with the keyboard', () => {
    renderWithProviders(<Wrapper />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'cc @olu' } });

    fireEvent.mouseDown(screen.getByText('Oluwakemi Rokosu'));

    expect(box).toHaveValue('cc @Oluwakemi Rokosu ');
    expect(screen.queryByText('Oluwaseun Afolabi')).not.toBeInTheDocument();
  });

  it('keeps the suggestion list clickable inside a modal drawer', () => {
    // A modal Dialog/Sheet (the task preview drawer) sets pointer-events: none on <body> and on everything portaled to it, so the list has to
    // opt back in or its names can only be picked with the keyboard. jsdom cannot reproduce the modal itself, so this pins the opt-in.
    renderWithProviders(<Wrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@olu' } });

    const list = screen.getByText('Oluwaseun Afolabi').closest('div');
    expect(list).toHaveStyle({ pointerEvents: 'auto' });
  });
});
