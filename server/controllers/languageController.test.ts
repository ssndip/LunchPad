import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import { getLanguages, getLanguageData, importLanguage, deleteLanguage } from './languageController';
import { db } from '../db';
import { settings } from '../config';

vi.mock('../db', () => ({
  db: {
    prepare: vi.fn(),
  },
}));

vi.mock('../broadcast', () => ({
  broadcast: vi.fn(),
}));

vi.mock('../config', () => ({
  settings: {
    systemLanguage: 'en',
  },
}));

describe('languageController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {
      params: {},
      body: {},
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('deleteLanguage', () => {
    it('should return 403 when trying to delete static English', () => {
      mockReq.params = { code: 'en' };
      deleteLanguage(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Cannot delete static languages" });
    });

    it('should return 403 when trying to delete static Bulgarian', () => {
      mockReq.params = { code: 'bg' };
      deleteLanguage(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: "Cannot delete static languages" });
    });

    it('should delete custom language and fallback to en if active', () => {
      mockReq.params = { code: 'fr' };
      settings.systemLanguage = 'fr';

      const mockRun = vi.fn();
      const mockGet = vi.fn();
      const mockPrepare = vi.fn().mockReturnValue({ run: mockRun, get: mockGet });
      vi.mocked(db.prepare).mockImplementation(mockPrepare);

      deleteLanguage(mockReq as Request, mockRes as Response);

      // Verify DB delete and DB update calls
      expect(db.prepare).toHaveBeenCalledWith("DELETE FROM custom_languages WHERE code = ?");
      expect(mockRun).toHaveBeenCalledWith('fr');
      expect(db.prepare).toHaveBeenCalledWith("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
      expect(mockRun).toHaveBeenCalledWith('system_language', 'en');
      expect(settings.systemLanguage).toBe('en');
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
    });
  });
});
