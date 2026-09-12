# Mobile Phone Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every surface of LunchPad below 768px render without truncated
text, with thumb-reachable navigation and phone-shaped layouts instead of
shrunken desktop ones.

**Architecture:** Fix seven measured defects first, then introduce three shared
components — `Sheet`, `DataList`, `TabHeader` — and apply them across the seven
dashboard tabs. The primitives exist so the phone layout is defined once rather
than re-invented per tab. A checked-in browser console script provides the
geometry regression guard that Vitest cannot, because happy-dom does not lay out.

**Tech Stack:** React 19, TypeScript, Tailwind 3.4, `motion/react`, Zustand,
Vitest + Testing Library + happy-dom, Vite 6.

**Source spec:** `docs/superpowers/specs/2026-09-11-mobile-phone-polish-design.md`

## Global Constraints

- Phone breakpoint is `< 768px` (`md`). Use `useResponsive()` for JS branches and Tailwind's `md:` prefix for CSS branches. Do not introduce a new breakpoint.
- Minimum interactive target is **44×44 px**, per `.touch-target` / `.touch-target-h` in `src/index.css`. Never satisfy it with rem units — `html` is `clamp(14px, 2vw, 16px)`, so rem shrinks on phones.
- **No new runtime or dev dependencies.** No CI configuration changes.
- Tablet (`md`–`lg`) and desktop (`lg+`) layouts must not regress. Where a shared component touches them, it renders exactly what the tab rendered before.
- No changes to business logic, pricing, ordering, or the parser.
- Every user-facing string goes through `t()` and is added to **both** `en` and `bg` in `src/translations.ts`.
- `t()` returns `undefined` for a missing key — never the key. Always guard with a falsy check, never by comparing against the key string.
- `npm run lint` (tsc) and `npm test` must pass before every commit.
- Commit messages end with the two attribution lines used by this repo:
  ```
  Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
  ```

## Deviation from the spec's phase order

The spec sequences `Sheet` in phase 4, but the navigation's "More" menu (phase 2)
consumes it. `Sheet` is therefore built in Phase 2 here, before navigation.
The audit script moves to Task 1 so it guards every task that follows.

---

## Phase 0 — The regression guard

### Task 1: Mobile geometry audit script

The checks that found every defect in the spec, made repeatable. happy-dom
returns `0` for `scrollWidth`, `clientWidth` and every bounding box, so these
assertions cannot live in Vitest, and CI has no browser. This is a browser
console script run by hand.

**Files:**
- Create: `scripts/audit-mobile.js`
- Modify: `README.md` (add a "Checking the phone layout" subsection)

**Interfaces:**
- Consumes: nothing.
- Produces: a global `__auditMobile(path?: string)` returning
  `Promise<{ path: string; viewport: {w: number; h: number}; findings: Finding[] }>`
  where `Finding` is
  `{ type: 'offscreen-x' | 'clipped-x' | 'empty-label' | 'small-target'; tag: string; cls: string; text: string; detail: string }`.
  Later tasks call it to verify their surface is clean.

- [ ] **Step 1: Write the script**

Create `scripts/audit-mobile.js`:

```js
/**
 * Phone-layout audit for LunchPad.
 *
 * happy-dom does not lay out, so scrollWidth, clientWidth and getBoundingClientRect
 * are all zero under Vitest — geometry cannot be asserted there. CI has no browser
 * either. So this runs by hand, in a real browser, against the dev server.
 *
 * Usage:
 *   1. npm run dev
 *   2. Open http://localhost:3400 in Chrome
 *   3. Paste this whole file into the devtools console
 *   4. await __auditMobile('/')                 // kiosk
 *      await __auditMobile('/?view=manager')    // dashboard (log in inside the frame first)
 *
 * It builds a 390x840 same-origin iframe — the narrowest phone the app targets —
 * and audits inside it, so resizing or docking the real browser window is not needed.
 */
(() => {
  const PHONE_W = 390;
  const PHONE_H = 840;
  const MIN_TARGET = 44;

  function audit(doc) {
    const W = doc.documentElement.clientWidth;
    const findings = [];
    const add = (type, el, text, detail) =>
      findings.push({
        type,
        tag: el.tagName,
        cls: String(el.className || '').slice(0, 70),
        text: String(text || '').trim().slice(0, 40),
        detail,
      });

    for (const el of doc.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const cs = getComputedStyle(el);

      // Anything crossing the viewport edge. A horizontal body scroll on a phone
      // is always a bug; the only legitimate sideways scrollers are opt-in.
      if (r.right > W + 1 || r.left < -1) {
        add('offscreen-x', el, el.textContent, `left=${Math.round(r.left)} right=${Math.round(r.right)} viewport=${W}`);
      }

      const ownsText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());

      // Text wider than its own clipped box — the literal "cut-off text" case.
      if (ownsText && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 1) {
        add('clipped-x', el, el.textContent, `scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth}`);
      }

      // A label element that renders nothing. This is what a t() miss looks like
      // in the DOM: the span exists, is styled, and is empty.
      const labelish = el.matches('span,h1,h2,h3,h4,label,th,td,p');
      if (labelish && !el.children.length && !el.textContent.trim() && r.width < 4) {
        add('empty-label', el, '', `width=${Math.round(r.width)}`);
      }
    }

    for (const el of doc.querySelectorAll('button,a,input,select,textarea,[role="button"]')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (el.hasAttribute('data-audit-ignore-size')) continue;
      if (r.width < MIN_TARGET || r.height < MIN_TARGET) {
        add('small-target', el, el.innerText || el.getAttribute('aria-label'),
            `${Math.round(r.width)}x${Math.round(r.height)} < ${MIN_TARGET}`);
      }
    }

    return findings;
  }

  window.__auditMobile = async function (path = '/') {
    document.querySelectorAll('iframe[data-audit-frame]').forEach((f) => f.remove());

    const frame = document.createElement('iframe');
    frame.setAttribute('data-audit-frame', '');
    frame.src = path;
    frame.width = String(PHONE_W);
    frame.height = String(PHONE_H);
    frame.style.cssText =
      'position:fixed;top:0;right:0;z-index:2147483647;border:2px solid #111;background:#fff';
    document.body.appendChild(frame);

    await new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
    // Let motion/react settle its enter animations before measuring; a mid-flight
    // height:auto transition reports a height nothing will ever render at.
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const findings = audit(frame.contentDocument);
    const report = { path, viewport: { w: PHONE_W, h: PHONE_H }, findings };

    if (findings.length) {
      console.warn(`[audit-mobile] ${findings.length} finding(s) at ${path}`);
      console.table(findings);
    } else {
      console.log(`[audit-mobile] clean at ${path} (${PHONE_W}x${PHONE_H})`);
    }
    return report;
  };

  console.log('[audit-mobile] ready — call await __auditMobile("/")');
})();
```

- [ ] **Step 2: Run it against the kiosk to confirm it reproduces the known defects**

Run `npm run dev`, open `http://localhost:3400`, paste the script, then:

```js
await __auditMobile('/')
```

Expected: it finds the category chips as `empty-label` and `small-target`
(28×44), and the RFID input as `small-target` (35px tall) once a cart exists.
If it reports clean, the script is wrong — the defects are still in the code at
this point.

- [ ] **Step 3: Document it in the README**

Add after the Docker deployment section:

```markdown
### Checking the phone layout

`scripts/audit-mobile.js` is a browser console script. It renders the app in a
390×840 iframe and reports text clipped by its own box, elements crossing the
viewport edge, labels that render empty, and interactive targets under 44×44.

```bash
npm run dev
```

Open <http://localhost:3400>, paste `scripts/audit-mobile.js` into the devtools
console, then:

```js
await __auditMobile('/')                // kiosk
await __auditMobile('/?view=manager')   // dashboard
```

It lives outside the test suite on purpose: `happy-dom` does not lay out, so
`scrollWidth` and `getBoundingClientRect` are zero under Vitest, and CI has no
browser to run a real one in.
```

- [ ] **Step 4: Commit**

```bash
git add scripts/audit-mobile.js README.md
git commit -m "$(cat <<'EOF'
test: add a phone-layout audit script

The checks that found the mobile defects, made repeatable. It cannot be a
Vitest test: happy-dom does not lay out, so scrollWidth, clientWidth and every
bounding box are zero there, and CI has no browser to run a real one in. So it
is a console script, run by hand, that builds a 390x840 same-origin iframe and
measures inside it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

## Phase 1 — Defect sweep

### Task 2: Category chips render their name

Spec defect #1. `t()` returns `undefined` for a missing key, but the caller
guards by comparing the result against the key string, so the `cat` fallback
never fires and `undefined` reaches the DOM. Database categories are `Soups`,
`Main Dishes`, `Side Dishes`; `translations.ts` defines `categories.soups` and
`categories.mains`. Every chip is blank, on every breakpoint.

**Files:**
- Create: `src/utils/categoryLabel.ts`
- Create: `src/utils/categoryLabel.test.ts`
- Modify: `src/components/kiosk/KioskCategorySidebar.tsx:93-100`

**Interfaces:**
- Consumes: `CustomCategory` from `src/types.ts`.
- Produces: `categoryLabel(cat: string, t: (k: string) => string | undefined, customCategories: CustomCategory[], lang: string): string` — always returns a non-empty string.

- [ ] **Step 1: Write the failing test**

Create `src/utils/categoryLabel.test.ts`:

```ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/utils/categoryLabel.test.ts`
Expected: FAIL — `Failed to resolve import "./categoryLabel"`.

- [ ] **Step 3: Write the implementation**

Create `src/utils/categoryLabel.ts`:

```ts
import { CustomCategory } from '../types';

/**
 * The display name for a menu category.
 *
 * Categories arrive from the parsed menu as free text ("Soups", "Main Dishes"),
 * while the translation keys are lowercase slugs ("categories.soups"), so the
 * lookup is case-insensitive and the raw name is always the last resort.
 *
 * useTranslation's t() returns undefined for a missing key — not the key — so
 * every branch here guards on falsiness. Comparing the result against the key
 * string is what previously let undefined reach the DOM and rendered every chip
 * blank.
 */
