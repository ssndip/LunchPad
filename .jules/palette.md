## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.

## 2024-12-07 - Missing ARIA Labels on Deeply Nested Icon-Only Utilities
**Learning:** Icon-only buttons used deep within feature panels (like the `PinPadModal` delete button, the `MenuTab` delivery/box fee refresh buttons, and the `CardsTab` cancel edit button) often slip through initial accessibility sweeps because they are visually intuitive to sighted users but completely opaque to screen readers.
**Action:** When auditing or building new components, aggressively scan for `<button>` elements that only contain an icon (e.g., `<Trash2 />`, `<RefreshCw />`, `<Delete />`, `<X />`) and immediately verify they have a localized `aria-label` mapped to a key in `src/translations.ts`. Do not assume utility icons convey meaning programmatically.
