## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.

## 2024-11-21 - Custom Switch Accessibility
**Learning:** Custom switch components using Tailwind often rely on `focus:outline-none` to hide default browser focus rings. However, this entirely removes focus visibility for keyboard navigation users.
**Action:** When building or modifying custom interactive elements (like custom toggles/switches), always ensure keyboard accessibility by pairing `focus:outline-none` with Tailwind's `focus-visible` classes, specifically: `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900` (or similar theme colors).