export function categoryLabel(
  cat: string,
  t: (key: string) => string | undefined,
  customCategories: CustomCategory[],
  lang: string,
): string {
  const custom = customCategories.find((c) => c.id === cat);
  if (custom) {
    return custom.names?.[lang] || custom.names?.en || custom.names?.bg || cat;
  }

  return t(`categories.${cat.toLowerCase()}`) || cat;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/utils/categoryLabel.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Use it in the sidebar**

In `src/components/kiosk/KioskCategorySidebar.tsx`, add the import beside the
existing `categoryAutobox` import:

```ts
import { categoryLabel } from "../../utils/categoryLabel";
```

Replace the IIFE at lines 93–100 — everything between `{(() => {` and `})()}` —
so the span body becomes a single call:

```tsx
                  {categoryLabel(cat, t, customCategories, lang)}
```

- [ ] **Step 6: Verify the whole suite and the types**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 7: Verify in the browser**

With `npm run dev` running, re-run `await __auditMobile('/')` from Task 1.
Expected: the `empty-label` findings for the category chips are gone, and the
chips now measure their text width rather than 28px.

- [ ] **Step 8: Commit**

```bash
git add src/utils/categoryLabel.ts src/utils/categoryLabel.test.ts src/components/kiosk/KioskCategorySidebar.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): render category names instead of nothing

t() returns undefined for a missing key, but the sidebar guarded by comparing
the result against the key string, so the raw-name fallback never fired and
undefined reached the DOM. Menu categories are "Soups" and "Main Dishes" while
the keys are lowercase slugs, so nothing matched: every chip rendered empty and
28px wide, on every breakpoint.

The lookup moves into categoryLabel(), is now case-insensitive, and falls back
to the raw category name whenever t() yields anything falsy.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 3: Kiosk header and toast respect the safe area

Spec defects #4 and #5. `h-16` with `pad-safe-top` subtracts the notch inset
from the 64px box instead of adding to it, squeezing the controls. The error
toast is anchored at a bare `top-14`, which puts it under the notch.

**Files:**
- Modify: `src/components/kiosk/KioskView.tsx:331`, `src/components/kiosk/KioskView.tsx:547`
- Modify: `src/index.css` (add `.inset-safe-top-14`)

**Interfaces:**
- Consumes: nothing.
- Produces: a `.inset-safe-top-14` utility, reused by any future top-anchored overlay.

- [ ] **Step 1: Add the utility**

In `src/index.css`, inside `@layer utilities`, directly after the existing
`.inset-safe-bottom` rule:

```css
  /* Top-anchored overlays. `top-14` alone puts a toast under the notch on a
     phone, because index.html sets viewport-fit=cover and the page extends
     beneath it. */
  .inset-safe-top-14 {
    top: calc(3.5rem + env(safe-area-inset-top, 0px));
  }
```

- [ ] **Step 2: Make the header grow by the inset rather than shrink into it**

`src/components/kiosk/KioskView.tsx:331` — change `h-16` to `min-h-16`:

```tsx
      <header className="min-h-16 shrink-0 glass-morphism flex items-center z-20 shadow-sm border-b-neutral-200/50 pad-safe-top">
```

- [ ] **Step 3: Re-anchor the error toast**

`src/components/kiosk/KioskView.tsx:547` — swap `top-14` for the new utility:

```tsx
            className="fixed inset-safe-top-14 left-1/2 -translate-x-1/2 bg-red-600 text-white px-5 py-2 rounded-full shadow-lg flex items-center gap-2 z-50 text-xs font-bold"
```

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

In Chrome devtools, toggle a device with a notch (iPhone 14 Pro) and confirm
the header controls keep their full height.

To make the toast appear, reproduce the offline-scan rejection that
`KioskView.test.tsx` covers: go offline in the Network panel, reload, then type
an RFID that is not in `localStorage.lunchpad_valid_rfids` followed by Enter.
The red toast should clear the notch.

- [ ] **Step 5: Commit**

```bash
git add src/index.css src/components/kiosk/KioskView.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): stop the notch eating the header and the error toast

index.html sets viewport-fit=cover, so the page runs under the notch. The
header combined a fixed h-16 with pad-safe-top, which subtracts the inset from
the 64px box rather than adding to it, squeezing the controls on every notched
phone; it is now min-h-16. The error toast was anchored at a bare top-14 and
landed underneath the notch; it now offsets by the inset.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 4: Remove the kiosk menu's dead bottom padding

Spec defect #3. `pb-[180px]` clears an order bar that is a normal-flow flex
sibling, not a fixed overlay, so it reserves 180px of empty scroll space in
every state.

**Files:**
- Modify: `src/components/kiosk/KioskItemList.tsx:82`

- [ ] **Step 1: Confirm the order bar is in normal flow**

Read `src/components/kiosk/KioskOrderBar.tsx`. Its root `motion.div` is
`className="shrink-0 w-full px-4 pb-4 pt-2 pad-safe-bottom"` — no `fixed`, no
`absolute`. It is rendered as a sibling of `<main>` inside the kiosk's
`flex flex-col` root in `KioskView.tsx`, so it already takes its own space.

- [ ] **Step 2: Drop the reservation**

`src/components/kiosk/KioskItemList.tsx:82`:

```tsx
      <div className="h-full overflow-y-auto no-scrollbar bg-[#F4F4F5] p-2 md:p-6">
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

In the browser at 390px: scroll the menu to the bottom with an empty cart and
confirm the last item sits just above the edge rather than 180px above it. Add
three items and confirm the list still scrolls fully and nothing is hidden
behind the order bar.

- [ ] **Step 4: Commit**

```bash
git add src/components/kiosk/KioskItemList.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): drop 180px of dead space under the menu

The padding cleared an order bar that is a normal-flow flex sibling rather than
a fixed overlay, so it already takes its own space. The reservation only ever
added empty scroll distance below the last item.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 5: Date tabs are reachable and fit a phone

Spec defect #6. `justify-center` on an `overflow-x-auto` flex row makes the
leading items overflow past `scrollLeft: 0`, where no scroll gesture can reach
them. Each tab is also `min-w-[120px]` while the phone header leaves about
250px between the icon clusters.

**Files:**
- Modify: `src/components/kiosk/KioskView.tsx:344-380`

- [ ] **Step 1: Switch the row to start-aligned, snapping scroll**

`src/components/kiosk/KioskView.tsx:344`:

```tsx
        <div
          ref={dateStripRef}
          className="flex-1 flex items-center justify-start md:justify-center px-4 overflow-x-auto no-scrollbar gap-2 snap-x snap-mandatory"
        >
```

- [ ] **Step 2: Narrow the tabs on phones and let them snap**

`src/components/kiosk/KioskView.tsx:355` — the button's className:

```tsx
                  className={`flex flex-col items-center justify-center min-w-[88px] md:min-w-[120px] h-12 rounded-2xl transition-all relative shrink-0 snap-start ${
```

- [ ] **Step 3: Scroll the active tab into view**

Add the ref and effect next to the other `useState`/`useRef` declarations in
`KioskView` (near the `rfidInputRef` declaration):

```tsx
  const dateStripRef = useRef<HTMLDivElement>(null);
```

And after the effect that syncs `selectedDate`:

```tsx
  // Keep the chosen day visible. The strip is start-aligned so that overflow
  // stays reachable by scrolling, which means the active tab is not centred for
  // free the way justify-center used to do it.
  React.useEffect(() => {
    const strip = dateStripRef.current;
    if (!strip || !selectedDate) return;
    const active = strip.querySelector<HTMLElement>('[data-date-active="true"]');
    active?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedDate]);
```

- [ ] **Step 4: Mark the active tab so the effect can find it**

On the same button, beside `key={date}`:

```tsx
                  data-date-active={isActive ? 'true' : 'false'}
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

In the browser at 390px with a menu containing four or more dates: confirm the
strip scrolls to both ends, that the first tab is reachable, and that selecting
a tab centres it.

- [ ] **Step 6: Commit**

```bash
git add src/components/kiosk/KioskView.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): make the leading date tabs reachable on a phone

justify-center on an overflow-x-auto flex row pushes the leading items past
scrollLeft 0, where no gesture can reach them — with four days of menu on a
390px phone the first day was simply unreachable. The strip is now start-
aligned below md, snaps, narrows its tabs to 88px, and scrolls the active day
into view.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 6: Dashboard content clears the bottom nav

Spec defects #2 and #7. `main` reserves `mb-16` (64px) for a nav that is 72px
plus `env(safe-area-inset-bottom)`, so the last row of every tab is covered.
The height is written down twice, which is why it drifted. `hide-scrollbar-on-mobile`
is applied and never defined.

**Files:**
- Modify: `src/components/manager/ManagerDashboard.tsx:41,187-215,223,263`
- Modify: `src/index.css`

**Interfaces:**
- Produces: a `--phone-nav-h` custom property on `document.documentElement`, with a `72px` fallback declared in `:root`.

- [ ] **Step 1: Declare the fallback**

In `src/index.css`, add to the existing `:root` block after `--app-max-width`:

```css
  /* Measured at runtime by ManagerDashboard's PhoneBottomNav. The fallback
     covers first paint and any render without a ResizeObserver. The height is
     deliberately not written down anywhere else: a second hardcoded copy is
     what let the content spacer drift out of step with the nav. */
  --phone-nav-h: 72px;
```

- [ ] **Step 2: Measure the nav into the property**

In `src/components/manager/ManagerDashboard.tsx`, replace the `PhoneBottomNav`
declaration at line 187 so it takes a ref and reports its height. Change the
opening of the component from:

```tsx
  const PhoneBottomNav = () => (
    <nav className="flex md:hidden fixed bottom-0 left-0 right-0 ...">
```

to a form that observes itself:

```tsx
  const navRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const publish = () =>
      document.documentElement.style.setProperty('--phone-nav-h', `${nav.offsetHeight}px`);
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(nav);
    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--phone-nav-h');
    };
  }, []);
```

and give the `<nav>` the ref:

```tsx
    <nav ref={navRef} className="flex md:hidden fixed bottom-0 left-0 right-0 ...">
```

- [ ] **Step 3: Pad the content by the measurement**

`src/components/manager/ManagerDashboard.tsx:223` — replace the hardcoded
`mb-16` and the duplicated safe-area padding:

```tsx
      <main
        className="flex-1 overflow-hidden flex flex-col relative w-full md:pb-0"
        style={{ paddingBottom: 'calc(var(--phone-nav-h, 72px) + env(safe-area-inset-bottom, 0px))' }}
      >
```

Note the nav already applies `pb-[env(safe-area-inset-bottom)]` to itself, so
`offsetHeight` includes the inset on a device that reports one. The `env()` in
the style above is therefore belt-and-braces for the fallback path only; keep
it, because the fallback is a bare `72px` with no inset baked in.

- [ ] **Step 4: Drop the undefined class**

`src/components/manager/ManagerDashboard.tsx:263` — remove `hide-scrollbar-on-mobile`:

```tsx
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 lg:p-10 relative z-10">
```

- [ ] **Step 5: Drop the unused responsive destructure**

`src/components/manager/ManagerDashboard.tsx:41` — `isPhone`, `isTablet` and
`isDesktop` are destructured and never read. Delete the line and the
`useResponsive` import at line 18 if nothing else in the file uses them (grep
first; Task 10 reintroduces the import, which is fine).

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

In the browser at 390px, logged into the dashboard: scroll any tab to the
bottom and confirm the last row clears the nav. Then in the console:

```js
getComputedStyle(document.documentElement).getPropertyValue('--phone-nav-h')
```

Expected: a measured pixel value, not the `72px` fallback.

- [ ] **Step 7: Commit**

```bash
git add src/index.css src/components/manager/ManagerDashboard.tsx
git commit -m "$(cat <<'EOF'
fix(dashboard): stop the bottom nav covering the last row

The content spacer reserved 64px for a nav that is 72px plus the safe-area
inset, so the bottom of every tab sat underneath it. The height was written
down in two places and the copies had drifted, so the nav now measures itself
into --phone-nav-h and the content pads by that, leaving one source of truth.

Also drops hide-scrollbar-on-mobile, which was applied here and defined
nowhere, and an unused useResponsive destructure.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 7: RFID input meets the touch floor

Spec defect #9. Measured 35px tall against the project's own 44px minimum.
`py-2.5` is rem-based, and `html` is `clamp(14px, 2vw, 16px)`, so it renders
12.5% smaller on a phone than the class implies.

**Files:**
- Modify: `src/components/kiosk/KioskOrderBar.tsx` (the RFID `<input>` className)

- [ ] **Step 1: Apply the existing floor utility**

In `src/components/kiosk/KioskOrderBar.tsx`, on the RFID `<input>`, add
`touch-target-h` to the className:

```tsx
                  className="w-full pl-9 pr-8 py-2.5 touch-target-h bg-neutral-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-all font-mono text-sm"
```

- [ ] **Step 2: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

Re-run `await __auditMobile('/')` with three items in the cart.
Expected: no `small-target` finding for the RFID input.

- [ ] **Step 3: Commit**

