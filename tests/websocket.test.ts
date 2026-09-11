/**
 * websocket.test.ts — Regression for an unhandled 'error' event taking the
 * whole server down.
 *
 * `ws` sockets are EventEmitters, and an EventEmitter with no 'error' listener
 * rethrows, which in Node means an uncaught exception and process exit. Nothing
 * in the server registered one, while the 30s heartbeat and every broadcast
 * called `send()` with no callback and no try/catch — so a client vanishing
 * mid-write (a tablet going to sleep, wifi dropping) could kill the server for
 * everyone.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import WebSocket, { WebSocketServer } from 'ws';
import type { AddressInfo } from 'net';
import { startServer } from '../server';
import { broadcast, setWssInstance } from '../server/broadcast';

process.env.NODE_ENV = 'test';

describe('broadcast resilience', () => {
  it('does not throw when a client send() fails, and still reaches the others', () => {
    const healthy = { readyState: WebSocket.OPEN, send: vi.fn() };
    const broken = {
      readyState: WebSocket.OPEN,
      send: vi.fn(() => { throw new Error('WebSocket is not open'); }),
    };

    setWssInstance({ clients: new Set([broken, healthy]) } as any);

    expect(() => broadcast({ type: 'STATUS_UPDATE', kioskOpen: true } as any)).not.toThrow();
    expect(broken.send).toHaveBeenCalled();
    expect(healthy.send).toHaveBeenCalled();
  });

  it('skips clients that are not open', () => {
    const closing = { readyState: WebSocket.CLOSING, send: vi.fn() };
    setWssInstance({ clients: new Set([closing]) } as any);

    broadcast({ type: 'STATUS_UPDATE', kioskOpen: true } as any);
    expect(closing.send).not.toHaveBeenCalled();
  });
});

describe('live socket error handling', () => {
  let httpServer: any;
  let wss: WebSocketServer;
  let url = '';

  beforeAll(async () => {
    const app = await startServer();
    httpServer = app.get('httpServer');
    wss = app.get('wss');
    setWssInstance(wss);

    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    url = `ws://127.0.0.1:${(httpServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  /** Connect and hand back the server's view of the socket. */
  const connect = async (): Promise<{ client: WebSocket; server: WebSocket }> => {
    const client = new WebSocket(url, { origin: 'http://localhost' });
    const server = await new Promise<WebSocket>((resolve, reject) => {
      wss.once('connection', (ws) => resolve(ws as WebSocket));
      client.once('error', reject);
    });
    return { client, server };
  };

  it('registers an error listener on every accepted socket', async () => {
    const { client, server } = await connect();
    expect(server.listenerCount('error')).toBeGreaterThan(0);
    client.terminate();
  });

  it('survives an error event on a live socket', async () => {
    const { client, server } = await connect();

    // What an abrupt disconnect looks like to `ws`. Without a listener this
    // is an uncaught exception and the process is gone.
    expect(() => server.emit('error', new Error('read ECONNRESET'))).not.toThrow();

    client.terminate();
  });

  it('survives a broadcast to a socket that died mid-flight', async () => {
    const { client, server } = await connect();

    // Force the socket into a state where send() rejects, as it would when the
    // peer has gone away but the server has not noticed yet.
    client.terminate();
    (server as any)._readyState = WebSocket.OPEN;
    (server as any)._socket = null;

    expect(() => broadcast({ type: 'STATUS_UPDATE', kioskOpen: false } as any)).not.toThrow();
  });
});
