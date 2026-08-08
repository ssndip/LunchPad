## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.

## 2024-11-21 - Localized ARIA labels on dynamic list buttons
**Learning:** Hardcoding `aria-label` and `title` attributes on dynamically rendered list actions (like 'Remove keyword' or 'Edit category') prevents proper accessibility and tooltip localization for non-English users, especially when the buttons are icon-only and rely entirely on these attributes for context.
**Action:** Always wrap utility and action button attributes (`title`, `aria-label`) inside dynamic mappings (like `.map()`) with the `t()` translation function (e.g., ``t('modals.remove') + ' ' + item.name``) to ensure screen readers provide localized context across all languages.
