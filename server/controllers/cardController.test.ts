import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { resetSingleBalance } from './cardController';
import { db } from '../db';
import { broadcast } from '../broadcast';

vi.mock('../db', () => ({
  db: {
    prepare: vi.fn(),
  },
}));

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

describe('cardController', () => {
  describe('resetSingleBalance', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        params: {}
      };

      mockRes = {
        json: vi.fn()
      };

      mockNext = vi.fn();

      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-01-01T12:00:00.000Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    it('should update the balance to 0 and broadcast for a given rfid', () => {
      mockReq.params = { rfid: '12345' };

      const mockRun = vi.fn();
      const mockAll = vi.fn().mockReturnValue([{ rfid: '12345', balance: 0 }]);
      vi.mocked(db.prepare).mockImplementation((query: string) => {
        if (query.includes("UPDATE cards SET balance = 0")) {
          return { run: mockRun } as any;
        } else if (query.includes("SELECT * FROM cards")) {
          return { all: mockAll } as any;
        }
        return {} as any;
      });

      resetSingleBalance(mockReq as Request, mockRes as Response, mockNext);

      expect(db.prepare).toHaveBeenCalledWith("UPDATE cards SET balance = 0, lastUpdated = ? WHERE LOWER(rfid) = ?");
      expect(mockRun).toHaveBeenCalledWith('2024-01-01T12:00:00.000Z', '12345');

      expect(broadcast).toHaveBeenCalledWith({ type: "CARDS_UPDATE" });

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        cards: [{ rfid: '12345', balance: 0, isAdmin: false }]
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should properly clean the rfid before updating', () => {
      mockReq.params = { rfid: '  ABcd 123!@#  ' };

      const mockRun = vi.fn();
      const mockAll = vi.fn().mockReturnValue([]);
      vi.mocked(db.prepare).mockImplementation((query: string) => {
        if (query.includes("UPDATE cards SET balance = 0")) {
          return { run: mockRun } as any;
        } else if (query.includes("SELECT * FROM cards")) {
          return { all: mockAll } as any;
        }
        return {} as any;
      });

      resetSingleBalance(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRun).toHaveBeenCalledWith('2024-01-01T12:00:00.000Z', 'abcd 123!@#');
    });

    it('should pass error to next if an exception is thrown', () => {
      mockReq.params = { rfid: '12345' };

      const error = new Error('Database error');
      vi.mocked(db.prepare).mockImplementationOnce(() => {
        throw error;
      });

      resetSingleBalance(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(broadcast).not.toHaveBeenCalled();
    });
  });
});
