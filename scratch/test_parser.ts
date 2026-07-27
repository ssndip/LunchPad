
import { parseMenuText } from '../src/utils/advancedMenuParser';

const testMenu = `
SIDE DISHES
Зелева салата 1.50€
Млечна салата 1.50€
Картофи по селски 1.50€
Пържени картофи 1.50€

BBQ
Кебапче 100гр 1.00€
`;

const result = parseMenuText(testMenu);
console.log(JSON.stringify(result, null, 2));
