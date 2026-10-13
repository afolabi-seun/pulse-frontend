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

  // ── The list opens on a bare "@", scrolls, and ranks by where the match is ──────────────────────────────────────────────────

  const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, name: `Person ${String.fromCharCode(65 + i)}` }));

  function ManyWrapper({ people = many }: { people?: { id: string; name: string }[] }) {
    const [value, setValue] = useState('');
    return <MentionTextarea value={value} onChange={setValue} engineers={people} />;
  }

  it('shows everyone as soon as "@" is typed, before any letter', () => {
    renderWithProviders(<Wrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@' } });

    expect(screen.getByText('Anuoluwapo Mogbojuri')).toBeInTheDocument();
    expect(screen.getByText('Oluwaseun Afolabi')).toBeInTheDocument();
    expect(screen.getByText('Oluwakemi Rokosu')).toBeInTheDocument();
  });

  it('keeps every name reachable on a bare "@" instead of cutting the list at six', () => {
    renderWithProviders(<ManyWrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'hi @' } });

    expect(screen.getAllByRole('button')).toHaveLength(12);
  });

  it('narrows as letters are typed after the bare "@"', () => {
    renderWithProviders(<Wrapper />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: '@' } });
    expect(screen.getAllByRole('button')).toHaveLength(3);

    fireEvent.change(box, { target: { value: '@anu' } });
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByText('Anuoluwapo Mogbojuri')).toBeInTheDocument();
  });

  it('ranks a name where a word starts with the typed letters ahead of one that only contains them', () => {
    const people = [{ id: 'n', name: 'Nike Adelakun' }, { id: 'k', name: 'Kemi Rokosu' }, { id: 'a', name: 'Okeke Ade' }];
    renderWithProviders(<ManyWrapper people={people} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@ke' } });

    // Kemi starts with "ke"; Nike and Bankole only have it buried inside a word, so they follow, in their original order.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Kemi Rokosu', 'Nike Adelakun', 'Okeke Ade']);
  });

  it('puts a name starting with the typed letters ahead of a later word that starts with them', () => {
    const people = [{ id: 'a', name: 'Ade Kemi' }, { id: 'b', name: 'Kemi Ade' }];
    renderWithProviders(<ManyWrapper people={people} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@ke' } });

    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Kemi Ade', 'Ade Kemi']);
  });

  it('lets the list scroll rather than grow', () => {
    renderWithProviders(<ManyWrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '@' } });

    const list = screen.getByText('Person A').closest('div');
    expect(list?.className).toContain('overflow-y-auto');
    expect(list?.className).toContain('max-h-');
  });

  it('inserts the name when one is chosen from the list opened by a bare "@"', () => {
    renderWithProviders(<Wrapper />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: 'cc @' } });

    fireEvent.mouseDown(screen.getByText('Oluwaseun Afolabi'));

    expect(box).toHaveValue('cc @Oluwaseun Afolabi ');
  });

  it('does not open on an "@" inside a word, such as an email address', () => {
    renderWithProviders(<Wrapper />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'write to me@' } });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('closes on Escape and leaves the typed "@" in place', () => {
    renderWithProviders(<Wrapper />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: '@' } });
    expect(screen.getAllByRole('button')).toHaveLength(3);

    fireEvent.keyDown(box, { key: 'Escape' });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(box).toHaveValue('@');
  });

  it('moves the highlight with the arrow keys and picks the highlighted name with Enter', () => {
    renderWithProviders(<Wrapper />);
    const box = screen.getByRole('textbox');
    fireEvent.change(box, { target: { value: '@' } });

    fireEvent.keyDown(box, { key: 'ArrowDown' });
    fireEvent.keyDown(box, { key: 'Enter' });

    expect(box).toHaveValue('@Oluwaseun Afolabi ');
  });
});
