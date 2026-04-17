import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { updateStatus, getStatus } from './statusController';
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

    // Reset shared state by calling updateStatus with a mocked req
    updateStatus({ body: { open: true } } as Request, { json: vi.fn() } as unknown as Response);
    vi.clearAllMocks(); // Clear the broadcast/json mock calls from setup
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('updateStatus', () => {
    it('should update kioskOpen to true and broadcast STATUS_UPDATE', () => {
      mockReq.body = { open: true };

      updateStatus(mockReq as Request, mockRes as Response);

      expect(broadcast).toHaveBeenCalledWith({ type: 'STATUS_UPDATE', data: { kioskOpen: true } });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, kioskOpen: true });
    });

    it('should update kioskOpen to false and broadcast STATUS_UPDATE', () => {
      mockReq.body = { open: false };

      updateStatus(mockReq as Request, mockRes as Response);

      expect(broadcast).toHaveBeenCalledWith({ type: 'STATUS_UPDATE', data: { kioskOpen: false } });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, kioskOpen: false });
    });

    it('should update kioskOpen to false if open is missing/falsy', () => {
      mockReq.body = {};

      updateStatus(mockReq as Request, mockRes as Response);

      expect(broadcast).toHaveBeenCalledWith({ type: 'STATUS_UPDATE', data: { kioskOpen: false } });
      expect(mockRes.json).toHaveBeenCalledWith({ success: true, kioskOpen: false });
    });
  });

  describe('getStatus', () => {
    it('should return current kioskOpen status when true', () => {
      updateStatus({ body: { open: true } } as Request, { json: vi.fn() } as unknown as Response);

      getStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ kioskOpen: true });
    });

    it('should return current kioskOpen status when false', () => {
      updateStatus({ body: { open: false } } as Request, { json: vi.fn() } as unknown as Response);

      getStatus(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith({ kioskOpen: false });
    });
  });
});
