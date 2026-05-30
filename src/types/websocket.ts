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
  | 'LANGUAGES_UPDATED'
  | 'CARDS_UPDATE';

export interface BaseWsMessage {
  type: WsMessageType;
}

export interface CardsUpdateMessage extends BaseWsMessage {
  type: 'CARDS_UPDATE';
}

export interface LanguagesUpdatedMessage extends BaseWsMessage {
  type: 'LANGUAGES_UPDATED';
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
  adminWhitelistEnabled: boolean;
  orderButtonEnabled: boolean;
  testModeEnabled: boolean;
  kioskModeEnabled: boolean;
  allowPWAInstall: boolean;
  systemLanguage?: string;
  bgnEnabled?: boolean;
  adminWhitelist?: string;
  announcement?: string;
  aiProvider?: string;
  aiApiKey?: string;
  aiModel?: string;
  aiEndpoint?: string;
  preIdentificationEnabled?: boolean;
  kioskAutoTiming?: boolean;
  kioskOpenTime?: string;
  kioskCloseTime?: string;
  kioskCloseDay?: number;
  publicAccessRequired?: boolean;
  publicAccessCode?: string;
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
    adminWhitelistEnabled?: boolean;
    orderButtonEnabled?: boolean;
    testModeEnabled?: boolean;
    preIdentificationEnabled?: boolean;
    systemLanguage?: string;
    bgnEnabled?: boolean;
    adminWhitelist?: string;
    announcement?: string;
    aiProvider?: string;
    aiApiKey?: string;
    aiModel?: string;
    aiEndpoint?: string;
    kioskAutoTiming?: boolean;
    kioskOpenTime?: string;
    kioskCloseTime?: string;
    kioskCloseDay?: number;
    packagingFee?: number;
    deliveryFee?: number;
    currency?: string;
    publicAccessRequired?: boolean;
    publicAccessCode?: string;
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
  | LanguagesUpdatedMessage
  | CardsUpdateMessage;
