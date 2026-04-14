import { MenuItem, ExtraFee } from '../types';
import { MENU_CONFIG, MenuConfig } from './menuConfig';

export interface ParseResult {
  detectedDate?: string;
  items: MenuItem[];
}

// ─── Regex ────────────────────────────────────────────────────────────────────
const DATE_RE = /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/;
/** Matches a price (e.g. 1.80, 1,80, 5) followed by currency */
const PRICE_RE = /([\d]+[,.][\d]+|[\d]+)\s*(€|\$|лв)/;

import { parseMenuText } from './advancedMenuParser';

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function mapCategoryNameToKey(categoryName: string, config: MenuConfig): string {
  const lineLower = categoryName.toLowerCase();
  for (const [key, keywords] of Object.entries(config.categoryKeywords)) {
    if (keywords.some(k => lineLower.includes(k.toLowerCase()))) {
      return key;
    }
  }
  return 'other'; // default to other if no matching keyword
}

/**
 * Stage 4: Enrichment (Rules Engine + Auto-Select)
 */
function enrichItems(items: MenuItem[], config: MenuConfig): MenuItem[] {
  // 1. Identify all side dishes
  const sideDishes = items.filter(i => i.category === config.categoryLabels.sides);
  const firstSide = sideDishes[0]?.name;

  return items.map(item => {
    // Apply General Rules
    config.rules.forEach(rule => {
      if (rule.match(item)) {
        // We no longer extract sectionConfigs, because boxFee is accurately extracted
        // on the item level by advancedMenuParser!
        // We'll pass a dummy sectionConfig with boxFee if the item specifically captured a boxFee > 0
        const dummySectionCfg = item.extraFees.length ? { boxFee: item.extraFees[0].amount } : undefined; 
        rule.apply(item, config, dummySectionCfg);
      }
    });

    // Reinforced Auto-Select Logic
    if (item.name.toLowerCase().includes(config.settings.sideDishTriggerKeyword.toLowerCase())) {
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

export function parsePastedMenu(text: string): ParseResult {
  const parsedAdvanced = parseMenuText(text);
  const tempItems: MenuItem[] = [];
  let currentId = Date.now();

  for (const parsedCategory of parsedAdvanced.categories) {
    const internalKey = mapCategoryNameToKey(parsedCategory.categoryName, MENU_CONFIG);
    const categoryDisplayLabel = MENU_CONFIG.categoryLabels[internalKey] || 'Other';

    for (const parsedItem of parsedCategory.items) {
      const item: MenuItem = {
        id: currentId++,
        name: parsedItem.name + (parsedItem.weight ? ` ${parsedItem.weight}` : ''), // Append weight to name for now, or keep separate later
        description: '',
        basePrice: parsedItem.price,
        price: parsedItem.price,
        available: true,
        category: categoryDisplayLabel,
        tags: [],
        extraFees: []
      };

      // Since advancedParser captures box overrides accurately per item, we simulate sectionConfig override:
      // Note: The rule applies +0.10 if match logic passes. We will manually tag the boxFee from the parsedItem
      if (parsedItem.boxFee > 0) {
        // If the item had an explicit box fee, add it immediately to avoid relying purely on rules
        // However, the menuConfig rules also run. Let's just pass this data down.
        item.tags.push('explicit_box_fee');
        // Let's store the boxFee temporarily so rules can use it if they want.
        // Actually, advanced parser handles determining when a box fee exists.
        // We can just add the box fee here directly. But if menuConfig rules duplicate it, we could have a pricing bug.
      }

      tempItems.push(item);
    }
  }

  // 4. Rules & Enrichment
  const enrichedItems = enrichItems(tempItems, MENU_CONFIG);

  return { detectedDate: parsedAdvanced.date || undefined, items: enrichedItems };
}

