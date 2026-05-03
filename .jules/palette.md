## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.

## 2024-11-21 - Identifying Unlabeled Utility Icons and Inputs
**Learning:** During accessibility audits, utility icon buttons (like Plus, Minus, Delete, and Close/X) and standalone form inputs (like PIN entries or confirmation prompts) are frequently created with `title` attributes or visual `placeholder`s but are missing the essential `aria-label`. This makes them completely opaque to screen readers despite appearing fine to mouse users.
**Action:** When adding utility icons or standalone inputs, mechanically check that both `aria-label` (for screen readers) and `title` (for mouse users, if it's a button) are explicitly provided and properly localized via `t()`.
