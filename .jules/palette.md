## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.
## 2024-03-24 - Distinct keyboard focus states for custom switches
**Learning:** Custom components using `role="switch"` and built with `button` elements need explicit `focus-visible` styles when `focus:outline-none` is applied, otherwise they become inaccessible to keyboard users navigating via Tab.
**Action:** When creating or modifying custom interactive elements (like switches or toggles), always append Tailwind's `focus-visible:ring-*` utilities (e.g. `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900`) alongside `focus:outline-none` to preserve keyboard accessibility without affecting mouse clicks.
