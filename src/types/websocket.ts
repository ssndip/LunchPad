import { MenuItem } from '../types';

export type WsMessageType = 
  | 'INITIAL_STATE'
  | 'PING'
  | 'PONG'
  | 'MENU_UPDATE'
  | 'NEW_ORDER'
  | 'ORDER_UPDATE'
  | 'STATUS_UPDATE'
  | 'SETTINGS_UPDATE'
  | 'PWA_SETTINGS_UPDATE'
  | 'CARDS_UPDATE';

export interface BaseWsMessage {
  type: WsMessageType;
}

export interface CardsUpdateMessage extends BaseWsMessage {
  type: 'CARDS_UPDATE';
}

export interface InitialStateMessage extends BaseWsMessage {
  type: 'INITIAL_STATE';
  menu: MenuItem[];
  orders: any[];
  kioskOpen: boolean;
  cards: any[];
  deliveryFee: number;
  packagingFee: number;
  menuVersion: number;
  menuDate?: string;
  globalAccess: boolean;
  publicAccessCode?: string;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  systemLanguage?: string;
}

export interface PingMessage extends BaseWsMessage {
  type: 'PING';
  ts: number;
}

export interface PongMessage extends BaseWsMessage {
  type: 'PONG';
}

export interface MenuUpdateMessage extends BaseWsMessage {
  type: 'MENU_UPDATE';
  menu: MenuItem[];
  version: number;
  menuDate?: string;
}

export interface NewOrderMessage extends BaseWsMessage {
  type: 'NEW_ORDER';
  data: any;
}

export interface OrderUpdateMessage extends BaseWsMessage {
  type: 'ORDER_UPDATE';
  orders: any[];
}

export interface StatusUpdateMessage extends BaseWsMessage {
  type: 'STATUS_UPDATE';
  kioskOpen: boolean;
}

export interface SettingsUpdateMessage extends BaseWsMessage {
  type: 'SETTINGS_UPDATE';
  settings: {
    globalAccess?: boolean;
    publicAccessCode?: string;
    orderButtonEnabled?: boolean;
    testModeEnabled?: boolean;
  };
}

export interface PwaSettingsUpdateMessage extends BaseWsMessage {
  type: 'PWA_SETTINGS_UPDATE';
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
}

export type WsMessage = 
  | InitialStateMessage 
  | PingMessage 
  | PongMessage 
  | MenuUpdateMessage 
  | NewOrderMessage
  | OrderUpdateMessage 
  | StatusUpdateMessage 
  | SettingsUpdateMessage
  | PwaSettingsUpdateMessage
  | CardsUpdateMessage;
