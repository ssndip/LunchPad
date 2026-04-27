
import { parseMenuText } from '../src/utils/advancedMenuParser';

const testMenu = `
SIDE DISHES
гр 0.75€ ( ако е отделно
Шопска салата 1.50€
Зелева салата 1.50 лв.
`;

const result = parseMenuText(testMenu);
console.log(JSON.stringify(result, null, 2));