```bash
git add src/components/kiosk/KioskOrderBar.tsx
git commit -m "$(cat <<'EOF'
fix(kiosk): bring the RFID field up to the 44px touch floor

It measured 35px. py-2.5 is rem-based and html is clamp(14px, 2vw, 16px), so
the padding renders 12.5% smaller on a phone than the class suggests — which is
exactly why index.css defines .touch-target-h in px. Apply it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 8: Phase 1 verification gate

**Files:** none — verification only.

- [ ] **Step 1: Full suite**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 2: Audit both surfaces**

```js
await __auditMobile('/')
await __auditMobile('/?view=manager')
```

Expected: zero `empty-label` findings. Remaining findings should be only the
known Phase 2+ items: truncated nav labels (a `clipped-x` on the nav spans) and
the admin tables' `offscreen-x`. Record the list — it is the Phase 2 starting
point. If anything else appears, it is a regression from Phase 1; fix it before
proceeding.

---

## Phase 2 — The Sheet primitive

### Task 9: `<Sheet>` — bottom sheet on phones, dialog above `md`

Built before navigation because the "More" menu in Task 10 consumes it.

**Files:**
- Create: `src/components/shared/Sheet.tsx`
- Create: `src/components/shared/Sheet.test.tsx`

**Interfaces:**
- Consumes: `useResponsive` from `src/hooks/useResponsive`.
- Produces:

  ```ts
  interface SheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    /** Rendered in the header row, right of the title. */
    headerAction?: React.ReactNode;
    /** Max width of the md+ dialog. Default 'max-w-md'. */
    maxWidth?: string;
    children: React.ReactNode;
  }
  export const Sheet: React.FC<SheetProps>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/components/shared/Sheet.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from './Sheet';

const responsive = vi.hoisted(() => ({ value: { isPhone: true } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : 1280,
    height: 840,
    isPortrait: true,
    isLandscape: false,
    isPhone: responsive.value.isPhone,
    isTablet: false,
    isDesktop: !responsive.value.isPhone,
    useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone, xl: false, xxl: false,
  }),
}));

describe('Sheet', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
    document.body.style.overflow = '';
  });

  it('renders nothing when closed', () => {
    render(<Sheet isOpen={false} onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.queryByText('body')).not.toBeInTheDocument();
  });

  it('renders its title and children when open', () => {
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('is a dialog with an accessible name', () => {
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  });

  it('anchors to the bottom on a phone', () => {
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByTestId('sheet-panel').className).toContain('rounded-t-[28px]');
  });

  it('centres as a dialog above md', () => {
    responsive.value.isPhone = false;
    render(<Sheet isOpen onClose={vi.fn()} title="Settings">body</Sheet>);
    expect(screen.getByTestId('sheet-panel').className).toContain('rounded-[28px]');
    expect(screen.getByTestId('sheet-panel').className).not.toContain('rounded-t-[28px]');
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    render(<Sheet isOpen onClose={onClose} title="Settings">body</Sheet>);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Sheet isOpen onClose={onClose} title="Settings">body</Sheet>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(<Sheet isOpen onClose={vi.fn()} title="S">body</Sheet>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<Sheet isOpen={false} onClose={vi.fn()} title="S">body</Sheet>);
    expect(document.body.style.overflow).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/shared/Sheet.test.tsx`
Expected: FAIL — `Failed to resolve import "./Sheet"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/shared/Sheet.tsx`:

```tsx
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from '../../hooks/useTranslation';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Rendered in the header row, right of the title. */
  headerAction?: React.ReactNode;
  /** Max width of the md+ dialog. Ignored on a phone, where the sheet is full width. */
  maxWidth?: string;
  children: React.ReactNode;
}

/**
 * A bottom sheet below md, a centred dialog above it.
 *
 * Phones put a centred dialog's controls in the middle of the screen, out of
 * thumb reach, and its backdrop-dismiss target where the palm rests. A sheet
 * anchored to the bottom edge puts the actions where the thumb already is,
 * which is why every mobile OS converges on it.
 */
export const Sheet: React.FC<SheetProps> = ({
  isOpen,
  onClose,
  title,
  headerAction,
  maxWidth = 'max-w-md',
  children,
}) => {
  const { isPhone } = useResponsive();
  const { t } = useTranslation();
  const titleId = React.useId();

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`fixed inset-0 z-[100] flex ${isPhone ? 'items-end' : 'items-center justify-center p-4'}`}
        >
          <motion.div
            data-testid="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/40 backdrop-blur-md"
          />

          <motion.div
            data-testid="sheet-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? titleId : undefined}
            initial={isPhone ? { y: '100%' } : { scale: 0.94, opacity: 0, y: 16 }}
            animate={isPhone ? { y: 0 } : { scale: 1, opacity: 1, y: 0 }}
            exit={isPhone ? { y: '100%' } : { scale: 0.94, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className={`relative bg-white shadow-2xl flex flex-col ${
              isPhone
                ? 'w-full rounded-t-[28px] max-h-[88dvh] pad-safe-bottom'
                : `w-full ${maxWidth} rounded-[28px] max-h-[85dvh]`
            }`}
          >
            {isPhone && (
              <div className="shrink-0 flex justify-center pt-3 pb-1" aria-hidden="true">
                <div className="w-10 h-1 rounded-full bg-neutral-200" />
              </div>
            )}

            {(title || headerAction) && (
              <div className="shrink-0 flex items-center justify-between gap-3 px-6 pt-4 pb-3 border-b border-neutral-100">
                {title && (
                  <h2 id={titleId} className="text-lg font-black tracking-tight text-neutral-900 truncate">
                    {title}
                  </h2>
                )}
                <div className="flex items-center gap-2 shrink-0">
                  {headerAction}
                  <button
                    onClick={onClose}
                    className="touch-target flex items-center justify-center rounded-full bg-neutral-100 text-neutral-500 hover:text-neutral-900 transition-colors active:scale-95"
                    aria-label={t('modals.close') || 'Close'}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shared/Sheet.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 5: Verify the whole suite**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/Sheet.tsx src/components/shared/Sheet.test.tsx
git commit -m "$(cat <<'EOF'
feat(shared): add a Sheet that is a bottom sheet on phones

A centred dialog puts its controls mid-screen, out of thumb reach, and its
dismiss target under the palm. Sheet anchors to the bottom edge below md and
keeps the centred dialog above it, so the existing tablet and desktop layouts
are unchanged. It owns the backdrop, Escape, scroll locking, the safe-area
inset and the dialog role; callers supply a title and a body.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

## Phase 3 — Navigation

### Task 10: Short navigation labels

Spec defect #8. Six tabs share 390px — about 65px each — at `text-[9px]` with
`truncate`. `Управление на менюто` is 20 characters; roughly twelve fit.

**Files:**
- Modify: `src/translations.ts` (the `en` `navigation` block at line 3, the `bg` one at line 514)

**Interfaces:**
- Produces: `navigation.menu_short`, `.orders_short`, `.history_short`, `.cards_short`, `.more` in both languages.

- [ ] **Step 1: Add the English keys**

In `src/translations.ts`, inside the `en` `navigation` block (starts line 3),
after `menu_management`:

```ts
      menu_short: 'Menu',
      orders_short: 'Orders',
      history_short: 'History',
      cards_short: 'Cards',
      more: 'More',
```

- [ ] **Step 2: Add the Bulgarian keys**

Inside the `bg` `navigation` block (starts line 514), after `menu_management`:

```ts
      menu_short: 'Меню',
      orders_short: 'Поръчки',
      history_short: 'История',
      cards_short: 'Карти',
      more: 'Още',
```

- [ ] **Step 3: Verify**

Run: `npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/translations.ts
git commit -m "$(cat <<'EOF'
i18n: add short navigation labels for the phone bottom nav

The full labels are up to 22 characters and the phone nav gives each tab about
65px, so every one truncated to an ellipsis. The long forms stay in use for the
desktop sidebar and the tablet bar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 11: Bottom nav becomes four tabs plus More

**Files:**
- Modify: `src/components/manager/ManagerDashboard.tsx` (`menuItems`, `PhoneBottomNav`, the phone-only header buttons at lines ~247-265)
- Create: `src/components/manager/ManagerDashboard.test.tsx`

**Interfaces:**
- Consumes: `Sheet` from Task 9; the `navigation.*_short` and `navigation.more` keys from Task 10.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

Create `src/components/manager/ManagerDashboard.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ManagerDashboard } from './ManagerDashboard';

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: 390, height: 840, isPortrait: true, isLandscape: false,
    isPhone: true, isTablet: false, isDesktop: false, useMobileLayout: true,
    sm: false, md: false, lg: false, xl: false, xxl: false,
  }),
}));

const props = {
  activeTab: 'menu' as const,
  onTabChange: vi.fn(),
  onLogout: vi.fn(),
  kioskOpen: true,
  onToggleKiosk: vi.fn(),
  children: <div>content</div>,
};

const PRIMARY = ['Menu', 'Orders', 'History', 'Cards'];

describe('ManagerDashboard phone navigation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows exactly four primary tabs plus More', () => {
    render(<ManagerDashboard {...props} />);
    const nav = screen.getByTestId('phone-bottom-nav');
    PRIMARY.forEach((label) => expect(within(nav).getByText(label)).toBeInTheDocument());
    expect(within(nav).getByText('More')).toBeInTheDocument();
    expect(within(nav).getAllByRole('button')).toHaveLength(5);
  });

  it('keeps every primary label short enough not to truncate', () => {
    render(<ManagerDashboard {...props} />);
    const nav = screen.getByTestId('phone-bottom-nav');
    [...PRIMARY, 'More'].forEach((label) =>
      expect(within(nav).getByText(label).textContent!.length).toBeLessThanOrEqual(8),
    );
  });

  it('routes a primary tab tap to onTabChange', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('Orders'));
    expect(props.onTabChange).toHaveBeenCalledWith('orders');
  });

  it('opens a sheet with the secondary destinations', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('More'));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText('Analytics')).toBeInTheDocument();
    expect(within(sheet).getByText('Parser Rules')).toBeInTheDocument();
    expect(within(sheet).getByText('System Settings')).toBeInTheDocument();
  });

  it('routes a secondary destination and closes the sheet', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('More'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Analytics'));
    expect(props.onTabChange).toHaveBeenCalledWith('analytics');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('offers logout from the More sheet', () => {
    render(<ManagerDashboard {...props} />);
    fireEvent.click(within(screen.getByTestId('phone-bottom-nav')).getByText('More'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Logout'));
    expect(props.onLogout).toHaveBeenCalledTimes(1);
  });

  it('reaches every destination from the phone nav', () => {
    render(<ManagerDashboard {...props} />);
    const nav = screen.getByTestId('phone-bottom-nav');
    ['Menu', 'Orders', 'History', 'Cards'].forEach((l) => fireEvent.click(within(nav).getByText(l)));
    fireEvent.click(within(nav).getByText('More'));
    ['Analytics', 'Parser Rules', 'System Settings'].forEach((l) =>
      fireEvent.click(within(screen.getByRole('dialog')).getByText(l)),
    );
    const reached = props.onTabChange.mock.calls.map(([tab]) => tab);
    expect(new Set(reached)).toEqual(
      new Set(['menu', 'orders', 'history', 'cards', 'analytics', 'parser_rules', 'settings']),
    );
  });
});
```

The test asserts English labels, which is the store's default `lang`. If the
default is `bg`, set it in a `beforeEach` with
`useStore.setState({ lang: 'en' })` and import `useStore` from `../../store/useStore`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/manager/ManagerDashboard.test.tsx`
Expected: FAIL — `Unable to find an element by: [data-testid="phone-bottom-nav"]`.

- [ ] **Step 3: Split the destinations**

In `src/components/manager/ManagerDashboard.tsx`, after the existing
`menuItems` array, add:

```tsx
  // Four is what fits at 390px without truncating: five cells leave 78px each,
  // and the longest short label ("Поръчки") needs about 52px at text-[10px].
  const PRIMARY_TABS = ['menu', 'orders', 'history', 'cards'] as const;

  const shortLabels: Record<string, string> = {
    menu: t('navigation.menu_short'),
    orders: t('navigation.orders_short'),
    history: t('navigation.history_short'),
    cards: t('navigation.cards_short'),
  };

  const primaryItems = menuItems.filter((i) => (PRIMARY_TABS as readonly string[]).includes(i.id));
  const secondaryItems = menuItems.filter((i) => !(PRIMARY_TABS as readonly string[]).includes(i.id));

  const [moreOpen, setMoreOpen] = React.useState(false);
```

Add the `Sheet` and `MoreHorizontal` imports at the top of the file:

```tsx
import { MoreHorizontal } from 'lucide-react';
import { Sheet } from '../shared/Sheet';
```

(`MoreHorizontal` joins the existing `lucide-react` import block.)

- [ ] **Step 4: Rewrite `PhoneBottomNav`**

Replace the whole `PhoneBottomNav` component (line 187 through its closing
`);`) with:

```tsx
  const PhoneBottomNav = () => (
    <nav
      ref={navRef}
      data-testid="phone-bottom-nav"
      className="flex md:hidden fixed bottom-0 left-0 right-0 bg-white/85 backdrop-blur-3xl border-t border-white/60 z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-16px_50px_rgba(0,0,0,0.1)]"
    >
      <div className="flex w-full justify-around items-center h-[72px] px-1 relative">
        {primaryItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as any)}
              aria-current={isActive ? 'page' : undefined}
              className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 active:scale-95 transition-transform"
            >
              <div className={`p-1 transition-all z-10 ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                <item.icon className="w-5 h-5 flex-shrink-0" />
              </div>
              {isActive && (
                <motion.div
                  layoutId="mobile-nav-pill"
                  className="absolute inset-x-2 inset-y-2 bg-neutral-900/5 rounded-2xl z-0 pointer-events-none"
                  transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                />
              )}
              <span className={`text-[10px] font-bold z-10 text-center transition-colors ${isActive ? 'text-neutral-900' : 'text-neutral-400'}`}>
                {shortLabels[item.id]}
              </span>
            </button>
          );
        })}

        <button
          onClick={() => setMoreOpen(true)}
          className="relative flex flex-col items-center justify-center flex-1 h-full gap-1 active:scale-95 transition-transform"
        >
          <div className={`p-1 transition-all z-10 ${secondaryItems.some((i) => i.id === activeTab) ? 'text-neutral-900' : 'text-neutral-400'}`}>
            <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className={`text-[10px] font-bold z-10 text-center transition-colors ${secondaryItems.some((i) => i.id === activeTab) ? 'text-neutral-900' : 'text-neutral-400'}`}>
            {t('navigation.more')}
          </span>
        </button>
      </div>
    </nav>
  );
