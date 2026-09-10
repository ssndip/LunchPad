import { WebSocketServer, WebSocket } from "ws";

import { WsMessage } from "../src/types/websocket";

let wssInstance: WebSocketServer | null = null;

export const setWssInstance = (wss: WebSocketServer) => {
  wssInstance = wss;
};

export const broadcast = (data: WsMessage) => {
  if (!wssInstance) return;
  const message = JSON.stringify(data);
  wssInstance.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
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
    if (client.readyState === WebSocket.OPEN && (client as any).isAdmin) {
      client.send(message);
    }
  });
};
