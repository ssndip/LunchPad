export interface ParsedItem {
  name: string;
  price: number;
  weight: string | null;
  boxFee: number;
  date: string | null; // Individual item date
}

export interface ParsedCategory {
  categoryName: string;
  items: ParsedItem[];
}

export interface ParsedMenu {
  date: string | null;
  categories: ParsedCategory[];
  unmatchedLines: string[];
}

// --- Regex Matchers & Configuration ---

const BULGARIAN_DAYS = ['ПОНЕДЕЛНИК', 'ВТОРНИК', 'СРЯДА', 'ЧЕТВЪРТЪК', 'ПЕТЪК', 'СЪБОТА', 'НЕДЕЛЯ'];
const ENGLISH_DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];

const RegexConfig = {
  DATE: /(?<=^|[^a-zA-Z0-9_а-яА-ЯёЁ])(?:(?:меню|дата|от|за)\s+)?(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})\b|(?<=^|[^a-zA-Z0-9_а-яА-ЯёЁ])(?:меню|дата|от|за)\s+(\d{1,2}[.\-/]\d{1,2})\b/i,
  DATE_RANGE: /(\d{1,2})\s*[-–—]\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/, // Matches 03 - 07.11.2025
  WEIGHT: /((?:\d+[.,])?\d+\s*(?:гр|g|gr|мл|ml))/i,
  // PRICE: matches number+currency OR dash+number at end-of-string.
  // Group 1 = number with currency. Group 2 = dash-price (no currency, must be at end).
  PRICE: /([\d]+[,.][\d]+|[\d]+)[\s\t]*(?:€|\$|е\.|евро|лв\.|лв(?!\.?\d)|лева)|([-–—][\s\t]*([\d]+[,.][\d]+|[\d]+))[\s\t]*$/i,
  BOX_FEE: /(?:кутийка[\s\t]*[:\-–—\s\t]*([\d]+[,.][\d]+|[\d]+)[\s\t]*(?:€|\$|лв|е|е\.)?|([\d]+[,.][\d]+|[\d]+)[\s\t]*(?:€|\$|лв|е|е\.)?[\s\t]*кутийка)/i,
  BGN_NOISE: /(?:\/|\|)?\s*[\d]+[,.][\d]+\s*(?:лв|лева|лв\.)/gi,
  BOX_KEYWORD: /кутийка/i,
  ITEM_PREFIX: /^\s*(?:[-•*+>~.#]|(?:[0-9]️?⃣)+(?:\.\s*(?:[0-9]️?⃣)+)*\s*|\d+(?:\.\d+)*[.)]\s*|(?=\d)(?!\d+[,.]?\d*\s*(?:гр|g|gr|мл|ml))\d+\.?\s+)/,
  PRICE_EXPLICIT: /([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$|е\.|евро|лв\.|лв(?!\.?\d)|лева)/i
};

const CategoryMapping: Record<string, string> = {
  'суп': 'Супи',
  'чорб': 'Супи',
  'салат': 'Салати',
  'гарнитур': 'Гарнитури',
  'основн': 'Основни ястия',
  'десерт': 'Десерти',
  'хляб': 'Хляб',
  'скара': 'Скара',
  'друг': 'Други',
  'soup': 'Soups',
  'salad': 'Salads',
  'side': 'Side Dishes',
  'main': 'Main Dishes',
  'dessert': 'Desserts',
  'bread': 'Bread',
  'bbq': 'BBQ',
  'other': 'Other'
};

function safeFloat(value: any, fallback: number | null = null): number | null {
  if (value === null || value === undefined) return fallback;
  const str = String(value).replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

function cleanItemName(name: string): string {
  return name
    .replace(RegexConfig.BGN_NOISE, '')
    .replace(/\(\s*\)/g, '')
    .replace(/[()+\-.:, /]+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Calculates a specific date for a given day name relative to a reference date.
 */
function getDateForDay(dayName: string, refDate: Date): string {
  const cleanDay = dayName.toUpperCase();
  let dayIndex = BULGARIAN_DAYS.indexOf(cleanDay);
  if (dayIndex === -1) dayIndex = ENGLISH_DAYS.indexOf(cleanDay);
  if (dayIndex === -1) {
    try {
      return refDate.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  let baseDate = new Date(refDate);
  if (isNaN(baseDate.getTime())) {
    baseDate = new Date();
    baseDate.setHours(0, 0, 0, 0);
  }

  const result = new Date(baseDate);
  // Find the first Monday on or before the reference date
  const currentDay = baseDate.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  result.setDate(baseDate.getDate() + diffToMonday + dayIndex);
  
  try {
    return result.toISOString().split('T')[0];
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

export function parseMenuText(rawText: string, customCategories: { keywords: string[] }[] = []): ParsedMenu {
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const parsedOutput: ParsedMenu = { date: null, categories: [], unmatchedLines: [] };
  
  let menuStartDate: Date = new Date();
  menuStartDate.setHours(0, 0, 0, 0);

  let currentDateContext: string | null = null;
  let currentCategory: ParsedCategory | null = null;
  
  let currentCategoryDefaultPrice: number | null = null;
  let currentCategoryDefaultWeight: string | null = null;
  let currentCategoryDefaultBoxFee: number = 0;

  // Build dynamic categories from customCategories, fallback to legacy if empty
  const dynamicCategoryKeywords = customCategories.length > 0 
    ? customCategories.flatMap(c => c.keywords).map(k => k.toLowerCase())
    : ['супи', 'основни', 'гарнитури', 'скара', 'десерти', 'други', 'салати', 'хляб'];

  // Helper: extract weight/price/boxFee defaults from any line
  function extractDefaults(line: string) {
    const lw = line.match(RegexConfig.WEIGHT);
    if (lw) currentCategoryDefaultWeight = lw[1];
    const lb = line.match(RegexConfig.BOX_FEE);
    if (lb) currentCategoryDefaultBoxFee = safeFloat(lb[1] || lb[2], 0) || 0;
    const lineNoBox = line.replace(RegexConfig.BOX_FEE, '');
    const lp = lineNoBox.match(RegexConfig.PRICE_EXPLICIT) || lineNoBox.match(RegexConfig.PRICE);
    if (lp) currentCategoryDefaultPrice = safeFloat(lp[1] || lp[3]);
  }

  function hasCategoryText(line: string, dynamicCategoryKeywords: string[]): boolean {
    const trimmed = line.trim();
    if (trimmed.length < 2) return false;

    // Standard core keywords in Bulgarian and English
    const CORE_KEYWORDS = Array.from(new Set([
      'скара', 'салат', 'суп', 'гарнитур', 'основн', 'десерт', 'хляб', 'друг', 'чорб',
      'soup', 'salad', 'side', 'main', 'dessert', 'bread', 'bbq', 'other',
      ...dynamicCategoryKeywords.map(k => k.toLowerCase())
    ]));
    
    const lower = line.toLowerCase();
    const matchesCore = CORE_KEYWORDS.some(cat => lower.includes(cat));
    
    if (matchesCore) {
      const cleanLine = trimmed.replace(RegexConfig.ITEM_PREFIX, '').toLowerCase().trim();
      const startsWithCore = CORE_KEYWORDS.some(cat => cleanLine.startsWith(cat));
      
      const hasPrice = RegexConfig.PRICE.test(trimmed);
      const hasColon = trimmed.includes(':');
      
      // If it has a price and NO colon, it's an item (e.g. "Зелева салата 1.50€"), not a category
      if (hasPrice && !hasColon) {
        return false;
      }
      
      if (startsWithCore) return true;
      return false;
    }

    // 2. Fallback to colon-based detection
    const hasColon = trimmed.includes(':');
    if (hasColon) {
      const stripped = trimmed
        .replace(RegexConfig.PRICE, '')
        .replace(RegexConfig.WEIGHT, '')
        .replace(/[+():,\-–—.:\/\s\t\d€$]/g, '')
        .trim();
      return stripped.length >= 2;
    }

    return false;
  }

  for (const line of lines) {
    // ── STEP 1: Date Range (e.g. "03 - 07.11.2025") ─────────────────────────
    const rangeMatch = line.match(RegexConfig.DATE_RANGE);
    if (rangeMatch) {
      const day = parseInt(rangeMatch[1]);
      const month = parseInt(rangeMatch[3]) - 1;
      const year = rangeMatch[4].length === 2 ? 2000 + parseInt(rangeMatch[4]) : parseInt(rangeMatch[4]);
      menuStartDate = new Date(year, month, day);
      if (!parsedOutput.date) parsedOutput.date = `${rangeMatch[1]}.${rangeMatch[3]}.${rangeMatch[4]}`;
      continue;
    }

    // ── STEP 2: Single Date ──────────────────────────────────────────────────
    const dateMatch = line.match(RegexConfig.DATE);
    if (dateMatch) {
      const rawDate = dateMatch[1] || dateMatch[2];
      if (!parsedOutput.date) parsedOutput.date = rawDate;
      const parts = rawDate.split(/[.\-/]/);
      if (parts.length >= 2) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const y = parts.length === 3 ? (parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2])) : new Date().getFullYear();
        menuStartDate = new Date(y, m, d);
      }
      continue;
    }

    // ── STEP 3: Day Name ────────────────────────────────────────────────────
    const upperLine = line.toUpperCase();
    const isDayHeader = BULGARIAN_DAYS.some(d => upperLine.includes(d)) || ENGLISH_DAYS.some(d => upperLine.includes(d));
    if (isDayHeader) {
      const dayName = BULGARIAN_DAYS.find(d => upperLine.includes(d)) || ENGLISH_DAYS.find(d => upperLine.includes(d));
      if (dayName) {
        currentDateContext = getDateForDay(dayName, menuStartDate);
        continue;
      }
    }

    // ── STEP 4: Bulleted / Prefixed Item (highest-priority item signal) ──────
    // Lines starting with -, *, •, or a number are always items.
    if (RegexConfig.ITEM_PREFIX.test(line)) {
      if (!currentCategory) {
        currentCategory = { categoryName: 'Други', items: [] };
        parsedOutput.categories.push(currentCategory);
      }
      const itemLine = line.replace(RegexConfig.ITEM_PREFIX, '').trim();
      let itemName = itemLine;
      let itemPrice: number | null = null;
      let itemWeight: string | null = null;
      let itemBoxFee: number = 0;

      const weightMatch = itemLine.match(RegexConfig.WEIGHT);
      if (weightMatch) { itemWeight = weightMatch[1]; itemName = itemName.replace(weightMatch[0], '').trim(); }

      const boxFeeMatch = itemLine.match(RegexConfig.BOX_FEE);
      if (boxFeeMatch) {
        itemBoxFee = safeFloat(boxFeeMatch[1] || boxFeeMatch[2], 0) || 0;
        itemName = itemName.replace(boxFeeMatch[0], '').trim();
      } else if (RegexConfig.BOX_KEYWORD.test(itemLine)) {
        itemBoxFee = currentCategoryDefaultBoxFee;
        itemName = itemName.replace(RegexConfig.BOX_KEYWORD, '').trim();
      }

      itemName = itemName.replace(RegexConfig.BGN_NOISE, '').trim();

      const priceMatch = itemName.match(RegexConfig.PRICE);
      if (priceMatch) { itemPrice = safeFloat(priceMatch[1] || priceMatch[3]); itemName = itemName.replace(priceMatch[0], '').trim(); }

      const finalName = cleanItemName(itemName);
      if (finalName) {
        currentCategory.items.push({
          name: finalName,
          price: itemPrice !== null ? itemPrice : (currentCategoryDefaultPrice || 0),
          weight: itemWeight,
          boxFee: itemBoxFee > 0 ? itemBoxFee : currentCategoryDefaultBoxFee,
          date: currentDateContext
        });
      }
      continue;
    }

    if (hasCategoryText(line, dynamicCategoryKeywords)) {
      // Clean the category name to be just the core keyword if found
      let cleanedName = line.trim();
      const lower = cleanedName.toLowerCase();
      const CORE_KEYWORDS = [
        'скара', 'салат', 'суп', 'гарнитур', 'основн', 'десерт', 'хляб', 'друг', 'чорб',
        'soup', 'salad', 'side', 'main', 'dessert', 'bread', 'bbq', 'other'
      ];
      const foundKeyword = CORE_KEYWORDS.find(k => lower.includes(k));
      if (foundKeyword) {
        // Map to standard category name
        cleanedName = CategoryMapping[foundKeyword];
      } else {
        // If no core keyword, just strip typical noise
        cleanedName = cleanedName
          .replace(RegexConfig.PRICE, '')
          .replace(RegexConfig.WEIGHT, '')
          .replace(RegexConfig.BOX_FEE, '')
          .replace(/[+():,\-–—.:\/\s\t\d€$]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (cleanedName) {
          cleanedName = cleanedName.charAt(0).toUpperCase() + cleanedName.slice(1);
        } else {
          cleanedName = "Other";
        }
      }
      
      currentCategory = { categoryName: cleanedName, items: [] };
      parsedOutput.categories.push(currentCategory);
      
      currentCategoryDefaultPrice = null;
      currentCategoryDefaultWeight = null;
      currentCategoryDefaultBoxFee = 0;
      extractDefaults(line);
      continue;
    }

    // ── STEP 6 + 7: Smart item-or-context detection inside a category ────────
    // If inside a category, decide: is this a named item or a pure context/defaults setter?
    // Named item: meaningful text remains after stripping all data fields (e.g. "Зелева салата 1.50€")
    // Context:    no text remains after stripping data (e.g. "200гр 1.50€ + 0.10€ кутийка")
    const hasData = RegexConfig.PRICE.test(line) || RegexConfig.WEIGHT.test(line) || RegexConfig.BOX_FEE.test(line);

    if (currentCategory) {
      // Extract candidate item name by stripping all numeric/currency content
      let candidateName = line
        .replace(RegexConfig.BOX_FEE, '')
        .replace(RegexConfig.WEIGHT, '')
        .replace(RegexConfig.PRICE, '')
        .replace(/\([^)]*\)/g, '')
        .replace(/[+\-–—():,.\/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      candidateName = cleanItemName(candidateName);

      if (candidateName.length > 1 && /[а-яА-Яa-zA-Z]/.test(candidateName)) {
        // Named item: use this line's price/weight if present, otherwise use category defaults
        let itemPrice: number | null = null;
        let itemWeight: string | null = null;
        let itemBoxFee: number = currentCategoryDefaultBoxFee;

        const wm = line.match(RegexConfig.WEIGHT);
        if (wm) itemWeight = wm[1];
        const bm = line.match(RegexConfig.BOX_FEE);
        if (bm) itemBoxFee = safeFloat(bm[1] || bm[2], 0) || 0;
        const lineNoBox = line.replace(RegexConfig.BOX_FEE, '');
        const pm = lineNoBox.match(RegexConfig.PRICE_EXPLICIT) || lineNoBox.match(RegexConfig.PRICE);
        if (pm) itemPrice = safeFloat(pm[1] || pm[3]);

        currentCategory.items.push({
          name: candidateName,
          price: itemPrice !== null ? itemPrice : (currentCategoryDefaultPrice || 0),
          weight: itemWeight,
          boxFee: itemBoxFee,
          date: currentDateContext
        });
      } else if (hasData) {
        // Pure context/defaults line: update the category-level defaults
        extractDefaults(line);
      }
      continue;
    }

    // ── Unmatched ────────────────────────────────────────────────────────────
    if (!hasData) {
      parsedOutput.unmatchedLines.push(line);
    }
  }

  parsedOutput.categories = parsedOutput.categories.filter(c => c.items.length > 0);
  return parsedOutput;
}
