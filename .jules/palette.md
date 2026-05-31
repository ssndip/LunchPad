## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.
## 2024-06-25 - Missing aria-label attributes on icon-only buttons
**Learning:** Found a recurring pattern in the codebase where icon-only buttons (like delete/remove/close with `X` or `Trash` icons) were missing `aria-label` attributes for screen reader accessibility. Some had `title` attributes, but many lacked explicit `aria-label`.
**Action:** When adding or reviewing icon-only buttons, always explicitly provide `aria-label` and `title` attributes (preferably localized with `t()`) to ensure the interactive element is fully accessible.
