import { Activity, AudioWaveform, BellRing, ClipboardCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import DemoBanner from '../DemoBanner';
import Footer from './Footer';
import { useTheme } from '../../hooks/useTheme';

const FEATURES = [
  { icon: ClipboardCheck, text: 'Async check-ins' },
  { icon: BellRing,       text: 'Escalation alerts' },
  { icon: Activity,       text: 'Overwork detection' },
];

export default function AuthShell({ children }: { children: ReactNode }) {
  useTheme();
  return (
    <>
    <DemoBanner />
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-muted/20 p-6 sm:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(600px circle at 50% 0%, hsl(var(--primary) / 0.12), transparent 70%)' }}
      />

      <div className="relative mb-8 flex flex-col items-center gap-2 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-primary shadow-sm shadow-primary/30">
          <span aria-hidden="true" className="absolute inset-0 rounded-2xl bg-primary/50 motion-safe:animate-ping motion-reduce:hidden" />
          <AudioWaveform className="relative h-6 w-6 text-primary-foreground" />
        </div>
        <span className="text-2xl font-bold tracking-tight">Pulse</span>
        <p className="text-sm text-muted-foreground">The pulse behind every sprint.</p>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          {FEATURES.map(({ icon: Icon, text }) => (
            <span
              key={text}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground"
            >
              <Icon className="h-3 w-3 text-primary" />
              {text}
            </span>
          ))}
        </div>
      </div>

      <div className="relative w-full max-w-sm">{children}</div>

      <Footer className="relative mt-8" />
    </main>
    </>
  );
}
