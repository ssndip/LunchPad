## 2025-04-16 - Removed `tabIndex={-1}` from primary interactive elements
**Learning:** `tabIndex={-1}` removes elements from the natural keyboard tab order. Applying it to primary interactive elements like buttons creates a severe accessibility blocker.
**Action:** Never apply `tabIndex={-1}` to primary interactive elements. Only use it for carefully managed focus patterns like custom modal focus trapping.
