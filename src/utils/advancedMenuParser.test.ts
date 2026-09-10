/**
 * Regression test suite for advancedMenuParser.
 *
 * Add new test cases here whenever a new menu format is encountered.
 */
import { describe, it, expect } from 'vitest';
import { parseMenuText } from './advancedMenuParser';

// ─── Menu Format 1: Dash-prefixed, prices on items ───────────────────────────
describe('Format 1: Dash prefix + prices on items (09.04.2026 format)', () => {
  const menu = `Меню за 09.04.2026

Основно ястие:
- Кюфтета по цариградски 3.20€
- Пекан боб 2.70€

Хляб:
- Четвъртинка хляб 0.50€

Супи:
- Пилешка супа 1.80€
- Шкембе 1.80€
- Таратор 1.50€

Салати:
200гр 1.50€ + 0.10€ кутийка
- Шопска салата
- Зелева салата
- Млечна салата

Гарнитури :
100гр 0.75€ ( 0.10€ кутийка ако е отделно)
- Картофи по селски
- Пържени картофи

Скара:
0.10€ кутийка
- Кебапче 100гр 1.00€
- Кюфте 100гр 1.00€

Десерт:
- Домашна бисквитена торта 1.80€`;

  const r = parseMenuText(menu);
  const mains = r.categories.find(c => /основн/i.test(c.categoryName));
  const soups = r.categories.find(c => /супи/i.test(c.categoryName));
  const salads = r.categories.find(c => /салат/i.test(c.categoryName));
  const sides = r.categories.find(c => /гарнитур/i.test(c.categoryName));
  const bbq = r.categories.find(c => /скара/i.test(c.categoryName));

  it('Date detected', () => expect(r.date).toEqual('09.04.2026'));

  it('Mains category found', () => expect(!!mains).toEqual(true));
  it('Кюфтета price', () => expect(mains?.items[0]?.price ?? -1).toBeCloseTo(3.20, 3));
  it('Кюфтета name clean', () => expect(mains?.items[0]?.name).toEqual('Кюфтета по цариградски'));

  it('Soups category found', () => expect(!!soups).toEqual(true));
  it('Таратор price', () => expect(soups?.items[2]?.price ?? -1).toBeCloseTo(1.50, 3));

  it('Salads category found', () => expect(!!salads).toEqual(true));
  it('Salads has 3 items', () => expect(salads?.items.length).toEqual(3));
  it('Шопска inherited price', () => expect(salads?.items[0]?.price ?? -1).toBeCloseTo(1.50, 3));
  it('Зелева inherited price', () => expect(salads?.items[1]?.price ?? -1).toBeCloseTo(1.50, 3));
  it('Млечна inherited price', () => expect(salads?.items[2]?.price ?? -1).toBeCloseTo(1.50, 3));
  it('Шопска name clean (no weight)', () => expect(salads?.items[0]?.name).toEqual('Шопска салата'));

  it('Sides category found', () => expect(!!sides).toEqual(true));
  it('Картофи inherited price', () => expect(sides?.items[0]?.price ?? -1).toBeCloseTo(0.75, 3));

  it('BBQ category found', () => expect(!!bbq).toEqual(true));
  it('Кебапче price', () => expect(bbq?.items[0]?.price ?? -1).toBeCloseTo(1.00, 3));
  it('Кебапче name (no weight in name)', () => expect(bbq?.items[0]?.name).toEqual('Кебапче'));
});

// ─── Menu Format 2: Asterisk-prefixed, category price on header line ─────────
describe('Format 2: Asterisk prefix + category price in header (27.04 format)', () => {
  const menu = `Меню за 27.04.26

Супи:
*Пилешка супа -1.70
*Шкембе чорба- 1.80
*Леща-1.50

Салати: 0.100гр - 0.67е.
*Млечна салата
*Шопска салата
*Катък с червена чушка

Скара:
*Кебапче -0.85
*Кюфте -0.85

Основни ястия:
*Миш маш -2.60
*Свински гювеч-3.20

Десерти:
*Мляко с ориз -1.00`;

  const r = parseMenuText(menu);
  const soups = r.categories.find(c => /супи/i.test(c.categoryName));
  const salads = r.categories.find(c => /салат/i.test(c.categoryName));
  const mains = r.categories.find(c => /основни/i.test(c.categoryName));

  it('Date detected', () => expect(r.date).toEqual('27.04.26'));

  it('Soups found', () => expect(!!soups).toEqual(true));
  it('Пилешка price', () => expect(soups?.items[0]?.price ?? -1).toBeCloseTo(1.70, 3));
  it('Пилешка name', () => expect(soups?.items[0]?.name).toEqual('Пилешка супа'));

  it('Salads found', () => expect(!!salads).toEqual(true));
  it('Salads has 3 items', () => expect(salads?.items.length).toEqual(3));
  it('Млечна inherited 0.67', () => expect(salads?.items[0]?.price ?? -1).toBeCloseTo(0.67, 3));
  it('Шопска inherited 0.67', () => expect(salads?.items[1]?.price ?? -1).toBeCloseTo(0.67, 3));
  it('Млечна name clean', () => expect(salads?.items[0]?.name).toEqual('Млечна салата'));

  it('Mains found', () => expect(!!mains).toEqual(true));
  it('Миш маш price', () => expect(mains?.items[0]?.price ?? -1).toBeCloseTo(2.60, 3));
});

// ─── Menu Format 3: No-bullet plain lines ────────────────────────────────────
describe('Format 3: No bullets, plain lines with prices', () => {
  const menu = `27.04.26

SIDE DISHES
Зелева салата 1.50€
Млечна салата 1.50€

BBQ
Кебапче 100гр 1.00€`;

  const r = parseMenuText(menu);
  const sides = r.categories.find(c => /side/i.test(c.categoryName));
  const bbq = r.categories.find(c => /bbq/i.test(c.categoryName));

  it('SIDE DISHES found', () => expect(!!sides).toEqual(true));
  it('Зелева price', () => expect(sides?.items[0]?.price ?? -1).toBeCloseTo(1.50, 3));
  it('Зелева name', () => expect(sides?.items[0]?.name).toEqual('Зелева салата'));

  it('BBQ found', () => expect(!!bbq).toEqual(true));
  it('Кебапче price', () => expect(bbq?.items[0]?.price ?? -1).toBeCloseTo(1.00, 3));
  it('Кебапче name (no weight)', () => expect(bbq?.items[0]?.name).toEqual('Кебапче'));
});

// ─── Menu Format 4: Malformed Date Resilience ────────────────────────────────
describe('Format 4: Malformed Date Resilience', () => {
  const menu = `Меню за 99.99.9999
Понеделник
Супи:
- Пилешка супа 1.80€`;

  it('Parser did not crash on malformed date', () => {
    expect(() => parseMenuText(menu)).not.toThrow();
    expect(typeof parseMenuText(menu)).toEqual('object');
  });

  it('Soups category exists', () => {
    expect(parseMenuText(menu).categories.length > 0).toEqual(true);
  });

  it('Item has a valid ISO date fallback', () => {
    const r = parseMenuText(menu);
    expect(typeof r.categories[0].items[0].date).toEqual('string');
  });
});
