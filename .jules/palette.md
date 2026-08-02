## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2024-11-21 - Localized ARIA labels on utility buttons
**Learning:** Even well-intentioned accessibility features like `title` and `aria-label` can fall short if they are hardcoded and not localized. I found a clear order utility button in `KioskOrderBar.tsx` that had `title="Clear order"` and `aria-label="Clear order"` hardcoded instead of using the translation function `t()`. This makes it unreadable for screen readers set to another language like Bulgarian.
**Action:** Always verify that utility button attributes (especially `title` and `aria-label`) are wrapped in `t()` using translation keys.
## 2024-05-18 - Missing ARIA Labels on dynamic elements
**Learning:** Found multiple instances where dynamic icons (like `NfcStatusButton`) or contextual icons (like `applyDeliveryFee`) in this React app were correctly given dynamic `title` attributes for mouse hovers, but were missing the equivalent `aria-label` attributes for screen readers.
**Action:** Always ensure that when creating or modifying icon-only interactive elements, the `title` attribute logic is replicated to an `aria-label` to provide equivalent information for non-mouse users.
