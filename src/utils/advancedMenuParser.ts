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
  DATE: /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/,
  DATE_RANGE: /(\d{1,2})\s*[-–—]\s*(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})/, // Matches 03 - 07.11.2025
  WEIGHT: /((?:\d+[.,])?\d+\s*(?:гр|g|gr|мл|ml))/i,
  PRICE: /(?:[-–—\s]+)?([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$|е|е\.|евро)?\s*[:.]?\s*$/i,
  BOX_FEE: /(?:кутийка\s*[:\-–—\s]*([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$|лв|е|е\.)?|([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$|лв|е|е\.)?\s*кутийка)/i,
  BGN_NOISE: /(?:\/|\|)?\s*[\d]+[,.][\d]+\s*(?:лв|лева|лв\.)/gi,
  BOX_KEYWORD: /кутийка/i,
  ITEM_PREFIX: /^(?:[-•*]|(?:[0-9]\uFE0F?\u20E3)+(?:\.\s*(?:[0-9]\uFE0F?\u20E3)+)*\s*|\d+(?:\.\d+)*[.)]?\s*)/,
  PRICE_EXPLICIT: /([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$|е|е\.|евро)/i
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
  if (dayIndex === -1) return refDate.toISOString().split('T')[0];

  const result = new Date(refDate);
  // Find the first Monday on or before the reference date
  const currentDay = refDate.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  result.setDate(refDate.getDate() + diffToMonday + dayIndex);
  
  return result.toISOString().split('T')[0];
}

export function parseMenuText(rawText: string): ParsedMenu {
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  const parsedOutput: ParsedMenu = { date: null, categories: [], unmatchedLines: [] };
  
  let menuStartDate: Date = new Date();
  menuStartDate.setHours(0, 0, 0, 0);

  let currentDateContext: string | null = null;
  let currentCategory: ParsedCategory | null = null;
  
  let currentCategoryDefaultPrice: number | null = null;
  let currentCategoryDefaultWeight: string | null = null;
  let currentCategoryDefaultBoxFee: number = 0;

  for (const line of lines) {
    // 1. Check for Date Range (e.g. 03 - 07.11.2025)
    const rangeMatch = line.match(RegexConfig.DATE_RANGE);
    if (rangeMatch) {
      const day = parseInt(rangeMatch[1]);
      const month = parseInt(rangeMatch[3]) - 1;
      const year = rangeMatch[4].length === 2 ? 2000 + parseInt(rangeMatch[4]) : parseInt(rangeMatch[4]);
      menuStartDate = new Date(year, month, day);
      if (!parsedOutput.date) parsedOutput.date = `${rangeMatch[1]}.${rangeMatch[3]}.${rangeMatch[4]}`;
      continue;
    }

    // 2. Check for Single Date
    const dateMatch = line.match(RegexConfig.DATE);
    if (dateMatch) {
      if (!parsedOutput.date) parsedOutput.date = dateMatch[1];
      const parts = dateMatch[1].split(/[.\-/]/);
      if (parts.length >= 2) {
        const d = parseInt(parts[0]);
        const m = parseInt(parts[1]) - 1;
        const y = parts.length === 3 ? (parts[2].length === 2 ? 2000 + parseInt(parts[2]) : parseInt(parts[2])) : new Date().getFullYear();
        menuStartDate = new Date(y, m, d);
      }
      continue;
    }

    // 3. Check for Day Name
    const upperLine = line.toUpperCase();
    const isDayHeader = BULGARIAN_DAYS.some(d => upperLine.includes(d)) || ENGLISH_DAYS.some(d => upperLine.includes(d));
    if (isDayHeader) {
      const dayName = BULGARIAN_DAYS.find(d => upperLine.includes(d)) || ENGLISH_DAYS.find(d => upperLine.includes(d));
      if (dayName) {
        currentDateContext = getDateForDay(dayName, menuStartDate);
        continue;
      }
    }

    // 4. Check for Item
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
      if (weightMatch) {
        itemWeight = weightMatch[1];
        itemName = itemName.replace(weightMatch[0], '').trim();
      }

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
      if (priceMatch) {
        itemPrice = safeFloat(priceMatch[1]);
        itemName = itemName.replace(priceMatch[0], '').trim();
      }

      const finalName = cleanItemName(itemName);
      const finalPrice = itemPrice !== null ? itemPrice : (currentCategoryDefaultPrice || 0);
      const finalWeight = itemWeight !== null ? itemWeight : currentCategoryDefaultWeight;
      const finalBoxFee = itemBoxFee > 0 ? itemBoxFee : currentCategoryDefaultBoxFee;

      currentCategory.items.push({
        name: finalName,
        price: finalPrice,
        weight: finalWeight,
        boxFee: finalBoxFee,
        date: currentDateContext
      });
      continue;
    }

    // 5. Category headers
    const isContext = /^\d+/.test(line) || (!/[a-zA-Zа-яА-Я]/.test(line.replace(RegexConfig.WEIGHT, '').replace(RegexConfig.PRICE, '').replace(RegexConfig.BOX_FEE, '').trim()));

    if (!isContext) {
      const nameCand = line.replace(RegexConfig.BOX_FEE, '').replace(RegexConfig.WEIGHT, '').replace(RegexConfig.PRICE, '').replace(/[+():]/g, '').trim();
      if (nameCand.length > 2) {
        currentCategory = { categoryName: nameCand, items: [] };
        parsedOutput.categories.push(currentCategory);
        currentCategoryDefaultPrice = null;
        currentCategoryDefaultWeight = null;
        currentCategoryDefaultBoxFee = 0;
      }
    }

    if (currentCategory) {
      const lw = line.match(RegexConfig.WEIGHT);
      if (lw) currentCategoryDefaultWeight = lw[1];
      const lb = line.match(RegexConfig.BOX_FEE);
      if (lb) currentCategoryDefaultBoxFee = safeFloat(lb[1] || lb[2], 0) || 0;
      const lp = line.replace(RegexConfig.BOX_FEE, '').match(RegexConfig.PRICE_EXPLICIT) || line.replace(RegexConfig.BOX_FEE, '').match(RegexConfig.PRICE);
      if (lp) currentCategoryDefaultPrice = safeFloat(lp[1]);
    }

    const hasKnown = RegexConfig.PRICE.test(line) || RegexConfig.WEIGHT.test(line) || RegexConfig.BOX_FEE.test(line) || RegexConfig.DATE.test(line);
    if (!isContext && !hasKnown && !currentCategory) {
      parsedOutput.unmatchedLines.push(line);
    }
  }

  return parsedOutput;
}
