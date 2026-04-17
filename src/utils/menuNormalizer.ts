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

const PRESETS_KEY = 'lunchpad_format_presets';

export function getAllPresets(): FormatPreset[] {
  const raw = localStorage.getItem(PRESETS_KEY);
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

export function normalizeMenuText(originalText: string, preset?: FormatPreset | null): string | any[] {
  if (preset && preset.type === 'json' && preset.rules && preset.rules.length > 0) {
    const rule = preset.rules[0];
    if (rule && rule.replace) {
      try {
        const raw = originalText.replace(new RegExp(rule.find, 'gm'), rule.replace);
        return JSON.parse(raw);
      } catch {
        return [];
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
        const pattern = rule.isRegex 
          ? new RegExp(rule.find, 'gm') 
          : new RegExp(rule.find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gm');
        text = text.replace(pattern, rule.replace);
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
