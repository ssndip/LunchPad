## 2024-05-19 - Accessible Icon Buttons
**Learning:** Icon-only buttons without labels (like those using lucide-react icons exclusively) are completely opaque to screen readers, creating immediate accessibility blockers for core tasks (like settings, toggles, or destructive actions).
**Action:** Always verify that `<button>` tags without visible text include a descriptive `aria-label` attribute.

## 2026-04-02 - Accessible Custom Toggle Switches
**Learning:** Custom UI toggle buttons (created with `<div>` and CSS) fail to communicate their state to screen readers and often lack visible focus for keyboard users.
**Action:** Always add `role="switch"`, an explicit `aria-checked={boolean}` property, and proper `focus-visible` utility classes to custom toggle components to ensure full accessibility.

## 2026-04-12 - Improper tabIndex Usage on Action Buttons
**Learning:** Developers occasionally apply `tabIndex={-1}` to primary action buttons (like 'Add Item' or 'Delete All'), inadvertently removing them from the natural keyboard navigation flow and creating a severe accessibility blocker for users who rely on keyboard navigation.
**Action:** Never apply `tabIndex={-1}` to primary interactive elements such as `<button>` or `<a>` unless intentionally managing focus trapping (like within a modal). Always ensure action buttons remain in the natural tab sequence.
