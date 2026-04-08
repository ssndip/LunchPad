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

// ─── Internal Helpers ─────────────────────────────────────────────────────────

/**
 * Extracts prices and fees from headers like:
 * "Гарнитури (100гр 0.75€ + 0.10€ кутийка) :"
 * "Скара + 0.10€ кутийка"
 */
function extractHeaderConfig(line: string) {
  const priceRegex = /([\d]+[,.][\d]+|[\d]+)\s*(€|\$|лв)/g;
  const prices: number[] = [];
  let match;
  while ((match = priceRegex.exec(line)) !== null) {
    prices.push(parseFloat(match[1].replace(',', '.')));
  }

  let basePrice: number | undefined;
  let boxFee: number | undefined;

  if (line.includes('Гарнитур')) {
    // For sides, usually: [Section Base Price, Container Fee]
    basePrice = prices[0];
    boxFee = prices[1];
  } else if (line.includes('+') || line.includes('кутийк')) {
    // For BBQ or others: [Container Fee]
    boxFee = prices[0];
  }

  return { basePrice, boxFee };
}

function detectCategoryKey(line: string, config: MenuConfig): string | null {
  const lineLower = line.toLowerCase();
  // Strip parentheses and common header symbols
  const mainPart = lineLower.replace(/\(.*\)/, '').replace(/[:\d.+€$]/g, '').trim();
  if (!mainPart) return null;

  for (const [key, keywords] of Object.entries(config.categoryKeywords)) {
    // Check if any keyword matches the start of the cleaned line
    if (keywords.some(k => {
      const kw = k.toLowerCase();
      return mainPart.startsWith(kw) || mainPart.includes(kw);
    })) {
      return key;
    }
  }
  return null;
}

function extractPrice(line: string): number | null {
  PRICE_RE.lastIndex = 0;
  const match = PRICE_RE.exec(line);
  if (!match) return null;
  return parseFloat(match[1].replace(',', '.'));
}

function extractBaseItem(line: string, categoryName: string, id: number, priceOverride?: number): MenuItem | null {
  const price = extractPrice(line) ?? priceOverride;
  if (price === undefined || price === null) return null;

  // Clean name: remove price markers and bullets
  let name = line.replace(PRICE_RE, '').replace(/^[-•*]\s*/, '').trim();
  name = name.replace(/[,.\s]+$/, '').trim();

  if (name.length < 2) return null;

  return {
    id,
    name,
    description: '',
    basePrice: price,
    price: price,
    available: true,
    category: categoryName,
    tags: [],
    extraFees: [],
  };
}

/**
 * Stage 4: Enrichment (Rules Engine + Auto-Select)
 */
function enrichItems(items: MenuItem[], config: MenuConfig, sectionConfigs: Record<string, any>): MenuItem[] {
  // 1. Identify all side dishes
  const sideDishes = items.filter(i => i.category === config.categoryLabels.sides);
  const firstSide = sideDishes[0]?.name;

  return items.map(item => {
    const sKey = Object.keys(config.categoryLabels).find(k => config.categoryLabels[k] === item.category);
    const sCfg = sKey ? sectionConfigs[sKey] : undefined;

    // Apply General Rules
    config.rules.forEach(rule => {
      if (rule.match(item)) {
        rule.apply(item, config, sCfg);
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
  const lines = text.split('\n');
  const tempItems: MenuItem[] = [];
  let currentId = Date.now();
  
  let currentCategoryKey = 'other';
  const sectionConfigs: Record<string, any> = {};
  let detectedDate: string | undefined;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 2) continue;

    // 1. Date detection
    if (!detectedDate) {
      const dateMatch = line.match(DATE_RE);
      if (dateMatch) {
        detectedDate = dateMatch[1];
        if (line.replace(DATE_RE, '').replace(/\s/g, '').length === 0) continue;
      }
    }

    // 2. Category Detection
    const categoryKey = detectCategoryKey(line, MENU_CONFIG);
    if (categoryKey) {
      currentCategoryKey = categoryKey;
      sectionConfigs[categoryKey] = extractHeaderConfig(line);
      continue;
    }

    // 3. Item Extraction
    const priceOverride = currentCategoryKey === 'sides' ? sectionConfigs['sides']?.basePrice : undefined;
    const item = extractBaseItem(line, MENU_CONFIG.categoryLabels[currentCategoryKey] || 'Other', currentId++, priceOverride);
    if (item) tempItems.push(item);
  }

  // 4. Rules & Enrichment
  const enrichedItems = enrichItems(tempItems, MENU_CONFIG, sectionConfigs);

  return { detectedDate, items: enrichedItems };
}