```

Note `truncate` is gone from the label span — with the short labels there is
nothing to truncate, and leaving it in would silently hide a future regression.

- [ ] **Step 5: Add the More sheet**

Immediately after `<PhoneBottomNav />` at the end of the component's JSX:

```tsx
      <Sheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} title={t('navigation.more')}>
        <div className="flex flex-col gap-1">
          {secondaryItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id as any);
                  setMoreOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 touch-target-h rounded-xl transition-all active:scale-[0.98] ${
                  isActive ? 'bg-neutral-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                }`}
              >
                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-neutral-400'}`} />
                <span className="font-bold text-sm text-left">{item.label}</span>
              </button>
            );
          })}

          <div className="h-px bg-neutral-100 my-2" />

          <button
            onClick={() => {
              setMoreOpen(false);
              onLogout();
            }}
            className="w-full flex items-center gap-3 px-4 touch-target-h text-red-500 rounded-xl hover:bg-red-50 transition-all font-bold text-sm active:scale-[0.98]"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span>{t('navigation.logout')}</span>
          </button>
        </div>
      </Sheet>
```

- [ ] **Step 6: Remove the now-duplicated header buttons**

The phone-only settings and logout buttons in the header (the
`<div className="flex md:hidden items-center gap-1.5 mr-1 border-r border-neutral-200 pr-2">`
block around lines 247–265) are subsumed by the More sheet. Delete the whole
block. This also frees header width, which the kiosk-status pill needs.

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run src/components/manager/ManagerDashboard.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 8: Verify the whole suite and the browser**

Run: `npm test && npm run lint`
Expected: PASS.

Then `await __auditMobile('/?view=manager')`.
Expected: no `clipped-x` findings on the nav.

- [ ] **Step 9: Commit**

```bash
git add src/components/manager/ManagerDashboard.tsx src/components/manager/ManagerDashboard.test.tsx
git commit -m "$(cat <<'EOF'
feat(dashboard): four tabs plus a More sheet on phones

Six tabs across 390px gave each about 65px, and the Bulgarian labels run to 22
characters, so every one rendered as an ellipsis. The nav now carries four
primary destinations with short labels and a More sheet holding Analytics,
Parser Rules, Settings and Logout — which also retires the phone-only settings
and logout buttons that were crowding the header.

The truncate class is deliberately gone from the labels: with short labels
there is nothing to truncate, and keeping it would hide a future regression.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

## Phase 4 — Kiosk order bar

### Task 12: Collapsing order bar

Spec defect #12. The bar measures 227px with three items — 27% of an 840px
screen — and is always fully expanded.

**Files:**
- Modify: `src/components/kiosk/KioskOrderBar.tsx`
- Create: `src/components/kiosk/KioskOrderBar.test.tsx`
- Modify: `src/translations.ts` (`kiosk.show_items`, `kiosk.hide_items`)

**Interfaces:**
- Consumes: the existing `KioskOrderBarProps` — unchanged, so `KioskView` needs no edit.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Add the translation keys**

In `src/translations.ts`, in the `en` `kiosk` block:

```ts
      show_items: 'Show items',
      hide_items: 'Hide items',
```

and in the `bg` `kiosk` block:

```ts
      show_items: 'Покажи артикулите',
      hide_items: 'Скрий артикулите',
```

- [ ] **Step 2: Write the failing test**

Create `src/components/kiosk/KioskOrderBar.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KioskOrderBar } from './KioskOrderBar';

const t = (k: string) => k;

const item = (id: number, name: string) => ({
  id, name, price: 5, basePrice: 5, available: true, category: 'Main',
  tags: [], extraFees: [], quantity: 1,
}) as any;

const base = {
  selectedItems: [item(1, 'Soup'), item(2, 'Salad')],
  totalPrice: 10,
  rfid: 'abc',
  setRfid: vi.fn(),
  rfidInputRef: React.createRef<HTMLInputElement>(),
  isScanning: false,
  computedKioskOpen: true,
  testModeEnabled: false,
  orderButtonEnabled: true,
  onOrder: vi.fn(),
  onClearCart: vi.fn(),
  onChangeSide: vi.fn(),
  t,
};

describe('KioskOrderBar', () => {
  it('renders nothing with an empty cart', () => {
    render(<KioskOrderBar {...base} selectedItems={[]} />);
    expect(screen.queryByText('kiosk.place_order')).not.toBeInTheDocument();
  });

  it('shows the total and the order button while collapsed', () => {
    render(<KioskOrderBar {...base} />);
    expect(screen.getByText('€10.00')).toBeInTheDocument();
    expect(screen.getByText('kiosk.place_order')).toBeInTheDocument();
  });

  it('hides the item list until expanded', () => {
    render(<KioskOrderBar {...base} />);
    expect(screen.queryByText('Soup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('order-bar-toggle'));
    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('Salad')).toBeInTheDocument();
  });

  it('collapses again on a second tap', () => {
    render(<KioskOrderBar {...base} />);
    fireEvent.click(screen.getByTestId('order-bar-toggle'));
    fireEvent.click(screen.getByTestId('order-bar-toggle'));
    expect(screen.queryByText('Soup')).not.toBeInTheDocument();
  });

  it('keeps the order button reachable without expanding', () => {
    render(<KioskOrderBar {...base} />);
    fireEvent.click(screen.getByText('kiosk.place_order'));
    expect(base.onOrder).toHaveBeenCalled();
  });

  it('exposes the toggle state to assistive tech', () => {
    render(<KioskOrderBar {...base} />);
    const toggle = screen.getByTestId('order-bar-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/components/kiosk/KioskOrderBar.test.tsx`
Expected: FAIL on the collapse cases — the item list renders unconditionally
and there is no `order-bar-toggle`.

- [ ] **Step 4: Implement the collapse**

In `src/components/kiosk/KioskOrderBar.tsx`, add the state and the auto-expand
above the `orderDisabled` computation:

```tsx
  // Collapsed by default: fully expanded the bar took 227px of an 840px phone
  // screen. It opens itself once, the first time something is added, so the
  // cart is not a mystery box; after that the customer decides.
  const [expanded, setExpanded] = React.useState(false);
  const hasOpenedOnce = React.useRef(false);

  React.useEffect(() => {
    if (selectedItems.length > 0 && !hasOpenedOnce.current) {
      hasOpenedOnce.current = true;
      setExpanded(true);
    }
    if (selectedItems.length === 0) {
      hasOpenedOnce.current = false;
      setExpanded(false);
    }
  }, [selectedItems.length]);
```

Wrap the existing item list — the
`<div className="max-h-32 overflow-y-auto custom-scrollbar space-y-2">` block
and the `<div className="h-px bg-neutral-100" />` divider that follows it — in
an animated container, and add the toggle above it. Replace the opening of the
card's inner content so it reads:

```tsx
          <div className="bg-white/95 backdrop-blur-lg rounded-3xl shadow-2xl border border-neutral-200/80 px-5 py-4 flex flex-col gap-3">
            <button
              data-testid="order-bar-toggle"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="flex items-center justify-between gap-2 touch-target-h -my-1 text-left"
            >
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">
                {expanded ? t('kiosk.hide_items') : t('kiosk.show_items')}
              </span>
              <ChevronRight className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? '-rotate-90' : 'rotate-90'}`} />
            </button>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  {/* existing item list block goes here, unchanged */}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="h-px bg-neutral-100" />
```

Move the existing `max-h-32` item list `<div>` inside the `motion.div`. Leave
the totals-and-actions row that follows exactly as it is — it is the collapsed
state, and it already wraps correctly at phone width.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/kiosk/KioskOrderBar.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

In the browser at 390px: add an item and confirm the bar opens once, then
collapses on tap and stays collapsed while more items are added. Measure it:

```js
document.querySelector('[data-testid="order-bar-toggle"]').closest('.rounded-3xl').getBoundingClientRect().height
```

Expected: under 120px collapsed.

- [ ] **Step 7: Commit**

```bash
git add src/components/kiosk/KioskOrderBar.tsx src/components/kiosk/KioskOrderBar.test.tsx src/translations.ts
git commit -m "$(cat <<'EOF'
feat(kiosk): collapse the order bar to a summary row

With three items the bar took 227px of an 840px phone screen — 27% of the
viewport permanently spent on a list the customer had just built. It now shows
the total, the count and the order button, expanding to the itemised list on
tap. It opens itself once on the first item so the cart is not a mystery box.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

## Phase 5 — The remaining primitives

### Task 13: `<DataList>` — table above `md`, cards below

Spec defect #10. Four admin tables carry `min-w-[500..640px]` inside
`overflow-x-auto`, so a phone reads them by scrolling sideways.

**Files:**
- Create: `src/components/shared/DataList.tsx`
- Create: `src/components/shared/DataList.test.tsx`

**Interfaces:**
- Consumes: `useResponsive`.
- Produces:

  ```ts
  export interface DataListColumn {
    key: string;
    label: string;
    align?: 'left' | 'center' | 'right';
    /** Phone presentation. 'title' is the card heading, 'body' a label/value
     *  pair, 'meta' a muted footer entry. Default 'body'. */
    role?: 'title' | 'body' | 'meta';
    /** Omit from the phone card entirely. Still rendered in the table. */
    hideOnPhone?: boolean;
    /** Renders a sort affordance in the table header and on the phone control row. */
    sortable?: boolean;
    onSort?: () => void;
    sortDirection?: 'asc' | 'desc' | null;
  }

  export interface DataListRow {
    key: string | number;
    cells: Record<string, React.ReactNode>;
    actions?: React.ReactNode;
    expandedContent?: React.ReactNode;
    isExpanded?: boolean;
    onClick?: () => void;
  }

  export interface DataListProps {
    columns: DataListColumn[];
    rows: DataListRow[];
    emptyMessage: string;
    /** Extra classes for the table element, e.g. a min-width for desktop. */
    tableClassName?: string;
  }
  export const DataList: React.FC<DataListProps>;
  ```

