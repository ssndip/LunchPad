/**
 * packagingFee.ts — the one rule for "does this item carry a box fee, and how
 * much".
 *
 * The kiosk and the till used to answer this separately. The server had a
 * hardcoded list of category names; the client had that same list *plus* a
 * lookup into `lunchpad_parser_settings` in localStorage. The two drifted: a
 * Salads item added by hand in the Menu tab (so carrying no parser tags) was
 * shown to the customer at price + 0.10 and then charged price + 0.00, because
 * `salads` is `autoBox: true` in the client's defaults but was missing from the
 * server's category list.
 *
 * localStorage has no business in a price. It is written only by the Parser
 * Rules tab, in one administrator's browser, and decides what tags and fees get
 * baked into the menu *at import time*. Once an item is in the menu it carries
 * its own `tags` and `packagingFee`, and those are what both sides read.
 *
 * Deliberately dependency-free so the server can import it as-is. The Dockerfile
 * copies this file into the runtime image.
 */

/** Tags the parser puts on an item to mark it as boxed. */
export const BOX_FEE_TAGS = ['autobox', 'has_custom_box', 'bbq'];

/**
 * Category names that carry a box fee when an item has no tag of its own.
 * Matched as lowercase substrings, so both the parser's English section names
 * and hand-typed Bulgarian ones land here.
 *
 * `salads`/`салати` are in the list because the default parser profile tags
 * exactly `['Side Dishes', 'Salads']` with `autobox` — salads were always meant
 * to be boxed, and only the server's copy of this list had left them out.
 */
export const BOX_FEE_CATEGORIES = [
  'side dishes', 'гарнитури',
  'salads', 'салати',
  'bbq', 'скара',
];

/** Does this category carry a box fee by default? */
export const categoryCarriesBoxFee = (category?: string | null): boolean => {
  const c = (category || '').toLowerCase();
  if (!c) return false;
  return BOX_FEE_CATEGORIES.some(name => c.includes(name));
};

export interface PricedItem {
  price?: unknown;
  category?: string | null;
  tags?: string[] | null;
  packagingFee?: number | null;
}

/**
 * The box fee for one item.
 *
 * In order: an explicit per-item fee wins; then a box tag; then the category.
 *
 * @param defaultFee the canteen-wide packaging fee to apply when the item
 *        qualifies but names no amount of its own.
 */
export const packagingFeeFor = (item: PricedItem | null | undefined, defaultFee: number): number => {
  if (!item) return 0;

  // An explicit fee is authoritative, including an explicit zero.
  if (item.packagingFee !== undefined && item.packagingFee !== null) {
    const explicit = Number(item.packagingFee);
    return Number.isFinite(explicit) ? explicit : 0;
  }

  const tags = Array.isArray(item.tags) ? item.tags : [];
  if (tags.some(t => BOX_FEE_TAGS.includes(t))) return defaultFee;

  return categoryCarriesBoxFee(item.category) ? defaultFee : 0;
};
