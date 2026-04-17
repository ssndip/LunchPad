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