Cells passed in must **not** carry `<td>` layout classes (`p-6`, `text-right`,
`p-5`). `DataList` owns padding and alignment in both modes; leftover cell
padding is what makes a card look like a table fragment.

- [ ] **Step 1: Write the failing test**

Create `src/components/shared/DataList.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DataList, DataListColumn, DataListRow } from './DataList';

const responsive = vi.hoisted(() => ({ value: { isPhone: true } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : 1280,
    height: 840, isPortrait: true, isLandscape: false,
    isPhone: responsive.value.isPhone, isTablet: false,
    isDesktop: !responsive.value.isPhone, useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone, xl: false, xxl: false,
  }),
}));

const columns: DataListColumn[] = [
  { key: 'name', label: 'Name', role: 'title' },
  { key: 'price', label: 'Price', align: 'right' },
  { key: 'status', label: 'Status', role: 'meta' },
  { key: 'internal', label: 'Internal', hideOnPhone: true },
];

const rows: DataListRow[] = [
  {
    key: 1,
    cells: { name: 'Soup', price: '€1.80', status: 'Available', internal: 'id-1' },
    actions: <button>Edit</button>,
  },
  {
    key: 2,
    cells: { name: 'Salad', price: '€2.50', status: 'Sold out', internal: 'id-2' },
  },
];

describe('DataList', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
  });

  it('renders a table above md', () => {
    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(3); // header + 2
  });

  it('renders cards and no table on a phone', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('datalist-card')).toHaveLength(2);
  });

  it('shows every non-hidden column value on the phone card', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('Soup')).toBeInTheDocument();
    expect(screen.getByText('€1.80')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('omits hideOnPhone columns from the card but keeps them in the table', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.queryByText('id-1')).not.toBeInTheDocument();

    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('id-1')).toBeInTheDocument();
  });

  it('labels body cells on the card so a value is never orphaned', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getAllByText('Price').length).toBeGreaterThan(0);
  });

  it('renders row actions on the card', () => {
    render(<DataList columns={columns} rows={rows} emptyMessage="Nothing here" />);
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('shows the empty message in both modes', () => {
    const { unmount } = render(<DataList columns={columns} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    unmount();

    responsive.value.isPhone = false;
    render(<DataList columns={columns} rows={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('renders expanded content when a row is expanded', () => {
    const expandable: DataListRow[] = [
      { key: 1, cells: { name: 'Soup', price: '€1.80', status: 'x', internal: 'y' },
        isExpanded: true, expandedContent: <div>breakdown</div> },
    ];
    render(<DataList columns={columns} rows={expandable} emptyMessage="none" />);
    expect(screen.getByText('breakdown')).toBeInTheDocument();
  });

  it('fires onClick from a card', () => {
    const onClick = vi.fn();
    render(
      <DataList
        columns={columns}
        rows={[{ key: 1, cells: { name: 'Soup', price: '', status: '', internal: '' }, onClick }]}
        emptyMessage="none"
      />,
    );
    fireEvent.click(screen.getByTestId('datalist-card'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('exposes sortable columns on the phone', () => {
    const onSort = vi.fn();
    const sortable: DataListColumn[] = [
      { key: 'name', label: 'Name', role: 'title', sortable: true, onSort, sortDirection: 'asc' },
    ];
    render(<DataList columns={sortable} rows={[{ key: 1, cells: { name: 'Soup' } }]} emptyMessage="none" />);
    fireEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/components/shared/DataList.test.tsx`
Expected: FAIL — `Failed to resolve import "./DataList"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/shared/DataList.tsx`:

