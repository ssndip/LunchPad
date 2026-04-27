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

function mapCategoryNameToKey(categoryName: string, config: MenuConfig): string {
  const lineLower = categoryName.toLowerCase();
  for (const [key, keywords] of Object.entries(config.categoryKeywords)) {
    if (keywords.some(k => lineLower.includes(k.toLowerCase()))) {
      return key;
    }
  }
  return 'other';
}

/**
 * Stage 4: Enrichment (Rules Engine + Auto-Select)
 * Accepts per-category settings overrides from localStorage.
 */
function enrichItems(items: MenuItem[], config: MenuConfig, settings: ParserPersistence): MenuItem[] {
  const catSettings = settings.categories;
  const sideDishes = items.filter(i => i.category === config.categoryLabels.sides);
  const firstSide = sideDishes[0]?.name;

  // Build a reverse lookup: display label → category key
  const labelToKey: Record<string, string> = {};
  for (const [key, label] of Object.entries(config.categoryLabels)) {
    labelToKey[label] = key;
  }

  return items.map(item => {
    const catKey = labelToKey[item.category || ''] || 'other';
    const catOverride = catSettings[catKey] || { autoBox: false, hasSideDish: false };

    // Apply auto-box tag based on per-category setting
    if (catOverride.autoBox) {
      item.tags.push('autobox');
    }

    // Apply BBQ tag (always — it's a BBQ-specific behaviour not an admin toggle)
    if (item.category === 'BBQ') {
      item.tags.push('bbq');
    }

    // Side Dish Trigger: triggers if WHOLE category is ON or if individual item matches keyword
    const hasSideTrigger = catOverride.hasSideDish || 
      item.name.toLowerCase().includes(settings.sideDishKeyword.toLowerCase());

    if (hasSideTrigger) {
      item.requiresSideChoice = true;
      item.hasIncludedSide = true;
      if (firstSide) {
        item.selectedSide = firstSide;
      }
    }

    // Preserve any custom box fee tagged by advancedParser
    // (the has_custom_box tag keeps dynamic fee logic intact)
    
    return item;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse pasted menu text using the category settings from localStorage.
 * Category settings control autobox and side dish trigger per category.
 */
export function parsePastedMenu(text: string, settingsOverride?: ParserPersistence): ParseResult {
  const settings = settingsOverride || loadCategorySettings();
  const parsedAdvanced = parseMenuText(text);
  const tempItems: MenuItem[] = [];
  let currentId = Date.now();

  for (const parsedCategory of parsedAdvanced.categories) {
    const internalKey = mapCategoryNameToKey(parsedCategory.categoryName, MENU_CONFIG);
    const categoryDisplayLabel = MENU_CONFIG.categoryLabels[internalKey] || 'Other';

    for (const parsedItem of parsedCategory.items) {
      const item: MenuItem = {
        id: currentId++,
        name: parsedItem.name,
        description: '',
        basePrice: parsedItem.price,
        price: parsedItem.price,
        available: true,
        category: categoryDisplayLabel,
        tags: [],
        extraFees: [],
        date: parsedItem.date || undefined
      };

      if (parsedItem.boxFee > 0) {
        item.tags.push('has_custom_box');
        // We no longer assign item.packagingFee here, so it falls back to the global preset packaging fee
      }

      tempItems.push(item);
    }
  }

  const enrichedItems = enrichItems(tempItems, MENU_CONFIG, settings);

  return {
    detectedDate: parsedAdvanced.date || undefined,
    items: enrichedItems,
    unmatchedLines: parsedAdvanced.unmatchedLines || []
  };
}
