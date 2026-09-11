/**
 * Split a fee across people without losing or inventing money.
 *
 * The delivery fee was divided with `Number((fee / n).toFixed(2))` and that one
 * rounded amount charged to everybody, so the total collected drifted from the
 * fee: 10.00 across 3 people collected 9.99, across 7 it collected 10.01.
 *
 * Works in whole cents and hands the leftover cents out one each, so the parts
 * always add back up to the total. The order is the caller's, and stable.
 */
export const splitFeeCents = (totalCents: number, people: number): number[] => {
  if (people <= 0) return [];
  const base = Math.floor(totalCents / people);
  const remainder = totalCents - base * people;
  return Array.from({ length: people }, (_, i) => base + (i < remainder ? 1 : 0));
};
