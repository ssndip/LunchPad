## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.

## 2024-05-18 - Descriptive ARIA labels on dynamic lists
**Learning:** Icon-only remove buttons mapped from dynamic arrays need highly descriptive `aria-label`s (e.g., `Remove ${item.name}`) rather than static generic ones. Using just `Remove` causes screen readers to read "Remove, button, Remove, button" repeatedly, leaving the user with no context on which item is being removed.
**Action:** Always interpolate unique list item identifiers into `aria-label`s for icon-only action buttons within mapped lists. Additionally, ensure keyboard users have visual feedback by adding `focus:outline-none focus-visible:ring-2` styling.
