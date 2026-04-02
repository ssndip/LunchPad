## 2024-05-19 - Accessible Icon Buttons
**Learning:** Icon-only buttons without labels (like those using lucide-react icons exclusively) are completely opaque to screen readers, creating immediate accessibility blockers for core tasks (like settings, toggles, or destructive actions).
**Action:** Always verify that `<button>` tags without visible text include a descriptive `aria-label` attribute.

## 2026-04-02 - Accessible Custom Toggle Switches
**Learning:** Custom UI toggle buttons (created with `<div>` and CSS) fail to communicate their state to screen readers and often lack visible focus for keyboard users.
**Action:** Always add `role="switch"`, an explicit `aria-checked={boolean}` property, and proper `focus-visible` utility classes to custom toggle components to ensure full accessibility.
