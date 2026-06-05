/**
 * Regression test suite for advancedMenuParser.
 * Run with: npx tsx src/utils/advancedMenuParser.test.ts
 * 
 * Add new test cases here whenever a new menu format is encountered.
 * Before building the Docker image, verify ALL tests pass.
 */
import { parseMenuText } from './advancedMenuParser';

let passed = 0;
let failed = 0;

function assert(description: string, actual: any, expected: any) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description}`);
    console.log(`     Expected: ${JSON.stringify(expected)}`);
    console.log(`     Actual:   ${JSON.stringify(actual)}`);
    failed++;
  }
}

function assertApprox(description: string, actual: number, expected: number) {
  const ok = Math.abs(actual - expected) < 0.001;
  if (ok) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.log(`  ❌ ${description}`);
    console.log(`     Expected: ${expected}`);
    console.log(`     Actual:   ${actual}`);
    failed++;
  }
}

// ─── Menu Format 1: Dash-prefixed, prices on items ───────────────────────────
console.log('\n📋 Format 1: Dash prefix + prices on items (09.04.2026 format)');
{
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

  assert('Date detected', r.date, '09.04.2026');

  const mains = r.categories.find(c => /основн/i.test(c.categoryName));
  assert('Mains category found', !!mains, true);
  assertApprox('Кюфтета price', mains?.items[0]?.price ?? -1, 3.20);
  assert('Кюфтета name clean', mains?.items[0]?.name, 'Кюфтета по цариградски');

  const soups = r.categories.find(c => /супи/i.test(c.categoryName));
  assert('Soups category found', !!soups, true);
  assertApprox('Таратор price', soups?.items[2]?.price ?? -1, 1.50);

  const salads = r.categories.find(c => /салат/i.test(c.categoryName));
  assert('Salads category found', !!salads, true);
  assert('Salads has 3 items', salads?.items.length, 3);
  assertApprox('Шопска inherited price', salads?.items[0]?.price ?? -1, 1.50);
  assertApprox('Зелева inherited price', salads?.items[1]?.price ?? -1, 1.50);
  assertApprox('Млечна inherited price', salads?.items[2]?.price ?? -1, 1.50);
  assert('Шопска name clean (no weight)', salads?.items[0]?.name, 'Шопска салата');

  const sides = r.categories.find(c => /гарнитур/i.test(c.categoryName));
  assert('Sides category found', !!sides, true);
  assertApprox('Картофи inherited price', sides?.items[0]?.price ?? -1, 0.75);

  const bbq = r.categories.find(c => /скара/i.test(c.categoryName));
  assert('BBQ category found', !!bbq, true);
  assertApprox('Кебапче price', bbq?.items[0]?.price ?? -1, 1.00);
  assert('Кебапче name (no weight in name)', bbq?.items[0]?.name, 'Кебапче');
}

// ─── Menu Format 2: Asterisk-prefixed, category price on header line ─────────
console.log('\n📋 Format 2: Asterisk prefix + category price in header (27.04 format)');
{
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

  assert('Date detected', r.date, '27.04.26');

  const soups = r.categories.find(c => /супи/i.test(c.categoryName));
  assert('Soups found', !!soups, true);
  assertApprox('Пилешка price', soups?.items[0]?.price ?? -1, 1.70);
  assert('Пилешка name', soups?.items[0]?.name, 'Пилешка супа');

  const salads = r.categories.find(c => /салат/i.test(c.categoryName));
  assert('Salads found', !!salads, true);
  assert('Salads has 3 items', salads?.items.length, 3);
  assertApprox('Млечна inherited 0.67', salads?.items[0]?.price ?? -1, 0.67);
  assertApprox('Шопска inherited 0.67', salads?.items[1]?.price ?? -1, 0.67);
  assert('Млечна name clean', salads?.items[0]?.name, 'Млечна салата');

  const mains = r.categories.find(c => /основни/i.test(c.categoryName));
  assert('Mains found', !!mains, true);
  assertApprox('Миш маш price', mains?.items[0]?.price ?? -1, 2.60);
}

// ─── Menu Format 3: No-bullet plain lines ────────────────────────────────────
console.log('\n📋 Format 3: No bullets, plain lines with prices');
{
  const menu = `27.04.26

SIDE DISHES
Зелева салата 1.50€
Млечна салата 1.50€

BBQ
Кебапче 100гр 1.00€`;

  const r = parseMenuText(menu);
  const sides = r.categories.find(c => /side/i.test(c.categoryName));
  assert('SIDE DISHES found', !!sides, true);
  assertApprox('Зелева price', sides?.items[0]?.price ?? -1, 1.50);
  assert('Зелева name', sides?.items[0]?.name, 'Зелева салата');

  const bbq = r.categories.find(c => /bbq/i.test(c.categoryName));
  assert('BBQ found', !!bbq, true);
  assertApprox('Кебапче price', bbq?.items[0]?.price ?? -1, 1.00);
  assert('Кебапче name (no weight)', bbq?.items[0]?.name, 'Кебапче');
}

// ─── Menu Format 4: Malformed Date Resilience ────────────────────────────────
console.log('\n📋 Format 4: Malformed Date Resilience');
{
  const menu = `Меню за 99.99.9999
Понеделник
Супи:
- Пилешка супа 1.80€`;

  try {
    const r = parseMenuText(menu);
    assert('Parser did not crash on malformed date', typeof r === 'object', true);
    assert('Soups category exists', r.categories.length > 0, true);
    assert('Item has a valid ISO date fallback', typeof r.categories[0].items[0].date === 'string', true);
  } catch (e: any) {
    assert('Parser crashed with error: ' + e.message, true, false);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('❌ TESTS FAILED — do NOT build Docker image until these are fixed!');
  process.exit(1);
} else {
  console.log('✅ All tests passed — safe to build Docker image.');
}
