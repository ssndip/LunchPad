import { MenuParserEngine } from './src/utils/parserEngine';
import { DEFAULT_PARSER_CONFIG } from './src/utils/defaultParserConfig';

const engine = new MenuParserEngine(DEFAULT_PARSER_CONFIG);

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

const result = engine.parse(rawText);
console.log('--- Parse Result ---');
console.log(JSON.stringify(result, null, 2));

// Verifications
const meatballs = result.items.find(i => i.name.includes('Кюфтета'));
console.log('\nMeatballs Check:', meatballs?.name === 'Кюфтета със сос' && meatballs.price === 3.5 ? 'PASS' : 'FAIL');

const kavarma = result.items.find(i => i.name.includes('кавърма'));
console.log('Kavarma Check:', kavarma?.packagingFee === 0.2 ? 'PASS' : 'FAIL');

const soup = result.items.find(i => i.name.includes('Пилешка супа'));
console.log('Soup Check:', soup?.price === 1.8 ? 'PASS' : 'FAIL');

const salad = result.items.find(i => i.name.includes('Шопска'));
console.log('Salad Check:', salad?.price === 1.5 && salad.tags.includes('autobox') ? 'PASS' : 'FAIL');

console.log('\nUnmatched Lines:', result.unmatchedLines.length);
