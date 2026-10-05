import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import ExpandableText, { isLongText } from '../ExpandableText';

describe('ExpandableText', () => {
  it('shows short text as is, with no toggle', () => {
    render(<ExpandableText text="Fixed the login bug" />);

    expect(screen.getByText('Fixed the login bug')).not.toHaveClass('line-clamp-3');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('clamps long text to three lines and offers Show more / Show less', () => {
    const long = 'word '.repeat(60);
    render(<ExpandableText text={long} />);

    expect(screen.getByText(/word word/)).toHaveClass('line-clamp-3');
    const toggle = screen.getByRole('button', { name: 'Show more' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(toggle);
    expect(screen.getByText(/word word/)).not.toHaveClass('line-clamp-3');
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('counts many short lines as long too, and keeps the line breaks', () => {
    expect(isLongText('a\nb\nc')).toBe(false);
    expect(isLongText('a\nb\nc\nd')).toBe(true);
    expect(isLongText('x'.repeat(181))).toBe(true);

    render(<ExpandableText text={'one\ntwo\nthree\nfour'} />);
    expect(screen.getByText(/one/)).toHaveClass('whitespace-pre-wrap');
  });

  describe('judging length by how the text actually wraps', () => {
    afterEach(() => vi.restoreAllMocks());

    // jsdom does no layout: stand in for a narrow table column where 150 characters run to four lines (20px each,
    // the component's fallback line height here).
    const wrapsToLines = (n: number) => {
      vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(n * 20);
    };

    it('clamps text that is short in characters but wraps past the allowed lines', () => {
      wrapsToLines(4);
      render(<ExpandableText text="Investigate how tenant context is handled in the frontend" lines={2} />);

      expect(screen.getByText(/Investigate/)).toHaveClass('line-clamp-2');
      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    });

    it('leaves text alone when it fits in the allowed lines', () => {
      wrapsToLines(2);
      render(<ExpandableText text="Account Number lookup fix" lines={2} />);

      expect(screen.getByText('Account Number lookup fix')).not.toHaveClass('line-clamp-2');
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });
});
