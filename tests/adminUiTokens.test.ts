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

const TABS = ['SettingsTab.tsx', 'MenuTab.tsx', 'CardsTab.tsx', 'OrdersTab.tsx', 'ParserRulesTab.tsx', 'AnalyticsTab.tsx', 'HistoryTab.tsx'];

const read = (file: string) => {
  const full = path.join(__dirname, '..', 'src', 'components', 'manager', 'tabs', file);
  return fs.readFileSync(full, 'utf-8');
};

/** Every match with the 1-based line it sits on, and that line's text. */
const tokensWithLines = (source: string, pattern: RegExp) => {
  const found: { token: string; line: number; text: string }[] = [];
  source.split('\n').forEach((text, i) => {
    for (const match of text.matchAll(pattern)) {
      found.push({ token: match[0], line: i + 1, text });
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

  it.each(TABS)('%s uses only the approved radii', file => {
    // The optional suffix matters: a bare `rounded` is Tailwind's 4px, a sixth
    // value hiding in plain sight. Matching only `rounded-*` let it through,
    // and ParserRulesTab had eleven of them on badges and buttons.
    // The trailing guard is a negative lookahead rather than \b: \b fails after
    // the `]` of `rounded-[28px]`, so the engine backtracks and reports a bare
    // `rounded` that was never there.
    const hits = tokensWithLines(read(file), /\brounded(?:-(?:\[[^\]]+\]|[a-z0-9]+))?(?![-\w[])/g)
      .filter(h => !ALLOWED_RADII.has(h.token))
      // Inline <code> keeps the tight 4px radius — a pill or a 12px corner
      // around a snippet of parser syntax reads as a button, not as code.
      .filter(h => !(h.token === 'rounded' && h.text.includes('<code')));

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

  it.each(TABS)('%s keeps form controls on the control radius', file => {
    // The radius test above enforces WHICH radii exist, not which role each one
    // belongs to, so a button at rounded-2xl — the well and icon-chip radius —
    // passed it while still being wrong. Four of them did, across three tabs.
    //
    // For an element written as a tag this is decidable: a <button>, <input>,
    // <textarea> or <select> is a control, whatever its className says. The
    // className may sit a few lines below the tag, so the scan reads forward to
    // the end of the opening tag.
    const lines = read(file).split('\n');
    const hits: string[] = [];

    lines.forEach((line, i) => {
      const tag = /<(button|input|textarea|select)\b/.exec(line);
      if (!tag) return;

      let opening = '';
      for (let j = i; j < Math.min(i + 14, lines.length); j++) {
        opening += lines[j];
        if (/\/?>\s*$/.test(lines[j].trimEnd())) break;
      }
      if (opening.includes('rounded-2xl')) {
        hits.push(`${file}:${i + 1} <${tag[1]}> uses rounded-2xl, not rounded-xl`);
      }
    });

    expect(hits).toEqual([]);
  });

  it.each(TABS)('%s draws charts from the dashboard palette', file => {
    // Recharts takes colours as props, not classNames, so nothing above sees
    // them and Tailwind cannot constrain them. The charts were drawing their
    // primary series in pure black, which is on no scale the dashboard uses —
    // the darkest anywhere else is neutral-900, which this same file already
    // uses for its axis labels.
    const PALETTE = new Set([
      '#4F46E5', // indigo-600  — primary, matches the UI accent
      '#111827', // neutral-900 — darkest neutral, was #000000
      '#F3F4F6', // neutral-100 — grid lines
      '#10B981', // emerald-500 — positive
      '#F59E0B', // amber-500   — warning
      '#EF4444', // red-500     — negative
    ]);

    const hits = tokensWithLines(read(file), /#[0-9a-fA-F]{6}\b/g)
      .filter(h => !PALETTE.has(h.token.toUpperCase()));

    expect(describeHits(file, hits)).toEqual([]);
  });

  it.each(TABS)('%s renders its title through TabHeader', file => {
    // ParserRulesTab shipped with no title element at all — not a hand-rolled
    // one that had drifted, simply none — so it opened onto its first section
    // and read as a fragment of the page rather than a tab of it. Every other
    // tab was migrated onto the shared header; this is what keeps the seventh
    // from being forgotten again, and any eighth from arriving without one.
    const source = read(file);

    expect(source, `${file} should import TabHeader`).toMatch(
      /import \{[^}]*\bTabHeader\b[^}]*\} from ['"][^'"]*shared\/TabHeader['"]/,
    );
    expect(source, `${file} should render <TabHeader`).toContain('<TabHeader');
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
