/**
 * packagingFeeParity.test.ts — the price the kiosk quotes must be the price the
 * till charges.
 *
 * The two had separate implementations: the server held a hardcoded list of
 * category names, the client held that list *plus* a lookup into
 * `lunchpad_parser_settings` in localStorage. They drifted. A Salads item added
 * by hand in the Menu tab (so carrying none of the parser's tags) was shown at
 * price + 0.10 and charged price + 0.00, because `salads` is `autoBox: true` in
 * the client's defaults but was absent from the server's list.
 *
 * This pins the two together by running the real cart-total reducer against the
 * real server-side charge for the same items.
 */
import { describe, it, expect } from 'vitest';
import { packagingFeeFor } from '../src/utils/packagingFee';
import { calculateItemPrice } from '../server/services/orderService';
import { settings } from '../server/config';
import { isItemAutoBox } from '../src/utils/categoryAutobox';

const FEE = 0.10;
settings.packagingFee = FEE;

const items = [
  { label: 'parsed salad (autobox tag)',   item: { name: 'Салата',    price: 2, category: 'Salads',      tags: ['autobox'] } },
  { label: 'hand-added salad, no tags',    item: { name: 'Салата',    price: 2, category: 'Salads',      tags: [] } },
  { label: 'hand-added side dish',         item: { name: 'Гарнитура', price: 2, category: 'Side Dishes', tags: [] } },
  { label: 'hand-added bbq',               item: { name: 'Скара',     price: 2, category: 'BBQ',         tags: [] } },
  { label: 'hand-added main',              item: { name: 'Основно',   price: 2, category: 'Main Dishes', tags: [] } },
  { label: 'hand-added soup',              item: { name: 'Супа',      price: 2, category: 'Soups',       tags: [] } },
  { label: 'Bulgarian category Гарнитури', item: { name: 'Гарнитура', price: 2, category: 'Гарнитури',   tags: [] } },
  { label: 'Bulgarian category Салати',    item: { name: 'Салата',    price: 2, category: 'Салати',      tags: [] } },
  { label: 'explicit per-item fee',        item: { name: 'Кутия',     price: 2, category: 'Soups',       tags: [], packagingFee: 0.25 } },
  { label: 'explicit zero fee beats tag',  item: { name: 'Без кутия', price: 2, category: 'BBQ',         tags: ['autobox'], packagingFee: 0 } },
];

describe('packaging fee parity between kiosk and server', () => {
  it.each(items)('agrees on $label', ({ item }) => {
    // What the kiosk adds to the cart total (src/store/selectors useTotalPrice)
    const quoted = packagingFeeFor(item as any, FEE);
    // What the server actually charges
    const charged = calculateItemPrice(item).itemFee;
    expect(quoted).toBeCloseTo(charged, 10);
  });

  it('charges the fee on a hand-added salad, matching what the kiosk shows', () => {
    const salad = { name: 'Салата', price: 2, category: 'Salads', tags: [] };
    expect(calculateItemPrice(salad).itemFee).toBeCloseTo(FEE, 10);
    expect(calculateItemPrice(salad).total).toBeCloseTo(2.10, 10);
  });

  it('never badges an item the server would not charge for', () => {
    for (const { item } of items) {
      const badged = isItemAutoBox(item as any);
      const charged = calculateItemPrice(item).itemFee > 0;
      expect(badged).toBe(charged);
    }
  });

  it('lets an explicit zero override a box tag', () => {
    const noBox = { name: 'x', price: 1, category: 'BBQ', tags: ['autobox'], packagingFee: 0 };
    expect(calculateItemPrice(noBox).itemFee).toBe(0);
    expect(packagingFeeFor(noBox as any, FEE)).toBe(0);
  });
});
