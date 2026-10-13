import { describe, it, expect } from 'vitest';
import { WIKI_CATEGORIES, wikiCategory, groupByWikiCategory, DEFAULT_WIKI_CATEGORY } from '../wikiCategories';

describe('wiki categories', () => {
  it('are the agreed types, with General last as the catch-all', () => {
    expect(WIKI_CATEGORIES.map((c) => c.value)).toEqual(['development', 'architecture', 'product', 'pmo', 'functional', 'general']);
    expect(DEFAULT_WIKI_CATEGORY).toBe('general');
  });

  it('treat a missing or unknown type as General instead of breaking the screen', () => {
    expect(wikiCategory(undefined).value).toBe('general');
    expect(wikiCategory(null).value).toBe('general');
    expect(wikiCategory('a-type-from-a-newer-build').value).toBe('general');
    expect(wikiCategory('pmo').label).toBe('PMO');
  });

  it('group items in the types\' order, drop empty types, and keep the incoming order inside a group', () => {
    const items = [
      { id: 1, category: 'general' }, { id: 2, category: 'pmo' }, { id: 3, category: 'development' },
      { id: 4, category: undefined }, { id: 5, category: 'pmo' },
    ];

    const groups = groupByWikiCategory(items, (i) => i.category);

    expect(groups.map((g) => g.category.value)).toEqual(['development', 'pmo', 'general']);
    expect(groups[1].items.map((i) => i.id)).toEqual([2, 5]);
    expect(groups[2].items.map((i) => i.id)).toEqual([1, 4]);   // undefined counts as General
  });
});
