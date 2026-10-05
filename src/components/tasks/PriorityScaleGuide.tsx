import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { PriorityScaleEntryDto } from '@/types/api';

// Same visual language as HelpTooltip (dark Radix tooltip, HelpCircle trigger), widened for a
// compact table instead of a single title+body pair — shown wherever priority is *set*, so the
// five levels can be compared side by side while choosing, not just hinted at one at a time.
export default function PriorityScaleGuide({ scale }: { scale: PriorityScaleEntryDto[] }) {
  if (!scale.length) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="What do priority levels mean?"
            className="ml-1.5 inline-flex items-center justify-center align-middle rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" className="w-72 max-w-none space-y-2 px-3 py-2.5 text-left">
          <p className="font-semibold">What do priority levels mean?</p>
          <table className="w-full text-xs border-collapse">
            <tbody>
              {scale
                .slice()
                .sort((a, b) => a.value - b.value)
                .map((e) => (
                  <tr key={e.value} className="align-top">
                    <td className="py-1 pr-2 font-bold whitespace-nowrap">P{e.value} &middot; {e.label}</td>
                    <td className="py-1 opacity-90">{e.criteria}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
