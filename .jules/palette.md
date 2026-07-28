## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.
## 2024-07-28 - Missing localized aria-labels on generic X icon buttons
**Learning:** Found generic X (remove/close) icon-only buttons in KioskOrderPanel and KioskView that had localized titles but were missing aria-labels. Even when a button uses an obvious icon like X, screen reader users rely on the aria-label to understand its function (e.g., "Remove item" vs "Close modal").
**Action:** Always ensure that icon-only buttons with tooltips (`title`) also have matching localized `aria-label`s so screen readers provide the same descriptive context as the visual tooltip.
