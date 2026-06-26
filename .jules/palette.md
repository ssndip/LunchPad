## 2024-05-18 - Dynamic ARIA Labels in Lists
**Learning:** Icon-only buttons rendered inside `map()` loops must include dynamic item identifiers (like `item.name` or `item.id`) in their `aria-label` or `title` attributes. Otherwise, screen reader users hear redundant, identical labels (e.g., "Edit, Edit, Edit") without context of which item they are acting upon.
**Action:** When adding accessible labels to buttons within lists or tables, always concatenate a unique item identifier (e.g., `aria-label={\`\${t('modals.edit')} for \${item.name}\`}`).
