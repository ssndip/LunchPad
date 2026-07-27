import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { fetchMenuBackups } from './menuController';
import { db, initDb } from '../db';

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

describe('menuController - fetchMenuBackups', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeAll(() => {
    initDb();
  });

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    mockNext = vi.fn();

    db.exec("DELETE FROM menu_backups");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty list when no backups exist', () => {
    fetchMenuBackups(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith([]);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return list of backups with accurate itemCount calculated via json_array_length', () => {
    const timestamp1 = new Date(Date.now() - 10000).toISOString();
    const timestamp2 = new Date(Date.now()).toISOString();

    const menuData1 = JSON.stringify([{ id: 1, name: 'Pizza' }, { id: 2, name: 'Burger' }]);
    const menuData2 = JSON.stringify([{ id: 3, name: 'Salad' }, { id: 4, name: 'Soup' }, { id: 5, name: 'Fries' }]);

    db.prepare(`
      INSERT INTO menu_backups (timestamp, menuDate, menuData, menuVersion)
      VALUES (?, ?, ?, ?)
    `).run(timestamp1, '2026-07-26', menuData1, 1);

    db.prepare(`
      INSERT INTO menu_backups (timestamp, menuDate, menuData, menuVersion)
      VALUES (?, ?, ?, ?)
    `).run(timestamp2, '2026-07-27', menuData2, 2);

    fetchMenuBackups(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith([
      {
        id: expect.any(Number),
        timestamp: timestamp2,
        menuDate: '2026-07-27',
        menuVersion: 2,
        itemCount: 3
      },
      {
        id: expect.any(Number),
        timestamp: timestamp1,
        menuDate: '2026-07-26',
        menuVersion: 1,
        itemCount: 2
      }
    ]);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 0 as itemCount for backups with malformed JSON without throwing an error', () => {
    const timestamp = new Date().toISOString();
    const malformedJson = '{ invalid json ';

    db.prepare(`
      INSERT INTO menu_backups (timestamp, menuDate, menuData, menuVersion)
      VALUES (?, ?, ?, ?)
    `).run(timestamp, '2026-07-27', malformedJson, 1);

    fetchMenuBackups(mockReq as Request, mockRes as Response, mockNext);

    expect(mockRes.json).toHaveBeenCalledWith([
      {
        id: expect.any(Number),
        timestamp: timestamp,
        menuDate: '2026-07-27',
        menuVersion: 1,
        itemCount: 0
      }
    ]);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should call next with error when db query fails', () => {
    const error = new Error('Database error');
    const spy = vi.spyOn(db, 'prepare').mockImplementationOnce(() => {
      throw error;
    });

    fetchMenuBackups(mockReq as Request, mockRes as Response, mockNext);

    expect(mockNext).toHaveBeenCalledWith(error);
    expect(mockRes.json).not.toHaveBeenCalled();
  });
});
