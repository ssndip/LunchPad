# Mobile polish — follow-ups

Residual items from the `mobile-polish` branch (56 commits), triaged by its whole-branch
review. Everything the plan set out to fix is delivered; these are what was deliberately
left, with the reasoning, so nobody re-derives it.

## Highest risk

**AnalyticsTab's two bar charts have never been executed anywhere.** This is the only
surface on the branch that received new runtime logic — a canvas `measureText` tick
renderer that truncates long category labels — and the only one nobody rendered in a
browser. It is also uncovered by tests: recharts' `ResponsiveContainer` measures 0x0 under
happy-dom, so the charts emit zero `<text>` nodes there, and `truncateLabelToWidth` /
`makeCategoryTick` are module-private so they cannot be unit-tested either.

The failure mode is quiet and total: if the font used for measurement does not match the
font actually painted, or `payload.value` is not the string the renderer assumes, a manager
sees mangled or missing category labels while CI stays green.

Do three things: export `truncateLabelToWidth` and unit-test it; take one live measurement
of the tab on a real phone; and add any test at all that mounts `AnalyticsTab`.

Context worth keeping: the labels were *already* broken before this branch. Real menu names
are 20-34 character Cyrillic dish names that overflowed even the original 100px axis, and
recharts clips SVG tick text invisibly rather than ellipsising it.

## Needs a product decision

**The kiosk's "change side" control is dead twice over.** It is
`opacity-0 group-hover:opacity-100`, so on a touch device — the app's primary target —
it never becomes visible; and its handler is `useCallback(() => {}, [])`, an empty no-op
wired to both the phone order bar and the desktop panel. A customer cannot change a chosen
side on any device. Fixing it means writing real behaviour, which this plan's constraints
forbade. Implement it or remove the control.

## Worth doing

- **Touch-utility conventions drifted mid-run.** Early tasks used the unscoped
  `.touch-target` / `.touch-target-h`, which permanently raise desktop controls; from Task 17
  the rule became phone-scoped. `CardsTab` now carries both. Net effect: the same class of
  icon control is 44px on desktop in HistoryTab and 32px in CardsTab. Consolidate, and write
  the selection rule into `src/index.css` next to the utilities.
- **`CardsTab` has no regression test** for its `Sheet` migration or its `TabHeader` button
  mapping — the final fix wave's highest-risk change ships on manual verification only.
- **`ParserRulesTab`** still has 2 controls under 44x44 at phone width.
- **`Sheet`'s `FOCUSABLE_SELECTOR`** filters `:not([disabled])` but not `aria-hidden`,
  `display:none` or hidden ancestors, so `.focus()` on such a match is a silent no-op.
  Restore-on-close likewise guards `document.contains` but not focusability.
- **`PhoneBottomNav` remounts on every `ManagerDashboard` render** (it is declared inside the
  component body). This is why its ref is a callback ref. It also breaks the `layoutId` pill
  animation, not just observer churn.
- **`navigation.actions` duplicates `cards.actions`** byte-for-byte in both languages, and
  both spellings are now live on the same screen.
- **`aria-current` / `aria-expanded` parity** on the nav's More button and the Sheet's active
  secondary item.
- **`KioskCategorySidebar`'s `t` prop is typed `(key: string) => string`** though
  `useTranslation`'s `t` can return `undefined` — the same class of lie that caused the blank
  category chips this branch fixed.
- **`CardsTab` has hardcoded untranslated strings** ("Toggle Admin", "View Statistics").
- **`scripts/audit-mobile.js`** could learn three things it currently gets wrong: pin an
  absolute origin for its iframe, exempt decorative non-textual absolutely-positioned
  elements, and treat a `<label>`-wrapped input's effective tap target as the label's box.

## Closed deliberately — no action

`snap-mandatory` vs `proximity` (no observed problem at 390px) · unscoped `snap-x`/`shrink-0`
at md+ · `overflow-auto` shorthand false-flag (no occurrences in `src/`) · `colSpan={0}`
(unreachable) · desktop `<th>` mouse-only sort · `useLayoutEffect` array-ref dependency ·
nested-Sheet z-index (no nesting exists) · MenuTab's stale-draft aria-labels · Sheet's
`onClose`-keyed Escape effect · Task 20's unscoped `touch-target-h` on a few desktop controls ·
case-colliding category names · the tick's `#111827` fill (an improvement over recharts'
grey) · Close-focused-first in a titled sheet (permitted by WAI-ARIA APG) · PinPad keys'
inert `touch-target` (they measure 107x70) · modal subtitles moved into the body · the nav's
length-not-pixels test · `CardsTab`'s pre-existing `onClick={onBatchAddCards}` passing a
MouseEvent as its `data?: Card[]` argument.
