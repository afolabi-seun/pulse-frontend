import { HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';

interface HelpTooltipProps {
  title: string;
  body: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export default function HelpTooltip({ title, body, side = 'top' }: HelpTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Help: ${title}`}
            className="inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          className="max-w-xs space-y-1 px-3 py-2.5 text-left"
        >
          <p className="font-semibold">{title}</p>
          <p className="text-xs font-normal leading-relaxed opacity-90">{body}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
