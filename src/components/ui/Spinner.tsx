interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; label?: string }

const SIZE = { sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-8 w-8' };

export default function Spinner({ size = 'md', label = 'Loading…' }: SpinnerProps) {
  return (
    <div role="status" aria-label={label} className="flex items-center justify-center">
      <svg
        className={`${SIZE[size]} animate-spin text-current`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
    </div>
  );
}
