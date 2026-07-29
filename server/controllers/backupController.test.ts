import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { listSystemBackups, restoreSystemBackup } from './backupController';
import { db } from '../db';

vi.mock('../db', () => ({
  db: {
    close: vi.fn(),
  },
}));

describe('backupController', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = {};
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('listSystemBackups', () => {
    it('should return empty array if backups directory does not exist', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      listSystemBackups(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should return array of backup metadata sorted by createdAt descending', () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readdirSync').mockReturnValue([
        'lunchpad_2026-01-01.db' as any,
        'lunchpad_2026-01-02.db' as any,
        'ignore_this.txt' as any,
      ]);

      vi.spyOn(fs, 'statSync').mockImplementation((filePath: fs.PathLike) => {
        const p = filePath.toString();
        if (p.includes('lunchpad_2026-01-01.db')) {
          return { size: 1024, mtime: new Date('2026-01-01T10:00:00Z') } as fs.Stats;
        }
        return { size: 2048, mtime: new Date('2026-01-02T10:00:00Z') } as fs.Stats;
      });

      listSystemBackups(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledWith([
        {
          filename: 'lunchpad_2026-01-02.db',
          sizeBytes: 2048,
          createdAt: new Date('2026-01-02T10:00:00Z').toISOString(),
        },
        {
          filename: 'lunchpad_2026-01-01.db',
          sizeBytes: 1024,
          createdAt: new Date('2026-01-01T10:00:00Z').toISOString(),
        },
      ]);
    });
  });

  describe('restoreSystemBackup', () => {
    it('should return 404 if backup file does not exist or filename does not end with .db', () => {
      mockReq.params = { filename: 'nonexistent.db' };
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      restoreSystemBackup(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Backup file not found' });
    });

    it('should return 404 if filename contains path traversal delimiters', () => {
      mockReq.params = { filename: '../secret.db' };
      const existsSpy = vi.spyOn(fs, 'existsSync');

      restoreSystemBackup(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Backup file not found' });
      expect(existsSpy).not.toHaveBeenCalled();
    });

    it('should close db, copy file, and return success', () => {
      mockReq.params = { filename: 'lunchpad_2026-01-01.db' };
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      const copyFileSyncSpy = vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {});

      restoreSystemBackup(mockReq as Request, mockRes as Response);

      expect(db.close).toHaveBeenCalled();
      expect(copyFileSyncSpy).toHaveBeenCalled();
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'System database successfully restored. Server restarting...',
      });
    });

    it('should return 500 if copyFileSync fails during restore', () => {
      mockReq.params = { filename: 'lunchpad_2026-01-01.db' };
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'copyFileSync').mockImplementation(() => {
        throw new Error('Disk error');
      });

      restoreSystemBackup(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Disk error' });
    });
  });
});
