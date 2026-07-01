## 2024-05-18 - Missing ARIA Label on ConfirmModal Prompt Input
**Learning:** The prompt configuration of `ConfirmModal` lacked an `aria-label` for its input, making it inaccessible to screen readers.
**Action:** Added `aria-label={config.title}` to the `<input>` element inside `ConfirmModal` to ensure accessibility for prompt interactions.
