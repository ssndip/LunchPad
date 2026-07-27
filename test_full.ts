import { parsePastedMenu } from './src/utils/menuParser';

const rawText = `Меню за 09.04.2026 

Основно ястие:
- Кюфтета по цариградски 3.20€
- Пилешко филе в гъбен сос 3.40€

Хляб:
- Четвъртинка хляб 0.50€

Супи:
- Пилешка супа 1.80€

Салати:
200гр 1.50€ + 0.10€ кутийка
- Шопска салата
- Зелева салата

Гарнитури :
100гр 0.75€ ( 0.10€ кутийка ако е отделно)
- Шопска салата
- Картофи по селски

Скара:
0.10€ кутийка
- Кебапче 100гр 1.00€
- Татарско кюфте с гарнитура 3.40€

Десерт:
- Домашна бисквитена торта 1.80€`;

const r = parsePastedMenu(rawText);
console.log(JSON.stringify(r.items.map(i => ({ name: i.name, category: i.category, requiresChoice: i.requiresSideChoice })), null, 2));
