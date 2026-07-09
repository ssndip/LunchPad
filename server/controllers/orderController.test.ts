import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { resetOrders } from './orderController';
import { db } from '../db';
import { broadcast } from '../broadcast';
import { getMenu } from './menuController';
import { kioskOpen } from './statusController';

// Mock dependencies
vi.mock('../db', () => {
  return {
    db: {
      transaction: vi.fn((cb) => cb), // return the callback itself so it can be executed
      prepare: vi.fn(),
    }
  };
});

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

vi.mock('./menuController', () => ({
  getMenu: vi.fn(),
}));

vi.mock('./statusController', () => ({
  kioskOpen: true,
}));

describe('orderController', () => {
  describe('resetOrders', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        json: vi.fn(),
      };
      mockNext = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should successfully reset orders, daily summaries, broadcast state, and return success', () => {
      // Setup mock data and behavior
      const mockRunOrders = vi.fn();
      const mockRunSummaries = vi.fn();
      const mockMenu = [{ id: 1, name: 'Test Menu Item' }];

      vi.mocked(getMenu).mockReturnValue(mockMenu as any);

      // Setup db.prepare mock to return different run functions based on the query
      vi.mocked(db.prepare).mockImplementation((query) => {
        if (query === 'DELETE FROM orders') {
          return { run: mockRunOrders } as any;
        }
        if (query === 'DELETE FROM daily_summaries') {
          return { run: mockRunSummaries } as any;
        }
        return { run: vi.fn() } as any;
      });

      // Execute controller function
      resetOrders(mockReq as Request, mockRes as Response, mockNext);

      // Verify transaction execution
      expect(db.transaction).toHaveBeenCalled();
      expect(db.prepare).toHaveBeenCalledWith('DELETE FROM orders');
      expect(mockRunOrders).toHaveBeenCalled();
      expect(db.prepare).toHaveBeenCalledWith('DELETE FROM daily_summaries');
      expect(mockRunSummaries).toHaveBeenCalled();

      // Verify broadcast
      expect(broadcast).toHaveBeenCalledWith(expect.objectContaining({
        type: 'INITIAL_STATE',
        menu: mockMenu,
        orders: [],
        kioskOpen: true
      }));

      // Verify response
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass error to next if an exception occurs during db operations', () => {
      const error = new Error('Database transaction failed');

      // Mock db.transaction to throw
      vi.mocked(db.transaction).mockImplementationOnce(() => {
        throw error;
      });

      resetOrders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
      expect(broadcast).not.toHaveBeenCalled();
    });
  });
});
