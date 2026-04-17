import { describe, it, expect } from 'vitest';
import { isItemAutoBox, isCategoryAutoBox } from './categoryAutobox';
import { MenuItem } from '../types';

describe('categoryAutobox', () => {
  describe('isItemAutoBox', () => {
    it('returns false if item is falsy', () => {
      expect(isItemAutoBox(null as any)).toBe(false);
      expect(isItemAutoBox(undefined as any)).toBe(false);
    });

    it('returns true if item has a packagingFee > 0', () => {
      const item = { packagingFee: 1.5 } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns false if item has a packagingFee <= 0', () => {
      const item = { packagingFee: 0, category: 'Unknown Category', tags: [] } as MenuItem;
      expect(isItemAutoBox(item)).toBe(false);
    });
    it('returns true if item has autobox tag', () => {
      const item = { tags: ['autobox'] } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true if item has has_custom_box tag', () => {
      const item = { tags: ['has_custom_box'] } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true if item has bbq tag', () => {
      const item = { tags: ['bbq'] } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true if category has autoBox set to true in settings (Salads)', () => {
      const item = { category: 'Salads' } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns false if category has autoBox set to false in settings (Soups)', () => {
      const item = { category: 'Soups' } as MenuItem;
      expect(isItemAutoBox(item)).toBe(false);
    });

    it('returns true for legacy category fallback: side dishes', () => {
      const item = { category: 'some Side Dishes' } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true for legacy category fallback: гарнитури', () => {
      const item = { category: 'Гарнитури' } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true for legacy category fallback: bbq', () => {
      const item = { category: 'Super bbq stuff' } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns true for legacy category fallback: скара', () => {
      const item = { category: 'Скара' } as MenuItem;
      expect(isItemAutoBox(item)).toBe(true);
    });

    it('returns false for unknown category without tags', () => {
      const item = { category: 'Unknown Category', tags: [] } as MenuItem;
      expect(isItemAutoBox(item)).toBe(false);
    });

    it('returns false if item lacks category and tags', () => {
      const item = {} as MenuItem;
      expect(isItemAutoBox(item)).toBe(false);
    });
  });

  describe('isCategoryAutoBox', () => {
    it('returns true for categories configured with autoBox: true', () => {
      expect(isCategoryAutoBox('Salads')).toBe(true);
      expect(isCategoryAutoBox('Side Dishes')).toBe(true);
      expect(isCategoryAutoBox('BBQ')).toBe(true);
    });

    it('returns false for categories configured with autoBox: false', () => {
      expect(isCategoryAutoBox('Soups')).toBe(false);
      expect(isCategoryAutoBox('Main Dishes')).toBe(false);
    });

    it('returns false for unmapped categories', () => {
      expect(isCategoryAutoBox('Unknown Category')).toBe(false);
    });
  });
});
