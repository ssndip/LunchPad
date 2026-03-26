export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  available: boolean;
  category: string;
}

export interface Order {
  id: number;
  rfid: string;
  ownerName?: string;
  items: MenuItem[];
  timestamp: string;
  status: 'pending' | 'completed' | 'cancelled';
}

export interface Card {
  rfid: string;
  ownerName: string;
}

export type AppState = 'kiosk' | 'manager';
