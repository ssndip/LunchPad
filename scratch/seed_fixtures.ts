
import { db } from '../server/db';
import { v4 as uuidv4 } from 'uuid';

const fixtures = [
  {
    name: 'Standard Menu (April 27)',
    rawInput: `Меню за 27.04.26
Супи:
*Пилешка супа -1.70
*Шкембе чорба- 1.80
Салати: 0.100гр - 0.67е.
*Млечна салата
*Шопска салата`
  },
  {
    name: 'Dash Menu (April 9)',
    rawInput: `Меню за 09.04.2026 
Супи:
- Пилешка супа 1.80€
- Шкембе 1.80€
Салати:
200гр 1.50€ + 0.10€ кутийка
- Шопска салата`
  }
];

fixtures.forEach(f => {
  const existing = db.prepare("SELECT id FROM parser_fixtures WHERE name = ?").get(f.name);
  if (!existing) {
    db.prepare("INSERT INTO parser_fixtures (id, name, rawInput, expectedOutputJson, createdAt) VALUES (?, ?, ?, ?, ?)")
      .run(uuidv4(), f.name, f.rawInput, "{}", new Date().toISOString());
    console.log(`[Fixture] Added: ${f.name}`);
  }
});
