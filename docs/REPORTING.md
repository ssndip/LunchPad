# Reporting System

LunchPad includes a professional reporting engine designed for administrative documentation and financial tracking.

## Generating a Report
1.  Navigate to the **History** tab in the Manager Dashboard.
2.  Use the filters to select your desired **Date Range**, **RFID**, or **Name**.
3.  Click the **Summary Report** (File Icon) button in the filter bar.
4.  A preview modal will appear showing the filtered data in an A4-optimized layout.

## Report Components
- **Summary Header**: Displays total order count, total revenue, and average transaction value for the filtered set.
- **Detailed Table**: Lists every transaction with timestamps, owner names, item lists, and individual totals.
- **Footer**: Includes generation timestamp and "LUNCHPAD PRO" branding.

## Printing
- Click the **Print Report** button in the modal.
- This triggers a specialized print stylesheet (`@media print`) that:
    - Hides all web UI elements (navigation, sidebar, buttons).
    - Formats the content for **A4 Paper**.
    - Handles automatic **Page Breaks** for long reports.
    - Removes shadows and backgrounds to save ink while maintaining clarity.

> [!TIP]
> To save the report as a PDF, select "Save as PDF" in your browser's print destination menu.
