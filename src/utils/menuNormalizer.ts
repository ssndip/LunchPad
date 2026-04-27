import { loadCategorySettings } from './parserLocalSettings';

export interface FormatPreset {
  id: string;
  name: string;
  type?: string;
  rules?: { find: string; replace: string }[];
  preprocessRules: { find: string; replace: string; isRegex: boolean }[];
  itemCategoryOverrides?: Record<string, string>;
  itemNameOverrides?: Record<string, string>;
  createdAt: string;
}

export interface ParserProfile {
  id: string;
  name: string;
  settings: any; // ParserPersistence
  presets: FormatPreset[];
  createdAt: string;
}

const PRESETS_KEY = 'lunchpad_format_presets';
const PROFILES_KEY = 'lunchpad_parser_profiles';

export function getAllPresets(): FormatPreset[] {
  const raw = localStorage.getItem(PRESETS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getAllProfiles(): ParserProfile[] {
  const raw = localStorage.getItem(PROFILES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function getActivePreset(): FormatPreset | null {
  const settings = loadCategorySettings();
  if (!settings.activePresetId) return null;
  const presets = getAllPresets();
  return presets.find(p => p.id === settings.activePresetId) || null;
}

// ⚡ Bolt: Cache regex compilations to avoid CPU overhead in parsing loops.
// Using Bounded FIFO cache mechanism to prevent memory leaks from unbounded Maps
// where dynamic strings might be added continuously.
class RegexCache {
  private cache = new Map<string, RegExp>();
  private readonly maxSize = 100;

  getPattern(find: string, isRegex: boolean): RegExp {
    const cacheKey = isRegex ? `regex:${find}` : `string:${find}`;
    let pattern = this.cache.get(cacheKey);

    if (!pattern) {
      if (this.cache.size >= this.maxSize) {
        // Remove oldest entry
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }

      pattern = isRegex
        ? new RegExp(find, 'gm')
        : new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
      this.cache.set(cacheKey, pattern);
    }
    return pattern;
  }
}

const regexCache = new RegexCache();

export function normalizeMenuText(originalText: string, preset?: FormatPreset | null): string {
  if (preset && preset.type === 'json' && preset.rules && preset.rules.length > 0) {
    const rule = preset.rules[0];
    if (rule && rule.replace) {
      try {
        // Preset JSON rules are treated as regexes
        return originalText.replace(regexCache.getPattern(rule.find, true), rule.replace);
      } catch {
        return originalText;
      }
    }
  }

  let text = originalText;

  // 1. Replace common non-standard bullet styles
  text = text.replace(/^[•○*◦‣▸►▶]\s*/gm, '- ');
  // 2. Lines that look like items (have price) but no "- " and don't start with digits → prepend "- "
  text = text.replace(/^(?![-•*]|\d)(.*[\d]+[,.]\d{1,2}\s*[€$лв].*)$/gm, (match) => `- ${match.trim()}`);
  
  // 3. Apply all rules from active preset
  if (preset) {
    for (const rule of preset.preprocessRules) {
      try {
        text = text.replace(regexCache.getPattern(rule.find, rule.isRegex), rule.replace);
      } catch { 
        /* invalid regex, skip */ 
      }
    }
  }

  return text;
}

export function applyItemOverrides(items: any[], preset?: FormatPreset | null) {
  if (!preset) return items;
  return items.map(item => {
    let overrideCat = preset.itemCategoryOverrides?.[item.name] || item.category;
    let overrideName = preset.itemNameOverrides?.[item.name] || item.name;
    return { ...item, category: overrideCat, name: overrideName };
  });
}
