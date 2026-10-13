/** The kinds of wiki page, so documents can be grouped by what they are as well as by project. Mirrors the backend's WikiCategory: the values are
 * what is stored and sent, the label is what people read. A page nobody typed is "general". Order here is the order groups are shown in. */
export interface WikiCategoryInfo {
  value: string;
  label: string;
  /** One line shown under the type picker, so "Product" and "Functional" are not guesswork. */
  hint: string;
  /** Badge colours: full class names, so Tailwind can see them. */
  badgeClass: string;
}

export const WIKI_CATEGORIES: readonly WikiCategoryInfo[] = [
  { value: 'development',  label: 'Development',  hint: 'Code, setup, runbooks and how-tos for engineers.',
    badgeClass: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20 dark:bg-indigo-500/15 dark:text-indigo-400 dark:ring-indigo-500/30' },
  { value: 'architecture', label: 'Architecture', hint: 'System design, service boundaries and decision records.',
    badgeClass: 'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/15 dark:text-violet-400 dark:ring-violet-500/30' },
  { value: 'product',      label: 'Product',      hint: 'Vision, roadmap, requirements and user research.',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/15 dark:text-emerald-400 dark:ring-emerald-500/30' },
  { value: 'pmo',          label: 'PMO',          hint: 'Plans, reporting, governance and delivery process.',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30' },
  { value: 'functional',   label: 'Functional',   hint: 'How the system should behave: specifications and business rules.',
    badgeClass: 'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/15 dark:text-teal-400 dark:ring-teal-500/30' },
  { value: 'general',      label: 'General',      hint: 'Anything that does not fit the others.',
    badgeClass: 'bg-gray-100 text-gray-600 ring-gray-500/20 dark:bg-white/10 dark:text-gray-200 dark:ring-white/15' },
];

export const DEFAULT_WIKI_CATEGORY = 'general';

/** Anything missing or not on the list is treated as General, so an older page or a newer type this build does not know never breaks the screen. */
export function wikiCategory(value: string | null | undefined): WikiCategoryInfo {
  return WIKI_CATEGORIES.find((c) => c.value === value) ?? WIKI_CATEGORIES[WIKI_CATEGORIES.length - 1];
}

export interface CategoryGroup<T> { category: WikiCategoryInfo; items: T[] }

/** Splits items into one group per type, in the list's order, leaving out types with nothing in them. Within a group the incoming order is kept. */
export function groupByWikiCategory<T>(items: readonly T[], categoryOf: (item: T) => string | null | undefined): CategoryGroup<T>[] {
  const buckets = new Map<string, T[]>();
  items.forEach((item) => {
    const key = wikiCategory(categoryOf(item)).value;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  });
  return WIKI_CATEGORIES
    .filter((c) => buckets.has(c.value))
    .map((c) => ({ category: c, items: buckets.get(c.value)! }));
}
