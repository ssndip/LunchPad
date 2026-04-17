import { describe, it, expect } from 'vitest';
import { MENU_CONFIG } from './menuConfig';
import { MenuItem } from '../types';

describe('MENU_CONFIG', () => {
  it('should have standard categoryLabels and categoryKeywords', () => {
    // Check categories
    const expectedCategories = ['soups', 'mains', 'salads', 'bread', 'sides', 'bbq', 'other', 'desserts'];

    expectedCategories.forEach(category => {
      expect(MENU_CONFIG.categoryLabels).toHaveProperty(category);
      expect(MENU_CONFIG.categoryKeywords).toHaveProperty(category);
      expect(Array.isArray(MENU_CONFIG.categoryKeywords[category])).toBe(true);
    });

    expect(MENU_CONFIG.categoryLabels.soups).toBe('Soups');
    expect(MENU_CONFIG.categoryKeywords.soups).toContain('супи');
  });

  it('should have default fees set to 0', () => {
    expect(MENU_CONFIG.fees).toEqual({
      defaultBox: 0,
      defaultBbqContainer: 0,
    });
  });

  it('should have expected settings', () => {
    expect(MENU_CONFIG.settings.sideDishTriggerKeyword).toBe('с гарнитура');
    expect(MENU_CONFIG.settings.applyBoxFee).toEqual({
      sides: true,
      bbq: true,
      salads: true,
      mainsWithGarnish: false,
    });
  });

  describe('rules', () => {
    // Helper to create a mock menu item
    const createMockItem = (overrides: Partial<MenuItem>): MenuItem => ({
      id: 1,
      name: 'Test Item',
      basePrice: 10,
      price: 10,
      available: true,
      category: 'Other',
      tags: [],
      extraFees: [],
      ...overrides
    });

    it('box_fee_logic should match Side Dishes and Salads and apply autobox tag', () => {
      const rule = MENU_CONFIG.rules.find(r => r.id === 'box_fee_logic');
      expect(rule).toBeDefined();
      if (!rule) return;

      const sideDish = createMockItem({ category: 'Side Dishes' });
      const salad = createMockItem({ category: 'Salads' });
      const mainDish = createMockItem({ category: 'Main Dishes' });

      // Test match
      expect(rule.match(sideDish)).toBe(true);
      expect(rule.match(salad)).toBe(true);
      expect(rule.match(mainDish)).toBe(false);

      // Test apply
      rule.apply(sideDish, MENU_CONFIG);
      expect(sideDish.tags).toContain('autobox');

      rule.apply(salad, MENU_CONFIG);
      expect(salad.tags).toContain('autobox');
    });

    it('bbq_logic should match BBQ and apply bbq tag', () => {
      const rule = MENU_CONFIG.rules.find(r => r.id === 'bbq_logic');
      expect(rule).toBeDefined();
      if (!rule) return;

      const bbq = createMockItem({ category: 'BBQ' });
      const soup = createMockItem({ category: 'Soups' });

      // Test match
      expect(rule.match(bbq)).toBe(true);
      expect(rule.match(soup)).toBe(false);

      // Test apply
      rule.apply(bbq, MENU_CONFIG);
      expect(bbq.tags).toContain('bbq');
    });

    it('main_with_side_logic should match Main Dishes or BBQ with included side and do nothing on apply', () => {
      const rule = MENU_CONFIG.rules.find(r => r.id === 'main_with_side_logic');
      expect(rule).toBeDefined();
      if (!rule) return;

      const mainWithSide = createMockItem({ category: 'Main Dishes', hasIncludedSide: true });
      const bbqWithSide = createMockItem({ category: 'BBQ', hasIncludedSide: true });
      const mainWithoutSide = createMockItem({ category: 'Main Dishes', hasIncludedSide: false });
      const soup = createMockItem({ category: 'Soups', hasIncludedSide: true });

      // Test match
      expect(rule.match(mainWithSide)).toBe(true);
      expect(rule.match(bbqWithSide)).toBe(true);
      expect(rule.match(mainWithoutSide)).toBe(false);
      expect(rule.match(soup)).toBe(false);

      // Test apply (should not throw and should not alter tags)
      const originalTagsLength = mainWithSide.tags.length;
      rule.apply(mainWithSide, MENU_CONFIG);
      expect(mainWithSide.tags.length).toBe(originalTagsLength);
    });
  });
});
