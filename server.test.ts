import { test, expect, describe, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { getMenu } from './server';

describe('getMenu', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE IF NOT EXISTS menu (
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
    db.close();
  });

  test('maps available 1 to true and 0 to false', () => {
    const insert = db.prepare("INSERT INTO menu (id, name, description, price, available, category) VALUES (?, ?, ?, ?, ?, ?)");
    insert.run(1, "Available Item", "Desc", 1.5, 1, "Category 1");
    insert.run(2, "Unavailable Item", "Desc", 2.0, 0, "Category 2");

    const result = getMenu(db);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 1,
      name: "Available Item",
      description: "Desc",
      price: 1.5,
      available: true,
      category: "Category 1"
    });
    expect(result[1]).toEqual({
      id: 2,
      name: "Unavailable Item",
      description: "Desc",
      price: 2.0,
      available: false,
      category: "Category 2"
    });
  });

  test('returns an empty array when there are no items', () => {
    const result = getMenu(db);
    expect(result).toEqual([]);
  });
});
