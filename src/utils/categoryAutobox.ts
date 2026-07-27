/**
 * categoryAutobox.ts
 * 
 * Single source of truth for "does this category/item require a packaging fee?"
 * Reads live from parserLocalSettings (localStorage), so toggling in the 
 * Admin Parser Rules tab takes effect immediately in the Kiosk without re-parsing.
 */
import { MenuItem } from '../types';
import { loadCategorySettings } from './parserLocalSettings';
import { MENU_CONFIG } from './menuConfig';

/**
 * Given a category ID (e.g. "salads", "cat_123"), returns whether the
 * admin has enabled autoBox for that category in parser settings.
 */
export function isCategoryAutoBox(categoryId: string): boolean {
  const settings = loadCategorySettings();
  if (!categoryId) return false;
  
  let normalizedKey = categoryId.toLowerCase().trim();
  if (normalizedKey === 'salads') normalizedKey = 'salads';
  else if (normalizedKey === 'side dishes' || normalizedKey === 'sides') normalizedKey = 'sides';
  else if (normalizedKey === 'bbq') normalizedKey = 'bbq';
  else if (normalizedKey === 'soups') normalizedKey = 'soups';
  else if (normalizedKey === 'main dishes' || normalizedKey === 'mains') normalizedKey = 'mains';
  else if (normalizedKey === 'bread') normalizedKey = 'bread';
  else if (normalizedKey === 'desserts') normalizedKey = 'desserts';
  else if (normalizedKey === 'other') normalizedKey = 'other';

  return settings.categories[normalizedKey]?.autoBox === true;
}

/**
 * Returns true if a menu item should have a packaging fee applied.
 * Priority:
 *  1. Item has an explicit `autobox` or `has_custom_box` tag (set at parse time)
 *  2. Admin has enabled autoBox for this item's category in parser settings (live)
 *  3. Legacy fallback: category name contains known BG keywords
 */
export function isItemAutoBox(item: MenuItem): boolean {
  if (!item) return false;
  if (item.packagingFee && item.packagingFee > 0) return true;

  const tags = item.tags || [];

  // 1. Explicit tag on the item
  if (tags.some(t => t === 'autobox' || t === 'has_custom_box' || t === 'bbq')) {
    return true;
  }

  // 2. Live parser settings for the category
  if (item.category && isCategoryAutoBox(item.category)) {
    return true;
  }

  // 3. Legacy category name fallback (BG keywords)
  const cat = (item.category || '').toLowerCase();
  return cat.includes('side dishes') || cat.includes('гарнитури') ||
         cat.includes('bbq') || cat.includes('скара');
}
