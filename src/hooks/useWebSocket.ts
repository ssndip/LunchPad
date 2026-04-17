/**
 * useWebSocket.ts — WebSocket connection + auto-reconnect logic.
 * Enhanced with Heartbeat and Exponential Backoff.
 */
import { useRef, useEffect } from 'react';
import { MenuItem, Card, Order } from '../types';
import { WsMessage, InitialStateMessage } from '../types/websocket';

export interface WsHandlers {
  onInitialState: (data: InitialStateMessage) => void;
  onMenuUpdate: (data: { menu: MenuItem[]; menuVersion: number; menuDate?: string }) => void;
  onStatusUpdate: (data: {
    kioskOpen?: boolean;
    orderButtonEnabled?: boolean;
    testModeEnabled?: boolean;
    globalAccess?: boolean;
  }) => void;
  onCardsUpdate: () => void;
  onOrderUpdate: (orders: any[]) => void;
  onNewOrder: (order: any) => void;
  onPWASettingsUpdate: (data: { kioskModeEnabled?: boolean; allowPWAInstall?: boolean }) => void;
  onConnectionError: (msg: string | null) => void;
}

export function useWebSocket(handlers: WsHandlers, token?: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const reconnectDelay = useRef(2000);
  const maxReconnectDelay = 30000;

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let heartbeatTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let url = `${protocol}//${window.location.host}`;
      if (token) {
        url += `?token=${encodeURIComponent(token)}`;
      }
      console.log(`[WS] Connecting to ${url}...`);
      
      ws.current = new WebSocket(url);

      ws.current.onopen = () => {
        console.log('[WS] Connected');
        reconnectDelay.current = 2000; // Reset delay on success
        handlersRef.current.onConnectionError(null);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        
        // Setup client-side heartbeat monitor
        const resetHeartbeat = () => {
          if (heartbeatTimer) clearTimeout(heartbeatTimer);
          heartbeatTimer = setTimeout(() => {
            console.warn('[WS] Heartbeat timeout. Closing...');
            ws.current?.close();
          }, 45000); // Expect a ping every 30s, give 15s grace
        };
        resetHeartbeat();
        (ws.current as any)._resetHeartbeat = resetHeartbeat;
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data as string) as WsMessage;
        const h = handlersRef.current;

        // Reset heartbeat on any message (especially PING)
        if ((ws.current as any)._resetHeartbeat) {
          (ws.current as any)._resetHeartbeat();
        }

        switch (message.type) {
          case 'PING':
            ws.current?.send(JSON.stringify({ type: 'PONG' }));
            break;

          case 'INITIAL_STATE':
            h.onInitialState(message);
            break;

          case 'MENU_UPDATE':
            h.onMenuUpdate({ 
              menu: message.menu, 
              menuVersion: message.version,
              menuDate: message.menuDate
            });
            break;

          case 'NEW_ORDER':
            h.onNewOrder(message.data);
            break;

          case 'ORDER_UPDATE':
            h.onOrderUpdate(message.orders);
            break;

          case 'CARDS_UPDATE' as any: 
            h.onCardsUpdate();
            break;

          case 'STATUS_UPDATE':
            h.onStatusUpdate({ kioskOpen: message.kioskOpen });
            break;

          case 'SETTINGS_UPDATE':
            h.onStatusUpdate(message.settings);
            break;

          case 'PWA_SETTINGS_UPDATE':
            h.onPWASettingsUpdate({
              kioskModeEnabled: message.kioskModeEnabled,
              allowPWAInstall: message.allowPWAInstall
            });
            break;
        }
      };

      ws.current.onclose = (event) => {
        console.log('[WS] Disconnected. Code:', event.code);
        if (heartbeatTimer) clearTimeout(heartbeatTimer);

        if (event.code === 4003) {
          handlersRef.current.onConnectionError('Global Access Disabled');
        } else if (event.code === 4001) {
          handlersRef.current.onConnectionError('PUBLIC_ACCESS_REQUIRED');
        } else {
          handlersRef.current.onConnectionError('Reconnecting...');
          reconnectTimer = setTimeout(() => {
            connect();
            // Exponential backoff
            reconnectDelay.current = Math.min(reconnectDelay.current * 1.5, maxReconnectDelay);
          }, reconnectDelay.current);
        }
      };

      ws.current.onerror = (err) => {
        console.error('[WS] Error:', err);
        ws.current?.close();
      };
    };

    connect();

    return () => {
      ws.current?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
    };
  }, []);

  return ws;
}
