import { MenuItem } from '../types';
import { MENU_CONFIG, MenuConfig } from './menuConfig';
import { parseMenuText } from './advancedMenuParser';
import { loadCategorySettings, ParserPersistence } from './parserLocalSettings';

export interface ParseResult {
  detectedDate?: string;
  items: MenuItem[];
  unmatchedLines: string[];
}

// ─── Regex ────────────────────────────────────────────────────────────────────
const DATE_RE = /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/;
const PRICE_RE = /([\d]+[,.][\d]+|[\d]+)\s*(€|\$|лв)/;

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function reclassifyItem(item: MenuItem, allItems: MenuItem[]): string {
  const name = item.name.toLowerCase().trim();
  const price = item.price;
  const currentCat = item.category;

  // 1. Safety Rule: Meat definitely isn't a salad
  const isMeat = /кюфте|кебапче|пържола|пиле|свинск|телешк|meat|chicken|pork|beef|филе|крилца/i.test(name);
  if (currentCat === 'salads' && isMeat) {
    return 'bbq';
  }

  // 2. Duplicate Differentiation Rule
  // ONLY if there are 2+ items with the exact same name (case-insensitive)
  const identicals = allItems.filter(i => i.name.toLowerCase().trim() === name);
  
  if (identicals.length >= 2) {
    const prices = identicals.map(i => i.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    // Only differentiate if there is a SIGNIFICANT price difference (at least 0.40)
    // This distinguishes "Main Salad" (e.g. 1.50) from "Side Garnish" (e.g. 0.75)
    if (maxPrice >= minPrice + 0.40) {
      if (price === minPrice) {
        return 'sides';
      }
    }
  }

  return currentCat;
}

function mapCategoryNameToKey(categoryName: string, config: MenuConfig): string {
  const lineLower = categoryName.toLowerCase().trim();
  
  // 1. Explicit Bulgarian overrides for absolute reliability
  if (lineLower.includes('салат')) return 'salads';
  if (lineLower.includes('гарнитур')) return 'sides';
  if (lineLower.includes('суп') || lineLower.includes('чорб')) return 'soups';
  if (lineLower.includes('скар')) return 'bbq';
  if (lineLower.includes('десерт')) return 'desserts';
  if (lineLower.includes('хляб')) return 'bread';
  if (lineLower.includes('основн')) return 'mains';
  if (lineLower.includes('друг')) return 'other';

  // 2. Try exact matches from config/custom
  for (const [key, keywords] of Object.entries(config.categoryKeywords)) {
    if (keywords.some(k => lineLower === k.toLowerCase())) {
      return key;
    }
  }

  // 3. Fallback to inclusion
  for (const [key, keywords] of Object.entries(config.categoryKeywords)) {
    if (keywords.some(k => lineLower.includes(k.toLowerCase()))) {
      return key;
    }
  }
  
  return 'other';
}

function enrichItems(items: MenuItem[], customCategories: any[], settings: ParserPersistence): MenuItem[] {
  const catSettings = settings.categories;

  // 1. Heuristic re-classification (Fixes meat in salads, small salads as sides, etc.)
  // Run this FIRST so we can accurately find the side dish pool
  items.forEach(item => {
    item.category = reclassifyItem(item, items);
  });
  
  // 2. Find first side dish name (legacy fallback if sides exist)
  const isSide = (catId: string) => {
    const lower = catId.toLowerCase();
    if (['sides', 'side dishes', 'гарнитури'].includes(lower)) return true;
    const custom = customCategories.find(c => c.id === catId);
    return custom?.keywords?.some((k: string) => /^(гарнитур|side dish)/i.test(k));
  };
  const sideDishes = items.filter(i => isSide(i.category || ''));
  const firstSide = sideDishes[0]?.name;

  return items.map(item => {
    const catId = item.category || 'other';
    const catOverride = catSettings[catId] || { autoBox: false, hasSideDish: false };

    if (catOverride.autoBox) {
      item.tags.push('autobox');
    }

    if (catId === 'bbq') {
      item.tags.push('bbq');
    }

    const keywordEnabled = settings.sideDishKeywordEnabled !== false; // default true if missing
    const keywordTrigger = keywordEnabled &&
      settings.sideDishKeyword &&
      item.name.toLowerCase().includes(settings.sideDishKeyword.toLowerCase());

    const hasSideTrigger = catOverride.hasSideDish || keywordTrigger;

    if (hasSideTrigger) {
      item.requiresSideChoice = true;
      item.hasIncludedSide = true;
      if (firstSide) {
        item.selectedSide = firstSide;
      }
    }
    
    return item;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function parsePastedMenu(text: string, settingsOverride?: ParserPersistence, customCategories: any[] = []): ParseResult {
  const settings = settingsOverride || loadCategorySettings();
  const parsedAdvanced = parseMenuText(text, customCategories);
  const tempItems: MenuItem[] = [];
  let currentId = Date.now();

  for (const parsedCategory of parsedAdvanced.categories) {
    const rawName = parsedCategory.categoryName.toLowerCase().trim();
    let matchedCatId = 'other';
    
    // 1. ABSOLUTE BULGARIAN LAW (Overrides everything)
    // Using character classes to handle Latin/Cyrillic lookalikes
    if (/[сc][кk][аa][рp]/.test(rawName)) matchedCatId = 'bbq';
    else if (/[сc][аa][лl][аa][тt]/.test(rawName)) matchedCatId = 'salads';
    else if (/[сc][уy][пp]|[чj][оo][рp][бb]/.test(rawName)) matchedCatId = 'soups';
    else if (/[гg][аa][рp][нn][иi][тt][уu][рp]/.test(rawName)) matchedCatId = 'sides';
    else if (/[дd][еe][сc][еe][рp][тt]/.test(rawName)) matchedCatId = 'desserts';
    else if (/[хh][лl][яa][бb]/.test(rawName)) matchedCatId = 'bread';
    else if (/[оo][сc][нn][оo][вv][нn]/.test(rawName)) matchedCatId = 'mains';

    // 2. Custom Category Logic (Only if not already matched by Bulgarian Law)
    if (matchedCatId === 'other' && customCategories && customCategories.length > 0) {
      for (const cat of customCategories) {
        if (cat.keywords.some((k: string) => rawName.includes(k.toLowerCase().trim()))) {
          matchedCatId = cat.id;
          break;
        }
      }
    }

    for (const parsedItem of parsedCategory.items) {
      const item: MenuItem = {
        id: currentId++,
        name: parsedItem.weight ? `${parsedItem.name} ${parsedItem.weight}` : parsedItem.name,
        description: '',
        basePrice: parsedItem.price,
        price: parsedItem.price,
        available: true,
        category: matchedCatId,
        tags: [],
        extraFees: [],
        date: parsedItem.date || undefined
      };

      if (parsedItem.boxFee > 0) {
        item.tags.push('has_custom_box');
      }

      tempItems.push(item);
    }
  }

  const enrichedItems = enrichItems(tempItems, customCategories, settings);

  return {
    detectedDate: parsedAdvanced.date || undefined,
    items: enrichedItems,
    unmatchedLines: parsedAdvanced.unmatchedLines || []
  };
}
