import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { Request, Response } from 'express';
import { exportAllProfiles } from './parserController';
import { db, initDb } from '../db';

describe('parserController', () => {
  beforeAll(() => {
    initDb();
  });

  describe('exportAllProfiles', () => {
    let mockReq: Partial<Request>;
    let mockRes: Partial<Response>;

    beforeEach(() => {
      mockReq = {};
      mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn()
      };

      db.exec("DELETE FROM parser_versions");
      db.exec("DELETE FROM parser_profiles");
    });

    afterEach(() => {
      vi.clearAllMocks();
    });

    it('should export all profiles with their latest version config in a single query', () => {
      // Setup test profiles and versions
      db.prepare(`
        INSERT INTO parser_profiles (id, name, description, status, isActive)
        VALUES 
          ('p1', 'Profile 1', 'Desc 1', 'published', 1),
          ('p2', 'Profile 2', 'Desc 2', 'published', 0)
      `).run();

      // Profile 1 has version 1 and version 2
      db.prepare(`
        INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt)
        VALUES 
          ('v1_1', 'p1', 1, '{"version":1,"key":"old"}', 'Initial', '2026-01-01T00:00:00Z'),
          ('v1_2', 'p1', 2, '{"version":2,"key":"latest"}', 'Updated', '2026-01-02T00:00:00Z')
      `).run();

      // Profile 2 has only version 1
      db.prepare(`
        INSERT INTO parser_versions (id, profileId, versionNumber, configJson, changeNote, createdAt)
        VALUES 
          ('v2_1', 'p2', 1, '{"version":1,"key":"p2_val"}', 'Initial', '2026-01-01T00:00:00Z')
      `).run();

      exportAllProfiles(mockReq as Request, mockRes as Response);

      expect(mockRes.json).toHaveBeenCalledTimes(1);
      const bundle = (mockRes.json as any).mock.calls[0][0];

      expect(bundle.version).toBe('1.0');
      expect(bundle.type).toBe('LUNCHPAD_PARSER_BUNDLE');
      expect(bundle.exportedAt).toBeDefined();
      expect(bundle.profiles).toHaveLength(2);

      const profile1 = bundle.profiles.find((p: any) => p.id === 'p1');
      expect(profile1).toEqual({
        id: 'p1',
        name: 'Profile 1',
        description: 'Desc 1',
        isActive: 1,
        config: { version: 2, key: 'latest' }
      });

      const profile2 = bundle.profiles.find((p: any) => p.id === 'p2');
      expect(profile2).toEqual({
        id: 'p2',
        name: 'Profile 2',
        description: 'Desc 2',
        isActive: 0,
        config: { version: 1, key: 'p2_val' }
      });
    });

    it('should handle profiles without versions by falling back to empty config', () => {
      db.prepare(`
        INSERT INTO parser_profiles (id, name, description, status, isActive)
        VALUES ('p3', 'Profile 3', 'No versions', 'draft', 0)
      `).run();

      exportAllProfiles(mockReq as Request, mockRes as Response);

      const bundle = (mockRes.json as any).mock.calls[0][0];
      expect(bundle.profiles).toHaveLength(1);
      expect(bundle.profiles[0]).toEqual({
        id: 'p3',
        name: 'Profile 3',
        description: 'No versions',
        isActive: 0,
        config: {}
      });
    });

    it('should handle database errors and return status 500', () => {
      const spy = vi.spyOn(db, 'prepare').mockImplementationOnce(() => {
        throw new Error('DB Error');
      });

      exportAllProfiles(mockReq as Request, mockRes as Response);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Failed to export bundle' });

      spy.mockRestore();
    });
  });
});
