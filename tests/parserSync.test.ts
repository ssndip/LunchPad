/**
 * parserSync.test.ts — 9b: the menu parser's configuration lives on the server.
 *
 * It used to live only in localStorage, so it did not follow the admin between
 * devices, did not survive clearing browser data, and — despite the Settings
 * backup panel listing "AI Parser Rules" as included — was not in a system
 * backup at all, because the `parser_profiles` table it exports held only a
 * seeded default.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { db } from '../server/db';
import {
  PARSER_CONFIG_PROFILE_ID,
  isEmptyParserConfig,
  parserConfigsEqual,
  pullParserConfig,
  pushParserConfig,
  readLocalParserConfig,
  syncParserConfig,
  writeLocalParserConfig,
} from '../src/utils/parserSync';

process.env.NODE_ENV = 'test';
process.env.ADMIN_PIN = '424242';

const adminToken = async (app: any): Promise<string> => {
  db.prepare("DELETE FROM settings WHERE key = ?").run("admin_pin");
  const res = await request(app).post('/api/auth/login').send({ pin: '424242' });
  return res.body.token;
};

const config = (presetName: string) => ({
  settings: {
    categories: { mains: { autoBox: true, hasSideDish: true } },
    sideDishKeyword: 'с гарнитура',
    sideDishKeywordEnabled: true,
    activePresetId: 'p1',
  },
  presets: [{ id: 'p1', name: presetName, preprocessRules: [], createdAt: '2026-09-17' }],
  profiles: [],
}) as any;

describe('parser config comparison', () => {
  it('treats key order as irrelevant', () => {
    const a = { settings: { x: 1, y: 2 }, presets: [], profiles: [] } as any;
    const b = { profiles: [], presets: [], settings: { x: 1, y: 2 } } as any;
    expect(parserConfigsEqual(a, b)).toBe(true);
  });

  it('notices a real difference', () => {
    expect(parserConfigsEqual(config('A'), config('B'))).toBe(false);
  });

  it('counts a config with no presets or snapshots as empty', () => {
    // Category settings always exist (defaults), so they cannot tell a
    // configured browser from an untouched one.
    expect(isEmptyParserConfig({ settings: { anything: true }, presets: [], profiles: [] } as any)).toBe(true);
    expect(isEmptyParserConfig(config('A'))).toBe(false);
    expect(isEmptyParserConfig(null)).toBe(true);
  });
});

describe('parser config round-trips through the server', () => {
  let app: any;
  let token: string;

  beforeEach(async () => {
    app = await startServer();
    token = await adminToken(app);
    localStorage.clear();
    db.prepare("DELETE FROM parser_versions WHERE profileId = ?").run(PARSER_CONFIG_PROFILE_ID);
    db.prepare("DELETE FROM parser_profiles WHERE id = ?").run(PARSER_CONFIG_PROFILE_ID);
    // The client's api layer talks to this server through supertest.
    vi.stubGlobal('fetch', (url: string, init?: any) =>
      request(app)[(init?.method || 'GET').toLowerCase() as 'get']
        (String(url))
        .set(init?.headers || {})
        .send(init?.body ? JSON.parse(init.body) : undefined)
        .then((res: any) => new Response(JSON.stringify(res.body), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('returns null before anything has been pushed', async () => {
    expect(await pullParserConfig(token)).toBeNull();
  });

  it('pushes and pulls back the same configuration', async () => {
    await pushParserConfig(token, config('Canteen format'));
    const pulled = await pullParserConfig(token);

    expect(pulled).not.toBeNull();
    expect(parserConfigsEqual(pulled, config('Canteen format'))).toBe(true);
  });

  it('records each push as a new version, so the history survives', async () => {
    await pushParserConfig(token, config('First'));
    await pushParserConfig(token, config('Second'));

    const versions = db
      .prepare("SELECT versionNumber FROM parser_versions WHERE profileId = ? ORDER BY versionNumber")
      .all(PARSER_CONFIG_PROFILE_ID) as any[];
    expect(versions.map(v => v.versionNumber)).toEqual([1, 2]);

    // A pull reads the latest.
    const pulled = await pullParserConfig(token);
    expect(pulled!.presets[0].name).toBe('Second');
  });

  it('now travels in a system backup, which the Settings panel always claimed', async () => {
    await pushParserConfig(token, config('Canteen format'));

    const res = await request(app).get('/api/system/backup').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const profiles = res.body.data.parser_profiles as any[];
    const versions = res.body.data.parser_versions as any[];
    expect(profiles.some(p => p.id === PARSER_CONFIG_PROFILE_ID)).toBe(true);
    expect(
      versions.some(v => v.profileId === PARSER_CONFIG_PROFILE_ID && v.configJson.includes('Canteen format')),
    ).toBe(true);
  });
});

describe('first reconciliation on entering the tab', () => {
  let app: any;
  let token: string;

  beforeEach(async () => {
    app = await startServer();
    token = await adminToken(app);
    localStorage.clear();
    db.prepare("DELETE FROM parser_versions WHERE profileId = ?").run(PARSER_CONFIG_PROFILE_ID);
    db.prepare("DELETE FROM parser_profiles WHERE id = ?").run(PARSER_CONFIG_PROFILE_ID);
    vi.stubGlobal('fetch', (url: string, init?: any) =>
      request(app)[(init?.method || 'GET').toLowerCase() as 'get']
        (String(url))
        .set(init?.headers || {})
        .send(init?.body ? JSON.parse(init.body) : undefined)
        .then((res: any) => new Response(JSON.stringify(res.body), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('seeds an empty server from this browser', async () => {
    writeLocalParserConfig(config('From this device'));

    const outcome = await syncParserConfig(token);

    expect(outcome.kind).toBe('pushed');
    expect((await pullParserConfig(token))!.presets[0].name).toBe('From this device');
  });

  it('fills a fresh browser from the server', async () => {
    await pushParserConfig(token, config('From the server'));
    localStorage.clear();

    const outcome = await syncParserConfig(token);

    expect(outcome.kind).toBe('pulled');
    // Written through to localStorage, so the tab keeps working offline.
    expect(readLocalParserConfig().presets[0].name).toBe('From the server');
  });

  it('does nothing when both sides already agree', async () => {
    writeLocalParserConfig(config('Same'));
    await pushParserConfig(token, config('Same'));

    expect((await syncParserConfig(token)).kind).toBe('in-sync');
  });

  it('reports a conflict instead of silently destroying either side', async () => {
    writeLocalParserConfig(config('Local work'));
    await pushParserConfig(token, config('Server work'));

    const outcome = await syncParserConfig(token);

    expect(outcome.kind).toBe('conflict');
    // Neither copy was touched: the admin still has both to choose between.
    expect(readLocalParserConfig().presets[0].name).toBe('Local work');
    expect((await pullParserConfig(token))!.presets[0].name).toBe('Server work');
  });

  it('reports a failure rather than wiping local rules when the server is unreachable', async () => {
    writeLocalParserConfig(config('Local work'));
    vi.stubGlobal('fetch', () => Promise.reject(new TypeError('offline')));

    const outcome = await syncParserConfig(token);

    expect(outcome.kind).toBe('failed');
    expect(readLocalParserConfig().presets[0].name).toBe('Local work');
  });
});
