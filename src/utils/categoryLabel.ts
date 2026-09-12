import { CustomCategory } from '../types';

/**
 * The display name for a menu category.
 *
 * Categories arrive from the parsed menu as free text ("Soups", "Main Dishes"),
 * while the translation keys are lowercase slugs ("categories.soups"), so the
 * lookup is case-insensitive and the raw name is always the last resort.
 *
 * useTranslation's t() returns undefined for a missing key — not the key — so
 * every branch here guards on falsiness. Comparing the result against the key
 * string is what previously let undefined reach the DOM and rendered every chip
 * blank.
 */
export function categoryLabel(
  cat: string,
  t: (key: string) => string | undefined,
  customCategories: CustomCategory[],
  lang: string,
): string {
  const custom = customCategories.find((c) => c.id === cat);
  if (custom) {
    return custom.names?.[lang] || custom.names?.en || custom.names?.bg || cat;
  }

  return t(`categories.${cat.toLowerCase()}`) || cat;
}
