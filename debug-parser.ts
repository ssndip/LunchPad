import { parseMenuText } from './src/utils/advancedMenuParser';
const menu2 = `Скара:
*Кебапче -0.85
*Кюфте -0.85
*Пилешко шишче-2.00
*Свинско шишче-2.00
*Татарско кюфте с гарнитура-3.00
*Карначе с манатарки и гарнитура-3.40
*Телешко карначе с гарнитура-3.60`;

console.dir(parseMenuText(menu2), { depth: null });
