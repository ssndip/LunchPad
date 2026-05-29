import { parseMenuText } from './src/utils/advancedMenuParser';

const menu = `27.04.26

SIDE DISHES
Зелева салата 1.50€
Млечна салата 1.50€

BBQ
Кебапче 100гр 1.00€`;

const result = parseMenuText(menu);
console.log('Result categories:', JSON.stringify(result.categories, null, 2));
console.log('Unmatched lines:', result.unmatchedLines);
