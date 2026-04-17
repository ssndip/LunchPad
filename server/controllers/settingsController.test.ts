import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { updatePin } from './settingsController';
import * as config from '../config';

vi.mock('../config', () => ({
  hashAndSetAdminPin: vi.fn(),
}));

describe('settingsController', () => {
  describe('updatePin', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;
    let mockNext: NextFunction;

    beforeEach(() => {
      mockReq = {
        body: {}
      };

      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      mockNext = vi.fn();
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should return 400 when newPin is missing', () => {
      mockReq.body = {};

      updatePin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid PIN" });
      expect(config.hashAndSetAdminPin).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 400 when newPin is not a string', () => {
      mockReq.body = { newPin: 1234 };

      updatePin(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Invalid PIN" });
      expect(config.hashAndSetAdminPin).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call hashAndSetAdminPin and return success for a valid newPin', () => {
      mockReq.body = { newPin: '5678' };

      updatePin(mockReq as Request, mockRes as Response, mockNext);

      expect(config.hashAndSetAdminPin).toHaveBeenCalledWith('5678');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass error to next if an exception is thrown', () => {
      mockReq.body = { newPin: '5678' };

      const error = new Error('Test error');
      vi.mocked(config.hashAndSetAdminPin).mockImplementationOnce(() => {
        throw error;
      });

      updatePin(mockReq as Request, mockRes as Response, mockNext);

      expect(config.hashAndSetAdminPin).toHaveBeenCalledWith('5678');
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });
});
