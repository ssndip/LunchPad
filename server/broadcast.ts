import { WebSocketServer, WebSocket } from "ws";

import { WsMessage } from "../src/types/websocket";

let wssInstance: WebSocketServer | null = null;

export const setWssInstance = (wss: WebSocketServer) => {
  wssInstance = wss;
};

/**
 * Write to one client without letting its failure escape.
 *
 * `send()` on a socket whose peer has gone away routes the failure to the
 * socket's 'error' event, and an EventEmitter with no 'error' listener rethrows
 * — which in Node is an uncaught exception that ends the process. One sleeping
 * tablet could therefore take the kiosk server down for everyone, so every
 * write supplies a callback (which suppresses the event) and is wrapped for the
 * synchronous throws `ws` raises before it ever gets that far.
 */
export const safeSend = (client: WebSocket, message: string) => {
  if (client.readyState !== WebSocket.OPEN) return;
  try {
    client.send(message, (err?: Error) => {
      if (err) console.warn(`[WS] Dropped a frame for a closing client: ${err.message}`);
    });
  } catch (err: any) {
    console.warn(`[WS] Send failed for a client: ${err?.message || err}`);
  }
};

export const broadcast = (data: WsMessage) => {
  if (!wssInstance) return;
  const message = JSON.stringify(data);
  wssInstance.clients.forEach(client => {
    safeSend(client, message);
  });
};

/**
 * Broadcast to admin sessions only.
 *
 * Sockets are tagged with `isAdmin` at connection time in server.ts after the
 * JWT is verified. Used for settings that must not reach kiosk clients, such as
 * the AI provider key and the admin IP whitelist.
 */
export const broadcastAdmin = (data: WsMessage) => {
  if (!wssInstance) return;
  const message = JSON.stringify(data);
  wssInstance.clients.forEach(client => {
    if ((client as any).isAdmin) {
      safeSend(client, message);
    }
  });
};