```tsx
import React from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';

export interface DataListColumn {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  /**
   * How the cell presents on a phone card. 'title' becomes the card heading,
   * 'body' a label/value pair, 'meta' a muted footer entry.
   */
  role?: 'title' | 'body' | 'meta';
  /** Omit from the phone card. Still rendered in the table. */
  hideOnPhone?: boolean;
  sortable?: boolean;
  onSort?: () => void;
  sortDirection?: 'asc' | 'desc' | null;
}

export interface DataListRow {
  key: string | number;
  cells: Record<string, React.ReactNode>;
  actions?: React.ReactNode;
  expandedContent?: React.ReactNode;
  isExpanded?: boolean;
  onClick?: () => void;
}

export interface DataListProps {
  columns: DataListColumn[];
  rows: DataListRow[];
  emptyMessage: string;
  /** Extra classes for the table element, e.g. a desktop min-width. */
  tableClassName?: string;
}

const alignClass = (align?: DataListColumn['align']) =>
  align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

/**
 * A table above md, a stacked card list below it.
 *
 * The four admin tables carried min-widths of 500–640px inside an
 * overflow-x-auto, so reading a row on a phone meant scrolling sideways and
 * losing the row header. Cards keep every value labelled and on screen.
 *
 * Cells must arrive without <td> layout classes: this component owns padding
 * and alignment in both modes.
 */
export const DataList: React.FC<DataListProps> = ({
  columns,
  rows,
  emptyMessage,
  tableClassName = '',
}) => {
  const { isPhone } = useResponsive();

  if (!isPhone) {
    return (
      <div className="overflow-x-auto">
        <table className={`w-full text-left border-collapse ${tableClassName}`}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={col.sortable ? col.onSort : undefined}
                  className={`p-6 font-serif italic text-xs uppercase tracking-widest text-neutral-400 border-b border-neutral-100 ${alignClass(col.align)} ${
                    col.sortable ? 'cursor-pointer hover:text-neutral-900 transition-colors' : ''
                  }`}
                >
                  <span className={`inline-flex items-center gap-2 ${col.align === 'center' ? 'justify-center' : ''}`}>
                    {col.label}
                    {col.sortable && (
                      <ArrowUpDown
                        className={`w-3 h-3 transition-opacity ${col.sortDirection ? 'opacity-100' : 'opacity-30'}`}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <React.Fragment key={row.key}>
                <tr
                  onClick={row.onClick}
                  className={`transition-colors ${row.onClick ? 'cursor-pointer' : ''} ${
                    row.isExpanded ? 'bg-neutral-50' : 'hover:bg-neutral-50'
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`p-6 ${alignClass(col.align)}`}>
                      {col.key === '__actions' ? row.actions : row.cells[col.key]}
                    </td>
                  ))}
                </tr>
                {row.isExpanded && row.expandedContent && (
                  <tr>
                    <td colSpan={columns.length} className="p-0 bg-neutral-50 border-b border-neutral-100">
                      {row.expandedContent}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-12 text-center text-neutral-400 italic text-sm">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  const visible = columns.filter((col) => !col.hideOnPhone);
  const titleCols = visible.filter((col) => col.role === 'title');
  const bodyCols = visible.filter((col) => !col.role || col.role === 'body');
  const metaCols = visible.filter((col) => col.role === 'meta');
  const sortCols = columns.filter((col) => col.sortable);

  if (rows.length === 0) {
    return <p className="p-12 text-center text-neutral-400 italic text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col">
      {sortCols.length > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pt-4 pb-1">
          {sortCols.map((col) => (
            <button
              key={col.key}
              onClick={col.onSort}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 touch-target-h rounded-full text-[11px] font-bold uppercase tracking-wider transition-colors ${
                col.sortDirection ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'
              }`}
            >
              {col.label}
              <ArrowUpDown className={`w-3 h-3 ${col.sortDirection === 'desc' ? 'rotate-180' : ''}`} />
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col divide-y divide-neutral-100">
        {rows.map((row) => (
          <div key={row.key} className={row.isExpanded ? 'bg-neutral-50' : ''}>
            <div
              data-testid="datalist-card"
              onClick={row.onClick}
              className={`flex flex-col gap-2 px-4 py-4 ${row.onClick ? 'cursor-pointer active:bg-neutral-50' : ''}`}
            >
              {titleCols.map((col) => (
                <div key={col.key} className="text-base font-bold text-neutral-900 leading-snug">
                  {row.cells[col.key]}
                </div>
              ))}

              {bodyCols.length > 0 && (
                <dl className="flex flex-col gap-1.5">
                  {bodyCols.map((col) => (
                    <div key={col.key} className="flex items-start justify-between gap-4">
                      <dt className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400 shrink-0 pt-0.5">
                        {col.label}
                      </dt>
                      <dd className="text-sm text-neutral-900 text-right min-w-0 flex-1">
                        {row.cells[col.key]}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}

              {metaCols.length > 0 && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400">
                  {metaCols.map((col) => (
                    <span key={col.key}>{row.cells[col.key]}</span>
                  ))}
                </div>
              )}

              {row.actions && (
                <div className="flex flex-wrap items-center gap-2 pt-1">{row.actions}</div>
              )}
            </div>

            {row.isExpanded && row.expandedContent && (
              <div className="border-t border-neutral-100">{row.expandedContent}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

Note the `__actions` column key: a tab that wants an actions *column* in the
table adds `{ key: '__actions', label: t('cards.actions'), align: 'center' }`
to `columns` and puts the buttons in `row.actions`. The table renders them in
that column; the card renders them in its action row. No tab needs to supply
the buttons twice.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/shared/DataList.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 5: Verify the whole suite**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/shared/DataList.tsx src/components/shared/DataList.test.tsx
git commit -m "$(cat <<'EOF'
feat(shared): add DataList — table above md, cards below

The four admin tables carry min-widths of 500-640px inside an overflow-x-auto,
so reading one row on a phone means scrolling sideways and losing the column
headers on the way. DataList keeps the existing table markup above md and
stacks each row into a labelled card below it, so no value is ever orphaned
from its header.

Cells arrive without <td> classes; the component owns padding and alignment in
both modes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 14: `<TabHeader>` — title, primary action, overflow

Spec defect #11. `MenuTab` renders five buttons plus two inline numeric fee
fields in one `flex-wrap` row, which stacks into a tall column on a phone.

**Files:**
- Create: `src/components/shared/TabHeader.tsx`
- Create: `src/components/shared/TabHeader.test.tsx`
- Modify: `src/translations.ts` (`navigation.actions`)

**Interfaces:**
- Consumes: `useResponsive`, `Sheet` (Task 9).
- Produces:

  ```ts
  export interface TabHeaderAction {
    key: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    onClick: () => void;
    isDestructive?: boolean;
    hidden?: boolean;
  }

  export interface TabHeaderProps {
    title: string;
    subtitle?: string;
    /** Always visible, at every width. */
    primaryAction?: TabHeaderAction;
    /** Inline above md; collapsed into a sheet below it. */
    secondaryActions?: TabHeaderAction[];
    /** Arbitrary controls (fee inputs, filters). Inline above md, in the sheet below. */
    controls?: React.ReactNode;
  }
  export const TabHeader: React.FC<TabHeaderProps>;
  ```

- [ ] **Step 1: Add the translation key**

`src/translations.ts`, `en` `navigation` block:

```ts
      actions: 'Actions',
```

`bg` `navigation` block:

```ts
      actions: 'Действия',
```

- [ ] **Step 2: Write the failing test**

Create `src/components/shared/TabHeader.test.tsx`:

```tsx
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { TabHeader } from './TabHeader';

const responsive = vi.hoisted(() => ({ value: { isPhone: true } }));

vi.mock('../../hooks/useResponsive', () => ({
  useResponsive: () => ({
    width: responsive.value.isPhone ? 390 : 1280,
    height: 840, isPortrait: true, isLandscape: false,
    isPhone: responsive.value.isPhone, isTablet: false,
    isDesktop: !responsive.value.isPhone, useMobileLayout: responsive.value.isPhone,
    sm: true, md: !responsive.value.isPhone, lg: !responsive.value.isPhone, xl: false, xxl: false,
  }),
}));

const secondary = [
  { key: 'paste', label: 'Paste Menu', onClick: vi.fn() },
  { key: 'backup', label: 'Restore Backup', onClick: vi.fn() },
];

describe('TabHeader', () => {
  beforeEach(() => {
    responsive.value.isPhone = true;
    vi.clearAllMocks();
  });

  it('renders the title and subtitle', () => {
    render(<TabHeader title="Menu Management" subtitle="Edit today's menu" />);
    expect(screen.getByText('Menu Management')).toBeInTheDocument();
    expect(screen.getByText("Edit today's menu")).toBeInTheDocument();
  });

  it('always shows the primary action', () => {
    const onClick = vi.fn();
    render(<TabHeader title="T" primaryAction={{ key: 'add', label: 'Add Item', onClick }} />);
    fireEvent.click(screen.getByText('Add Item'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('hides secondary actions behind an overflow button on a phone', () => {
    render(<TabHeader title="T" secondaryActions={secondary} />);
    expect(screen.queryByText('Paste Menu')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(within(screen.getByRole('dialog')).getByText('Paste Menu')).toBeInTheDocument();
  });

  it('runs a secondary action and closes the sheet', () => {
    render(<TabHeader title="T" secondaryActions={secondary} />);
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Paste Menu'));
    expect(secondary[0].onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders secondary actions inline above md', () => {
    responsive.value.isPhone = false;
    render(<TabHeader title="T" secondaryActions={secondary} />);
    expect(screen.getByText('Paste Menu')).toBeInTheDocument();
    expect(screen.queryByTestId('tabheader-overflow')).not.toBeInTheDocument();
  });

  it('omits hidden actions entirely', () => {
    render(<TabHeader title="T" secondaryActions={[{ key: 'x', label: 'Delete All', onClick: vi.fn(), hidden: true }]} />);
    expect(screen.queryByTestId('tabheader-overflow')).not.toBeInTheDocument();
  });

  it('puts controls in the sheet on a phone and inline above md', () => {
    render(<TabHeader title="T" controls={<input aria-label="Fee" />} secondaryActions={secondary} />);
    expect(screen.queryByLabelText('Fee')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tabheader-overflow'));
    expect(within(screen.getByRole('dialog')).getByLabelText('Fee')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/components/shared/TabHeader.test.tsx`
Expected: FAIL — `Failed to resolve import "./TabHeader"`.

- [ ] **Step 4: Write the implementation**

Create `src/components/shared/TabHeader.tsx`:

```tsx
import React from 'react';
import { MoreHorizontal } from 'lucide-react';
import { useResponsive } from '../../hooks/useResponsive';
import { useTranslation } from '../../hooks/useTranslation';
import { Sheet } from './Sheet';

export interface TabHeaderAction {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  isDestructive?: boolean;
  hidden?: boolean;
}

export interface TabHeaderProps {
  title: string;
  subtitle?: string;
  /** Always visible, at every width. */
  primaryAction?: TabHeaderAction;
  /** Inline above md; collapsed into a sheet below it. */
  secondaryActions?: TabHeaderAction[];
  /** Arbitrary controls — fee inputs, filters. Inline above md, in the sheet below. */
  controls?: React.ReactNode;
}

/**
 * A tab's title row.
 *
 * Above md everything renders inline, exactly as the tabs did by hand. Below
 * md only the title and one primary action stay on screen and the rest moves
 * into a sheet, because MenuTab's seven controls otherwise wrap into a column
 * taller than the content they act on.
 */
export const TabHeader: React.FC<TabHeaderProps> = ({
  title,
  subtitle,
  primaryAction,
  secondaryActions = [],
  controls,
}) => {
  const { isPhone } = useResponsive();
  const { t } = useTranslation();
  const [overflowOpen, setOverflowOpen] = React.useState(false);

  const visibleSecondary = secondaryActions.filter((a) => !a.hidden);
  const hasOverflow = isPhone && (visibleSecondary.length > 0 || !!controls);

  const button = (action: TabHeaderAction, variant: 'primary' | 'secondary') => {
    const Icon = action.icon;
    return (
      <button
        key={action.key}
        onClick={action.onClick}
        className={`flex items-center gap-2 px-5 touch-target-h rounded-xl font-bold transition-all text-sm ${
          action.isDestructive
            ? 'bg-red-50 border border-red-100 text-red-600 hover:bg-red-100'
            : variant === 'primary'
              ? 'bg-neutral-900 text-white hover:bg-neutral-800 shadow-md shadow-neutral-200'
              : 'bg-white border border-neutral-200 text-neutral-900 hover:bg-neutral-50 shadow-sm'
        }`}
      >
        {Icon && <Icon className="w-4 h-4" />}
        {action.label}
      </button>
    );
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl md:text-4xl font-black tracking-tighter text-neutral-900">{title}</h1>
          {subtitle && <p className="text-neutral-500 text-sm md:text-base">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isPhone && controls}
          {!isPhone && visibleSecondary.map((a) => button(a, 'secondary'))}
          {primaryAction && button(primaryAction, 'primary')}
          {hasOverflow && (
            <button
              data-testid="tabheader-overflow"
              onClick={() => setOverflowOpen(true)}
              aria-label={t('navigation.actions')}
              className="touch-target flex items-center justify-center rounded-xl bg-white border border-neutral-200 text-neutral-600 shadow-sm active:scale-95 transition-transform"
            >
              <MoreHorizontal className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <Sheet isOpen={overflowOpen} onClose={() => setOverflowOpen(false)} title={t('navigation.actions')}>
        <div className="flex flex-col gap-3">
          {controls}
          {visibleSecondary.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.key}
                onClick={() => {
                  setOverflowOpen(false);
                  action.onClick();
                }}
                className={`w-full flex items-center gap-3 px-4 touch-target-h rounded-xl font-bold text-sm transition-all active:scale-[0.98] ${
                  action.isDestructive ? 'text-red-600 hover:bg-red-50' : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                {Icon && <Icon className="w-5 h-5 shrink-0" />}
                <span className="text-left">{action.label}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </>
  );
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/components/shared/TabHeader.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 6: Verify the whole suite**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/shared/TabHeader.tsx src/components/shared/TabHeader.test.tsx src/translations.ts
git commit -m "$(cat <<'EOF'
feat(shared): add TabHeader with a phone overflow sheet

MenuTab renders five buttons and two inline fee inputs in one flex-wrap row,
which on a phone stacks into a column taller than the table underneath it.
TabHeader keeps the title and one primary action on screen and moves the rest
into a sheet below md, while rendering everything inline above md exactly as
the tabs do today.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

## Phase 6 — Tab migration

Each migration follows the same shape, so they are ordered simplest first: the
implementer learns the pattern on `HistoryTab` before meeting `CardsTab`'s
inline editing or `MenuTab`'s row component.

### Task 15: HistoryTab

**Files:**
- Modify: `src/components/manager/tabs/HistoryTab.tsx:136-185`

**Interfaces:**
- Consumes: `DataList`, `DataListColumn`, `DataListRow` from Task 13.

- [ ] **Step 1: Import the primitive**

```tsx
import { DataList, DataListColumn, DataListRow } from '../../shared/DataList';
```

- [ ] **Step 2: Build the column model**

Inside the component, above the return:

```tsx
  const columns: DataListColumn[] = [
    { key: 'when', label: t('orders.timestamp'), role: 'title' },
    { key: 'who', label: t('orders.cardholder') },
    { key: 'items', label: t('orders.items') },
    { key: 'total', label: t('orders.total'), align: 'right' },
  ];

  const rows: DataListRow[] = (Array.isArray(history) ? history : []).map((order) => ({
    key: order.id,
    cells: {
      when: (
        <>
          <p className="font-bold text-neutral-900">{formatDate(order.timestamp)}</p>
          <p className="text-[10px] text-neutral-400 font-mono">
            {new Date(order.timestamp).toLocaleTimeString()}
          </p>
        </>
      ),
      who: (
        <>
          <p className="font-bold text-neutral-900">{order.ownerName ?? t('menu.unknown_user')}</p>
          <p className="text-[10px] text-neutral-400 font-mono">{order.rfid ?? 'N/A'}</p>
        </>
      ),
      items: (
        <div className="space-y-1 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
          {Array.isArray(order.items) ? (
            order.items.map((i: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center gap-4 text-xs">
                <span className="font-bold text-neutral-900 truncate">{i.name}</span>
                <span className="text-neutral-400 font-mono">x{i.quantity || 1}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-neutral-400 italic">{t('menu.no_items')}</p>
          )}
        </div>
      ),
      total: (
        <span className="font-mono font-bold text-neutral-900">
          €{(Number(order.totalPrice) || 0).toFixed(2)}
        </span>
      ),
    },
  }));
```

Note the `p-6` and `text-right` classes from the old `<td>`s are gone — `DataList`
supplies both.

- [ ] **Step 3: Replace the table**

Replace lines 136–185 — from `<div className="overflow-x-auto">` through
`</table>` and its closing `</div>` — with:

```tsx
        <DataList
          columns={columns}
          rows={rows}
          emptyMessage={t('menu.no_history')}
          tableClassName="min-w-[600px]"
        />
```

Keep the surrounding
`<div className="bg-white rounded-3xl shadow-sm border border-neutral-200 overflow-hidden">`
wrapper.

- [ ] **Step 4: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

At 1280px the table looks exactly as before. At 390px each order is a card with
the timestamp as its heading. Run `await __auditMobile('/?view=manager')` on
the History tab.
Expected: no `offscreen-x` findings.

- [ ] **Step 5: Commit**

```bash
git add src/components/manager/tabs/HistoryTab.tsx
git commit -m "$(cat <<'EOF'
refactor(history): render order history as cards on a phone

The table carried min-w-[600px] inside an overflow-x-auto, so a 390px screen
read it by scrolling sideways. It now goes through DataList: the same table
above md, labelled cards below it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 16: OrdersTab

The only table with expandable rows, which is why it follows `HistoryTab`.

**Files:**
- Modify: `src/components/manager/tabs/OrdersTab.tsx:92-105` and the expanded-row block that follows

- [ ] **Step 1: Import the primitive**

```tsx
import { DataList, DataListColumn, DataListRow } from '../../shared/DataList';
```

- [ ] **Step 3: Build the column model**

```tsx
  const columns: DataListColumn[] = [
    { key: 'date', label: t('orders.date'), role: 'title' },
    { key: 'people', label: t('navigation.order_summary'), align: 'center' },
    { key: 'total', label: t('orders.total'), align: 'right' },
  ];

  const rows: DataListRow[] = (Array.isArray(summaries) ? summaries : []).map((summary) => ({
    key: summary.date,
    isExpanded: expandedDate === summary.date,
    onClick: () => onExpandDate(summary.date),
    cells: {
      date: (
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
            expandedDate === summary.date ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-400'
          }`}>
            <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${
              expandedDate === summary.date ? 'rotate-90' : ''
            }`} />
          </div>
          <span className="font-bold text-neutral-900">
            {summary.date ? formatDate(summary.date) : t('menu.unknown_date')}
          </span>
        </div>
      ),
      people: (
        <div className="flex flex-col items-center">
          <span className="px-4 py-1.5 bg-neutral-100 rounded-full font-mono font-bold text-neutral-900">
            {Number(summary.uniqueUserCount) || 0}
          </span>
          <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider mt-1">
            {Number(summary.orderCount) || 0} {t('orders.quantity').toLowerCase()}
          </span>
        </div>
      ),
      total: (
        <span className="font-mono font-bold text-neutral-900">
          €{(Number(summary?.totalSales) || 0).toFixed(2)}
        </span>
      ),
    },
    expandedContent: renderBreakdown(summary),
  }));
```

- [ ] **Step 2: Extract the expanded block into `renderBreakdown`**

Do this before the column model below, which calls it.

The existing expanded row is a `<tr><td colSpan={3}>` wrapping a `motion.div`
with the items breakdown and the delivery-fee controls. Move that `motion.div`
— unchanged, minus the `<tr>`/`<td>` wrapper — into a function above the
`columns` declaration:

```tsx
  const renderBreakdown = (summary: any) => (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="p-4 md:p-8"
    >
      {/* the existing breakdown JSX, verbatim */}
    </motion.div>
  );
```

Change the `p-8` to `p-4 md:p-8`: 32px of padding on each side of a 390px
screen leaves 326px for a fee input and two buttons. Change the breakdown's
inner `flex justify-between items-center mb-6` to
`flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6`, and
drop `min-w-[140px]` from the fee field's wrapper so it can go full width.

- [ ] **Step 4: Replace the table**

Replace the `<div className="overflow-x-auto">` … `</table></div>` block with:

```tsx
        <DataList
          columns={columns}
          rows={rows}
          emptyMessage={t('menu.no_history')}
          tableClassName="min-w-[500px]"
        />
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

At 390px: tapping a date card expands the breakdown beneath it; the fee input
and its buttons stack and are each at least 44px tall.

- [ ] **Step 6: Commit**

```bash
git add src/components/manager/tabs/OrdersTab.tsx
git commit -m "$(cat <<'EOF'
refactor(orders): render the daily summary as cards on a phone

Moves the table through DataList and lifts the expanded breakdown out of its
colSpan row into renderBreakdown, so it renders under the card on a phone and
inside the table above md. The breakdown's fee controls stack below md instead
of squeezing a 140px input and two buttons into 326px.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 17: CardsTab

The most involved migration: sortable headers plus per-row inline editing.

**Files:**
- Modify: `src/components/manager/tabs/CardsTab.tsx:330-420` (the table)
- Modify: `src/components/manager/tabs/CardsTab.test.tsx` if its assertions
  depend on table markup — read it first and update selectors rather than
  weakening the assertions.

- [ ] **Step 1: Read the existing test**

Run: `cat src/components/manager/tabs/CardsTab.test.tsx`

Note which queries target `<table>`, `<tr>` or `<td>`. Those need new
selectors after the migration; the behaviour they assert must not change.

- [ ] **Step 2: Import the primitive**

```tsx
import { DataList, DataListColumn, DataListRow } from '../../shared/DataList';
```

- [ ] **Step 3: Build the column model**

The existing header maps five sortable columns plus an actions column.
`DataList` carries the sort affordance, so `toggleSort` and `sortConfig` stay
exactly as they are:

```tsx
  const sortDir = (key: keyof Card) =>
    sortConfig.key === key ? (sortConfig.direction as 'asc' | 'desc') : null;

  const columns: DataListColumn[] = [
    { key: 'ownerName', label: t('cards.owner_name'), role: 'title', sortable: true, onSort: () => toggleSort('ownerName'), sortDirection: sortDir('ownerName') },
    { key: 'rfid', label: t('cards.rfid'), sortable: true, onSort: () => toggleSort('rfid'), sortDirection: sortDir('rfid') },
    { key: 'pin', label: 'PIN', sortable: true, onSort: () => toggleSort('hasPin'), sortDirection: sortDir('hasPin') },
    { key: 'isAdmin', label: t('cards.admin'), align: 'center', sortable: true, onSort: () => toggleSort('isAdmin'), sortDirection: sortDir('isAdmin') },
    { key: 'balance', label: t('cards.owed'), align: 'center', sortable: true, onSort: () => toggleSort('balance'), sortDirection: sortDir('balance') },
    { key: '__actions', label: t('cards.actions'), align: 'center' },
  ];
```

Owner name becomes the card title and moves first; RFID drops to a body row.
On a phone the person's name is the identifier that matters, and a hex tag is
a poor heading.

- [ ] **Step 4: Build the rows**

Map `filteredAndSortedCards` to `DataListRow[]`, moving each existing `<td>`'s
inner JSX into the matching `cells` key **without** its `p-6` / `text-center`
classes, and the action buttons into `actions`. Keep every handler
(`startEditing`, `setEditValues`, the admin toggle, save and delete) exactly as
it is — this is a presentation change only.

The PIN input is `w-20`; leave it, it is already inside the 44px floor via its
own padding, but add `touch-target-h` so the audit script passes:

```tsx
      className={`w-20 px-2 touch-target-h rounded-lg border font-mono text-center text-xs outline-none transition-all ${isEditing ? 'bg-white border-neutral-900 ring-1 ring-neutral-900' : 'bg-neutral-50 border-neutral-200'}`}
```

- [ ] **Step 5: Replace the table**

```tsx
            <DataList
              columns={columns}
              rows={rows}
              emptyMessage={t('cards.no_cards') || t('menu.no_items_yet')}
              tableClassName="min-w-[500px]"
            />
```

If `cards.no_cards` does not exist, add it to both languages rather than
leaving the `||` fallback in place.

- [ ] **Step 6: Verify**

Run: `npx vitest run src/components/manager/tabs/CardsTab.test.tsx && npm test && npm run lint`
Expected: PASS.

At 390px: each card shows the owner as a heading, sort chips scroll across the
top, editing a name or PIN works inline, and the action buttons sit in their
own row.

- [ ] **Step 7: Commit**

```bash
git add src/components/manager/tabs/CardsTab.tsx src/components/manager/tabs/CardsTab.test.tsx
git commit -m "$(cat <<'EOF'
refactor(cards): render the card list as cards on a phone

Moves the table through DataList, which carries the sort affordance into a
scrollable chip row below md. Owner name becomes the card heading and the RFID
drops to a body row: on a phone the person is the identifier that matters, and
a hex tag makes a poor heading. Inline editing and every handler are unchanged.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 18: MenuTab

**Files:**
- Modify: `src/components/manager/tabs/MenuTab.tsx` — the toolbar (lines ~326–412), the table (lines ~415–450), and `MenuRow`

- [ ] **Step 1: Replace the toolbar with `TabHeader`**

Import:

```tsx
import { TabHeader } from '../../shared/TabHeader';
```

Replace the title block and the `<div className="flex flex-wrap gap-3">` toolbar
with:

```tsx
      <TabHeader
        title={t('navigation.menu_management')}
        subtitle={t('menu.management_desc')}
        primaryAction={{ key: 'add', label: t('menu.add_item') || 'Add Item', icon: Plus, onClick: onAddItem }}
        secondaryActions={[
          { key: 'paste', label: t('menu.paste_title') || 'Paste Menu Text', icon: FileText, onClick: () => setIsPasteOpen(true) },
          { key: 'backups', label: t('menu.backups') || 'Restore Backup', icon: History, onClick: openBackupsModal },
          {
            key: 'delete-all',
            label: t('menu.delete_all') || 'Delete All',
            icon: Trash2,
            isDestructive: true,
            hidden: editingMenu.length === 0,
            onClick: () =>
              confirm({
                title: t('modals.remove_item') || 'Reset Menu',
                message: t('modals.reset_warning') || 'Are you sure you want to delete all items?',
                isDestructive: true,
                onConfirm: () => onDeleteAll(),
              }),
          },
        ]}
        controls={
          <>
            {/* the two existing fee pills, verbatim */}
          </>
        }
      />
```

Move the delivery-fee and packaging-fee pills — the two
`<div className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 rounded-xl shadow-sm">`
blocks — into `controls` unchanged, except: on the numeric `<input>`s, change
`w-16` to `w-16 touch-target-h` so they clear the floor inside the sheet.

- [ ] **Step 2: Convert `MenuRow` to a cells factory**

`MenuRow` currently returns a `<tr>`. Change it to a function returning the
cells object, so both modes share it. Rename it `menuRowCells` and have it
return `Record<string, React.ReactNode>`, moving each `<td>`'s inner JSX across
without the `p-5` classes. Its props stay identical.

- [ ] **Step 3: Build the column model and replace the table**

```tsx
  const columns: DataListColumn[] = [
    { key: 'name', label: t('menu.name'), role: 'title' },
    { key: 'category', label: t('menu.category') },
    { key: 'price', label: t('menu.price'), align: 'right' },
    { key: 'side', label: t('menu.included_side') || 'Included Side' },
    { key: 'status', label: t('menu.status'), role: 'meta' },
    { key: '__actions', label: t('cards.actions'), align: 'center' },
  ];

  const rows: DataListRow[] = editingMenu.map((item) => ({
    key: item.id,
    cells: menuRowCells({ item, customCategories, getCategoryLabel, onUpdateItem, isSideDishCategoryId, editingMenu, t }),
    actions: <MenuRowActions item={item} onRemoveItem={onRemoveItem} t={t} />,
  }));
```

Name moves ahead of category, for the same reason as CardsTab: the dish is what
identifies the row.

Replace the `overflow-x-auto` table block with:

```tsx
        <DataList
          columns={columns}
          rows={rows}
          emptyMessage={t('menu.no_items_yet')}
          tableClassName="min-w-[640px]"
        />
```

Extract the row's delete button into a small `MenuRowActions` component beside
`menuRowCells`.

- [ ] **Step 4: Convert the paste and backups modals to `Sheet`**

Both are hand-rolled `fixed inset-0` overlays (the paste modal starts around
line 452). Replace each outer `AnimatePresence`/`motion.div` pair with:

```tsx
      <Sheet isOpen={isPasteOpen} onClose={() => setIsPasteOpen(false)} title={t('menu.paste_title')} maxWidth="max-w-3xl">
        {/* the existing body, minus its own header and close button */}
      </Sheet>
```

`Sheet` supplies the header, the close button, the backdrop and Escape, so
delete the hand-rolled versions rather than nesting them.

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

At 390px: the header is a title plus "Add Item" plus an overflow button; the
fee pills and the other three actions live in the sheet; menu items are cards.
At 1280px the tab is visually unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/components/manager/tabs/MenuTab.tsx
git commit -m "$(cat <<'EOF'
refactor(menu): phone layout for the menu editor

The toolbar put five buttons and two fee inputs in one wrapping row, which on a
phone stacked taller than the table it acted on; it now goes through TabHeader,
with the fee pills and secondary actions in an overflow sheet. The table goes
through DataList, so MenuRow becomes a cells factory shared by both modes, and
the paste and backup overlays become Sheets.

Item name leads the row now, ahead of category: the dish is what identifies it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 19: Shared modals become Sheets

**Files:**
- Modify: `src/components/shared/ConfirmModal.tsx`
- Modify: `src/components/shared/PinPadModal.tsx`
- Modify: `src/components/kiosk/UserHistoryModal.tsx`
- Modify: `src/components/manager/modals/NfcWriteModal.tsx`

- [ ] **Step 1: Read the existing tests first**

Run: `cat src/components/manager/modals/NfcWriteModal.test.tsx`

Update its selectors if it targets the hand-rolled overlay markup. Behaviour
must not change.

- [ ] **Step 2: Convert each modal**

For each file, replace the outer `AnimatePresence` + backdrop `motion.div` +
panel `motion.div` with a `Sheet`, keeping the body JSX and every handler:

```tsx
    <Sheet isOpen={!!config} onClose={onClose} title={config?.title}>
      {/* existing body */}
    </Sheet>
```

`PinPadModal`'s keypad is `grid-cols-3` with no responsive prefix — that is
correct for a keypad at every width, so leave it. Give each key
`touch-target` if it does not have it.

`UserHistoryModal` has a `w-[200px]` element; make it `w-full sm:w-[200px]`.

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

At 390px each modal rises from the bottom edge; at 1280px each is a centred
dialog as before.

- [ ] **Step 4: Commit**

```bash
git add src/components/shared/ConfirmModal.tsx src/components/shared/PinPadModal.tsx src/components/kiosk/UserHistoryModal.tsx src/components/manager/modals/NfcWriteModal.tsx
git commit -m "$(cat <<'EOF'
refactor(modals): route the shared modals through Sheet

Four hand-rolled fixed-inset overlays, each with its own backdrop, close button
and animation, become one Sheet call apiece — a bottom sheet on a phone and the
same centred dialog above md. Escape handling and scroll locking come for free,
which two of the four did not have.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 20: SettingsTab and ParserRulesTab

Neither has a table, and — checked against the files rather than assumed —
neither has a toolbar either. `SettingsTab`'s header is a title and subtitle
with no buttons, and `ParserRulesTab` has no tab-level header at all (no `<h1>`;
its headings are per-section). So `TabHeader` applies to `SettingsTab` only, for
consistency of type scale, and `ParserRulesTab` needs fixed-width controls made
fluid instead.

**Files:**
- Modify: `src/components/manager/tabs/SettingsTab.tsx` (header block, and lines 248, 271)
- Modify: `src/components/manager/tabs/ParserRulesTab.tsx:1256, 1929, 1933, 1957, 1982`

- [ ] **Step 1: Use `TabHeader` for the SettingsTab title**

Import it:

```tsx
import { TabHeader } from '../../shared/TabHeader';
```

Replace the header block — the
`<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">`
wrapper and its contents — with:

```tsx
      <TabHeader title={t('navigation.system_settings')} subtitle={t('settings.global_desc')} />
```

There are no actions to pass: this header has never had buttons. The point is
the shared type scale and spacing, so Settings stops being the one tab with a
`text-3xl` title where every other tab uses `text-2xl md:text-4xl`.

- [ ] **Step 2: Make the SettingsTab language control fluid**

Line 248 — the dropdown trigger is pinned at `w-[200px]`:

```tsx
                    className="flex items-center justify-between w-full sm:w-[200px] px-4 touch-target-h bg-neutral-50 border border-neutral-200 rounded-2xl font-bold text-sm text-neutral-900 hover:border-neutral-900 transition-all focus:outline-none"
```

Line 271 — the dropdown panel is pinned at `w-[240px]`:

```tsx
                          className="absolute bottom-full mb-2 left-0 right-0 sm:right-auto sm:w-[240px] bg-white border border-neutral-100 rounded-3xl shadow-2xl z-50 overflow-hidden p-2"
```

- [ ] **Step 3: Give the settings cards phone padding**

The cards are `bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm`.
32px of padding each side of a 390px screen leaves 326px of content. Change
every occurrence in this file to:

```tsx
className="bg-white p-5 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm"
```

Run `grep -n 'p-8 rounded-\[40px\]' src/components/manager/tabs/SettingsTab.tsx`
first to get the full list, and change each one.

- [ ] **Step 4: Make the ParserRulesTab rule grid stack**

Line 1256 is a three-column header row that cannot fit 390px:

```tsx
          <div className="col-span-full hidden md:grid grid-cols-[1fr_auto_auto] gap-4 px-3 pb-1 border-b border-neutral-100">
```

Hiding it below `md` is correct only if the rows beneath it stack and carry
their own labels. Find the matching rule-row grid (it uses the same
`grid-cols-[1fr_auto_auto]` template) and change it to:

```tsx
className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-2 md:gap-4 px-3 py-2"
```

- [ ] **Step 5: Let the rule preview wrap instead of hiding itself**

Lines 1929, 1933, 1957 and 1982 put `truncate` with `max-w-[35%]` or
`max-w-[40%]` on `<code>` elements showing a rule's before/after text. At 390px
that is roughly 136–156px — about eighteen monospace characters — so the
preview truncates away the very thing the panel exists to show.

Replace `truncate max-w-[35%]` with:

```tsx
break-all max-w-[45%] md:max-w-[35%]
```

and `truncate max-w-[40%]` with:

```tsx
break-all max-w-[45%] md:max-w-[40%]
```

- [ ] **Step 6: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

`await __auditMobile('/?view=manager&tab=settings')` and
`await __auditMobile('/?view=manager&tab=parser_rules')`.
Expected: no `offscreen-x` and no `clipped-x` findings.

- [ ] **Step 7: Commit**

```bash
git add src/components/manager/tabs/SettingsTab.tsx src/components/manager/tabs/ParserRulesTab.tsx
git commit -m "$(cat <<'EOF'
fix(settings,parser): make the fixed-width controls fluid on a phone

The language dropdown was pinned at 200px and its panel at 240px, the settings
cards spent 64px of a 390px screen on padding, and the parser rule rows were a
three-column grid that cannot fit a phone.

The rule preview is the worst of them: it truncated its before/after codes at
35% of the width, about eighteen monospace characters on a phone, hiding the
one thing that panel exists to show. Those now wrap.

SettingsTab also moves to TabHeader, which only normalises its type scale - it
has no toolbar buttons to collapse. ParserRulesTab has no tab-level header at
all, so it gets none.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 21: AnalyticsTab charts

Checked against the file: `AnalyticsTab` renders **no `<Legend />` at all** —
four `ResponsiveContainer`s at `width="100%" height="100%"` inside fixed `h-80`
divs. The spec's "move the legends below the plot" does not apply; there are no
legends to move. The real phone squeeze is elsewhere, and this task fixes what
is actually there.

Two vertical `BarChart`s (`analytics.popular_meals` at line ~165 and
`analytics.popular_sides` at ~181) use `YAxis width={100}` with
`margin={{ top: 0, right: 30, left: 40, bottom: 0 }}`. Inside a `p-8` card on a
390px screen the plot is 326px wide, of which 170px is axis label plus margin —
leaving about 156px of actual bar. The bars are less than half the chart.

**Files:**
- Modify: `src/components/manager/tabs/AnalyticsTab.tsx` (the four chart cards, the two `BarChart`s, and the table at line 137)

- [ ] **Step 1: Give the chart cards phone padding**

All four cards are `bg-white p-8 rounded-[40px] border border-neutral-200 shadow-sm`.
Change each to:

```tsx
className="bg-white p-4 md:p-8 rounded-[28px] md:rounded-[40px] border border-neutral-200 shadow-sm"
```

That returns 32px of plot width. Also change each card's heading from
`text-xl font-bold text-neutral-900 mb-8` to
`text-lg md:text-xl font-bold text-neutral-900 mb-4 md:mb-8`.

- [ ] **Step 2: Reclaim the bar charts' axis width on a phone**

Add the hook at the top of the component, beside the existing hooks:

```tsx
import { useResponsive } from '../../../hooks/useResponsive';
```

```tsx
  const { isPhone } = useResponsive();
```

Verify that relative path against the file's other imports — `AnalyticsTab` is
at `src/components/manager/tabs/`, so `../../../hooks/useResponsive` is correct.

For **both** vertical `BarChart`s, replace the fixed axis width and margin:

```tsx
                  <BarChart
                    data={data.popularMeals}
                    layout="vertical"
                    margin={isPhone ? { top: 0, right: 8, left: 0, bottom: 0 } : { top: 0, right: 30, left: 40, bottom: 0 }}
                  >
```

and the `YAxis`:

```tsx
                    <YAxis
                      dataKey="name"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 'bold' }}
                      width={isPhone ? 72 : 100}
                    />
```

Apply the same change to the `data.popularSides` chart, which is identical
apart from `dataKey` and `fill`.

- [ ] **Step 3: Shorten the chart bodies on a phone**

Each chart sits in a `<div className="h-80">`. 320px of chart plus a heading
plus card padding is most of a phone screen per chart, with four charts
stacked. Change each to:

```tsx
              <div className="h-64 md:h-80">
```

- [ ] **Step 4: Route the summary table through DataList**

The table at line 137 (`<table className="w-full text-left text-sm">`) has no
`min-w`, so on a phone it squeezes its columns rather than scrolling — which is
how its numbers end up wrapping mid-value. Convert it following the pattern in
Task 15: read its `<thead>` for the column labels, build a `DataListColumn[]`
with the first column as `role: 'title'`, map its rows into `cells` with the
`<td>` padding classes stripped, and replace the `<table>` with:

```tsx
                <DataList
                  columns={columns}
                  rows={rows}
                  emptyMessage={t('menu.no_history')}
                />
```

Import it:

```tsx
import { DataList, DataListColumn, DataListRow } from '../../shared/DataList';
```

- [ ] **Step 5: Verify**

Run: `npm test && npm run lint`
Expected: PASS.

At 390px, measure a bar chart's usable plot in the console:

```js
document.querySelector('.recharts-wrapper').getBoundingClientRect().width
```

Expected: at least 320px, with the category labels no wider than 72px of it.

`await __auditMobile('/?view=manager&tab=analytics')`.
Expected: no findings.

- [ ] **Step 6: Commit**

```bash
git add src/components/manager/tabs/AnalyticsTab.tsx
git commit -m "$(cat <<'EOF'
fix(analytics): give the charts room on a phone

The two vertical bar charts reserved a 100px category axis plus 70px of margin
inside a p-8 card, so on a 390px screen 170px of a 326px plot was spent before
a single bar was drawn. The axis and margins now shrink below md and the cards
drop to p-4, which roughly doubles the bar area.

The charts carry no legends, so there was nothing to reposition - the squeeze
was all axis and padding. The summary table, which has no min-width and so
squeezed rather than scrolled, goes through DataList.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01GZSfApK7rgKUAz45Cr8B6Z
EOF
)"
```

---

### Task 22: Final verification gate

**Files:** none — verification only.

- [ ] **Step 1: Full suite**

Run: `npm test && npm run lint`
Expected: PASS.

- [ ] **Step 2: Audit every surface**

With `npm run dev` running and the script pasted:

```js
await __auditMobile('/')
await __auditMobile('/?view=manager&tab=menu')
await __auditMobile('/?view=manager&tab=orders')
await __auditMobile('/?view=manager&tab=history')
await __auditMobile('/?view=manager&tab=cards')
await __auditMobile('/?view=manager&tab=analytics')
await __auditMobile('/?view=manager&tab=parser_rules')
await __auditMobile('/?view=manager&tab=settings')
```

Expected: zero findings on every surface. The dashboard paths need a logged-in
session in the iframe; log in once inside the frame and re-run.

- [ ] **Step 3: Confirm the larger breakpoints did not regress**

At 1280px and at 800px, walk every dashboard tab and the kiosk. Compare against
`git stash`-ing the branch or against the pre-work commit. Nothing above `md`
should look different except MenuTab's toolbar, which is now `TabHeader`'s
inline rendering of the same buttons.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: succeeds. `DataList`, `Sheet` and `TabHeader` are small and live in
the entry chunk; confirm no lazy chunk grew unexpectedly.

---

## Self-review notes

**Spec coverage.** Every numbered defect maps to a task: #1→2, #2→6, #3→4,
#4→3, #5→3, #6→5, #7→6, #8→10+11, #9→7, #10→13+15..18+21, #11→14+18,
#12→12, #13→9+19. The three primitives are tasks 9, 13, 14. Navigation is
10–11. The audit script is task 1. Testing is per-task plus gates at 8 and 22.

**Two spec claims were wrong and are corrected in both documents.** The spec
said `AnalyticsTab`'s legends should move below the plot; it renders no
legends, and Task 21 fixes the axis-and-padding squeeze that is actually there.
The spec said `ParserRulesTab` gets a `TabHeader`; it has no tab-level header to
replace, so Task 20 gives it none. Both were caught by reading the files while
writing the tasks, which is why every step quotes real line numbers.

**Known deviation.** `Sheet` is built in Phase 2 rather than the spec's Phase 4,
because the More menu consumes it. Recorded at the top of this plan.

**Type consistency.** `DataListColumn` / `DataListRow` / `DataListProps` are
defined once in Task 13 and used unchanged in Tasks 15–18 and 21.
`TabHeaderAction` / `TabHeaderProps` are defined in Task 14 and used in 18 and
20. `SheetProps` is defined in Task 9 and used in 11, 14, 18 and 19. The
`__actions` column key is introduced in Task 13's implementation note and used
in 17 and 18. `categoryLabel`'s signature is fixed in Task 2 and used only
there.
