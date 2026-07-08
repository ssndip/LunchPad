## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.
## 2024-05-15 - Interactive Custom Switch Components Keyboard Accessibility
**Learning:** Custom UI elements like toggle switches built with buttons often lack adequate visible focus states by default, making them difficult or impossible for keyboard users to track during navigation, particularly when `focus:outline-none` is applied to remove default browser rings.
**Action:** Always verify custom interactive components with keyboard navigation (Tab key) to ensure they provide clear visual feedback, and consistently apply appropriate Tailwind focus classes (e.g. `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900`) alongside `focus:outline-none` so that focus rings only appear for keyboard users and not upon mouse clicks.
