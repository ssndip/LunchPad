import { describe, it, expect } from 'vitest';
import { applyItemOverrides, FormatPreset } from './menuNormalizer';

describe('applyItemOverrides', () => {
  const items = [
    { name: 'Pizza', category: 'Main' },
    { name: 'Cola', category: 'Drink' },
  ];

  it('should return original items if preset is null or undefined', () => {
    expect(applyItemOverrides(items, null)).toEqual(items);
    expect(applyItemOverrides(items, undefined)).toEqual(items);
  });

  it('should return items with no changes if overrides are undefined', () => {
    const preset: FormatPreset = {
      id: '1',
      name: 'Preset 1',
      preprocessRules: [],
      createdAt: '2023-01-01',
    };
    expect(applyItemOverrides(items, preset)).toEqual(items);
  });

  it('should return items with no changes if overrides do not match item names', () => {
    const preset: FormatPreset = {
      id: '1',
      name: 'Preset 1',
      preprocessRules: [],
      createdAt: '2023-01-01',
      itemCategoryOverrides: { 'Burger': 'Main Course' },
      itemNameOverrides: { 'Water': 'Spring Water' },
    };
    expect(applyItemOverrides(items, preset)).toEqual(items);
  });

  it('should apply itemCategoryOverrides to an item if it matches the item name', () => {
    const preset: FormatPreset = {
      id: '1',
      name: 'Preset 1',
      preprocessRules: [],
      createdAt: '2023-01-01',
      itemCategoryOverrides: { 'Pizza': 'Fast Food' },
    };
    const expected = [
      { name: 'Pizza', category: 'Fast Food' },
      { name: 'Cola', category: 'Drink' },
    ];
    expect(applyItemOverrides(items, preset)).toEqual(expected);
  });

  it('should apply itemNameOverrides to an item if it matches the item name', () => {
    const preset: FormatPreset = {
      id: '1',
      name: 'Preset 1',
      preprocessRules: [],
      createdAt: '2023-01-01',
      itemNameOverrides: { 'Cola': 'Coca Cola' },
    };
    const expected = [
      { name: 'Pizza', category: 'Main' },
      { name: 'Coca Cola', category: 'Drink' },
    ];
    expect(applyItemOverrides(items, preset)).toEqual(expected);
  });

  it('should apply both itemCategoryOverrides and itemNameOverrides if both match', () => {
    const preset: FormatPreset = {
      id: '1',
      name: 'Preset 1',
      preprocessRules: [],
      createdAt: '2023-01-01',
      itemCategoryOverrides: { 'Pizza': 'Fast Food', 'Cola': 'Beverage' },
      itemNameOverrides: { 'Pizza': 'Margherita', 'Cola': 'Coca Cola' },
    };
    const expected = [
      { name: 'Margherita', category: 'Fast Food' },
      { name: 'Coca Cola', category: 'Beverage' },
    ];
    expect(applyItemOverrides(items, preset)).toEqual(expected);
  });
});
