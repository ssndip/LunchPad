import { MenuItem } from '../types';
import { ParserConfig, SectionDetectionRule, PreprocessingRule, IgnoredLineRule } from '../types/parserConfig';

export interface ParseResult {
  date: string | null;
  items: MenuItem[];
  unmatchedLines: string[];
  warnings: string[];
}

/**
 * Safely parses a number from a string, supporting comma decimals.
 */
function safeFloat(value: any, fallback: number = 0): number {
  if (value === null || value === undefined) return fallback;
  const str = String(value).replace(',', '.').trim();
  const num = parseFloat(str);
  return isNaN(num) ? fallback : num;
}

/**
 * Robust Menu Parser Engine
 */
export class MenuParserEngine {
  private config: ParserConfig;

  // Cached compiled regular expressions
  private dateRegex: RegExp;
  private itemPrefixRegex: RegExp;
  private weightRegex: RegExp;
  private boxFeeRegex: RegExp;
  private boxKeywordRegex: RegExp;
  private priceRegex: RegExp;
  private bgnNoiseRegex: RegExp | null;

  // Caches for array/rule based regexes
  private preprocessRegexCache: Map<string, RegExp>;
  private ignoreRegexCache: RegExp[];
  private startsWithWeightRegex: RegExp;
  private sectionRegexCache: Map<string, RegExp>;

  constructor(config: ParserConfig) {
    this.config = config;

    // Precompile entity extraction regexes
    this.dateRegex = new RegExp(this.config.entityExtraction.datePattern, 'i');
    this.itemPrefixRegex = new RegExp(this.config.entityExtraction.itemPrefixPattern);
    this.weightRegex = new RegExp(this.config.entityExtraction.weightPattern, 'i');
    this.boxFeeRegex = new RegExp(this.config.entityExtraction.boxFeePattern, 'i');
    this.boxKeywordRegex = new RegExp(this.config.entityExtraction.boxKeywordPattern, 'i');
    this.priceRegex = new RegExp(this.config.entityExtraction.pricePattern, 'i');
    this.bgnNoiseRegex = this.config.entityExtraction.bgnNoisePattern
      ? new RegExp(this.config.entityExtraction.bgnNoisePattern, 'gi')
      : null;

    // Precompile preprocessing regexes
    this.preprocessRegexCache = new Map();
    for (const rule of this.config.preprocessing) {
      if ((rule.type === 'replace' || rule.type === 'remove') && rule.pattern) {
        this.preprocessRegexCache.set(rule.id, new RegExp(rule.pattern, 'gi'));
      }
    }

    // Precompile ignore rules regexes
    this.ignoreRegexCache = this.config.ignoreRules.map(rule => new RegExp(rule.pattern, 'i'));

    // Precompile section detection regexes
    this.sectionRegexCache = new Map();
    for (const rule of this.config.sectionDetection) {
      this.sectionRegexCache.set(rule.id, new RegExp(`^(${rule.pattern})$`, 'i'));
    }

    // Cached for performance to avoid recompiling on every line
    this.startsWithWeightRegex = new RegExp('^' + this.config.entityExtraction.weightPattern, 'i');
  }

  /**
   * Main entry point for parsing menu text.
   */
  public parse(rawText: string): ParseResult {
    let text = rawText;

    // 1. Normalization & Preprocessing
    text = this.preprocess(text);

    const lines = text.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !this.isIgnored(line));

    const result: ParseResult = {
      date: null,
      items: [],
      unmatchedLines: [],
      warnings: []
    };

    let currentCategory: SectionDetectionRule | null = null;
    let categoryDefaults = {
      price: null as number | null,
      weight: null as string | null,
      boxFee: 0
    };

