import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { startServer } from '../server';
import { settings, setAiApiKeyConfig } from '../server/config';
import { buildClientState } from '../server/clientState';

describe('Public bootstrap payload does not leak secrets', () => {
  let app: any;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = await startServer();
    // Give the server a non-empty key so an accidental leak would be visible.
    setAiApiKeyConfig('sk-test-should-never-be-served-publicly');
  });

  it('GET /api/init omits the AI API key', async () => {
    const res = await request(app).get('/api/init');
    expect(res.status).toBe(200);
    expect(res.body.aiApiKey).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('sk-test-should-never-be-served-publicly');
  });

  it('GET /api/init omits the admin IP whitelist', async () => {
    const res = await request(app).get('/api/init');
    expect(res.body.adminWhitelist).toBeUndefined();
  });

  it('GET /api/init still reports whether an AI key is configured', async () => {
    const res = await request(app).get('/api/init');
    expect(res.body.aiApiKeyConfigured).toBe(true);
  });

  it('GET /api/init still carries the fields the kiosk needs to boot', async () => {
    const res = await request(app).get('/api/init');
    for (const field of [
      'menu',
      'menuVersion',
      'kioskOpen',
      'orderButtonEnabled',
      'systemLanguage',
      'deliveryFee',
      'packagingFee',
    ]) {
      expect(res.body[field], `missing field: ${field}`).toBeDefined();
    }
  });
});

describe('buildClientState', () => {
  beforeAll(() => {
    setAiApiKeyConfig('sk-admin-visible');
  });

  it('exposes the AI key to admin sessions', () => {
    const state = buildClientState({ isAdmin: true }) as any;
    expect(state.aiApiKey).toBe('sk-admin-visible');
    expect(state.adminWhitelist).toBe(settings.adminWhitelist);
  });

  it('omits secrets entirely for non-admins rather than blanking them', () => {
    const state = buildClientState({ isAdmin: false }) as any;
    // `undefined` (not '') matters: the client hydration guards are
    // `if (data.x !== undefined)`, so omission leaves existing state intact.
    expect('aiApiKey' in state).toBe(false);
    expect('adminWhitelist' in state).toBe(false);
  });

  it('reports aiApiKeyConfigured as false when no key is set', () => {
    setAiApiKeyConfig('');
    expect(buildClientState({ isAdmin: false }).aiApiKeyConfigured).toBe(false);
    setAiApiKeyConfig('sk-admin-visible');
  });
});
