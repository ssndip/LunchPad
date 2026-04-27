## 2024-05-20 - Icon-only Buttons Accessibility
**Learning:** Icon-only buttons (like Trash, Settings, LogOut, Lock) in the Kiosk and Manager UI rely heavily on visual context but lack accessible names, making them difficult for screen reader users and leaving desktop users without descriptive hover tooltips.
**Action:** Always add `aria-label` (for screen readers) and `title` (for mouse hover tooltips) using localized strings to all icon-only buttons during component creation.

## 2026-04-24 - Add accessible labels to icon-only buttons in Parser Rules Tab
**Learning:** Icon-only buttons used heavily in data tables (like the Parser's list of extracted items) often lack contextual `aria-label`s, rendering them ambiguous to screen readers. Relying only on visual icons like `ArrowUp` or `Trash2` creates an accessibility barrier.
**Action:** When implementing or reviewing dense data tables with action rows, always ensure icon-only control buttons include localized `aria-label` and `title` attributes (e.g., using `t('modals.remove')`).