    for (const line of lines) {
      // 2. Extract Globally Available Metadata (e.g. Date)
      if (!result.date) {
        const dateMatch = line.match(this.dateRegex);
        if (dateMatch) {
          result.date = dateMatch[1];
          continue;
        }
      }

      // 3. Section/Category Detection
      const detectedCategory = this.detectCategory(line);
      if (detectedCategory) {
        currentCategory = detectedCategory;
        // Reset defaults
        categoryDefaults = {
          price: detectedCategory.defaultPrice || null,
          weight: detectedCategory.defaultWeight || null,
          boxFee: detectedCategory.applyBoxFeeByDefault ? 0.3 : 0
        };
        
        // Some sections might have context in the header line itself
        this.updateDefaultsFromLine(line, categoryDefaults);
        continue;
      }

      // 4. Item Extraction
      // Use price/weight as fallback signals only when meaningful text
      // (an actual item name) remains after stripping those values.
      const startsWithWeight = this.startsWithWeightRegex.test(line);
      const startsWithPriceOrFee = /^\d+(?:[.,]\d+)?\s*(?:€|\$|лв|лева|е|е\.|евро|кутийка)/i.test(line);
      const hasBulletPrefix = !startsWithWeight && !startsWithPriceOrFee && this.itemPrefixRegex.test(line);
      const hasSignal = this.priceRegex.test(line) || this.weightRegex.test(line);
      let isItemLine = hasBulletPrefix;
      if (!isItemLine && hasSignal) {
        // Strip weight, price and prefix then check if a name is left
        const residual = line
          .replace((startsWithWeight || startsWithPriceOrFee) ? '' : this.itemPrefixRegex, '')
          .replace(this.weightRegex, '')
          .replace(this.boxFeeRegex, '')
          .replace(this.priceRegex, '')
          .replace(/[(),.:+\-–—\/]/g, '')
          .trim();
        // Only treat as item if there are at least 2 meaningful characters left
        // and it contains actual letters (Latin or Cyrillic)
        isItemLine = residual.length >= 2 && /[a-zA-Z\u0400-\u04FF]/.test(residual);
      }
      if (isItemLine) {
        const item = this.extractItem(line, currentCategory?.categoryName || this.config.fallbackCategory, categoryDefaults, currentCategory);
        if (item) {
          this.enrichItem(item);
          result.items.push(item);
        } else {
          result.unmatchedLines.push(line);
        }
        continue;
      }

      // 5. Check if it's a context update line (e.g. "100гр 1.50€")
      if (this.updateDefaultsFromLine(line, categoryDefaults)) {
        continue;
      }

      // 6. If we are inside an established category and the line is plain text (no signals),
      //    treat it as an item that inherits the category default price.
      if (currentCategory) {
        const item = this.extractItem(line, currentCategory.categoryName, categoryDefaults, currentCategory);
        if (item) {
          this.enrichItem(item);
          result.items.push(item);
          continue;
        }
      }

      result.unmatchedLines.push(line);
    }

