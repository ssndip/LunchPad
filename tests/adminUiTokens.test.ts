import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * Guards the admin dashboard's visual token scale.
 *
 * Settings and Menu had drifted apart: six radius values, seven focus
 * treatments and two competing accents between them. Normalising that once is
 * easy; keeping it normalised is not, because every new control is written by
 * hand and any single-token slip reads as "close enough" in review.
 *
 * So the scale is asserted here rather than left to discipline. These are
 * source-text assertions, not render assertions — the point is to catch a
 * stray className the moment it is written, wherever it sits in the tree.
 *
 * Adding a tab to TABS puts it under the same contract.
 */

const TABS = ['SettingsTab.tsx', 'MenuTab.tsx', 'CardsTab.tsx', 'OrdersTab.tsx'];

const read = (file: string) => {
  const full = path.join(__dirname, '..', 'src', 'components', 'manager', 'tabs', file);
  return fs.readFileSync(full, 'utf-8');
};

/** Every `rounded-*` occurrence with the 1-based line it sits on. */
const tokensWithLines = (source: string, pattern: RegExp) => {
  const found: { token: string; line: number }[] = [];
  source.split('\n').forEach((text, i) => {
    for (const match of text.matchAll(pattern)) {
      found.push({ token: match[0], line: i + 1 });
    }
  });
  return found;
};

const describeHits = (file: string, hits: { token: string; line: number }[]) =>
  hits.map(h => `${file}:${h.line} ${h.token}`);

describe('admin UI token scale', () => {
  /**
   * Four roles, four radii. `rounded-lg` and `rounded-3xl` are deliberately
   * absent: they were the drift, sitting a half-step from a neighbour and
   * reading as an accident rather than a decision.
   */
  const ALLOWED_RADII = new Set([
    'rounded-xl',      // control — input, select, button
    'rounded-2xl',     // well and icon chip — nests inside a card
    'rounded-[28px]',  // card, phone
    'rounded-[40px]',  // card, md and up
    'rounded-full',    // pill and avatar
  ]);

  it.each(TABS)('%s uses only the four approved radii', file => {
    const hits = tokensWithLines(read(file), /rounded-(?:\[[^\]]+\]|[a-z0-9]+)/g)
      .filter(h => !ALLOWED_RADII.has(h.token));

    expect(describeHits(file, hits)).toEqual([]);
  });

  it.each(TABS)('%s gives every control the same focus ring', file => {
    const source = read(file);

    // `focus:ring-0` and a bare `focus:border-*` were the two ways a control
    // ended up with no visible focus state, or a one-off one.
    const suppressed = tokensWithLines(source, /focus:ring-0\b/g);
    const borderFocus = tokensWithLines(source, /focus:border-[a-z0-9-]+/g);
    const offPalette = tokensWithLines(source, /focus:ring-(?!2\b)[a-z0-9-]+/g)
      .filter(h => h.token !== 'focus:ring-indigo-600');

    expect(describeHits(file, [...suppressed, ...borderFocus, ...offPalette])).toEqual([]);
  });

  it.each(TABS)('%s carries no focus ring width other than 2', file => {
    const hits = tokensWithLines(read(file), /focus:ring-(\d+)\b/g)
      .filter(h => h.token !== 'focus:ring-2');

    expect(describeHits(file, hits)).toEqual([]);
  });

  it.each(TABS)('%s uses indigo as its only accent', file => {
    // violet-600 was a second primary, on the backup/restore block alone.
    const hits = tokensWithLines(read(file), /\b(?:bg|text|border|ring|shadow|from|to)-violet-[0-9]+/g);

    expect(describeHits(file, hits)).toEqual([]);
  });

  it('keeps the card radius identical across tabs', () => {
    // The clearest cross-tab mismatch: Menu's list card was rounded-3xl while
    // every Settings section was rounded-[28px] md:rounded-[40px].
    const CARD = 'rounded-[28px] md:rounded-[40px]';

    for (const file of TABS) {
      expect(read(file), `${file} should build its section cards on ${CARD}`).toContain(CARD);
    }
  });
});
