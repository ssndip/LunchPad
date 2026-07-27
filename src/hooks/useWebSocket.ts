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
    adminWhitelistEnabled?: boolean;
  }) => void;
  onCardsUpdate: () => void;
  onOrderUpdate: (orders: any[]) => void;
  onNewOrder: (order: any) => void;
  onPWASettingsUpdate: (data: { kioskModeEnabled?: boolean; allowPWAInstall?: boolean }) => void;
  onLanguagesUpdated: () => void;
  onConnectionError: (msg: string | null) => void;
}

export function useWebSocket(handlers: WsHandlers, token?: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const retryCount = useRef(0);

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
        retryCount.current = 0; // Reset retries on success
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
          
          case 'LANGUAGES_UPDATED':
            h.onLanguagesUpdated();
            break;
        }
      };

      ws.current.onclose = (event) => {
        console.log('[WS] Disconnected. Code:', event.code);
        if (heartbeatTimer) clearTimeout(heartbeatTimer);

        if (event.code === 4003) {
          handlersRef.current.onConnectionError('Access Denied');
        } else {
          handlersRef.current.onConnectionError('Reconnecting...');
          // Exponential backoff with random jitter
          const delay = Math.min(1000 * Math.pow(2, retryCount.current), 30000) + Math.random() * 1000;
          console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (retry #${retryCount.current + 1})...`);
          
          reconnectTimer = setTimeout(() => {
            retryCount.current += 1;
            connect();
          }, delay);
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
