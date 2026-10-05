import { useState } from 'react';
import { X, FlaskConical } from 'lucide-react';

const STORAGE_KEY = 'pulse_demo_banner_dismissed';

interface Persona { email: string; role: string }

// Demo credentials are NEVER hard-coded — they are supplied at build time via env
// so nothing sensitive ends up in the source or the production bundle. The banner
// only renders for a demo build that explicitly sets these.
const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD as string | undefined;

function parsePersonas(): Persona[] {
  const raw = import.meta.env.VITE_DEMO_PERSONAS as string | undefined;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p): p is Persona => typeof p?.email === 'string' && typeof p?.role === 'string')
      : [];
  } catch {
    return [];
  }
}

const PERSONAS = parsePersonas();

export default function DemoBanner() {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(STORAGE_KEY) === 'true',
  );

  const enabled = import.meta.env.VITE_SHOW_DEMO_BANNER === 'true' && !!DEMO_PASSWORD;
  if (!enabled || dismissed) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setDismissed(true);
  };

  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-900">
      <FlaskConical className="h-4 w-4 shrink-0 text-amber-600" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold">Demo environment</span>
        <span className="text-amber-700">
          Password for all accounts:{' '}
          <code className="font-mono font-semibold">{DEMO_PASSWORD}</code>
        </span>
        {PERSONAS.length > 0 && (
          <span className="hidden sm:flex flex-wrap gap-x-3 text-amber-800">
            {PERSONAS.map(({ email, role }) => (
              <span key={email} className="whitespace-nowrap">
                <code className="font-mono text-xs">{email}</code>
                <span className="text-amber-600"> ({role})</span>
              </span>
            ))}
          </span>
        )}
      </div>
      <button
        onClick={dismiss}
        className="shrink-0 rounded p-0.5 hover:bg-amber-100"
        aria-label="Dismiss demo banner"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
