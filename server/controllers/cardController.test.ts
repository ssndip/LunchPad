import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { resetAllBalances, updateSingleCard, addOrUpdateCard } from './cardController';
import { db, initDb } from '../db';
import * as broadcastModule from '../broadcast';

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

describe('cardController', () => {
  beforeAll(() => {
    initDb();
  });

  describe('resetAllBalances', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

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

  describe('updateSingleCard & addOrUpdateCard PIN handling', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      mockNext = vi.fn();
      db.exec("DELETE FROM cards");
    });

    it('should allow adding card with a valid 6-digit PIN and hash it', () => {
      mockReq = {
        body: {
          rfid: '12345',
          ownerName: 'Test Owner',
          balance: 10,
          isAdmin: false,
          pin: '123456'
        }
      };

      addOrUpdateCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );

      const card = db.prepare("SELECT * FROM cards WHERE rfid = '12345'").get() as any;
      expect(card).toBeDefined();
      expect(card.pin).toHaveLength(64); // SHA-256 is 64 characters long
      expect(card.pin).not.toBe('123456');
    });

    it('should reject invalid PIN formats during card addition', () => {
      mockReq = {
        body: {
          rfid: '12345',
          ownerName: 'Test Owner',
          balance: 10,
          isAdmin: false,
          pin: 'abc' // not digits, too short
        }
      };

      addOrUpdateCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'PIN must be exactly 6 digits' })
      );
    });

    it('should allow updating card and preserve pre-hashed PIN', () => {
      const hashedPin = 'a'.repeat(64); // fake 64-char hash
      db.prepare(`
        INSERT INTO cards (rfid, ownerName, balance, isAdmin, pin)
        VALUES ('55555', 'Initial Name', 0, 0, ?)
      `).run(hashedPin);

      mockReq = {
        params: { rfid: '55555' },
        body: {
          ownerName: 'Updated Name',
          balance: 15.00,
          isAdmin: true,
          pin: hashedPin // frontend sending back unchanged pre-hashed PIN
        }
      };

      updateSingleCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          card: expect.objectContaining({
            rfid: '55555',
            ownerName: 'Updated Name',
            balance: 15.00,
            isAdmin: true,
            pin: hashedPin
          })
        })
      );

      const card = db.prepare("SELECT * FROM cards WHERE rfid = '55555'").get() as any;
      expect(card.pin).toBe(hashedPin);
    });

    it('should allow updating card with a new 6-digit PIN and hash it', () => {
      db.prepare(`
        INSERT INTO cards (rfid, ownerName, balance, isAdmin, pin)
        VALUES ('55555', 'Initial Name', 0, 0, NULL)
      `).run();

      mockReq = {
        params: { rfid: '55555' },
        body: {
          ownerName: 'Initial Name',
          balance: 0,
          isAdmin: false,
          pin: '987654' // changing to new 6-digit PIN
        }
      };

      updateSingleCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true })
      );

      const card = db.prepare("SELECT * FROM cards WHERE rfid = '55555'").get() as any;
      expect(card.pin).toHaveLength(64);
      expect(card.pin).not.toBe('987654');
    });
  });

  describe('updateSingleCard ownerName validation', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };
      mockNext = vi.fn();
      db.exec("DELETE FROM cards");
      db.prepare(`
        INSERT INTO cards (rfid, ownerName, balance, isAdmin)
        VALUES ('55555', 'Initial Name', 0, 0)
      `).run();
    });

    it('should return 400 error when ownerName is missing or empty', () => {
      mockReq = {
        params: { rfid: '55555' },
        body: {
          ownerName: '',
          balance: 10
        }
      };

      updateSingleCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or missing ownerName' });
    });

    it('should return 400 error when ownerName is not a string', () => {
      mockReq = {
        params: { rfid: '55555' },
        body: {
          ownerName: 12345,
          balance: 10
        }
      };

      updateSingleCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or missing ownerName' });
    });

    it('should return 400 error when ownerName exceeds 100 characters', () => {
      mockReq = {
        params: { rfid: '55555' },
        body: {
          ownerName: 'a'.repeat(101),
          balance: 10
        }
      };

      updateSingleCard(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or missing ownerName' });
    });
  });
});

