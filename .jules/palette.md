## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.

## 2024-07-04 - Keyboard Accessibility for Custom Toggle Switches
**Learning:** Custom UI components like toggle switches built with standard DOM elements (like `<button>`) must explicitly implement visual focus indicators when removing the default browser outline. Relying solely on `focus:outline-none` causes these elements to become invisible to keyboard users during navigation.
**Action:** When implementing or modifying custom interactive elements (like switches or icon buttons), always ensure `focus-visible` utility classes (e.g., `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900`) are applied alongside `focus:outline-none` to guarantee distinct keyboard focus states without affecting mouse click styling.
