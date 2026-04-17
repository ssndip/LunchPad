import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { updateStatus } from './statusController';
import { broadcast } from '../broadcast';

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

describe('statusController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      body: {}
    };

    mockRes = {
      json: vi.fn()
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateStatus', () => {
    it('should set kioskOpen to true and broadcast STATUS_UPDATE when req.body.open is true', () => {
      mockReq.body = { open: true };

      updateStatus(mockReq as Request, mockRes as Response);

      expect(broadcast).toHaveBeenCalledWith({ type: 'STATUS_UPDATE', data: { kioskOpen: true } });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, kioskOpen: true });
    });

    it('should set kioskOpen to false and broadcast STATUS_UPDATE when req.body.open is false', () => {
      mockReq.body = { open: false };

      updateStatus(mockReq as Request, mockRes as Response);

      expect(broadcast).toHaveBeenCalledWith({ type: 'STATUS_UPDATE', data: { kioskOpen: false } });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, kioskOpen: false });
    });

    it('should set kioskOpen to false when req.body.open is undefined or falsy', () => {
      mockReq.body = {};

      updateStatus(mockReq as Request, mockRes as Response);

      expect(broadcast).toHaveBeenCalledWith({ type: 'STATUS_UPDATE', data: { kioskOpen: false } });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, kioskOpen: false });
    });
  });
});
