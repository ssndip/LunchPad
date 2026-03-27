import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { getMenu } from './server.ts';

describe('getMenu', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Setup an in-memory SQLite database
    db = new Database(':memory:');

    // Create the menu table matching the schema in server.ts
    db.exec(`
      CREATE TABLE menu (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        price REAL,
        available INTEGER,
        category TEXT
      );
    `);
  });

  afterEach(() => {
    // Tear down the database connection
    db.close();
  });

  it('should return an empty array when there are no items', () => {
    const result = getMenu(db);
    expect(result).toEqual([]);
  });

  it('should return mapped items with available as true when available is 1', () => {
    db.prepare(`
      INSERT INTO menu (id, name, description, price, available, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(1, 'Test Item 1', 'Desc 1', 1.0, 1, 'Category 1');

    const result = getMenu(db);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 1,
      name: 'Test Item 1',
      description: 'Desc 1',
      price: 1.0,
      available: true,
      category: 'Category 1'
    });
  });

  it('should return mapped items with available as false when available is 0', () => {
    db.prepare(`
      INSERT INTO menu (id, name, description, price, available, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(2, 'Test Item 2', 'Desc 2', 2.0, 0, 'Category 2');

    const result = getMenu(db);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      id: 2,
      name: 'Test Item 2',
      description: 'Desc 2',
      price: 2.0,
      available: false,
      category: 'Category 2'
    });
  });

  it('should correctly handle multiple items with mixed availability', () => {
    const insert = db.prepare(`
      INSERT INTO menu (id, name, description, price, available, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insert.run(1, 'Item 1', 'Desc 1', 1.0, 1, 'Cat A');
    insert.run(2, 'Item 2', 'Desc 2', 2.0, 0, 'Cat B');
    insert.run(3, 'Item 3', 'Desc 3', 3.0, 1, 'Cat A');

    const result = getMenu(db);

    expect(result).toHaveLength(3);

    const item1 = result.find((i: any) => i.id === 1);
    const item2 = result.find((i: any) => i.id === 2);
    const item3 = result.find((i: any) => i.id === 3);

    expect(item1.available).toBe(true);
    expect(item2.available).toBe(false);
    expect(item3.available).toBe(true);
  });
});
