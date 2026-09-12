import { describe, it, expect } from 'vitest';
import { categoryLabel } from './categoryLabel';

// Mirrors useTranslation's real contract: a miss yields undefined, not the key.
const t = (key: string) => ({
  'categories.soups': 'Супи',
  'categories.mains': 'Основни',
}[key]);

describe('categoryLabel', () => {
  it('translates a known category case-insensitively', () => {
    expect(categoryLabel('Soups', t, [], 'bg')).toBe('Супи');
  });

  it('falls back to the raw name when there is no translation', () => {
    expect(categoryLabel('Main Dishes', t, [], 'bg')).toBe('Main Dishes');
  });

  it('never renders undefined when t() misses', () => {
    const result = categoryLabel('Totally Unknown', t, [], 'bg');
    expect(result).toBe('Totally Unknown');
    expect(result).not.toBe(undefined);
    expect(String(result)).not.toContain('undefined');
  });

  it('prefers a custom category name in the active language', () => {
    const custom = [{ id: 'cat_1', names: { bg: 'Десерти', en: 'Desserts' } } as any];
    expect(categoryLabel('cat_1', t, custom, 'bg')).toBe('Десерти');
  });

  it('falls back through en then the raw id for a custom category', () => {
    const custom = [{ id: 'cat_2', names: { en: 'Drinks' } } as any];
    expect(categoryLabel('cat_2', t, custom, 'bg')).toBe('Drinks');
    expect(categoryLabel('cat_3', t, [{ id: 'cat_3', names: {} } as any], 'bg')).toBe('cat_3');
  });

  it('returns the raw name rather than an empty string for a blank translation', () => {
    const blank = () => '';
    expect(categoryLabel('Soups', blank, [], 'bg')).toBe('Soups');
  });
});
