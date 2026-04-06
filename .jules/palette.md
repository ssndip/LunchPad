## 2024-05-19 - Accessible Icon Buttons
**Learning:** Icon-only buttons without labels (like those using lucide-react icons exclusively) are completely opaque to screen readers, creating immediate accessibility blockers for core tasks (like settings, toggles, or destructive actions).
**Action:** Always verify that `<button>` tags without visible text include a descriptive `aria-label` attribute.

## 2026-04-02 - Accessible Custom Toggle Switches
**Learning:** Custom UI toggle buttons (created with `<div>` and CSS) fail to communicate their state to screen readers and often lack visible focus for keyboard users.
**Action:** Always add `role="switch"`, an explicit `aria-checked={boolean}` property, and proper `focus-visible` utility classes to custom toggle components to ensure full accessibility.

## 2026-04-06 - Prevent Blocking Keyboard Navigation
**Learning:** Applying `tabIndex={-1}` to primary interactive elements (like custom actions or modal triggers) completely removes them from the natural tab order, blocking keyboard users. Additionally, custom toggles (like `role="switch"`) must explicitly define `focus-visible` utility classes, as default browser focus outlines often don't apply properly to styled `<div>` or `<button>` components.
**Action:** Never apply `tabIndex={-1}` to standard action buttons meant for user interaction. Ensure all custom interactive elements, especially toggles, have explicit `focus-visible` styling (e.g., `focus-visible:ring-2`) so keyboard focus state is apparent.
