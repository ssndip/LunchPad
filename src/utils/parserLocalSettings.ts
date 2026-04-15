// src/utils/parserLocalSettings.ts

export interface CategoryParserSettings {
  autoBox: boolean;
  hasSideDish: boolean;
}

export type AllCategorySettings = Record<string, CategoryParserSettings>;

export interface ParserPersistence {
  categories: AllCategorySettings;
  sideDishKeyword: string;
  activePresetId: string | null;
}

const STORAGE_KEY = 'lunchpad_parser_settings';
export const DEFAULT_SIDE_DISH_KEYWORD = "с гарнитура";

export const DEFAULT_CATEGORY_SETTINGS: AllCategorySettings = {
  soups:    { autoBox: false, hasSideDish: false },
  mains:    { autoBox: false, hasSideDish: true  },
  salads:   { autoBox: true,  hasSideDish: false },
  bread:    { autoBox: false, hasSideDish: false },
  sides:    { autoBox: true,  hasSideDish: false },
  bbq:      { autoBox: true,  hasSideDish: false },
  other:    { autoBox: false, hasSideDish: false },
  desserts: { autoBox: false, hasSideDish: false },
};

export function loadCategorySettings(): ParserPersistence {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { 
        categories: { ...DEFAULT_CATEGORY_SETTINGS }, 
        sideDishKeyword: DEFAULT_SIDE_DISH_KEYWORD,
        activePresetId: null
      };
    }

    const parsed = JSON.parse(raw);
    
    // Check if it's the new format or the old format (legacy is just the Record)
    if (parsed.categories && typeof parsed.sideDishKeyword === 'string') {
      return {
        categories: { ...DEFAULT_CATEGORY_SETTINGS, ...parsed.categories },
        sideDishKeyword: parsed.sideDishKeyword,
        activePresetId: parsed.activePresetId !== undefined ? parsed.activePresetId : null
      };
    }

    // Fallback for legacy format (the Record was stored directly)
    return {
      categories: { ...DEFAULT_CATEGORY_SETTINGS, ...parsed },
      sideDishKeyword: DEFAULT_SIDE_DISH_KEYWORD,
      activePresetId: null
    };
  } catch {
    return { 
      categories: { ...DEFAULT_CATEGORY_SETTINGS }, 
      sideDishKeyword: DEFAULT_SIDE_DISH_KEYWORD,
      activePresetId: null
    };
  }
}

export function saveCategorySettings(settings: ParserPersistence): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

