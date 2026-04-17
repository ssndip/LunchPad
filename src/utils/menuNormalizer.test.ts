import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllPresets, getActivePreset, normalizeMenuText, applyItemOverrides, FormatPreset } from './menuNormalizer';
import { DEFAULT_CATEGORY_SETTINGS } from './parserLocalSettings';

describe('menuNormalizer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('getAllPresets', () => {
    it('should return empty array if localStorage is empty', () => {
      expect(getAllPresets()).toEqual([]);
    });

    it('should return parsed presets if valid JSON', () => {
      const presets: FormatPreset[] = [{ id: '1', name: 'Test', preprocessRules: [], createdAt: 'now' }];
      localStorage.setItem('lunchpad_format_presets', JSON.stringify(presets));
      expect(getAllPresets()).toEqual(presets);
    });

    it('should return empty array if JSON.parse throws', () => {
      localStorage.setItem('lunchpad_format_presets', 'invalid-json');
      expect(getAllPresets()).toEqual([]);
    });
  });

  describe('getActivePreset', () => {
    it('should return null if no active preset id', () => {
      localStorage.setItem('lunchpad_parser_settings', JSON.stringify({
        categories: DEFAULT_CATEGORY_SETTINGS,
        sideDishKeyword: 'с гарнитура',
        activePresetId: null
      }));
      expect(getActivePreset()).toBeNull();
    });

    it('should return null if active preset id does not match any preset', () => {
      localStorage.setItem('lunchpad_parser_settings', JSON.stringify({
        categories: DEFAULT_CATEGORY_SETTINGS,
        sideDishKeyword: 'с гарнитура',
        activePresetId: 'non-existent'
      }));
      expect(getActivePreset()).toBeNull();
    });

    it('should return the active preset', () => {
      const presets: FormatPreset[] = [{ id: '1', name: 'Test', preprocessRules: [], createdAt: 'now' }];
      localStorage.setItem('lunchpad_format_presets', JSON.stringify(presets));
      localStorage.setItem('lunchpad_parser_settings', JSON.stringify({
        categories: DEFAULT_CATEGORY_SETTINGS,
        sideDishKeyword: 'с гарнитура',
        activePresetId: '1'
      }));
      expect(getActivePreset()).toEqual(presets[0]);
    });
  });

  describe('normalizeMenuText', () => {
    it('should replace common non-standard bullet styles', () => {
      const text = '• Item 1\n○ Item 2\n* Item 3\n◦ Item 4\n‣ Item 5\n▸ Item 6\n► Item 7\n▶ Item 8';
      const expected = '- Item 1\n- Item 2\n- Item 3\n- Item 4\n- Item 5\n- Item 6\n- Item 7\n- Item 8';
      expect(normalizeMenuText(text)).toBe(expected);
    });

    it('should prepend "- " to lines that look like items with price', () => {
      const text = 'Some item 5.00€\nAnother 12,50 лв\n- Already has 3.00€\n1. Numbered 2.00€';
      const expected = '- Some item 5.00€\n- Another 12,50 лв\n- Already has 3.00€\n1. Numbered 2.00€';
      expect(normalizeMenuText(text)).toBe(expected);
    });

    it('should apply valid preprocess rules', () => {
      const preset: FormatPreset = {
        id: '1', name: 'Test', createdAt: 'now',
        preprocessRules: [
          { find: 'foo', replace: 'bar', isRegex: false },
          { find: '[A-Z]oo', replace: 'Zoo', isRegex: true }
        ]
      };
      const text = 'foo and Foo and Boo';
      // foo -> bar, Foo -> Zoo, Boo -> Zoo
      const expected = 'bar and Zoo and Zoo';
      expect(normalizeMenuText(text, preset)).toBe(expected);
    });

    it('should skip invalid regex rules and continue', () => {
      const preset: FormatPreset = {
        id: '1', name: 'Test', createdAt: 'now',
        preprocessRules: [
          { find: '[', replace: 'error', isRegex: true }, // Invalid regex
          { find: 'foo', replace: 'bar', isRegex: false }
        ]
      };
      const text = 'foo [';
      const expected = 'bar [';
      expect(normalizeMenuText(text, preset)).toBe(expected);
    });

    it('should return parsed JSON array when preset.type is json and replace succeeds', () => {
      const preset: FormatPreset = {
        id: '1', name: 'Test JSON', createdAt: 'now', type: 'json',
        preprocessRules: [],
        rules: [{ find: 'foo', replace: '[1, 2, 3]' }]
      };
      expect(normalizeMenuText('foo', preset)).toEqual([1, 2, 3]);
    });

    it('should return [] on JSON parse error when preset.type is json', () => {
      const preset: FormatPreset = {
        id: '1', name: 'Test JSON', createdAt: 'now', type: 'json',
        preprocessRules: [],
        rules: [{ find: 'foo', replace: 'invalid-json' }]
      };
      expect(normalizeMenuText('foo', preset)).toEqual([]);
    });
  });

  describe('applyItemOverrides', () => {
    it('should return original items if preset is null', () => {
      const items = [{ name: 'Item 1', category: 'Cat 1' }];
      expect(applyItemOverrides(items, null)).toEqual(items);
    });

    it('should apply overrides from preset', () => {
      const items = [{ name: 'Item 1', category: 'Cat 1' }, { name: 'Item 2', category: 'Cat 2' }];
      const preset: FormatPreset = {
        id: '1', name: 'Test', createdAt: 'now', preprocessRules: [],
        itemCategoryOverrides: { 'Item 1': 'Cat 1 Override' },
        itemNameOverrides: { 'Item 2': 'Item 2 Override' }
      };
      const expected = [
        { name: 'Item 1', category: 'Cat 1 Override' },
        { name: 'Item 2 Override', category: 'Cat 2' }
      ];
      expect(applyItemOverrides(items, preset)).toEqual(expected);
    });
  });
});
