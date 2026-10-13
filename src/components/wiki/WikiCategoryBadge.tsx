import { wikiCategory } from '../../lib/wikiCategories';
import { cn } from '@/lib/utils';

/** A small coloured chip naming a wiki page's type. */
export default function WikiCategoryBadge({ category, className }: { category: string | null | undefined; className?: string }) {
  const info = wikiCategory(category);
  return (
    <span
      className={cn('inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset', info.badgeClass, className)}
      title={info.hint}
    >
      {info.label}
    </span>
  );
}
