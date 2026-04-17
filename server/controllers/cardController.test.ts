import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { resetAllBalances } from './cardController';
import { db, initDb } from '../db';
import * as broadcastModule from '../broadcast';

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

describe('cardController', () => {
  describe('resetAllBalances', () => {
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

      db.exec("DELETE FROM cards");
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should reset all card balances to 0, broadcast update and return success', () => {
      // Setup cards with balances
      db.prepare(`
        INSERT INTO cards (rfid, ownerName, balance, isAdmin)
        VALUES
          ('111', 'User 1', 10.50, 0),
          ('222', 'User 2', 5.00, 0),
          ('333', 'User 3', 0.00, 1)
      `).run();

      resetAllBalances(mockReq as Request, mockRes as Response, mockNext);

      // Verify db changes
      const updatedCards = db.prepare("SELECT * FROM cards").all() as any[];
      expect(updatedCards.length).toBe(3);
      updatedCards.forEach(card => {
        expect(card.balance).toBe(0);
      });

      // Verify response
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        cards: expect.arrayContaining([
          expect.objectContaining({ rfid: '111', balance: 0, isAdmin: false }),
          expect.objectContaining({ rfid: '222', balance: 0, isAdmin: false }),
          expect.objectContaining({ rfid: '333', balance: 0, isAdmin: true }),
        ])
      });

      // Verify broadcast
      expect(broadcastModule.broadcast).toHaveBeenCalledWith({ type: 'CARDS_UPDATE' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass error to next if a database error occurs', () => {
      const error = new Error('Database connection failed');

      const spy = vi.spyOn(db, 'prepare').mockImplementationOnce(() => {
        throw error;
      });

      resetAllBalances(mockReq as Request, mockRes as Response, mockNext);

      expect(spy).toHaveBeenCalledWith("UPDATE cards SET balance = 0, lastUpdated = ?");
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(broadcastModule.broadcast).not.toHaveBeenCalled();
    });
  });
});
