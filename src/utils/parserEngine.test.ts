import { describe, it, expect } from 'vitest';
import { MenuParserEngine } from './parserEngine';
import { DEFAULT_PARSER_CONFIG } from './defaultParserConfig';

describe('MenuParserEngine', () => {
  const engine = new MenuParserEngine(DEFAULT_PARSER_CONFIG);

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

  it('should parse the menu correctly', () => {
    const result = engine.parse(rawText);
    
    expect(result.date).toBe('09.04.2026');
    expect(result.items.length).toBeGreaterThan(0);
    
    // Check specific items
    const kyufteta = result.items.find(i => i.name.includes('Кюфтета по цариградски'));
    expect(kyufteta).toBeDefined();
    expect(kyufteta?.price).toBe(3.2);
    expect(kyufteta?.category).toBe('Main Dishes');

    const shopska = result.items.find(i => i.name === 'Шопска салата' && i.category === 'Salads');
    expect(shopska).toBeDefined();
    expect(shopska?.price).toBe(1.5);
    expect(shopska?.packagingFee).toBe(0.1);

    const kebapche = result.items.find(i => i.name === 'Кебапче');
    expect(kebapche).toBeDefined();
    expect(kebapche?.price).toBe(1.0);
    expect(kebapche?.packagingFee).toBe(0.1);
  });

  it('should handle unmatched lines correctly', () => {
    const text = "Random line\n- Item 1.00€";
    const result = engine.parse(text);
    expect(result.unmatchedLines).toContain("Random line");
    expect(result.items.length).toBe(1);
  });

  it('should parse Cyrillic menu date using Group 2 regex without year suffix', () => {
    const text = "Меню за 09.04\n\nСупи:\n- Пилешка супа 1.80€";
    const result = engine.parse(text);
    expect(result.date).toBe('09.04');
    expect(result.items.length).toBe(1);
  });
});
