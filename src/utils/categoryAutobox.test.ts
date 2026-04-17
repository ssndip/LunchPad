import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isCategoryAutoBox, isItemAutoBox } from './categoryAutobox';
import * as parserSettings from './parserLocalSettings';
import { MenuItem } from '../types';

describe('categoryAutobox', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(parserSettings, 'loadCategorySettings').mockReturnValue({
      categories: {
        soups: { autoBox: true, hasSideDish: false },
        mains: { autoBox: false, hasSideDish: false },
        salads: { autoBox: true, hasSideDish: false },
        bread: { autoBox: false, hasSideDish: false }
      },
      sideDishKeyword: 'с гарнитура',
      activePresetId: null
    } as any);
  });

  describe('isCategoryAutoBox', () => {
    it('returns true if category has autoBox enabled in settings', () => {
      // 'Soups' maps to 'soups' which has autoBox: true
      expect(isCategoryAutoBox('Soups')).toBe(true);
      // 'Salads' maps to 'salads' which has autoBox: true
      expect(isCategoryAutoBox('Salads')).toBe(true);
    });

    it('returns false if category has autoBox disabled in settings', () => {
      // 'Main Dishes' maps to 'mains' which has autoBox: false
      expect(isCategoryAutoBox('Main Dishes')).toBe(false);
      // 'Bread' maps to 'bread' which has autoBox: false
      expect(isCategoryAutoBox('Bread')).toBe(false);
    });

    it('returns false if category display name is not recognized', () => {
      expect(isCategoryAutoBox('Unknown Category')).toBe(false);
      expect(isCategoryAutoBox('')).toBe(false);
    });
  });

  describe('isItemAutoBox', () => {
    const createBaseItem = (overrides: Partial<MenuItem> = {}): MenuItem => ({
      id: 1,
      name: 'Test Item',
      price: 1.0,
      basePrice: 1.0,
      available: true,
      category: 'Main Dishes',
      tags: [],
      extraFees: [],
      ...overrides
    });

    it('returns true if item has explicit autobox tag', () => {
      const item = createBaseItem({ tags: ['autobox'] });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true if item has explicit has_custom_box tag', () => {
      const item = createBaseItem({ tags: ['has_custom_box'] });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true if item has explicit bbq tag', () => {
      const item = createBaseItem({ tags: ['bbq'] });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true if live parser settings for the category indicate autoBox', () => {
      const item = createBaseItem({ category: 'Soups' }); // Soups is mocked to true
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns false if live parser settings for the category indicate no autoBox and no fallback applies', () => {
      const item = createBaseItem({ category: 'Main Dishes' }); // Mains is mocked to false
      expect(isItemAutoBox(item)).toBe(false);
    });

    it('returns true based on legacy fallback keywords (гарнитури)', () => {
      // Unrecognized by label mapper but matches fallback
      const item = createBaseItem({ category: 'Гарнитури - Specials' });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true based on legacy fallback keywords (side dishes)', () => {
      const item = createBaseItem({ category: 'Fancy side dishes' });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true based on legacy fallback keywords (скара)', () => {
      const item = createBaseItem({ category: 'Скара' });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true based on legacy fallback keywords (bbq)', () => {
      const item = createBaseItem({ category: 'BBQ Specials' });
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns false if item category is missing', () => {
      const item = createBaseItem({ category: undefined as unknown as string });
      expect(isItemAutoBox(item)).toBe(false);
    });

    it('returns false if item category is completely unrelated and missing tags', () => {
      const item = createBaseItem({ category: 'Drinks' }); // Not in LABEL_TO_KEY, doesn't match legacy keywords
      expect(isItemAutoBox(item)).toBe(false);
    });
  });
});
