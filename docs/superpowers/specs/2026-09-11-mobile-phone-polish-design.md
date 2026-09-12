# Mobile phone polish — design

**Date:** 2026-09-11
**Scope:** Every surface the app renders below 768px — the customer kiosk, the
manager dashboard shell, and all seven dashboard tabs.
**Goal:** Nothing truncated, navigation reachable by thumb, and an admin screen
on a phone that reads like an app rather than a shrunken desktop page.

## Why now

A phone-width audit of the running app (viewport 390×840, measured in the DOM
rather than eyeballed) turned up one outright rendering bug, six layout
defects, two truncation problems, and four patterns that are merely
desktop-shaped. They are listed below with the evidence that identified them.

## Defects

### Bugs

1. **Kiosk category chips render no text.** Every chip measures 28px wide with
   `span.textContent === ""`. `useTranslation`'s `t()` returns `undefined` for a
   missing key, but `KioskCategorySidebar.tsx:107` guards with
   `translated !== ` + the key string, so the `cat` fallback never fires and
   `undefined` is rendered. Menu categories in the database are `Soups`,
   `Main Dishes`, `Side Dishes`; `translations.ts` only defines
   `categories.soups` and `categories.mains`. Affects every breakpoint; it is
   merely most damaging on a phone, where the chip row is the only category
   navigation.

2. **Dashboard content sits under the bottom nav.** `ManagerDashboard.tsx:229`
   reserves `mb-16` (64px). `PhoneBottomNav` is `h-[72px]` plus
   `env(safe-area-inset-bottom)`. The last row of any tab is covered.

3. **180px of dead space below the kiosk menu.** `KioskItemList.tsx:80` sets
   `pb-[180px]` to clear an order bar that is a normal-flow flex sibling, not a
   fixed overlay. The reservation is unnecessary in every state.

4. **Kiosk header collapses on notched phones.** `KioskView.tsx:331` combines a
   fixed `h-16` with `pad-safe-top`, so the inset is subtracted from the 64px
   box instead of added to it, squeezing the controls.

5. **Error toast lands under the notch.** `KioskView.tsx:565` positions with a
   bare `top-14`, ignoring `safe-area-inset-top`.

6. **Leading date tabs are unreachable.** `KioskView.tsx:346` centres an
   `overflow-x-auto` flex row with `justify-center`. When the tabs overflow,
   the leading ones spill past `scrollLeft: 0` and cannot be scrolled back to.
   Compounding it, each tab is `min-w-[120px]` while the phone header leaves
   roughly 250px between the icon clusters.

7. **`hide-scrollbar-on-mobile` is used and never defined.** Applied at
   `ManagerDashboard.tsx:263`; absent from `index.css`. Dead class.

### Truncation

8. **Every bottom-nav label is an ellipsis.** Six tabs share 390px — about 65px
   each — with `text-[9px] truncate`. The Bulgarian labels are
   `Управление на менюто` (20 chars), `Обобщение на поръчките` (22),
   `Управление на карти` (19). Roughly twelve characters fit.

9. **RFID input is below the project's own touch floor.** Measured 35px tall
   against the 44px minimum `index.css` documents and enforces elsewhere via
   `.touch-target`.

### Desktop-shaped patterns

10. **Four admin tables scroll sideways on a phone** — `MenuTab` (`min-w-[640px]`),
    `HistoryTab` (`min-w-[600px]`), `OrdersTab` and `CardsTab` (`min-w-[500px]`).
11. **Tab toolbars wrap into tall stacks.** `MenuTab` alone renders five buttons
    plus two inline numeric fee fields in one `flex-wrap` row.
12. **The kiosk order bar is always fully expanded** — 227px, 27% of an 840px
    screen, with only three items in the cart.
13. **Modals are centred desktop dialogs** (`rounded-[48px]`, `p-8`) rather than
    bottom sheets.

## Approach

Fix the defects first, then introduce three shared primitives and apply them
across the tabs. The primitives matter because the alternative — hand-editing
roughly 5,000 lines of `MenuTab`, `SettingsTab`, `CardsTab` and
`ParserRulesTab` — produces four divergent phone layouts and no reusable
answer for the next tab.

### Components

**`<DataList>`** (`src/components/shared/DataList.tsx`)

One component replacing the four sideways-scrolling tables. At `md` and above
it renders the existing semantic `<table>`; below `md` it renders each row as a
stacked card.

```ts
interface DataListColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  /** How the cell presents on a phone card. Default 'body'. */
  role?: 'title' | 'body' | 'meta';
  /** Omit from the phone card entirely (redundant or decorative). */
  hideOnPhone?: boolean;
}

interface DataListRow {
  key: string | number;
  cells: Record<string, React.ReactNode>;
  actions?: React.ReactNode;
  expandedContent?: React.ReactNode;
  isExpanded?: boolean;
  onClick?: () => void;
}
```

Phone card layout: `role: 'title'` cells become the card heading, `'body'`
cells become label/value pairs, `'meta'` cells sit in a muted footer row, and
`actions` render as a full-width button row. `expandedContent` renders beneath
the card, matching the table's `colSpan` row.

The primitive owns padding and alignment, so cells passed in must not carry
`<td>`-specific classes (`p-6`, `text-right`). Un-classing the existing cell
content is the mechanical part of each tab's migration.

**`<Sheet>`** (`src/components/shared/Sheet.tsx`)

A bottom sheet below `md`, a centred dialog at `md` and above. Handles the
backdrop, `AnimatePresence` enter/exit, Escape, focus trapping, scroll locking,
and `env(safe-area-inset-bottom)`. Applied to `ConfirmModal`, `PinPadModal`,
`UserHistoryModal`, `NfcWriteModal`, and the paste/backup modals in `MenuTab`
and `CardsTab`.