    return result;
  }

  private preprocess(text: string): string {
    let t = text;
    for (const rule of this.config.preprocessing) {
      switch (rule.type) {
        case 'normalize_whitespace':
          t = t.replace(/[ \t]+/g, ' ');
          break;
        case 'trim':
          t = t.split('\n').map(l => l.trim()).join('\n');
          break;
        case 'replace':
          if (rule.pattern) {
            const regex = this.preprocessRegexCache.get(rule.id);
            if (regex) t = t.replace(regex, rule.replace || '');
          }
          break;
        case 'remove':
          if (rule.pattern) {
            const regex = this.preprocessRegexCache.get(rule.id);
            if (regex) t = t.replace(regex, '');
          }
          break;
      }
    }
    return t;
  }

  private isIgnored(line: string): boolean {
    return this.ignoreRegexCache.some(regex => regex.test(line));
  }

  private detectCategory(line: string): SectionDetectionRule | null {
    // Strip weight, price, box-fee and punctuation before testing so
    // header lines like "Салати 0.100гр 1.50€" still match the category pattern.
    let cleanLine = line
      .replace(this.boxFeeRegex, '')
      .replace(this.weightRegex, '')
      .replace(this.priceRegex, '')
      .replace(/[+():,]/g, '')
      .trim();
    for (const rule of this.config.sectionDetection) {
      const regex = this.sectionRegexCache.get(rule.id);
      if (regex && regex.test(cleanLine)) {
        return rule;
      }
    }
    return null;
  }

  private extractItem(line: string, category: string, defaults: any, sectionRule: SectionDetectionRule | null): MenuItem | null {
    let name = line.replace(this.itemPrefixRegex, '').trim();
    let price: number | null = null;
    let weight: string | null = null;
    let boxFee: number = defaults.boxFee;

    // 1. Extract Weight
    const weightMatch = name.match(this.weightRegex);
    if (weightMatch) {
      weight = weightMatch[1];
      name = name.replace(weightMatch[0], '').trim();
    }

    // 2. Extract Box Fee Specific (e.g. "+ 0.10€ кутийка")
    const boxFeeMatch = name.match(this.boxFeeRegex);
    if (boxFeeMatch) {
      boxFee = safeFloat(boxFeeMatch[1] || boxFeeMatch[2]);
      name = name.replace(boxFeeMatch[0], '').trim();
    } else if (this.boxKeywordRegex.test(name)) {
      name = name.replace(this.boxKeywordRegex, '').trim();
      // If we found the box keyword but no specific fee, we use the category default (already in boxFee)
    }

    // 3. Extract Price
    // Strip trailing punctuation/noise (like +) before matching the price pattern
    name = name.replace(/[+:\s\-–—]+$/, '').trim();
    const priceMatch = name.match(this.priceRegex);
    if (priceMatch) {
      price = safeFloat(priceMatch[1]);
      name = name.replace(priceMatch[0], '').trim();
    }

    // Fallback to defaults
    const finalPrice = price !== null ? price : (defaults.price || 0);

    // 4. Noise removal (BGN info)
    if (this.bgnNoiseRegex) {
      name = name.replace(this.bgnNoiseRegex, '');
    }

    // 5. Final Name Cleanup
    name = name
      .replace(/\(\s*\)/g, '')
      .replace(/[()+\-.:, /]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!name) return null;

    return {
      id: Math.floor(Math.random() * 1000000),
      name: name,
      price: finalPrice,
      basePrice: finalPrice,
      category: category,
      available: true,
      hasIncludedSide: false,
      sideChoices: [],
      extraFees: [],
      tags: [],
      packagingFee: boxFee,
      _debug: {
        matchedLine: line.trim(),
        ruleId: sectionRule?.id,
        ruleType: 'section'
      }
    };
  }

  private enrichItem(item: MenuItem) {
    for (const rule of this.config.enrichmentRules) {
      let match = true;
      if (rule.condition.category && rule.condition.category.length > 0) {
        if (!rule.condition.category.includes(item.category || '')) {
          match = false;
        }
      }
      if (rule.condition.nameContains) {
        if (!item.name.toLowerCase().includes(rule.condition.nameContains.toLowerCase())) {
          match = false;
        }
      }

      if (match) {
        if (rule.action.addTag) item.tags.push(rule.action.addTag);
        if (rule.action.setBoxFee !== undefined) item.packagingFee = rule.action.setBoxFee;
        if (rule.action.hasIncludedSide !== undefined) item.hasIncludedSide = rule.action.hasIncludedSide;
        
        // Track enrichment rule match
        if (item._debug) {
          item._debug.ruleId = rule.id;
          item._debug.ruleType = 'enrichment';
        }
      }
    }
  }

  private updateDefaultsFromLine(line: string, defaults: any): boolean {
    let updated = false;

    // Weight
    const weightMatch = line.match(this.weightRegex);
    if (weightMatch) {
      defaults.weight = weightMatch[1];
      updated = true;
    }

    // Box Fee (check before price to avoid confusion if both match)
    const boxMatch = line.match(this.boxFeeRegex);
    if (boxMatch) {
      defaults.boxFee = safeFloat(boxMatch[1] || boxMatch[2]);
      updated = true;
    }

    // Price (strip box fee pattern first to avoid double matching)
    let lineWithoutBox = line.replace(this.boxFeeRegex, '').trim();
    // Also, strip trailing punctuation/noise (like +) before matching the price pattern.
    lineWithoutBox = lineWithoutBox.replace(/[+:\s\-–—]+$/, '').trim();
    const priceMatch = lineWithoutBox.match(this.priceRegex);
    if (priceMatch) {
      defaults.price = safeFloat(priceMatch[1]);
      updated = true;
    }

    return updated;
  }
}
