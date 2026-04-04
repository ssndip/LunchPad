/**
 * useWebSocket.ts — WebSocket connection + auto-reconnect logic.
 */
import { useRef, useEffect } from 'react';
import { MenuItem } from '../types';

export interface WsHandlers {
  onInitialState: (data: {
    menu: MenuItem[];
    kioskOpen: boolean;
    globalAccess: boolean;
    orderButtonEnabled: boolean;
    testModeEnabled: boolean;
  }) => void;
  onMenuUpdate: (menu: MenuItem[]) => void;
  onStatusUpdate: (data: {
    kioskOpen?: boolean;
    orderButtonEnabled?: boolean;
    testModeEnabled?: boolean;
  }) => void;
  onCardsUpdate: () => void;
  onConnectionError: (msg: string | null) => void;
}

export function useWebSocket(handlers: WsHandlers) {
  const ws = useRef<WebSocket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws.current = new WebSocket(`${protocol}//${window.location.host}`);

      ws.current.onopen = () => {
        console.log('[WS] Connected');
        if (reconnectTimer) clearTimeout(reconnectTimer);
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data as string);
        const h = handlersRef.current;

        switch (message.type) {
          case 'INITIAL_STATE':
            h.onInitialState({
              menu: message.menu ?? [],
              kioskOpen: !!message.kioskOpen,
              globalAccess: !!message.globalAccess,
              orderButtonEnabled: !!message.orderButtonEnabled,
              testModeEnabled: !!message.testModeEnabled,
            });
            break;

          case 'MENU_UPDATE':
            h.onMenuUpdate(message.data);
            break;

          case 'CARDS_UPDATE':
            h.onCardsUpdate();
            break;

          case 'STATUS_UPDATE':
            h.onStatusUpdate(message.data);
            break;
        }
      };

      ws.current.onclose = (event) => {
        console.log('[WS] Disconnected. Code:', event.code);
        if (event.code === 4003) {
          handlersRef.current.onConnectionError('Global Access Disabled');
        } else {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };

      ws.current.onerror = () => {
        ws.current?.close();
      };
    };

    connect();

    return () => {
      ws.current?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, []);

  return ws;
}
