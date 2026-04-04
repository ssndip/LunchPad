## 2024-05-19 - Accessible Icon Buttons
**Learning:** Icon-only buttons without labels (like those using lucide-react icons exclusively) are completely opaque to screen readers, creating immediate accessibility blockers for core tasks (like settings, toggles, or destructive actions).
**Action:** Always verify that `<button>` tags without visible text include a descriptive `aria-label` attribute.

## 2026-04-02 - Accessible Custom Toggle Switches
**Learning:** Custom UI toggle buttons (created with `<div>` and CSS) fail to communicate their state to screen readers and often lack visible focus for keyboard users.
**Action:** Always add `role="switch"`, an explicit `aria-checked={boolean}` property, and proper `focus-visible` utility classes to custom toggle components to ensure full accessibility.

## 2024-05-18 - Keyboard Accessibility Blocker on Primary Actions
**Learning:** Using `tabIndex={-1}` on primary interactive elements like `<button>` completely removes them from the natural tab order. This creates a severe accessibility blocker for keyboard-only and screen reader users, preventing them from accessing core functionality (like clearing carts or deleting items).
**Action:** Never apply `tabIndex={-1}` to primary interactive elements unless implementing a carefully managed focus trapping pattern (e.g., inside a custom modal). Use `tabIndex` attributes sparingly and primarily rely on semantic HTML structure for focus management.
