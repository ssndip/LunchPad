/**
 * categoryAutobox.ts
 *
 * "Should this item show a packaging-fee badge?" for the kiosk UI.
 *
 * It used to answer that from `lunchpad_parser_settings` in localStorage, which
 * is written only by the Parser Rules tab in one administrator's browser. The
 * server cannot see it, so the badge — and the cart total, which used the same
 * function — could advertise a fee that never reached the bill. Both now defer
 * to the shared rule in packagingFee.ts, the one the server charges with, so
 * what the customer is shown and what they pay cannot disagree.
 *
 * The localStorage settings still drive the *parser*, where they belong: they
 * decide which tags and fees get baked into the menu at import time.
 */
import { MenuItem } from '../types';
import { categoryCarriesBoxFee, packagingFeeFor } from './packagingFee';

/** Does this category carry a packaging fee by default? */
export function isCategoryAutoBox(categoryId: string): boolean {
  return categoryCarriesBoxFee(categoryId);
}

/** Will this item be charged a packaging fee? */
export function isItemAutoBox(item: MenuItem): boolean {
  if (!item) return false;
  // A nominal default of 1 makes this a yes/no question about the rule rather
  // than about the canteen's configured amount.
  return packagingFeeFor(item as any, 1) > 0;
}
