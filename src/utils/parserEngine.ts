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

  constructor(config: ParserConfig) {
    this.config = config;
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
        const dateMatch = line.match(new RegExp(this.config.entityExtraction.datePattern, 'i'));
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
      const isItemLine = new RegExp(this.config.entityExtraction.itemPrefixPattern).test(line);
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
            t = t.replace(new RegExp(rule.pattern, 'gi'), rule.replace || '');
          }
          break;
        case 'remove':
          if (rule.pattern) {
            t = t.replace(new RegExp(rule.pattern, 'gi'), '');
          }
          break;
      }
    }
    return t;
  }

  private isIgnored(line: string): boolean {
    return this.config.ignoreRules.some(rule => new RegExp(rule.pattern, 'i').test(line));
  }

  private detectCategory(line: string): SectionDetectionRule | null {
    // Clean line of non-text for discovery
    const cleanLine = line.replace(/[+():]/g, '').trim();
    for (const rule of this.config.sectionDetection) {
      if (new RegExp(rule.pattern, 'i').test(cleanLine)) {
        return rule;
      }
    }
    return null;
  }

  private extractItem(line: string, category: string, defaults: any, sectionRule: SectionDetectionRule | null): MenuItem | null {
    let name = line.replace(new RegExp(this.config.entityExtraction.itemPrefixPattern), '').trim();
    let price: number | null = null;
    let weight: string | null = null;
    let boxFee: number = defaults.boxFee;

    // 1. Extract Weight
    const weightMatch = name.match(new RegExp(this.config.entityExtraction.weightPattern, 'i'));
    if (weightMatch) {
      weight = weightMatch[1];
      name = name.replace(weightMatch[0], '').trim();
    }

    // 2. Extract Box Fee Specific (e.g. "+ 0.10€ кутийка")
    const boxFeeMatch = name.match(new RegExp(this.config.entityExtraction.boxFeePattern, 'i'));
    if (boxFeeMatch) {
      boxFee = safeFloat(boxFeeMatch[1]);
      name = name.replace(boxFeeMatch[0], '').trim();
    } else if (new RegExp(this.config.entityExtraction.boxKeywordPattern, 'i').test(name)) {
      name = name.replace(new RegExp(this.config.entityExtraction.boxKeywordPattern, 'i'), '').trim();
      // If we found the box keyword but no specific fee, we use the category default (already in boxFee)
    }

    // 3. Extract Price
    const priceMatch = name.match(new RegExp(this.config.entityExtraction.pricePattern, 'i'));
    if (priceMatch) {
      price = safeFloat(priceMatch[1]);
      name = name.replace(priceMatch[0], '').trim();
    }

    // Fallback to defaults
    const finalPrice = price !== null ? price : (defaults.price || 0);

    // 4. Noise removal (BGN info)
    if (this.config.entityExtraction.bgnNoisePattern) {
      name = name.replace(new RegExp(this.config.entityExtraction.bgnNoisePattern, 'gi'), '');
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
    const weightMatch = line.match(new RegExp(this.config.entityExtraction.weightPattern, 'i'));
    if (weightMatch) {
      defaults.weight = weightMatch[1];
      updated = true;
    }

    // Box Fee (check before price to avoid confusion if both match)
    const boxMatch = line.match(new RegExp(this.config.entityExtraction.boxFeePattern, 'i'));
    if (boxMatch) {
      defaults.boxFee = safeFloat(boxMatch[1]);
      updated = true;
    }

    // Price (strip box fee pattern first to avoid double matching)
    const lineWithoutBox = line.replace(new RegExp(this.config.entityExtraction.boxFeePattern, 'i'), '');
    const priceMatch = lineWithoutBox.match(new RegExp(this.config.entityExtraction.pricePattern, 'i'));
    if (priceMatch) {
      defaults.price = safeFloat(priceMatch[1]);
      updated = true;
    }

    return updated;
  }
}
