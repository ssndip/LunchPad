## 2024-07-01 - Add focus-visible states to switch elements
**Learning:** Interactive toggle switch components used `focus:outline-none` but lacked any replacement visual indication for keyboard focus.
**Action:** Always add `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neutral-900` when removing the default outline on custom interactive elements to ensure keyboard accessibility.
