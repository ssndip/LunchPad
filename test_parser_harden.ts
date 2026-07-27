import { parseMenuText } from './src/utils/advancedMenuParser';

const rawText = `Меню за 14.04.2026 

Основни ястия (3.50€):
- Кюфтета със сос (200гр) 3.50€ (6.85лв.)
- Пилешка кавърма 3.20€ + 0.20€ кутийка
- Скумрия на скара (Информативно: 8.50лв. / 4.35€)

Супи:
1.80€
- Пилешка супа 200гр
- Шкембе чорба (+0.10€ кутийка)

Салати:
200гр 1.50€
- Шопска салата (2.93лв.)
- Снежанка

Бележка: Всички цени са в Евро. Курсът е фиксиран.`;

const parsed = parseMenuText(rawText);
console.log(JSON.stringify(parsed, null, 2));

// Quick verifications
const meatballs = parsed.categories[0].items[0];
console.log('--- Meatballs Verification ---');
console.log('Name:', meatballs.name); // Should be "Кюфтета със сос"
console.log('Price:', meatballs.price); // Should be 3.5
console.log('Weight:', meatballs.weight); // Should be "200гр"

const kavarma = parsed.categories[0].items[1];
console.log('\n--- Kavarma Verification ---');
console.log('Name:', kavarma.name); // Should be "Пилешка кавърма"
console.log('BoxFee:', kavarma.boxFee); // Should be 0.2

const salad = parsed.categories[2].items[0];
console.log('\n--- Salad Verification ---');
console.log('Name:', salad.name); // Should be "Шопска салата"
console.log('Price:', salad.price); // Should be 1.5
