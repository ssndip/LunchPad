export interface ParsedItem {
  name: string;
  price: number;
  weight: string | null;
  boxFee: number;
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

const RegexConfig = {
  DATE: /(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})/,
  // Matches "200гр", "100 гр", "50g", etc.
  WEIGHT: /(\d+\s*(?:гр|g|gr|мл|ml))/i,
  // Matches Euro only as official price source
  PRICE: /([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$)/i,
  // Matches packaging box fee with currency
  BOX_FEE: /([\d]+[,.][\d]+|[\d]+)\s*(?:€|\$)?\s*кутийка/i,
  // Informative BGN strings to be stripped (noise)
  BGN_NOISE: /[\d]+[,.][\d]+\s*(?:лв|лева|лв\.)/gi,
  // Box keyword fallback
  BOX_KEYWORD: /кутийка/i,
  // Item line indicator
  ITEM_PREFIX: /^[-•*]\s*/
};

/**
 * Safely parses a number from a string, supporting comma decimals.
 * Returns null if parsing fails or result is NaN.
 */
function safeFloat(value: any, fallback: number | null = null): number | null {
  if (value === null || value === undefined) return fallback;
  const str = String(value).replace(',', '.');
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Strips noise and trailing punctuation/artifacts from item names.
 */
function cleanItemName(name: string): string {
  return name
    .replace(RegexConfig.BGN_NOISE, '') // Remove лв. info
    .replace(/\(\s*\)/g, '')            // Remove empty parentheses
    .replace(/[()+\-.:, /]+$/, '')       // Remove trailing punctuation/slashes
    .replace(/\(\s+/g, '(')             // Fix internal spacing
    .replace(/\s+\)/g, ')')
    .replace(/\s+/g, ' ')               // Normalize whitespace
    .trim();
}

/**
 * Parses raw text into a cleanly typed JSON object.
 */
export function parseMenuText(rawText: string): ParsedMenu {
  const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const parsedOutput: ParsedMenu = { date: null, categories: [], unmatchedLines: [] };
  let currentCategory: ParsedCategory | null = null;
  
  // Contextual State values
  let currentCategoryDefaultPrice: number | null = null;
  let currentCategoryDefaultWeight: string | null = null;
  let currentCategoryDefaultBoxFee: number = 0;

  for (const line of lines) {
    // 1. Check for Date
    const dateMatch = line.match(RegexConfig.DATE);
    if (!parsedOutput.date && dateMatch) {
      parsedOutput.date = dateMatch[1];
      continue;
    }

    // 2. Check for Item (lines starting with hyphen/bullet)
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

      // Extract specific item attributes
      const weightMatch = itemLine.match(RegexConfig.WEIGHT);
      if (weightMatch) {
        itemWeight = weightMatch[1];
        itemName = itemName.replace(weightMatch[0], '').trim();
      }

      const boxFeeMatch = itemLine.match(RegexConfig.BOX_FEE);
      if (boxFeeMatch) {
        itemBoxFee = safeFloat(boxFeeMatch[1], 0) || 0;
        itemName = itemName.replace(boxFeeMatch[0], '').trim();
      } else if (RegexConfig.BOX_KEYWORD.test(itemLine)) {
        itemBoxFee = currentCategoryDefaultBoxFee;
        itemName = itemName.replace(RegexConfig.BOX_KEYWORD, '').trim();
      }

      const priceMatch = itemName.match(RegexConfig.PRICE);
      if (priceMatch) {
        itemPrice = safeFloat(priceMatch[1]);
        itemName = itemName.replace(priceMatch[0], '').trim();
      }

      // Final cleanup of the item name
      const finalName = cleanItemName(itemName);
      const finalPrice = itemPrice !== null ? itemPrice : (currentCategoryDefaultPrice || 0);
      const finalWeight = itemWeight !== null ? itemWeight : currentCategoryDefaultWeight;
      const finalBoxFee = itemBoxFee > 0 ? itemBoxFee : currentCategoryDefaultBoxFee;

      currentCategory.items.push({
        name: finalName,
        price: finalPrice,
        weight: finalWeight,
        boxFee: finalBoxFee
      });
      
      continue;
    }

    // 3. Check for Category headers or Contextual definition lines.
    const isDedicatedContext = /^\d+/.test(line) || (!/[a-zA-Zа-яА-Я]/.test(line.replace(RegexConfig.WEIGHT, '').replace(RegexConfig.PRICE, '').replace(RegexConfig.BOX_FEE, '').trim()));

    if (!isDedicatedContext) {
      // It's likely a category header
      const nameCand = line.replace(RegexConfig.BOX_FEE, '')
                           .replace(RegexConfig.WEIGHT, '')
                           .replace(RegexConfig.PRICE, '')
                           .replace(/[+():]/g, '')
                           .trim();
      
      if (nameCand.length > 2) {
        currentCategory = { categoryName: nameCand, items: [] };
        parsedOutput.categories.push(currentCategory);
        
        // Reset defaults for the new category
        currentCategoryDefaultPrice = null;
        currentCategoryDefaultWeight = null;
        currentCategoryDefaultBoxFee = 0;
      }
    }

    // Always check for context updates if we have a current category
    if (currentCategory) {
      const lineWeightMatch = line.match(RegexConfig.WEIGHT);
      if (lineWeightMatch) currentCategoryDefaultWeight = lineWeightMatch[1];
      
      const lineBoxMatch = line.match(RegexConfig.BOX_FEE);
      if (lineBoxMatch) currentCategoryDefaultBoxFee = safeFloat(lineBoxMatch[1], 0) || 0;

      const linePriceMatch = line.replace(RegexConfig.BOX_FEE, '').match(RegexConfig.PRICE);
      if (linePriceMatch) currentCategoryDefaultPrice = safeFloat(linePriceMatch[1]);
    }

    // 4. If nothing matched and line has no known pattern → unmatched
    const hasKnownPattern = RegexConfig.PRICE.test(line) || RegexConfig.WEIGHT.test(line) || RegexConfig.BOX_FEE.test(line) || RegexConfig.DATE.test(line);
    if (!isDedicatedContext && !hasKnownPattern && !currentCategory) {
      // Context lines before any category are truly unmatched
      parsedOutput.unmatchedLines.push(line);
    }
  }

  return parsedOutput;
}
