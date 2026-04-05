## 2024-05-19 - Accessible Icon Buttons
**Learning:** Icon-only buttons without labels (like those using lucide-react icons exclusively) are completely opaque to screen readers, creating immediate accessibility blockers for core tasks (like settings, toggles, or destructive actions).
**Action:** Always verify that `<button>` tags without visible text include a descriptive `aria-label` attribute.

## 2026-04-02 - Accessible Custom Toggle Switches
**Learning:** Custom UI toggle buttons (created with `<div>` and CSS) fail to communicate their state to screen readers and often lack visible focus for keyboard users.
**Action:** Always add `role="switch"`, an explicit `aria-checked={boolean}` property, and proper `focus-visible` utility classes to custom toggle components to ensure full accessibility.

## 2025-04-05 - Avoid tabIndex={-1} on Interactive Buttons
**Learning:** Using `tabIndex={-1}` on primary interactive elements like `<button>` explicitly removes them from the natural keyboard navigation flow (Tab order). While sometimes used to prevent focus jumping, doing so on standard action buttons (like Delete, Add, or clear input buttons) creates a severe accessibility barrier for keyboard-only or screen reader users.
**Action:** Never use `tabIndex={-1}` on interactive `<button>` elements unless implementing a strictly managed focus loop (like a custom modal focus trap). Standard action buttons must remain keyboard focusable by default.