**`<TabHeader>`** (`src/components/shared/TabHeader.tsx`)

Title, subtitle, one primary action, and an overflow menu. On a phone the
secondary actions collapse into the overflow; at `md` and above they render
inline as they do today. Replaces the hand-rolled `flex-wrap` toolbar in each
tab.

### Navigation

`PhoneBottomNav` drops to four primary destinations — Menu, Orders, History,
Cards — plus a fifth "More" entry that opens a `<Sheet>` containing Analytics,
Parser Rules, Settings and Logout. The phone-only settings and logout buttons
currently crowding the dashboard header are removed, since More subsumes them.

Labels use new short forms so nothing truncates. Add to `translations.ts` under
`navigation`, for both `en` and `bg`:

| Key | en | bg |
| :-- | :-- | :-- |
| `menu_short` | Menu | Меню |
| `orders_short` | Orders | Поръчки |
| `history_short` | History | История |
| `cards_short` | Cards | Карти |
| `more` | More | Още |

At `text-[10px]` in a 78px cell, the longest of these ("Поръчки", 7 chars)
fits with room to spare. The full labels stay in use for the desktop sidebar
and tablet bar.

The nav spacer bug (#2) is fixed by measuring rather than guessing. A
`ResizeObserver` on the nav element writes its measured height to a
`--phone-nav-h` custom property on `document.documentElement`, and the main
content area pads by `calc(var(--phone-nav-h, 72px) + env(safe-area-inset-bottom))`.
`index.css` declares the `72px` fallback on `:root` so the first paint and any
non-browser render are correct. A hardcoded second copy of the height is what
broke in the first place, so the height is never written down twice.

### Kiosk

- Category chips get the fallback fix (#1): render `cat` whenever `t()` returns
  a falsy value, and look the key up case-insensitively so `Soups` finds
  `categories.soups`. `Main Dishes` has no key under any casing and correctly
  falls through to its raw name.
- Date tabs become `justify-start` with `scroll-snap-type: x mandatory`, and
  the active tab is scrolled into view on mount and on change. Width drops to
  `min-w-[88px]` on phones.
- Header becomes `min-h-16` with the safe-area inset added rather than
  subtracted.
- The error toast is anchored with `calc(3.5rem + env(safe-area-inset-top))`.
- `pb-[180px]` is removed from the item list.
- The order bar collapses: by default a single-row pill showing total, item
  count and the order button; tapping the pill expands the item list. Expanded
  state is component state in `KioskOrderBar`, defaulting to collapsed and
  auto-expanding once on the first item added — it is not persisted, so a
  reload returns to collapsed. The RFID field moves inside the expanded state
  and gets `min-h-[44px]`.

### Dashboard tabs

Each tab is migrated in the same three steps: `TabHeader` for the toolbar,
`DataList` for the table, `Sheet` for its modals. `SettingsTab` and
`ParserRulesTab` have no tables — they get `TabHeader`, `Sheet`, and a pass
over their fixed-width controls (`w-[200px]`, `w-[240px]`, and the
`grid-cols-[1fr_auto_auto]` row at `ParserRulesTab.tsx:1256`) to make them
fluid below `md`.

`AnalyticsTab`'s recharts containers get an explicit phone height and their
legends move below the plot, where at 390px they otherwise steal half the
chart width.

## Testing

The existing stack is Vitest plus Testing Library (`vitest.config.ts`,
`vitest.setup.ts`), with component tests already present for `KioskView`,
`CardsTab` and `NfcWriteModal`.

- **Unit tests for the category label fallback** — the specific bug in #1:
  a known key translates, an unknown key renders its raw name, and `t()`
  returning `undefined` never reaches the DOM.
- **Unit tests for `DataList`** — table markup at desktop width, card markup at
  phone width, and every column's content present in both.
- **Unit tests for the nav** — four primary destinations plus More, every
  destination reachable, and no label longer than its cell's character budget.

`happy-dom` does not lay out, so `scrollWidth`, `clientWidth` and bounding
boxes are all zero under Vitest. Geometry cannot be asserted there, and CI
(`.github/workflows/docker-build.yml`) runs `npm run lint` and `npm test` on a
runner with no browser. Adding Playwright to get real layout in CI is a larger
dependency decision than this work justifies, so:

- **Geometry checks live in a checked-in dev script**, `scripts/audit-mobile.mjs`,
  run by hand against the dev server. It loads each surface at 390×840 and
  fails on any element whose `scrollWidth` exceeds its `clientWidth` under
  hidden overflow, any element crossing the 390px boundary, any interactive
  element below 44×44, and any element rendering an empty text node where a
  label is expected. This is the same check that found the defects above, so it
  is also the regression guard for them.
- **CI keeps covering logic only** — the label fallback, the `DataList`
  breakpoint switch (with `useResponsive` mocked), and the nav model. No CI
  configuration changes, no new runtime or dev dependencies.

## Sequencing

Each phase is independently shippable; work can stop after any of them.

1. **Defect sweep** — items 1–9. Surgical, no new components.
2. **Navigation** — 4 tabs + More sheet, short labels, measured nav spacer.
3. **Kiosk polish** — date tabs, header, toast, collapsing order bar.
4. **Primitives** — `DataList`, `Sheet`, `TabHeader` with their unit tests.
5. **Tab migration** — Orders, History, Cards, Menu, then Settings, Parser
   Rules, Analytics.

## Out of scope

- Dark mode.
- Any change to business logic, pricing, ordering, or the parser.
- Tablet and desktop layouts, except where a shared component necessarily
  touches them. Those breakpoints must not regress.
